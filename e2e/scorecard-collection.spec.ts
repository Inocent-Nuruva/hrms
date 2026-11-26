import { expect, test, type Page } from "@playwright/test";
import { installDashboardFixture } from "./helpers/dashboard-fixture";

type ScorecardFixture = ReturnType<typeof makeScorecard>;

function makeScorecard(id: number, year = new Date().getFullYear()) {
  const score = id === 2 ? null : id === 3 ? "0" : id === 4 ? "124.5" : "67.33";
  const entries = Array.from({ length: id === 2 ? 1 : 2 }, (_, index) => ({
    assignmentId: id * 10 + index,
    definitionVersionId: index + 1,
    targetRevisionId: index + 1,
    weight: "50",
    required: true,
    kpiName: `KPI ${index + 1}`,
    target: { value: 50 },
    actual: score == null ? null : 40,
    weightedScore: score == null ? null : "25",
    status: score == null ? "awaiting_data" : "scored",
  }));
  return {
    id,
    code: `SCORECARD_${id}`,
    subjectType: "employee",
    subjectId: 3,
    periodId: 1,
    managerEmployeeId: 5,
    status: "published",
    currentVersion: { id, version: 1, name: id === 5 ? "A very long scorecard name that needs to wrap cleanly on tablet and mobile screens without expanding the layout" : id === 1 ? "Bosco November KPI scorecard" : `Scorecard ${id}`, description: null, mode: "weighted", policyVersionId: 1, entries, publishedAt: `${year}-01-01T00:00:00Z` },
    versions: [],
    entries,
    period: { label: `KPI QA — November ${year}`, startDate: `${year}-01-01`, endDate: `${year}-12-31` },
    overallScore: score,
    completenessPercent: score == null ? "50" : "100",
    performanceStatus: score == null ? "partial" : "scored",
  };
}

async function setup(page: Page, getRows: () => ScorecardFixture[], getTheme: () => "light" | "dark" = () => "light") {
  const user = await installDashboardFixture(page, "employee", []);
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (["/api/users/me", "/api/auth/me", "/api/auth/session"].includes(path)) {
      await route.fulfill({ json: { ...user, data: user } });
    } else if (path === "/api/users/me/appearance") {
      await route.fulfill({ json: { theme: getTheme() } });
    } else if (path === "/api/hr/kpi/scorecards/me") {
      await route.fulfill({ json: getRows() });
    } else if (/^\/api\/hr\/kpi\/scorecards\/\d+$/.test(path)) {
      const id = Number(path.split("/").at(-1));
      await route.fulfill({ json: getRows().find((item) => item.id === id) ?? getRows()[0] });
    } else {
      await route.fulfill({ json: { data: [] } });
    }
  });
}

test("scorecard collection handles zero, one, two, three, six and twenty records", async ({ page }, info) => {
  let rows: ScorecardFixture[] = [];
  await setup(page, () => rows);
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const count of [0, 1, 2, 3, 6, 20]) {
    rows = Array.from({ length: count }, (_, index) => makeScorecard(index + 1));
    await page.goto("/dashboard/me/scorecards", { waitUntil: "domcontentloaded" });
    if (count === 0) {
      await expect(page.getByRole("heading", { name: "No scorecards yet" })).toBeVisible();
      continue;
    }
    await expect(page.locator("[data-scorecard-card]")).toHaveCount(count);
    await expect(page.getByRole("heading", { name: `Current scorecards (${count})` })).toBeVisible();
    if (count === 1) await page.locator("[data-scorecard-card]").first().screenshot({ path: info.outputPath("scorecards-single-light.png") });
    if (count === 3) await page.locator("[data-scorecard-collection]").first().screenshot({ path: info.outputPath("scorecards-multiple-light.png") });
  }
  await expect(page.locator('[data-scorecard-card][href="/dashboard/me/scorecards/1"]')).toContainText("67.33%");
  await expect(page.locator('[data-scorecard-card][href="/dashboard/me/scorecards/2"]')).toContainText("Awaiting data");
  await expect(page.locator('[data-scorecard-card][href="/dashboard/me/scorecards/3"]')).toContainText("0%");
  await expect(page.locator('[data-scorecard-card][href="/dashboard/me/scorecards/4"]')).toContainText("124.5%");
  await expect(page.locator('[data-scorecard-card][href="/dashboard/me/scorecards/4"] [data-scorecard-progress]')).toHaveAttribute("style", /width: 100%/);
});

test("grid, list, theme, responsive layout, navigation and primary-token inheritance", async ({ page }, info) => {
  const rows = Array.from({ length: 6 }, (_, index) => makeScorecard(index + 1));
  let theme: "light" | "dark" = "light";
  await setup(page, () => rows, () => theme);
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto("/dashboard/me/scorecards", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-scorecard-card]")).toHaveCount(6);

  const grid = page.locator("[data-scorecard-grid]").first();
  const desktopColumns = await grid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  expect(desktopColumns).toBe(3);
  const scoreFontSize = await page.locator("[data-scorecard-score]").first().evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(scoreFontSize).toBeGreaterThanOrEqual(32);
  await page.locator("[data-scorecard-card]").first().hover();
  expect(await page.locator("[data-scorecard-card]").first().evaluate((element) => getComputedStyle(element).textDecorationLine)).toBe("none");
  await page.locator("[data-scorecard-collection]").first().screenshot({ path: info.outputPath("scorecards-grid-light.png") });

  await page.setViewportSize({ width: 1280, height: 900 });
  const tabletColumns = await grid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  expect(tabletColumns).toBe(2);
  await page.setViewportSize({ width: 1920, height: 1000 });

  theme = "dark";
  await page.evaluate(() => window.localStorage.setItem("hrms.theme", "dark"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html.dark")).toHaveCount(1);
  await expect(page.locator("[data-scorecard-card]")).toHaveCount(6);
  await page.locator("[data-scorecard-collection]").first().screenshot({ path: info.outputPath("scorecards-grid-dark.png") });

  const before = await page.locator("[data-scorecard-score]").first().evaluate((element) => getComputedStyle(element).color);
  await page.evaluate(() => document.documentElement.style.setProperty("--primary", "rgb(22, 130, 82)"));
  const after = await page.locator("[data-scorecard-score]").first().evaluate((element) => getComputedStyle(element).color);
  expect(after).not.toBe(before);
  await page.evaluate(() => document.documentElement.style.removeProperty("--primary"));

  await page.getByRole("tab", { name: "List" }).click();
  await expect(page.getByRole("table", { name: "Current scorecards" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Scorecard" })).toBeVisible();
  await expect(page.locator("[data-scorecard-list-row]")).toHaveCount(6);
  await page.locator("[data-scorecard-list-row]").first().hover();
  expect(await page.locator("[data-scorecard-list-row]").first().evaluate((element) => getComputedStyle(element).textDecorationLine)).toBe("none");
  await expect(page.locator("[data-scorecard-card]")).toHaveCount(0);
  await page.locator("[data-scorecard-collection]").first().screenshot({ path: info.outputPath("scorecards-list-dark.png") });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "Grid" }).click();
  await expect(page.locator("[data-scorecard-card]")).toHaveCount(6);
  const mobileColumns = await grid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  expect(mobileColumns).toBe(1);
  const noOverflow = await page.locator("[data-scorecard-collection]").first().evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
  expect(noOverflow).toBe(true);
  await expect(page.locator('[data-scorecard-card][href="/dashboard/me/scorecards/5"]')).toContainText("A very long scorecard name");
  await page.getByRole("tab", { name: "List" }).click();
  await expect(page.locator("[data-scorecard-list-row]")).toHaveCount(6);
  const listNoOverflow = await page.locator("[data-scorecard-collection]").first().evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
  expect(listNoOverflow).toBe(true);
  const mobileHeaderHeight = await page.getByRole("table", { name: "Current scorecards" }).locator("thead").evaluate((element) => element.getBoundingClientRect().height);
  expect(mobileHeaderHeight).toBeLessThan(90);
  await page.screenshot({ path: info.outputPath("scorecards-list-mobile-dark.png") });
  await expect(page.locator('[data-scorecard-list-row] a[href="/dashboard/me/scorecards/5"]').first()).toContainText("A very long scorecard name");
  await page.locator("[data-scorecard-list-row]").first().click();
  await expect(page).toHaveURL(/\/dashboard\/me\/scorecards\/\d+$/);
  await page.goBack({ waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Grid" }).click();
  await page.locator('[data-scorecard-card][href="/dashboard/me/scorecards/1"]').click();
  await expect(page).toHaveURL(/\/dashboard\/me\/scorecards\/1$/);
});
