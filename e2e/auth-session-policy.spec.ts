import { test, expect, type BrowserContext } from "@playwright/test";

const sid = "7a263955-39b8-4498-9ead-fc9e4925859e";
const user = {
  id: 7,
  fullName: "Session tester",
  email: "session@example.test",
  scope: "company",
  dashboardType: "admin",
  companyId: 1,
  roles: ["ADMIN"],
  permissions: [
    "manage_company_users",
    "security_events:read",
    "view_company_dashboard",
  ],
  accessContextResolved: true,
};
function token(seconds: number) {
  const b64 = (data: unknown) =>
    Buffer.from(JSON.stringify(data)).toString("base64url");
  return (
    b64({ alg: "RS256" }) +
    "." +
    b64({
      sub: 7,
      companyId: 1,
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
    { access, user },
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
