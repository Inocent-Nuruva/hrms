import { expect, test, type Page } from "@playwright/test";
import { DASHBOARD_AUTH_COOKIE } from "../src/lib/dashboard-permissions";
async function prepare(page: Page) {
  const permissions = [
    "company_dashboard:read",
    "company_data:read",
    "data_scope:company",
    "forms_feedback:manage",
  ];
  const user = {
    id: 90,
    fullName: "Test HR",
    email: "forms@example.test",
    roles: ["HR_MANAGER"],
    permissions,
    scope: "company",
    companyId: 10,
    company_id: 10,
    dashboardType: "admin",
    accessContextResolved: true,
  };
  const token = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: 90, scope: "company", userType: "COMPANY_USER", companyId: 10, companyMembershipId: 90, roles: user.roles, permissions, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.fixture`;
  await page.context().addCookies([
    {
      name: DASHBOARD_AUTH_COOKIE,
      value: "1",
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    },
  ]);
  await page.addInitScript(
    ({ user, token, permissions }) => {
      localStorage.setItem(
        "ess.auth.tokens",
        JSON.stringify({ accessToken: token, refreshToken: "fixture" }),
      );
      localStorage.setItem("ess.auth.user", JSON.stringify(user));
      localStorage.setItem("hrms.admin.accessToken", token);
      sessionStorage.setItem(
        "hrms.dashboard.actorPermissions",
        JSON.stringify(permissions),
      );
      sessionStorage.setItem(
        "hrms.dashboard.accessMode",
        JSON.stringify("admin"),
      );
      sessionStorage.setItem("hrms.dashboard.isAdmin", "true");
    },
    { user, token, permissions },
  );
  const state = { submitted: false, saves: 0 };
  const question = {
    id: "q",
    label: "How satisfied are you at work?",
    type: "rating",
    required: true,
  };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = { rows: [], total: 0, data: [] };
    if (path.includes("/auth/me") || path === "/api/users/me")
      data = { ...user, data: user };
    else if (path.endsWith("/suggestions")) data = [question];
    else if (path === "/api/employee/forms-feedback")
      data = {
        rows: [
          {
            id: "round-1",
            definition: {
              title: "Monthly pulse",
              description: "Share your experience",
              responseMode: "anonymous",
              questions: [question],
            },
            opensAt: new Date(Date.now() - 1000).toISOString(),
            closesAt: new Date(Date.now() + 86400000).toISOString(),
            submitted: state.submitted,
          },
        ],
        total: 1,
      };
    else if (path.endsWith("/round-1/submit")) {
      expect(route.request().postDataJSON()).toEqual({ answers: { q: 4 } });
      state.submitted = true;
      data = { submitted: true };
    } else if (
      path === "/api/hr/forms-feedback" &&
      route.request().method() === "POST"
    ) {
      const questions = route.request().postDataJSON().questions;
      expect(questions).toHaveLength(3);
      expect(
        new Set(questions.map((question: { id: string }) => question.id)).size,
      ).toBe(3);
      state.saves++;
      data = { id: "draft-1" };
    }
    await route.fulfill({ json: data });
  });
  return state;
}
test("HR can add suggested questions and preview the anonymous notice", async ({
  page,
}) => {
  await prepare(page);
  // Network HTTP origins do not expose randomUUID; adding questions must still work.
  await page.addInitScript(() => {
    Object.defineProperty(crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    });
  });
  await page.goto("/dashboard/forms-feedback");
  await page.getByRole("button", { name: "Create form", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Monthly pulse");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", {
      name: "How satisfied are you at work?",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Question", exact: true }),
  ).toHaveValue("How satisfied are you at work?");
  await page
    .getByRole("button", {
      name: "How satisfied are you at work?",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Add question", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Question", exact: true }),
  ).toHaveCount(3);
  await page
    .getByRole("textbox", { name: "Question", exact: true })
    .nth(2)
    .fill("Additional feedback");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.locator('input[type="date"], input[type="time"], select'),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByText("Your identity is not linked to your answers.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await page.screenshot({
    path: "test-results/forms-builder-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Form saved.", { exact: false })).toBeVisible();
});
test("employee submits anonymous answers once on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await prepare(page);
  await page.goto("/dashboard/forms-feedback");
  await page
    .getByRole("button", { name: "Complete form", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Submit response", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("radio", { name: "4 out of 5 stars", exact: true })
    .check();
  await page
    .getByRole("checkbox", {
      name: "I have reviewed my answers and understand the response identity setting.",
    })
    .check();
  await page.screenshot({
    path: "test-results/forms-employee-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Submit response", exact: true })
    .click();
  await expect(
    page.getByText("Thank you. Your response has been submitted."),
  ).toBeVisible();
  expect(state.submitted).toBe(true);
  await expect(
    page.getByRole("button", { name: "Complete form", exact: true }),
  ).toBeDisabled();
});

test("HR switches between summary and anonymous responses", async ({
  page,
}) => {
  await prepare(page);
  const definition = {
    title: "Closed pulse",
    responseMode: "anonymous",
    questions: [
      { id: "q", label: "Satisfaction", type: "rating", required: true },
    ],
    schedule: { frequency: "monthly" },
  };
  const round = {
    id: "round-2",
    definition,
    opensAt: "2026-01-01T06:00:00Z",
    closesAt: "2026-01-08T06:00:00Z",
  };
  await page.route("**/api/hr/forms-feedback**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith("/results")
      ? {
          round,
          total: 5,
          eligible: 5,
          withheld: false,
          rows: [{ answers: { q: 4 } }],
          summary: [{ question: "q", answer: 4, count: "5" }],
        }
      : path.endsWith("/rounds")
        ? { rows: [round], total: 1 }
        : {
            rows: [
              { id: "form-1", definition, status: "scheduled", roundCount: 1 },
            ],
            total: 1,
          };
    await route.fulfill({ json: data });
  });
  await page.goto("/dashboard/forms-feedback");
  await page.getByRole("tab", { name: "Manage forms", exact: true }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Close form?" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Close form?" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Results", exact: true }).click();
  await page
    .getByRole("button", { name: "Open results summary", exact: true })
    .click();
  await expect(
    page.getByRole("progressbar", { name: "Satisfaction: 4" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Responses", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Submission", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("5 submissions", { exact: false })).toBeVisible();
});
