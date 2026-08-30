import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { loadEnvironment } from "../src/config/environment.js";

const environment = loadEnvironment({ NODE_ENV: "test" });

describe("health API", () => {
  it("returns a stable liveness response and request ID", async () => {
    const app = createApp({ environment, readinessCheck: async () => undefined });

    const response = await request(app).get("/api/v1/health/live");

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toMatch(/^req_/);
    expect(response.body).toEqual({ status: "ok", service: "lapangango-api" });
  });

  it("uses the forwarded client address behind the deployment proxy", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const app = createApp({ environment, readinessCheck: async () => undefined });
      const response = await request(app)
        .get("/api/v1/health/live")
        .set("X-Forwarded-For", "203.0.113.10")
        .set("Forwarded", "for=203.0.113.10;proto=https");

      expect(response.status).toBe(200);
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("reports degraded readiness without affecting liveness", async () => {
    const app = createApp({
      environment,
      readinessCheck: async () => {
        throw new Error("redis unavailable");
      },
    });

    const readiness = await request(app).get("/api/v1/health/ready");
    const liveness = await request(app).get("/api/v1/health/live");

    expect(readiness.status).toBe(503);
    expect(readiness.body).toEqual({
      status: "degraded",
      service: "lapangango-api",
    });
    expect(liveness.status).toBe(200);
  });

  it("uses the documented error envelope", async () => {
    const app = createApp({ environment, readinessCheck: async () => undefined });

    const response = await request(app).get("/api/v1/not-found");

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      code: "ROUTE_NOT_FOUND",
      requestId: expect.stringMatching(/^req_/),
    });
  });
});
