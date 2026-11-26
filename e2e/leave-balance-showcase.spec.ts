import { expect, test, type Page } from "@playwright/test";
import { installDashboardFixture } from "./helpers/dashboard-fixture";

async function setup(page: Page, getTheme: () => "light" | "dark") {
  const user = await installDashboardFixture(page, "employee", []);
  const employee = { id: 19, user_id: user.id, employee_no: "DEMO-19" };
  const balances = [
    { id: 1, leave_type_id: 1, leave_type_name: "Annual Leave", fiscal_year: "2026", allocated_days: 28, accrued_days: 28, used_days: 35, pending_days: 0, available_days: -7 },
    { id: 2, leave_type_id: 2, leave_type_name: "Sick Leave", fiscal_year: "2026", allocated_days: 126, accrued_days: 126, used_days: 0, pending_days: 0, available_days: 126 },
    { id: 3, leave_type_id: 3, leave_type_name: "Paternity Leave", fiscal_year: "2026", allocated_days: 3, used_days: 0, pending_days: 0, available_days: 3 },
  ];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = { data: [] };
    if (["/api/users/me", "/api/auth/me", "/api/auth/session"].includes(path)) json = { ...user, data: user };
    if (path === "/api/users/me/appearance") json = { theme: getTheme() };
    if (path === "/api/employees/me") json = { data: employee };
    if (path === "/api/me/leave/balances") json = { current_fiscal_year: "2026", data: [{ employee_id: employee.id, leave_balances: balances }] };
    if (path === "/api/leave/comp-off/eligibility") json = { types: [], convertible_overtime: [] };
    await route.fulfill({ json });
  });
}

test("leave balances provide summary and cards views from the same data", async ({ page }, info) => {
  let theme: "light" | "dark" = "light";
  await setup(page, () => theme);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dashboard/me/leave/balances");
  const section = page.getByRole("region", { name: "My leave balances" });
  await expect(section.getByRole("heading", { name: "My leave balance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How your leave is earned" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Encash leave" })).toBeVisible();
  await expect(section.getByText("-7")).toBeVisible();
  await expect(section.getByText("Negative leave balance")).toBeVisible();
  await expect(section.locator("details")).toHaveCount(2);
  await section.screenshot({ path: info.outputPath("leave-balances-summary-light.png") });
  await section.locator("details").first().locator("summary").click();
  await expect(section.locator("details").first().getByText("Accrued")).toBeVisible();

  await section.getByRole("tab", { name: "Cards" }).click();
  await expect(section.getByRole("heading", { name: "Annual Leave" })).toBeVisible();
  await expect(section.getByRole("heading", { name: "Sick Leave" })).toBeVisible();
  await expect(section.getByRole("heading", { name: "Paternity Leave" })).toBeVisible();
  await expect(section.getByText("—")).toBeVisible();
  await section.screenshot({ path: info.outputPath("leave-balances-cards-light.png") });

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await section.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await section.screenshot({ path: info.outputPath("leave-balances-cards-mobile.png") });

  theme = "dark";
  await page.evaluate(() => localStorage.setItem("hrms.theme", "dark"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html.dark")).toHaveCount(1);
  const darkSection = page.getByRole("region", { name: "My leave balances" });
  await expect(darkSection.getByText("Negative leave balance")).toBeVisible();
  await darkSection.screenshot({ path: info.outputPath("leave-balances-summary-dark-mobile.png") });
  await darkSection.getByRole("tab", { name: "Cards" }).click();
  await darkSection.screenshot({ path: info.outputPath("leave-balances-cards-dark-mobile.png") });
});
