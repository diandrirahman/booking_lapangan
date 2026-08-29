import { defineConfig, devices } from "@playwright/test";

const externalServers = process.env.PLAYWRIGHT_EXTERNAL_SERVERS === "true";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "ui-route-audit.spec.ts",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4180",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
  },
  webServer: externalServers
    ? undefined
    : {
        command:
          "node ../node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4180 --strictPort",
        url: "http://127.0.0.1:4180",
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
