import { expect, test } from "@playwright/test";

import { loginAs, readTestUsers } from "./helpers/auth";

test.describe("payroll and employee-finance reconciliation routes", () => {
  test("admin can reach payroll reconciliation controls", async ({ page }) => {
    const { admin } = readTestUsers();
    await loginAs(page, admin);

    await page.goto("/dashboard/operations/payroll", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("body")).not.toContainText(/next\.js error/i);
    await expect(page.getByText("Run reconciliation")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /reconcile run/i }),
    ).toBeVisible();
  });

  test("admin can reach finance statement and reconciliation routes", async ({
    page,
  }) => {
    const { admin } = readTestUsers();
    await loginAs(page, admin);

    await page.goto("/dashboard/finance/accounts", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("body")).not.toContainText(/next\.js error/i);

    const statementExport = page.getByRole("button", {
      name: /export statement/i,
    });
    if ((await statementExport.count()) > 0) {
      await expect(statementExport.first()).toBeVisible();
    }

    await page.goto("/dashboard/finance/reports", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("body")).not.toContainText(/next\.js error/i);
    await expect(page.getByText(/import bank csv/i).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /export csv/i }),
    ).toBeVisible();
  });
});
