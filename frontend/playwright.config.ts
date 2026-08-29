import { defineConfig, devices } from "@playwright/test";

const externalServers = process.env.PLAYWRIGHT_EXTERNAL_SERVERS === "true";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "phase-a.spec.ts",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4173", trace: "on-first-retry" },
  webServer: externalServers
    ? undefined
    : {
        command:
          "node ../node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: false,
      },
  projects: [
    {
      name: "mobile",
      use: { ...devices["Pixel 5"], viewport: { width: 360, height: 800 } },
    },
    {
      name: "tablet-portrait",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: "tablet-landscape",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1024, height: 768 },
      },
    },
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
