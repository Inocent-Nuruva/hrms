import { test, expect, type BrowserContext } from "@playwright/test";

const sid = "7a263955-39b8-4498-9ead-fc9e4925859e";
const user = {
  id: 7,
  fullName: "Session tester",
  email: "session@example.test",
  scope: "company",
  userType: "COMPANY_USER",
  dashboardType: "admin",
  companyId: 1,
  roles: ["ADMIN"],
  permissions: [
    "company_users:manage",
    "security_events:read",
    "company_dashboard:read",
  ],
  accessContextResolved: true,
};
function token(seconds: number, companyId = 1) {
  const b64 = (data: unknown) =>
    Buffer.from(JSON.stringify(data)).toString("base64url");
  return (
    b64({ alg: "RS256" }) +
    "." +
    b64({
      sub: 7,
      companyId,
      scope: "company",
      userType: "COMPANY_USER",
      sessionId: sid,
      exp: Math.floor(Date.now() / 1000) + seconds,
    }) +
    ".fixture"
  );
}
async function signedIn(
  context: BrowserContext,
  baseURL: string,
  seconds: number,
  account: typeof user & { availableCompanies?: { id: number; name: string }[] } = user,
) {
  const access = token(seconds);
  await context.addCookies([
    { name: "hrms_dashboard_auth", value: "1", url: baseURL },
  ]);
  await context.addInitScript(
    ({ access, user }) => {
      Object.defineProperty(navigator, "locks", {
        configurable: true,
        value: undefined,
      });
      if (!localStorage.getItem("hrms.auth.session.v1")) {
        localStorage.setItem(
          "hrms.auth.session.v1",
          JSON.stringify({
            tokens: { accessToken: access, refreshToken: "original" },
            user,
            credentialVersion: "1",
          }),
        );
        localStorage.setItem("hrms.admin.accessToken", access);
      }
    },
    { access, user: account },
  );
}
function deadlines(idle: number) {
  return {
    session_id: sid,
    server_time: Date.now(),
    idle_expires_at: Date.now() + idle,
    absolute_expires_at: Date.now() + 600000,
    refresh_expires_at: Date.now() + 600000,
    access_token_lifetime: "900s",
    refresh_token_lifetime: "7200s",
    refresh_token_lifetime_is_sliding: true,
    absolute_session_lifetime_seconds: 3600,
    idle_seconds: 300,
    max_sessions: 2,
  };
}

test("switches to a second membership from the account menu and loads its grants", async ({ page, context, baseURL }) => {
  const companies = [{id:1,name:"West office"},{id:2,name:"East office"}]
  const first = {...user,availableCompanies:companies}
  const second = {...first,companyId:2,dashboardType:"employee",roles:["EMPLOYEE"],permissions:["data_scope:self"]}
  let switched = false
  await signedIn(context,baseURL!,3600,first)
  await context.route("**/api/**",async route => {
    const path = new URL(route.request().url()).pathname
    if (path === "/api/auth/switch-company") {
      expect(route.request().postDataJSON()).toEqual({company_id:2})
      switched = true
      return route.fulfill({json:{scope:"company",dashboard_type:"employee",company:companies[1],
        companies:companies.map(c=>({companyId:c.id,companyName:c.name})),user:second,
        access_token:token(3600,2),refresh_token:"second-refresh"}})
    }
    if (["/api/auth/session","/api/users/me","/api/auth/me"].includes(path))
      return route.fulfill({json:switched?second:first})
    if (path === "/api/auth/session-policy") return route.fulfill({json:deadlines(300000)})
    return route.fulfill({json:{data:[]}})
  })
  await page.goto("/dashboard/settings")
  await page.getByRole("button",{name:/account menu/i}).click()
  await expect(page.getByRole("menuitem",{name:"West office (current)"})).toBeDisabled()
  await page.getByRole("menuitem",{name:"East office"}).click()
  await expect.poll(()=>switched).toBe(true)
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("hrms.auth.session.v1")||"{}").user))
    .toMatchObject({companyId:2,roles:["EMPLOYEE"],permissions:["data_scope:self"]})
})

test("linked company sign-in returns to HRMS for two-factor verification", async ({
  page,
  context,
  baseURL,
}) => {
  const state = "test-state-for-browser-signin";
  let browserKey = "";
  let confirmed = false;
  await context.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/sso/login/start") {
      const body = route.request().postDataJSON();
      expect(body.company).toBe("example");
      browserKey = body.browser_key;
      return route.fulfill({
        json: {
          authorization_url:
            "https://idp.example.test/authorize?state=" + state,
        },
      });
    }
    if (path === "/api/auth/sso/login/finish") {
      expect(route.request().postDataJSON()).toMatchObject({
        state,
        code: "fixture-code",
        browser_key: browserKey,
      });
      return route.fulfill({
        json: { requires2FA: true, tempToken: "fixture-challenge" },
      });
    }
    if (path === "/api/auth/2fa/complete-login") {
      expect(route.request().postDataJSON()).toEqual({
        tempToken: "fixture-challenge",
        code: "123456",
      });
      confirmed = true;
      return route.fulfill({
        json: { access_token: token(600), refresh_token: "replacement", user },
      });
    }
    if (path === "/api/auth/session") return route.fulfill({ json: user });
    if (path === "/api/auth/session-policy")
      return route.fulfill({ json: deadlines(300000) });
    return route.fulfill({ json: { data: user } });
  });
  await context.route("https://idp.example.test/authorize**", (route) =>
    route.fulfill({
      status: 302,
      headers: {
        location: new URL(
          "/auth/sso/callback?state=" + state + "&code=fixture-code",
          baseURL,
        ).href,
      },
    }),
  );
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in with SSO" }).click();
  await page.getByLabel("Company sign-in code").fill("example");
  await page
    .getByRole("button", { name: "Continue to identity provider" })
    .click();
  await expect(page.getByLabel("Authentication code")).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/sso\/callback$/);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("hrms.auth.session.v1") ?? "null")
          ?.tokens ?? null,
    ),
  ).toBeNull();
  await page.getByLabel("Authentication code").fill("123456");
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard/);
  expect(confirmed).toBe(true);
});

test("a cancelled provider sign-in offers password recovery", async ({
  page,
}) => {
  await page.goto("/auth/sso/callback?error=access_denied");
  await page.getByRole("link", { name: "Return to sign in" }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Forgot password?" }),
  ).toBeVisible();
});

test("two tabs without Web Locks share one refresh", async ({
  context,
  baseURL,
}) => {
  await signedIn(context, baseURL!, 12);
  let count = 0;
  await context.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/refresh") {
      count++;
      // Keep the first rotation pending until both tabs can contend for the same token.
      await new Promise((resolve) => setTimeout(resolve, 450));
      return route.fulfill({
        status: count === 1 ? 201 : 401,
        json: { access_token: token(600), refresh_token: "replacement", user },
      });
    }
    if (path === "/api/auth/session") return route.fulfill({ json: user });
    if (path === "/api/auth/session-policy")
      return route.fulfill({ json: deadlines(300000) });
    return route.fulfill({ json: { data: user } });
  });
  const pages = await Promise.all([context.newPage(), context.newPage()]);
  await Promise.all(
    pages.map((p) =>
      p.goto("/auth/reset-password", { waitUntil: "domcontentloaded" }),
    ),
  );
  for (const p of pages)
    await expect
      .poll(() =>
        p.evaluate(
          () =>
            JSON.parse(localStorage.getItem("hrms.auth.session.v1") ?? "null")
              ?.tokens?.refreshToken,
        ),
      )
      .toBe("replacement");
  expect(count).toBe(1);
});

for (const [device, width, height] of [
  ["desktop", 1440, 900],
  ["phone", 390, 844],
] as const) {
  test(
    device + " sign-in, expiry warning and company controls",
    async ({ page, context, baseURL }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/login", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Sign in with SSO" }).click();
      await expect(page.getByLabel("Company sign-in code")).toBeVisible();
      await signedIn(context, baseURL!, 600);
      let idle = 45000,
        activity = 0;
      await context.route("**/api/**", async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === "/api/auth/sessions/activity") {
          idle = 300000;
          activity++;
          return route.fulfill({ json: deadlines(idle) });
        }
        if (url.pathname === "/api/auth/session") return route.fulfill({ json: user });
        if (url.pathname === "/api/auth/session-policy")
          return route.fulfill({ json: deadlines(idle) });
        if (url.pathname === "/api/users/me")
          return route.fulfill({ json: { data: user } });
        if (url.pathname === "/api/auth/sso/provider")
          return route.fulfill({
            json: {
              issuer: "",
              client_id: "",
              configured: false,
              enabled: false,
              tested_at: null,
              redirect_uri: "https://hrms.example.test/auth/sso/callback",
            },
          });
        return route.fulfill({ json: { data: [], items: [], total: 0 } });
      });
      await page.goto("/dashboard/settings?section=security&tab=devices", {
        waitUntil: "domcontentloaded",
      });
      const stay = page.getByRole("button", { name: "Stay signed in" });
      await expect(stay).toBeVisible({ timeout: 60000 });
      await stay.click();
      await expect(stay).toBeHidden();
      expect(activity).toBeGreaterThan(0);
      await page
        .getByText("Company identity provider", { exact: true })
        .click();
      await expect(page.getByLabel("Issuer URL")).toBeVisible();
      await expect(page.getByLabel("Client secret")).toHaveAttribute(
        "type",
        "password",
      );
      await expect(
        page.getByText("Session policy", { exact: true }),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBeLessThanOrEqual(1);
    },
  );
}
