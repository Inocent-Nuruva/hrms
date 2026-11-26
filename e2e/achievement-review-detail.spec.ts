import { expect, test } from "@playwright/test";
import { installDashboardFixture } from "./helpers/dashboard-fixture";

const achievement = {
  id: 1,
  assignmentId: 12,
  approvedRevisionId: 21,
  assignment: {
    id: 12,
    subjectType: "employee",
    subjectId: 3,
    periodId: 2,
    period: { id: 2, label: "KPI QA — November 2026" },
    definitionVersion: { id: 7, name: "Policy renewal rate", measurementType: "numeric", measurementUnit: "%", direction: "higher" },
    currentTarget: { revision: 1, target: { value: 90 } },
  },
  current: {
    id: 21,
    revision: 1,
    rowVersion: 1,
    status: "approved",
    actual: 30,
    comments: "Customer renewals completed this month.",
    reviewComment: "",
    evidence: [],
    activities: [
      { id: 31, activityDate: "2026-11-24", title: "Renewal follow-up", details: "Called customers", status: "approved", measurableResult: 30, comments: "Completed", evidence: [] },
      { id: 32, activityDate: "2026-11-25", title: "Documentation", details: "Updated records", status: "approved", measurableResult: null, comments: null, evidence: [] },
    ],
  },
  revisions: [],
  history: [],
};

test("achievement review keeps the submitted result separate from activities in light and dark modes", async ({ page }, info) => {
  const user = await installDashboardFixture(page, "company", ["kpi_achievements:review", "kpi_assignments:read"]);
  let correctionRequests = 0;
  let correctionCreated = false;
  let theme: "light" | "dark" = "light";
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (["/api/users/me", "/api/auth/me", "/api/auth/session"].includes(path)) {
      await route.fulfill({ json: { ...user, data: user } });
    } else if (path === "/api/users/me/appearance") {
      await route.fulfill({ json: { theme } });
    } else if (path === "/api/hr/kpi/achievements/1/correction") {
      correctionRequests += 1;
      correctionCreated = true;
      await route.fulfill({ json: { ...achievement, current: { ...achievement.current, revision: 2, status: "draft" } } });
    } else if (path === "/api/hr/kpi/achievements/1") {
      await route.fulfill({ json: achievement });
    } else if (path === "/api/hr/kpi/achievements/pending") {
      const status = new URL(route.request().url()).searchParams.get("status");
      await route.fulfill({ json: status === "correction_draft"
        ? correctionCreated ? [{ ...achievement, current: { ...achievement.current, revision: 2, status: "draft" } }] : []
        : status === "approved" && correctionCreated ? [] : [achievement] });
    } else if (path === "/api/employees") {
      await route.fulfill({ json: [{ id: 3, first_name: "Bosco", last_name: "Odillo", employee_no: "AIC-EMP-1003" }] });
    } else {
      await route.fulfill({ json: [] });
    }
  });

  await page.goto("/dashboard/kpi/reviews", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "View", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Bosco Odillo (AIC-EMP-1003) · Revision 1")).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Policy renewal rate" })).toBeVisible();
  await expect(dialog.getByText("Actual relative to target: 33.33%")).toBeVisible();
  await expect(dialog.getByText("Supporting activities are not automatically included in the actual result.")).toBeVisible();
  await expect(dialog.getByRole("article")).toHaveCount(2);
  await expect(page.locator(".fui-DialogSurface").first()).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(dialog.getByText("30%", { exact: true }).first()).toHaveCSS("font-size", "36px");
  await page.waitForTimeout(250);
  await page.screenshot({ path: info.outputPath("achievement-review-light.png") });

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: info.outputPath("achievement-review-mobile-light.png") });

  theme = "dark";
  await page.evaluate(() => localStorage.setItem("hrms.theme", "dark"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "View", exact: true }).first().click();
  await expect(page.locator("html.dark")).toHaveCount(1);
  await expect(page.locator(".fui-DialogSurface").first()).toHaveCSS("background-color", "rgb(32, 32, 32)");
  await page.waitForTimeout(250);
  await page.screenshot({ path: info.outputPath("achievement-review-mobile-dark.png") });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: info.outputPath("achievement-review-dark.png") });
  await expect(dialog.getByText("Need to change this approved result?")).toBeVisible();
  await dialog.getByRole("button", { name: "Create correction draft" }).click();
  const confirmation = dialog.getByRole("group", { name: "Confirm correction draft" });
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText("This will not change the approved result yet.");
  await page.waitForTimeout(250);
  await page.screenshot({ path: info.outputPath("approved-correction-confirm-dark.png") });
  expect(correctionRequests).toBe(0);
  await confirmation.getByRole("button", { name: "Cancel" }).click();
  expect(correctionRequests).toBe(0);
  await dialog.getByRole("button", { name: "Create correction draft" }).click();
  await dialog.getByRole("button", { name: "Confirm and create draft" }).click();
  await expect(dialog.getByRole("status")).toContainText("Correction draft created (revision 2)");
  await page.waitForTimeout(250);
  await page.screenshot({ path: info.outputPath("approved-correction-created-dark.png") });
  await expect(dialog.getByText("draft", { exact: true }).first()).toBeVisible();
  expect(correctionRequests).toBe(1);
  await dialog.getByRole("button", { name: "Close achievement review" }).click();
  await expect(page.getByRole("combobox", { name: "Show submissions" })).toHaveText("Correction drafts");
  await expect(page.getByRole("table")).toContainText("Correction draft");
});

test("submitted zero result retains review actions and evidence download", async ({ page }) => {
  const user = await installDashboardFixture(page, "company", ["kpi_achievements:review", "kpi_assignments:read"]);
  const submitted = {
    ...achievement,
    current: {
      ...achievement.current,
      status: "submitted",
      actual: 0,
      comments: null,
      activities: [],
      evidence: [{ id: 44, revisionId: 21, fileName: "renewals.pdf", fileSize: 2048, mimeType: "application/pdf", createdAt: "2026-11-24" }],
    },
  };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (["/api/users/me", "/api/auth/me", "/api/auth/session"].includes(path)) await route.fulfill({ json: { ...user, data: user } });
    else if (path === "/api/users/me/appearance") await route.fulfill({ json: { theme: "light" } });
    else if (path === "/api/hr/kpi/achievements/pending") await route.fulfill({ json: [submitted] });
    else if (path === "/api/hr/kpi/achievements/1") await route.fulfill({ json: submitted });
    else if (path === "/api/hr/kpi/achievements/1/evidence/44") await route.fulfill({ body: "%PDF-1.4\n", contentType: "application/pdf" });
    else if (path === "/api/employees") await route.fulfill({ json: [{ id: 3, first_name: "Bosco", last_name: "Odillo" }] });
    else await route.fulfill({ json: [] });
  });
  await page.goto("/dashboard/kpi/reviews", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Review", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("0%", { exact: true })).toBeVisible();
  await expect(dialog.getByText("No comments provided.")).toBeVisible();
  await expect(dialog.getByText("No supporting activities recorded.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Approve result" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Return for correction" })).toBeVisible();
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download" }).click();
  expect((await download).suggestedFilename()).toBe("renewals.pdf");
});
