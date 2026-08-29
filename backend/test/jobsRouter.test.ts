import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { loadEnvironment } from "../src/config/environment.js";
import type { MaintenanceJobs } from "../src/platform/jobs/MaintenanceJobs.js";
import { createJobsRouter } from "../src/platform/jobs/jobsRouter.js";

describe("jobsRouter", () => {
  it("menerima GET yang dikirim Vercel Cron", async () => {
    const run = vi.fn().mockResolvedValue({
      skipped: false,
      expired: 0,
      published: 1,
      failed: 0,
    });
    const environment = loadEnvironment({
      NODE_ENV: "test",
      CRON_SECRET: "cron-secret-for-router-test",
    });
    const app = express();
    const jobs = { run } as unknown as MaintenanceJobs;
    app.use("/api/v1", createJobsRouter(jobs, environment));

    const response = await request(app)
      .get("/api/v1/internal/jobs/maintenance")
      .set("Authorization", "Bearer cron-secret-for-router-test");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ published: 1, failed: 0 });
    expect(run).toHaveBeenCalledOnce();
  });
});
