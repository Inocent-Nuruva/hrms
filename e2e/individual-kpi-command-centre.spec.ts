import { expect, test } from "@playwright/test";
import { installDashboardFixture } from "./helpers/dashboard-fixture";

const periods = { startDate: "2026-11-25", endDate: "2026-11-30", label: "November 2026" };
const assignments = [
  { id: 12, status: "active", subjectType: "employee", subjectId: 3, period: periods, definitionVersion: { name: "Policy renewals", description: "Count completed policy renewals.", measurementType: "numeric", measurementUnit: "policies" }, currentTarget: { target: { value: 12 } } },
  { id: 13, status: "active", subjectType: "employee", subjectId: 3, period: periods, definitionVersion: { name: "New policies", description: "Count new policies.", measurementType: "numeric", measurementUnit: "policies" }, currentTarget: { target: { value: 4 } } },
];
const activity = (id: number) => ({ id, activityDate: `2026-11-${id === 1 ? "25" : "26"}`, title: id === 1 ? "Customer follow-up" : "Renewal calls", details: "Completed policy work for customers.", measurableResult: id, comments: "Recorded today", status: "draft", rowVersion: 1, evidence: [] });
const achievement = (actual: number | null, activities: ReturnType<typeof activity>[], status = "draft") => ({
  id: 51, assignmentId: 12, approvedRevisionId: null, assignment: assignments[0],
  current: { id: 52, revision: 1, rowVersion: 1, status, actual, comments: "", reviewComment: null, evidence: [], activities },
  revisions: [], history: [],
});

test("KPI command centre keeps activity work separate from the final result and switches assignments", async ({ page }, info) => {
  const user = await installDashboardFixture(page, "employee", ["kpi_assignments:read", "kpi_achievements:write"]);
  let saved = achievement(null, []);
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (["/api/users/me", "/api/auth/me", "/api/auth/session"].includes(path)) await route.fulfill({ json: { ...user, data: user } });
    else if (path === "/api/users/me/appearance") await route.fulfill({ json: { theme: "light" } });
    else if (path === "/api/hr/kpi/me/assignments") await route.fulfill({ json: assignments });
    else if (path === "/api/hr/kpi/me/achievements") await route.fulfill({ json: [saved] });
    else if (path === "/api/hr/kpi/achievements/51/activities" && route.request().method() === "POST") {
      saved = achievement(null, [activity(1)]);
      await route.fulfill({ json: saved });
    } else if (path === "/api/hr/kpi/achievements/51/draft" && route.request().method() === "PATCH") {
      saved = achievement(0, saved.current.activities);
      await route.fulfill({ json: saved });
    } else if (path === "/api/hr/kpi/achievements/51/submit" && route.request().method() === "POST") {
      saved = achievement(0, saved.current.activities, "submitted");
      await route.fulfill({ json: saved });
    } else await route.fulfill({ json: [] });
  });

  await page.goto("/dashboard/me/kpi/12", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Policy renewals" })).toBeVisible();
  await expect(page.getByRole("region", { name: "KPI performance summary" })).toContainText(/12\s*policies/);
  await expect(page.getByRole("region", { name: "KPI performance summary" })).toContainText("Not entered");
  await expect(page.getByRole("heading", { name: "Start your activity journal" })).toBeVisible();
  await page.screenshot({ path: info.outputPath("kpi-empty-desktop-light.png"), fullPage: true });
  await page.getByRole("heading", { name: "Start your activity journal" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("kpi-empty-journal-light.png") });
  await page.evaluate(() => document.documentElement.style.setProperty("--primary", "rgb(12, 100, 80)"));
  await expect(page.getByRole("region", { name: "KPI performance summary" }).locator(".bg-primary")).toHaveCSS("background-color", "rgb(12, 100, 80)");
  await page.evaluate(() => document.documentElement.style.removeProperty("--primary"));

  await page.getByRole("button", { name: "Add activity", exact: true }).click();
  await page.getByRole("textbox", { name: "Activity title" }).fill("Customer follow-up");
  await page.getByRole("textbox", { name: "Work performed" }).fill("Completed policy work for customers.");
  await page.getByRole("button", { name: "Save activity" }).click();
  await expect(page.getByRole("button", { name: /Open Customer follow-up/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "KPI performance summary" })).toContainText("Not entered");
  await expect(page.getByRole("region", { name: "KPI activity journal" })).toContainText("1 entry");
  await page.getByRole("button", { name: /Open Customer follow-up/ }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("kpi-activity-desktop-light.png") });

  await page.getByRole("button", { name: "Switch KPI" }).click();
  await page.getByRole("button", { name: /New policies/ }).click();
  await expect(page.getByRole("heading", { name: "New policies" })).toBeVisible();
  await expect(page.getByRole("region", { name: "KPI performance summary" })).toContainText(/4\s*policies/);
  await expect(page.getByRole("heading", { name: "Start your activity journal" })).toBeVisible();

  await page.goto("/dashboard/me/kpi/12", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Submit KPI" }).click();
  await page.getByRole("textbox", { name: /Final actual achievement/ }).fill("0");
  await page.getByRole("button", { name: "Submit to manager" }).click();
  await expect(page.getByRole("region", { name: "KPI performance summary" })).toContainText("0 policies");
  await expect(page.getByRole("region", { name: "KPI performance summary" })).toContainText("Submitted");
});

test("multiple activities remain readable on mobile and in dark mode", async ({ page }, info) => {
  const user = await installDashboardFixture(page, "employee", ["kpi_assignments:read", "kpi_achievements:write"]);
  await page.addInitScript(() => localStorage.setItem("hrms.theme", "dark"));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (["/api/users/me", "/api/auth/me", "/api/auth/session"].includes(path)) await route.fulfill({ json: { ...user, data: user } });
    else if (path === "/api/users/me/appearance") await route.fulfill({ json: { theme: "dark" } });
    else if (path === "/api/hr/kpi/me/assignments") await route.fulfill({ json: assignments });
    else if (path === "/api/hr/kpi/me/achievements") await route.fulfill({ json: [achievement(0, [activity(1), activity(2)])] });
    else await route.fulfill({ json: [] });
  });
  await page.goto("/dashboard/me/kpi/12", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /Open Customer follow-up/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Open Renewal calls/ })).toBeVisible();
  await page.getByRole("button", { name: /Open Customer follow-up/ }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("kpi-multiple-desktop-dark.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("region", { name: "KPI activity journal" })).toContainText("2 entries");
  await page.getByRole("button", { name: /Open Customer follow-up/ }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath("kpi-multiple-mobile-dark.png"), fullPage: true });
});
