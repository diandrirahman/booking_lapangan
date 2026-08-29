import { Router } from "express";

export interface HealthDependencies {
  readinessCheck(): Promise<void>;
}

export function createHealthRouter(dependencies: HealthDependencies): Router {
  const router = Router();

  router.get("/live", (_request, response) => {
    response.json({ status: "ok", service: "lapangango-api" });
  });

  router.get("/ready", async (_request, response) => {
    try {
      await dependencies.readinessCheck();
      response.json({ status: "ready", service: "lapangango-api" });
    } catch {
      response.status(503).json({
        status: "degraded",
        service: "lapangango-api",
      });
    }
  });

  return router;
}
