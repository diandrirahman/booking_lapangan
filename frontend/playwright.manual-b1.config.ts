import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.QA_BASE_URL;
const localBaseUrl = "http://127.0.0.1:4175";
const externalServers = process.env.PLAYWRIGHT_EXTERNAL_SERVERS === "true";

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["manual-qa-b1.spec.ts", "realtime-slo.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: "../docs/phase-b1/qa/evidence/2026-08-28-b1-local-readiness/test-output",
  reporter: [
    ["list"],
    [
      "html",
      {
        open: "never",
        outputFolder:
          "../docs/phase-b1/qa/evidence/2026-08-28-b1-local-readiness/playwright-report",
      },
    ],
  ],
  use: {
    baseURL: externalBaseUrl ?? localBaseUrl,
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer:
    externalBaseUrl || externalServers
      ? undefined
      : [
          {
            command: "node backend/dist/index.js",
            cwd: "..",
            url: "http://127.0.0.1:3102/api/v1/health/live",
            reuseExistingServer: false,
            env: {
              APP_ORIGIN: localBaseUrl,
              DATABASE_URL:
                "mysql://lapangango:lapangango_test@127.0.0.1:3308/lapangango_e2e",
              NODE_ENV: "test",
              PORT: "3102",
              REDIS_URL: "redis://127.0.0.1:6380/1",
            },
            timeout: 120_000,
          },
          {
            command:
              "node ../node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4175",
            url: localBaseUrl,
            reuseExistingServer: false,
            env: {
              VITE_API_PROXY_TARGET: "http://127.0.0.1:3102",
            },
            timeout: 120_000,
          },
        ],
  projects: [
    {
      name: "mobile-360x800",
      use: { ...devices["Pixel 5"], viewport: { width: 360, height: 800 } },
    },
    {
      name: "tablet-768x1024",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: "landscape-1024x768",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1024, height: 768 },
      },
    },
    {
      name: "desktop-1440x900",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
