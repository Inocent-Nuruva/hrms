import { expect, test, type Page } from "@playwright/test";
import { installDashboardFixture } from "./helpers/dashboard-fixture";

function makeCard(count: number, state: "scored" | "partial" | "strategic" = "scored") {
  const entries = Array.from({ length: count }, (_, index) => ({
    assignmentId: index + 1, definitionVersionId: index + 1, targetRevisionId: index + 1,
    weight: String(100 / count), required: true,
    kpiName: index === 0 ? "Policies issued" : index === 1 ? "Policy renewal rate" : `KPI ${index + 1} with a longer descriptive name`,
    measurementType: index === 2 ? "binary" : "percentage",
    direction: index === 1 ? "lower" : "higher",
    measurementUnit: index === 2 ? null : "%",
    target: index === 2 ? { value: true } : { value: index === 1 ? 90 : 50 },
    actual: state === "partial" && index === count - 1 ? null : index === 2 ? true : index === 1 ? 30 : 45,
    achievement: state === "partial" && index === count - 1 ? null : index === 1 ? "33.333333333333" : "90",
    rawAchievement: null,
    weightedScore: state === "partial" && index === count - 1 ? null : index === 0 && count === 2 ? "54" : index === 1 && count === 2 ? "13.333333333333" : String(60 / count),
    status: state === "partial" && index === count - 1 ? "awaiting_data" : "scored",
  }));
  const version = { id: 2, version: 1, name: "Bosco November KPI scorecard", description: "Approved November performance", mode: state === "strategic" ? "strategic" : "weighted", policyVersionId: 1, publishedAt: "2026-11-01T00:00:00Z", entries };
  return { id: 2, code: "QA_NOV26_BOSCO", subjectType: "employee", subjectId: 3, periodId: 1, managerEmployeeId: 5, status: "active", currentVersion: version, versions: [version], entries, period: { label: "KPI QA — November 2026", startDate: "2026-11-01", endDate: "2026-11-30" }, overallScore: state === "partial" ? null : state === "strategic" ? null : count === 2 ? "67.333333333333" : "60", rating: state === "scored" ? "Needs improvement" : null, completenessPercent: state === "partial" ? "50" : "100", performanceStatus: state === "partial" ? "partial" : state === "strategic" ? "status_only" : "scored" };
}

async function setup(page: Page, getCard: () => ReturnType<typeof makeCard>, getTheme: () => "light" | "dark", manager = false) {
  const baseUser = await installDashboardFixture(page, manager ? "company" : "employee", manager ? ["kpi_assignments:read"] : []);
  const user = manager ? { ...baseUser, roles: ["HR_MANAGER"] } : baseUser;
  if (manager) await page.addInitScript(() => {
    const raw = localStorage.getItem("hrms.auth.session.v1");
    if (raw) { const session = JSON.parse(raw); session.user.roles = ["HR_MANAGER"]; localStorage.setItem("hrms.auth.session.v1", JSON.stringify(session)); }
    sessionStorage.setItem("hrms.dashboard.actorRoles", JSON.stringify(["HR_MANAGER"]));
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (["/api/users/me", "/api/auth/me", "/api/auth/session"].includes(path)) await route.fulfill({ json: { ...user, data: user } });
    else if (path === "/api/users/me/appearance") await route.fulfill({ json: { theme: getTheme() } });
    else if (path === "/api/hr/kpi/scorecards/2") await route.fulfill({ json: getCard() });
    else if (path === "/api/hr/kpi/workflow/guidance") await route.fulfill({ json: {
      stages: ["assign", "track", "submit", "review", "approve", "close"].map((id) => ({ id, name: id[0].toUpperCase() + id.slice(1), description: `${id} stage`, roles: ["Employee", "Manager"], next: [] })),
      actions: [], records: [{ kind: "scorecard", id: 2, stage: "approve", status: "active", href: "/dashboard/me/scorecards/2", owner: "Authorized manager" }], waiting: [], updatedAt: "2026-11-25",
    } });
    else await route.fulfill({ json: { data: [] } });
  });
}

test("individual report handles one, two, five and ten KPIs plus incomplete and strategic states", async ({ page }) => {
  let card = makeCard(1);
  await setup(page, () => card, () => "light");
  for (const count of [1, 2, 5, 10]) {
    card = makeCard(count);
    await page.goto("/dashboard/me/scorecards/2", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-scorecard-kpi]")).toHaveCount(count);
    await expect(page.getByRole("heading", { name: "Weighted score contribution" })).toBeVisible();
  }
  card = makeCard(2);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("67.33%", { exact: true })).toBeVisible();
  await expect(page.getByText("13.33", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("54.00", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("img", { name: /Policies issued: 54.00 points/ }).first()).toBeVisible();
  await expect(page.getByText("Lower is better", { exact: false }).first()).toBeVisible();
  await page.getByText("Configuration history").click();
  await expect(page.getByText("Version 1", { exact: true }).last()).toBeVisible();
  card = makeCard(2, "partial");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("Unavailable", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("1 KPI has no weighted score yet.", { exact: false })).toBeVisible();
  card = makeCard(2, "strategic");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("This strategic scorecard has no weighted contribution chart.")).toBeVisible();
  card = { ...makeCard(2), overallScore: "124.5" };
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("124.5%", { exact: true })).toBeVisible();
  await expect(page.getByText("Score outside the 0–100 display range; the progress bar is omitted.")).toBeVisible();
  card = { ...makeCard(2), entries: [{ ...makeCard(2).entries[0], weightedScore: "-4" }, makeCard(2).entries[1]] };
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("Negative contributions are listed below; a proportional donut would misrepresent them.")).toBeVisible();
  card = { ...makeCard(1), overallScore: "0", entries: [{ ...makeCard(1).entries[0], weightedScore: "0" }] };
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("0%", { exact: true })).toBeVisible();
  await expect(page.getByText("No approved weighted contributions are available yet.")).toBeVisible();
});

test("individual report is responsive, theme-aware, and retains navigation and lifecycle", async ({ page }, info) => {
  const card = makeCard(2);
  let theme: "light" | "dark" = "light";
  await setup(page, () => card, () => theme);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/dashboard/me/scorecards/2", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Bosco November KPI scorecard" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Scorecard workflow progress" })).toBeVisible();
  await expect(page.getByText("Stage 5 of 6")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create draft revision" })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("scorecard-report-desktop-light.png") });
  await page.getByRole("heading", { name: "Target versus actual" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("scorecard-report-results-light.png") });
  await page.setViewportSize({ width: 1024, height: 900 });
  const tabletColumns = await page.locator("[data-scorecard-kpi]").first().locator("..").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  expect(tabletColumns).toBe(2);
  await page.setViewportSize({ width: 1440, height: 960 });
  const before = await page.locator("[data-scorecard-report-score]").evaluate((element) => getComputedStyle(element).color);
  await page.evaluate(() => document.documentElement.style.setProperty("--primary", "rgb(50, 160, 90)"));
  const after = await page.locator("[data-scorecard-report-score]").evaluate((element) => getComputedStyle(element).color);
  expect(after).not.toBe(before);
  await page.evaluate(() => document.documentElement.style.removeProperty("--primary"));
  theme = "dark";
  await page.evaluate(() => localStorage.setItem("hrms.theme", "dark"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html.dark")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Bosco November KPI scorecard" })).toBeVisible();
  await page.screenshot({ path: info.outputPath("scorecard-report-desktop-dark.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: info.outputPath("scorecard-report-mobile-dark.png") });
  await page.getByRole("heading", { name: "Target versus actual" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("scorecard-report-mobile-results-dark.png") });
  theme = "light";
  await page.evaluate(() => localStorage.setItem("hrms.theme", "light"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html.dark")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Bosco November KPI scorecard" })).toBeVisible();
  await page.screenshot({ path: info.outputPath("scorecard-report-mobile-light.png") });
  await page.getByRole("link", { name: "My scorecards" }).click();
  await expect(page).toHaveURL(/\/dashboard\/me\/scorecards$/);
});

test("manager retains scorecard configuration actions while employee does not", async ({ page }) => {
  await setup(page, () => makeCard(2), () => "light", true);
  await page.goto("/dashboard/kpi/scorecards/2", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Bosco November KPI scorecard" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create draft revision" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Archive" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Scorecards", exact: true })).toHaveAttribute("href", "/dashboard/kpi/scorecards");
});
