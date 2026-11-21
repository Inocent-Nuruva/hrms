import { expect, test, type Page } from "@playwright/test";
import { DASHBOARD_AUTH_COOKIE } from "../src/lib/dashboard-permissions";

/**
 * Browser checks for the payroll lifecycle screens with a fixture session and
 * mocked API (no real credentials needed). Verifies what each screen shows
 * and what it sends; the real-account UAT run is separate.
 */

test.use({ video: "off" });

const PAYROLL_PERMISSIONS = [
  "payroll:runs",
  "payroll:runs:read",
  "payroll:runs:process",
  "payroll:runs:approve",
  "payroll:runs:lock",
  "payroll:runs:cancel",
  "payroll:runs:reverse",
  "payroll:payments:confirm",
  "payroll:runs:close",
  "payroll:banking",
  "payroll:accounting",
  "payroll:inputs",
  "payroll:inputs:approve",
  "payroll:config",
  "payroll:config:read",
  "payroll:statutory:approve",
  "payroll:recoveries:manage",
  "payroll:recoveries:approve",
  "payroll:reports",
  "manage_payroll",
];

type Captured = { method: string; path: string; body: unknown };

const runs = [
  {
    id: 11,
    run_no: "PR-1-000011",
    run_type: "REGULAR",
    status: "PENDING_FINANCE_APPROVAL",
    calculation_hash: "hash-11",
    payroll_period_id: 3,
    net_pay_total: "977000.00",
    approvals: [],
  },
  {
    id: 12,
    run_no: "PR-1-000012",
    run_type: "REGULAR",
    status: "PAYMENT_FILE_GENERATED",
    calculation_hash: "hash-12",
    payroll_period_id: 3,
    net_pay_total: "977000.00",
    approvals: [],
  },
  {
    id: 13,
    run_no: "PR-1-000013",
    run_type: "BONUS",
    status: "DRAFT",
    payroll_period_id: 3,
    approvals: [],
  },
];

async function openPayroll(
  page: Page,
  captured: Captured[],
  permissions = PAYROLL_PERMISSIONS,
) {
  const user = {
    id: 5,
    email: "payroll@example.test",
    fullName: "Payroll Admin",
    roles: ["PAYROLL_ADMIN"],
    permissions,
    scope: "company",
    companyId: 10,
    company_id: 10,
    dashboardType: "admin",
    accessContextResolved: true,
  };
  const token = `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: 5, scope: "company", userType: "COMPANY_USER", companyId: 10, companyMembershipId: 5, roles: user.roles, permissions, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.fixture`;
  await page
    .context()
    .addCookies([
      {
        name: DASHBOARD_AUTH_COOKIE,
        value: "1",
        url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
      },
    ]);
  await page.addInitScript(
    ({ token, user, permissions }) => {
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
      sessionStorage.setItem("hrms.dashboard.accessMode", "admin");
      sessionStorage.setItem(
        "hrms.dashboard.actorRoles",
        JSON.stringify(user.roles),
      );
      sessionStorage.setItem("hrms.dashboard.scope", "company");
    },
    { token, user, permissions },
  );
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() !== "GET") {
      captured.push({
        method: request.method(),
        path,
        body: request.postDataJSON?.() ?? null,
      });
      return route.fulfill({
        status: 200,
        json: { data: { id: 1, status: "OK" } },
      });
    }
    if (path.includes("auth/me"))
      return route.fulfill({
        status: 200,
        json: { ...user, dashboard_type: "admin" },
      });
    if (path.endsWith("/payroll/runs"))
      return route.fulfill({ status: 200, json: { data: runs } });
    if (/\/payroll\/runs\/\d+$/.test(path)) {
      const id = Number(path.split("/").pop());
      return route.fulfill({
        status: 200,
        json: { data: runs.find((run) => run.id === id) ?? runs[0] },
      });
    }
    if (path.endsWith("/payroll/recoveries")) {
      return route.fulfill({
        status: 200,
        json: {
          data: [
            {
              id: 1,
              employeeId: 7,
              originalPayrollRunId: 9,
              method: "INSTALLMENTS",
              legalBasis: "EMPLOYEE_CONSENT",
              overpaidAmount: "90000.00",
              recoveredAmount: "0.00",
              status: "PENDING_APPROVAL",
              createdByCompanyUserId: 4,
            },
            {
              id: 2,
              employeeId: 8,
              originalPayrollRunId: 9,
              method: "REFUND",
              legalBasis: "NOT_APPLICABLE",
              overpaidAmount: "10000.00",
              recoveredAmount: "0.00",
              status: "ACTIVE",
            },
          ],
        },
      });
    }
    if (path.endsWith("/payroll/approval-workflows"))
      return route.fulfill({ status: 200, json: { data: [] } });
    if (path.endsWith("/payroll/attendance-deduction-policies")) {
      return route.fulfill({
        status: 200,
        json: {
          data: [
            {
              id: 3,
              name: "Absence draft",
              effectiveFrom: "2027-01-01",
              status: "DRAFT",
              rules: {
                standard_minutes_per_day: 480,
                unauthorized_absence: { enabled: true },
              },
            },
          ],
        },
      });
    }
    if (path.includes("/payment-progress")) {
      return route.fulfill({
        status: 200,
        json: {
          payroll_run_id: 12,
          run_status: "PAYMENT_FILE_GENERATED",
          payment_state: "PARTIALLY_PAID",
          paid_count: 1,
          partially_paid_count: 1,
          failed_count: 1,
          pending_count: 0,
          outstanding_total: "150.00",
          rows: [
            {
              employee_id: 1,
              employee_name: "Asha",
              net_pay: "100.00",
              confirmed_amount: "0.00",
              outstanding_amount: "100.00",
              state: "FAILED",
            },
            {
              employee_id: 2,
              employee_name: "Baraka",
              net_pay: "200.00",
              confirmed_amount: "150.00",
              outstanding_amount: "50.00",
              state: "PARTIALLY_PAID",
            },
            {
              employee_id: 3,
              employee_name: "Chausiku",
              net_pay: "300.00",
              confirmed_amount: "300.00",
              outstanding_amount: "0.00",
              state: "PAID",
            },
          ],
        },
      });
    }
    if (path.includes("/eligibility")) {
      return route.fulfill({
        status: 200,
        json: {
          eligible_count: 1,
          excluded_count: 0,
          error_count: 1,
          rows: [
            {
              employee_id: 4,
              employee_no: "E4",
              employee_name: "Dotto",
              status: "ERROR",
              reason: "Employed during this period but has no payroll profile.",
              action: "Create the payroll profile.",
            },
          ],
        },
      });
    }
    return route.fulfill({ status: 200, json: { data: [] } });
  });
  await page.goto("/dashboard/operations/payroll", {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await expect(
    page.getByRole("tab", { name: "Runs", exact: true }).first(),
  ).toBeVisible({ timeout: 150_000 });
  await expect(page.locator("body")).not.toContainText(
    /next\.js error|application error/i,
  );
}

async function openTab(page: Page, name: string) {
  await page.getByRole("tab", { name, exact: true }).first().click();
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe("payroll lifecycle screens", () => {
  test("reject sends the stage, hash and reason back to the preparer", async ({
    page,
  }) => {
    const captured: Captured[] = [];
    await openPayroll(page, captured);
    await openTab(page, "Runs");
    await page
      .getByRole("button", { name: "Approve", exact: true })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Approve payroll run")).toBeVisible();
    await dialog.getByRole("button", { name: "Reject to preparer" }).click();
    await expect(
      dialog.getByText(/calculation hash is required/i),
    ).toBeVisible();
    await dialog.locator("input").last().fill("hash-11");
    await dialog.getByRole("button", { name: "Reject to preparer" }).click();
    await expect(
      dialog.getByText(/rejection reason in comments/i),
    ).toBeVisible();
    await dialog
      .locator('[aria-multiline="true"]')
      .fill("Overtime not supported");
    await dialog.getByRole("button", { name: "Reject to preparer" }).click();
    await expect
      .poll(
        () =>
          captured.find(
            (c) =>
              c.path.endsWith("/payroll/runs/11/reject") ||
              c.path.match(/runs\/\d+\/reject$/),
          )?.body,
      )
      .toMatchObject({
        calculation_hash: "hash-11",
        reason: "Overtime not supported",
      });
  });

  test("state-aware run actions, cancel, payments and eligibility", async ({
    page,
  }) => {
    const captured: Captured[] = [];
    await openPayroll(page, captured);
    await openTab(page, "Runs");
    // Cancel is offered for unlocked runs; Reverse and Payments for locked ones.
    await expect(
      page.getByRole("button", { name: "Cancel run" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Reverse" }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Payments" }).first().click();
    const progress = page.getByRole("dialog");
    await expect(progress.getByText("Payment progress")).toBeVisible();
    await expect(progress.getByText("Baraka")).toBeVisible();
    await expect(
      progress.getByRole("button", { name: "Generate retry file" }),
    ).toBeDisabled();
    await progress.locator("input").fill("Account corrected by bank");
    await progress.getByRole("button", { name: "Generate retry file" }).click();
    await expect
      .poll(() => captured.find((c) => c.path.endsWith("/batches/retry"))?.body)
      .toMatchObject({ reason: "Account corrected by bank" });

    await page.getByRole("button", { name: "Eligibility" }).first().click();
    await expect(
      page.getByRole("dialog").getByText(/no payroll profile/i),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Cancel run" }).first().click();
    const cancel = page.getByRole("dialog");
    await cancel.getByRole("button", { name: "Cancel run" }).click();
    await expect(cancel.getByText("A reason is required.")).toBeVisible();
    await cancel.locator('[aria-multiline="true"]').fill("Wrong period");
    await cancel.getByRole("button", { name: "Cancel run" }).click();
    await expect
      .poll(() => captured.find((c) => c.path.endsWith("/cancel"))?.body)
      .toMatchObject({ reason: "Wrong period" });
  });

  test("manual payment confirmation requires evidence", async ({ page }) => {
    const captured: Captured[] = [];
    await openPayroll(page, captured);
    await openTab(page, "Runs");
    await page
      .getByRole("button", { name: "Paid", exact: true })
      .nth(1)
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Confirm salary payment")).toBeVisible();
    await dialog.locator('[aria-multiline="true"]').fill("Confirmed with CRDB");
    await dialog.getByRole("button", { name: "Confirm payment" }).click();
    await expect(
      dialog.getByText(/reference and date are required/i),
    ).toBeVisible();
    await dialog.locator("input").first().fill("CRDB-778");
    await dialog.getByRole("button", { name: "Confirm payment" }).click();
    await expect
      .poll(() => captured.find((c) => c.path.endsWith("/mark-paid"))?.body)
      .toMatchObject({
        payment_reference: "CRDB-778",
        confirmation_note: "Confirmed with CRDB",
      });
  });

  test("recoveries: approve/reject/refund actions follow status and permissions", async ({
    page,
  }) => {
    const captured: Captured[] = [];
    await openPayroll(page, captured);
    await openTab(page, "Recoveries");
    await expect(page.getByText("Overpayment recoveries")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Approve", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Record refund" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Record refund" }).click();
    const dialog = page.getByRole("dialog");
    const inputs = dialog.locator("input");
    await inputs.nth(0).fill("10000.00");
    await inputs.nth(1).fill("RCPT-9");
    await dialog.locator('[aria-multiline="true"]').fill("Bank deposit slip");
    await dialog.getByRole("button", { name: "Confirm" }).click();
    await expect
      .poll(
        () =>
          captured.find((c) => c.path.endsWith("/recoveries/2/refunds"))?.body,
      )
      .toMatchObject({ amount: "10000.00", reference: "RCPT-9" });

    await page.getByRole("button", { name: "Raise recovery" }).click();
    await expect(
      page.getByRole("dialog").getByText("Raise overpayment recovery"),
    ).toBeVisible();
  });

  test("a user without recovery permissions sees no recovery actions", async ({
    page,
  }) => {
    const captured: Captured[] = [];
    await openPayroll(
      page,
      captured,
      PAYROLL_PERMISSIONS.filter(
        (p) => !p.startsWith("payroll:recoveries") && p !== "manage_payroll",
      ),
    );
    await openTab(page, "Recoveries");
    await expect(page.getByText("Overpayment recoveries")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Raise recovery" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Approve", exact: true }),
    ).toHaveCount(0);
  });

  test("approval workflows and attendance deduction policies", async ({
    page,
  }) => {
    const captured: Captured[] = [];
    await openPayroll(page, captured);
    await openTab(page, "Configuration");
    await openTab(page, "Approval workflows");
    await expect(
      page.getByText(/runs use HR → Finance → Management/),
    ).toBeVisible();
    await page.getByRole("button", { name: "New workflow version" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("input").first().fill("Two-step");
    await dialog.getByRole("checkbox").first().uncheck();
    await dialog.getByRole("button", { name: "Save workflow" }).click();
    await expect
      .poll(
        () =>
          captured.find((c) => c.path.endsWith("/approval-workflows"))?.body,
      )
      .toMatchObject({
        name: "Two-step",
        scope: "COMPANY",
        stages: [
          expect.objectContaining({ stage: "FINANCE" }),
          expect.objectContaining({ stage: "MANAGEMENT" }),
        ],
      });

    await openTab(page, "Attendance deductions");
    await expect(
      page.getByText(/Monetary attendance deductions are off/),
    ).toBeVisible();
    await page.getByRole("button", { name: "Activate" }).click();
    const activate = page.getByRole("dialog");
    await activate.locator("input").fill("LEGAL-2027-01");
    await activate.getByRole("button", { name: "Activate" }).click();
    await expect
      .poll(
        () =>
          captured.find((c) =>
            c.path.endsWith("/attendance-deduction-policies/3/activate"),
          )?.body,
      )
      .toMatchObject({ legal_review_reference: "LEGAL-2027-01" });
  });

  for (const [label, width, height] of [
    ["desktop", 1440, 900],
    ["tablet", 820, 1180],
    ["mobile", 390, 844],
  ] as const) {
    test(`layout has no horizontal page scroll on ${label}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      const captured: Captured[] = [];
      await openPayroll(page, captured);
      for (const tab of ["Runs", "Recoveries"]) {
        await openTab(page, tab);
        await page.waitForTimeout(300);
        await noHorizontalScroll(page);
      }
      await openTab(page, "Runs");
      await page.getByRole("button", { name: "Payments" }).first().click();
      await expect(
        page.getByRole("dialog").getByText("Payment progress"),
      ).toBeVisible();
      await noHorizontalScroll(page);
    });
  }
});
