import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    browserName: "chromium",
    channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
    headless: true,
    viewport: { width: 1440, height: 1100 },
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "node node_modules/next/dist/bin/next dev --hostname localhost --port 3000",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60000,
  },
})
