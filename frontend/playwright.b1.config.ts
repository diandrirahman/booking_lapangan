import { defineConfig, devices } from "@playwright/test";

const externalServers = process.env.PLAYWRIGHT_EXTERNAL_SERVERS === "true";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "phase-b1.spec.ts",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  webServer: externalServers
    ? undefined
    : [
        {
          command: "node backend/dist/index.js",
          cwd: "..",
          url: "http://127.0.0.1:3101/api/v1/health/live",
          reuseExistingServer: false,
          env: {
            APP_ORIGIN: "http://127.0.0.1:4173",
            PORT: "3101",
          },
          timeout: 120_000,
        },
        {
          command:
            "node ../node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort",
          url: "http://127.0.0.1:4173",
          reuseExistingServer: false,
          env: {
            VITE_API_PROXY_TARGET: "http://127.0.0.1:3101",
          },
          timeout: 120_000,
        },
      ],
  projects: [
    {
      name: "mobile-b1",
      use: { ...devices["Pixel 5"], viewport: { width: 360, height: 800 } },
    },
    {
      name: "tablet-portrait-b1",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: "tablet-landscape-b1",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1024, height: 768 },
      },
    },
    {
      name: "desktop-b1",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
});
