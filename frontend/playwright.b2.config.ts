import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.QA_BASE_URL;
const localBaseUrl = "http://127.0.0.1:4173";
const externalServers = process.env.PLAYWRIGHT_EXTERNAL_SERVERS === "true";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "phase-b2.spec.ts",
  fullyParallel: false,
  workers: 1,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: externalBaseUrl ?? localBaseUrl,
    viewport: { width: 1440, height: 900 },
    trace: "on-first-retry",
  },
  webServer:
    externalBaseUrl || externalServers
      ? undefined
      : [
          {
            command: "node backend/dist/index.js",
            cwd: "..",
            url: "http://127.0.0.1:3101/api/v1/health/live",
            reuseExistingServer: false,
            env: { APP_ORIGIN: localBaseUrl, PORT: "3101" },
            timeout: 120_000,
          },
          {
            command:
              "node ../node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort",
            url: localBaseUrl,
            reuseExistingServer: false,
            env: { VITE_API_PROXY_TARGET: "http://127.0.0.1:3101" },
            timeout: 120_000,
          },
        ],
});
