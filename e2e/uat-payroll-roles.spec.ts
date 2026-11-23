import { expect, test, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";

/**
 * Real-account UAT checks of the payroll screens. Runs only when
 * PLAYWRIGHT_BASE_URL points at UAT and the HRMS_E2E_* test logins exist
 * (frontend/.env.local, never committed). Uses the fictional UAT test users.
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "";
const enabled =
  /192\.168\.1\.30:9990/.test(BASE) && !!process.env.HRMS_E2E_ADMIN_EMAIL;

test.describe.configure({ mode: "serial" });
test.skip(
  !enabled,
  "UAT real-account checks need PLAYWRIGHT_BASE_URL=UAT and HRMS_E2E_* logins",
);
test.use({ video: "off" });

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s) from a base32 secret. */
function totp(secret: string, epochSeconds: number) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret.replace(/=+$/, "").toUpperCase()) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  }
  const key = Buffer.from(
    bits.match(/.{8}/g)!.map((byte) => parseInt(byte, 2)),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(epochSeconds / 30)));
  const hmac = createHmac("sha1", key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const value = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(value).padStart(6, "0");
}

type Role = "ADMIN" | "HR" | "FINANCE" | "MANAGEMENT" | "EMPLOYEE";

async function signIn(page: Page, role: Role) {
  await page.context().clearCookies();
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page
    .locator('input[type="email"]')
    .fill(process.env[`HRMS_E2E_${role}_EMAIL`]!);
  await page
    .locator('input[type="password"], input[autocomplete="current-password"]')
    .first()
    .fill(process.env[`HRMS_E2E_${role}_PASSWORD`]!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const twoFactor = page.getByText(/two-factor|authenticator code/i).first();
  await Promise.race([
    page.waitForURL(/\/dashboard/, { timeout: 60_000 }),
    twoFactor.waitFor({ state: "visible", timeout: 60_000 }),
  ]).catch(() => undefined);
  if (
    !page.url().includes("/dashboard") &&
    (await twoFactor.isVisible().catch(() => false))
  ) {
    // Server-time based code (UAT clock may differ from this machine).
    const res = await page.request.get(
      `${BASE.replace(":9990", ":9999")}/api/health/ready`,
    );
    const serverEpoch = Math.floor(Date.parse(res.headers()["date"]) / 1000);
    const code = totp(process.env.HRMS_E2E_ADMIN_TOTP_SECRET!, serverEpoch);
    await page
      .locator(
        'input[inputmode="numeric"], input[autocomplete="one-time-code"], input[type="text"]',
      )
      .first()
      .fill(code);
    await page
      .getByRole("button", { name: /verify|continue|sign in/i })
      .first()
      .click();
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
  await expect(page).toHaveURL(/\/dashboard/);
}

async function openPayroll(page: Page) {
  await page.goto("/dashboard/operations/payroll", {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("tab", { name: "Runs", exact: true }).first(),
  ).toBeVisible({ timeout: 150_000 });
}

test("preparer sees the closed UAT test run, eligibility and payments", async ({
  page,
}) => {
  await signIn(page, "ADMIN");
  await openPayroll(page);
  await page.getByRole("tab", { name: "Runs", exact: true }).first().click();
  await expect(page.getByText("Closed").first()).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole("button", { name: "Payments" }).first().click();
  const progress = page.getByRole("dialog");
  await expect(progress.getByText("Payment progress")).toBeVisible();
  await expect(progress.getByText(/Paid/).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("tab", { name: "Recoveries", exact: true })
    .first()
    .click();
  await expect(page.getByText("Overpayment recoveries")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Raise recovery" }),
  ).toBeVisible();
  await page
    .getByRole("tab", { name: "Configuration", exact: true })
    .first()
    .click();
  await page
    .getByRole("tab", { name: "Attendance deductions", exact: true })
    .first()
    .click();
  await expect(
    page.getByText(/Monetary attendance deductions are off/),
  ).toBeVisible();
});

for (const role of ["HR", "FINANCE", "MANAGEMENT"] as const) {
  test(`${role} approver can open payroll runs`, async ({ page }) => {
    await signIn(page, role);
    await openPayroll(page);
    await page.getByRole("tab", { name: "Runs", exact: true }).first().click();
    await expect(page.getByText(/PR-1-/).first()).toBeVisible({
      timeout: 60_000,
    });
  });
}

test("employee sees own payslip and cannot open payroll operations", async ({
  page,
}) => {
  await signIn(page, "EMPLOYEE");
  await page.goto("/dashboard/me/finance/payroll", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByText(/2026|Dec|December/).first()).toBeVisible({
    timeout: 120_000,
  });
  await page.goto("/dashboard/operations/payroll", {
    waitUntil: "domcontentloaded",
  });
  await expect(page).not.toHaveURL(
    /\/dashboard\/operations\/payroll(?:[/?]|$)/,
    { timeout: 60_000 },
  );
});

for (const [label, width, height] of [
  ["tablet", 820, 1180],
  ["mobile", 390, 844],
] as const) {
  test(`preparer payroll screen fits ${label}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await signIn(page, "ADMIN");
    await openPayroll(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
