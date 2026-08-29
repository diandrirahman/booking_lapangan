import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import type { Environment } from "../../config/environment.js";
import { ApiError } from "../../http/ApiError.js";
import { asyncHandler } from "../../http/asyncHandler.js";
import type { MaintenanceJobs } from "./MaintenanceJobs.js";

export function createJobsRouter(
  jobs: MaintenanceJobs,
  environment: Environment,
): Router {
  const router = Router();
  const runMaintenance = asyncHandler(async (request, response) => {
    if (!matchesSecret(request.header("Authorization"), environment.CRON_SECRET)) {
      throw new ApiError(401, "INVALID_CRON_SECRET", "Cron credential tidak valid.");
    }
    response.json(await jobs.run());
  });

  // Vercel Cron uses GET; POST remains available for explicit local recovery tests.
  router.get("/internal/jobs/maintenance", runMaintenance);
  router.post("/internal/jobs/maintenance", runMaintenance);
  return router;
}

function matchesSecret(
  authorization: string | undefined,
  expectedSecret: string,
): boolean {
  const suppliedSecret = authorization?.replace(/^Bearer\s+/i, "") ?? "";
  const supplied = Buffer.from(suppliedSecret);
  const expected = Buffer.from(expectedSecret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
