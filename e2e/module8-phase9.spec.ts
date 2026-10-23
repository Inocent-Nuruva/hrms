import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page
    .locator('input[type="password"], input[autocomplete="current-password"]')
    .first()
    .fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 45_000 });
}

function readAccount(prefix: "MODULE8_E2E_EMPLOYEE" | "MODULE8_E2E_MANAGER") {
  const email = process.env[`${prefix}_EMAIL`]?.trim();
  const password = process.env.MODULE8_E2E_PASSWORD;
  if (!email || !password) {
    throw new Error(`Set ${prefix}_EMAIL and MODULE8_E2E_PASSWORD for this UAT run.`);
  }
  return { email, password };
}

function readHrAccount() {
  const email = process.env.HRMS_E2E_HR_EMAIL?.trim();
  const password = process.env.HRMS_E2E_HR_PASSWORD;
  if (!email || !password) {
    throw new Error("Set HRMS_E2E_HR_EMAIL and HRMS_E2E_HR_PASSWORD for this UAT run.");
  }
  return { email, password };
}

test.describe("Module 8 signed-in browser UAT", () => {
  test("HR opens the activity reports workspace", async ({ page }) => {
    const account = readHrAccount();
    await signIn(page, account.email, account.password);
    await page.goto("/dashboard/activities/reports");
    await expect(page.getByText("Department activity summary")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Activity report view" })).toBeVisible();
  });

  test("employee opens personal activities and daily work", async ({ page }) => {
    const account = readAccount("MODULE8_E2E_EMPLOYEE");
    await signIn(page, account.email, account.password);
    await page.goto("/dashboard/me/activities/today");
    await expect(page.getByRole("heading", { name: "My activities" })).toBeVisible();
  });

  test("manager opens the team activities workspace", async ({ page }) => {
    const account = readAccount("MODULE8_E2E_MANAGER");
    await signIn(page, account.email, account.password);
    await page.goto("/dashboard/activities/team");
    await expect(page.getByRole("heading", { name: "Team activities" })).toBeVisible();
  });
});
