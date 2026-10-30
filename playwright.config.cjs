const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    serviceWorkers: "allow",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
          : {}
      }
    },
    {
      name: "webkit-iphone",
      use: { ...devices["iPhone 13"] }
    }
  ],
  webServer: {
    command: "node tests/e2e/server.cjs",
    url: "http://127.0.0.1:4173/__test/health",
    reuseExistingServer: false,
    timeout: 15_000
  }
});
