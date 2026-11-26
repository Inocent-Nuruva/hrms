import { expect, test } from "@playwright/test";
import { installDashboardFixture } from "./helpers/dashboard-fixture";

test("KPI search shows its Fluent sparkle icon", async ({ page }, info) => {
  const user = await installDashboardFixture(page, "company", ["kpi_definitions:create", "kpi_assignments:read"]);
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (["/api/users/me", "/api/auth/me", "/api/auth/session"].includes(path)) {
      await route.fulfill({ json: { ...user, data: user } });
    } else {
      await route.fulfill({ json: [] });
    }
  });
  await page.goto("/dashboard/kpi", { waitUntil: "domcontentloaded" });
  const search = page.getByRole("searchbox", { name: "Search KPI definitions" });
  await expect(search).toBeVisible();
  const icon = search.locator("xpath=..").locator("svg").first();
  await expect(icon).toBeVisible();
  const iconBox = await icon.boundingBox();
  const inputBox = await search.boundingBox();
  expect((iconBox?.x ?? 0) + (iconBox?.width ?? 0)).toBeLessThan(inputBox?.x ?? 0);
  expect(await icon.evaluate((node) => {
    const firstPath = node.querySelector("path");
    const gradientId = /^url\(#(.+)\)$/.exec(firstPath?.getAttribute("fill") ?? "")?.[1];
    return gradientId && node.querySelector(`[id="${gradientId}"]`) !== null && document.querySelectorAll(`[id="${gradientId}"]`).length === 1;
  })).toBe(true);
  expect(await page.locator(".fui-SearchBox svg:has(defs)").evaluateAll((icons) => icons.every((node) => {
    const firstPath = node.querySelector("path");
    const gradientId = /^url\(#(.+)\)$/.exec(firstPath?.getAttribute("fill") ?? "")?.[1];
    return gradientId && node.querySelector(`[id="${gradientId}"]`) !== null && document.querySelectorAll(`[id="${gradientId}"]`).length === 1;
  }))).toBe(true);
  await icon.screenshot({ path: info.outputPath("sparkle-icon-alone.png") });
  await search.locator("xpath=../..").screenshot({ path: info.outputPath("kpi-search-sparkle.png") });
});
