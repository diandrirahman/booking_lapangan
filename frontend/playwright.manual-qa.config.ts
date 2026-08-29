import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "manual-qa-payment.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: "../docs/phase-b1/qa/evidence/2026-08-28-payment-flow/test-output",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 360, height: 800 },
      },
    },
  ],
});
