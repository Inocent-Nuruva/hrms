import { defineConfig, devices } from "@playwright/test"

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
const localURL = new URL(baseURL)
const runLocalServer = ["localhost", "127.0.0.1"].includes(localURL.hostname)

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["json", { outputFile: "outputs/ui-audit/playwright-results.json" }],
  ],
  outputDir: "test-results",
  webServer: runLocalServer
    ? {
        command: `npx next dev --webpack --disable-source-maps -p ${localURL.port || "3000"}`,
        url: new URL("/login", baseURL).toString(),
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
          : undefined,
      },
    },
  ],
})
