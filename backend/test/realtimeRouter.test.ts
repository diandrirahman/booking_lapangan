import { EventEmitter } from "node:events";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { loadEnvironment } from "../src/config/environment.js";
import { formatPublicId } from "../src/database/ids.js";
import { createRealtimeRouter } from "../src/realtime/realtimeRouter.js";
import type { TenantAuthorizationService } from "../src/tenant/authorization/TenantAuthorizationService.js";
import type { Redis } from "ioredis";

class FailingSubscriber extends EventEmitter {
  readonly disconnect = vi.fn();
  connect = vi.fn().mockRejectedValue(new Error("Redis down"));
  subscribe = vi.fn();
}

describe("realtimeRouter", () => {
  it("mengirim degraded dan disconnect aman ketika Redis gagal", async () => {
    const environment = loadEnvironment({ NODE_ENV: "test" });
    const subscriber = new FailingSubscriber();
    const redis = {
      duplicate: () => subscriber,
    } as unknown as Redis;
    const app = createApp({
      environment,
      readinessCheck: () => Promise.resolve(),
      sessionStore: {
        create: vi.fn(),
        revoke: vi.fn(),
        findByToken: vi.fn().mockResolvedValue({
          id: "realtime-session",
          userId: formatPublicId(1),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      },
      routers: [createRealtimeRouter(redis, {} as TenantAuthorizationService)],
    });
    const response = await request(app)
      .get("/api/v1/events")
      .set("Cookie", `${environment.SESSION_COOKIE_NAME}=token`);
    expect(response.status).toBe(200);
    expect(response.text).toContain("event: degraded");
    expect(subscriber.disconnect).toHaveBeenCalledOnce();
  });
});
