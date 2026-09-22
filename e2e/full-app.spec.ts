import { expect, test, type Page } from "@playwright/test";

import { loginAs, readTestUsers } from "./helpers/auth";
import {
  attachPageListeners,
  auditRoute,
  collectNavLabels,
  writeAuditReport,
  type PageAudit,
} from "./helpers/audit";
import {
  ADMIN_SMOKE_ROUTES,
  HR_SMOKE_ROUTES,
  JOURNEY_CREATE_PAGES,
} from "./routes";

const audits: PageAudit[] = [];
const extra: Record<string, unknown> = {
  journeys: [] as unknown[],
  nav: {} as Record<string, string[]>,
};

async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: `outputs/ui-audit/${name}.png`,
    fullPage: true,
  });
}

async function inspectCreateDialog(page: Page, title: string) {
  const createButton = page.getByRole("button", { name: /create/i }).first();
  const visible = await createButton.isVisible().catch(() => false);
  if (!visible) {
    return { title, opened: false, issue: "Create button not visible." };
  }

  await createButton.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const dialogTitle = (
    (await dialog.locator("h2, h3").first().textContent()) || ""
  ).trim();
  const description = (
    (await dialog
      .locator("p")
      .first()
      .textContent()
      .catch(() => "")) || ""
  ).trim();
  const labels = (await dialog.locator("label span, label").allTextContents())
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 20);
  await screenshot(page, `create-${title.toLowerCase().replace(/\s+/g, "-")}`);
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" }).catch(() => undefined);

  const issues: string[] = [];
  if (!description || description.length < 12) {
    issues.push(
      "Create dialog has no customer-facing description of what this record is for.",
    );
  }
  if (labels.length === 0) {
    issues.push("Create dialog rendered no field labels.");
  }
  return { title, opened: true, dialogTitle, description, labels, issues };
}

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  await writeAuditReport(audits, extra);
});

test("admin can sign in and reach the dashboard", async ({ page }) => {
  const { admin } = readTestUsers();
  await loginAs(page, admin);
  extra.nav = { ...(extra.nav as object), admin: await collectNavLabels(page) };
  await screenshot(page, "admin-dashboard");
  await expect(page).toHaveURL(/\/dashboard/);
});

test("admin smoke: every operations page loads", async ({ page }) => {
  test.setTimeout(30 * 60 * 1000);
  const { admin } = readTestUsers();
  await loginAs(page, admin);
  const bags = attachPageListeners(page);

  for (const route of ADMIN_SMOKE_ROUTES) {
    const result = await auditRoute(page, "admin", route, bags);
    audits.push(result);
  }

  const fatal = audits.filter(
    (row) =>
      row.role === "admin" &&
      (row.status === "redirected-login" || row.status === "blank"),
  );
  expect(
    fatal,
    fatal.map((row) => `${row.path}: ${row.issues.join("; ")}`).join("\n"),
  ).toHaveLength(0);
});

test("admin journey: timetable, days, shifts, leave create dialogs", async ({
  page,
}) => {
  const { admin } = readTestUsers();
  await loginAs(page, admin);
  const journeys: unknown[] = [];

  for (const entry of JOURNEY_CREATE_PAGES) {
    await page.goto(entry.path, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const pageTitle = (
      (await page
        .locator("h1")
        .first()
        .textContent()
        .catch(() => "")) || ""
    ).trim();
    const descriptionOnPage = await page
      .getByText(/master timetable|day entries that belong/i)
      .count();
    const dialog = await inspectCreateDialog(page, entry.title);
    journeys.push({
      path: entry.path,
      pageTitle,
      descriptionOnPage,
      dialog,
    });
  }

  extra.journeys = journeys;
  await screenshot(page, "admin-timetable-days");
});

test("admin journey: employees, leave, attendance operations", async ({
  page,
}) => {
  const { admin } = readTestUsers();
  await loginAs(page, admin);

  await page.goto("/dashboard/employees/all", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2000);
  await screenshot(page, "admin-employees");
  const employeeBody = await page.locator("body").innerText();
  expect(employeeBody.toLowerCase()).not.toContain("next.js error");

  await page.goto("/dashboard/leave-management/requests", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2000);
  await screenshot(page, "admin-leave-requests");

  await page.goto("/dashboard/attendance/daily-summaries", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2000);
  await screenshot(page, "admin-daily-summaries");
});

test("admin journey: loan operations reports and controls", async ({
  page,
}) => {
  const { admin } = readTestUsers();
  await loginAs(page, admin);

  await page.goto("/dashboard/finance/reports", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2000);
  await screenshot(page, "admin-finance-reports");
  await expect(
    page.getByText(/finance reports|loan reports/i).first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /export csv/i })).toBeVisible();
  await expect(page.getByText(/import bank csv/i).first()).toBeVisible();

  await page.goto("/dashboard/finance/accounts", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2000);
  await screenshot(page, "admin-finance-accounts");
  await expect(page.locator("body")).not.toContainText(/next\.js error/i);
});

test("hr can sign in and reach the dashboard", async ({ page }) => {
  const { hr } = readTestUsers();
  await loginAs(page, hr);
  extra.nav = { ...(extra.nav as object), hr: await collectNavLabels(page) };
  await screenshot(page, "hr-dashboard");
  await expect(page).toHaveURL(/\/dashboard/);
});

test("hr smoke: self-service and HR workspace pages load", async ({ page }) => {
  test.setTimeout(20 * 60 * 1000);
  const { hr } = readTestUsers();
  await loginAs(page, hr);
  const bags = attachPageListeners(page);

  for (const route of HR_SMOKE_ROUTES) {
    const result = await auditRoute(page, "hr", route, bags);
    audits.push(result);
  }

  const fatal = audits.filter(
    (row) =>
      row.role === "hr" &&
      (row.status === "redirected-login" || row.status === "blank"),
  );
  expect(
    fatal,
    fatal.map((row) => `${row.path}: ${row.issues.join("; ")}`).join("\n"),
  ).toHaveLength(0);
});

test("hr journey: profile, leave, attendance, timetable", async ({ page }) => {
  const { hr } = readTestUsers();
  await loginAs(page, hr);

  await page.goto("/dashboard/me/profile", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await screenshot(page, "hr-profile");

  await page.goto("/dashboard/me/leave/requests", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2000);
  await screenshot(page, "hr-leave-requests");

  await page.goto("/dashboard/attendance/today", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2000);
  await screenshot(page, "hr-attendance-today");

  await page.goto("/dashboard/attendance/timetables", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2000);
  await screenshot(page, "hr-timetables");

  await page.goto("/dashboard/attendance/timetable-days", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2000);
  await screenshot(page, "hr-timetable-days");
});

test("hr journey: self-service loan workspace", async ({ page }) => {
  const { hr } = readTestUsers();
  await loginAs(page, hr);

  await page.goto("/dashboard/me/finance/applications", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2000);
  await screenshot(page, "hr-finance-applications");
  await expect(page.getByText(/loans and advances/i).first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: /new application/i }),
  ).toBeVisible();
});
