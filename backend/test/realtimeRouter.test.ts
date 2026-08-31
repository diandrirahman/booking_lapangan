import { EventEmitter } from "node:events";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { loadEnvironment } from "../src/config/environment.js";
import { formatPublicId } from "../src/database/ids.js";
import {
  canReceiveRealtimeEvent,
  createRealtimeRouter,
} from "../src/realtime/realtimeRouter.js";
import type { RealtimeEvent } from "../src/realtime/OutboxPublisher.js";
import type { TenantAuthorizationService } from "../src/tenant/authorization/TenantAuthorizationService.js";
import type { Redis } from "ioredis";

class FailingSubscriber extends EventEmitter {
  readonly disconnect = vi.fn();
  connect = vi.fn().mockRejectedValue(new Error("Redis down"));
  subscribe = vi.fn();
}

class SuccessfulSubscriber extends EventEmitter {
  readonly disconnect = vi.fn();
  connect = vi.fn().mockResolvedValue(undefined);
  subscribe = vi.fn().mockResolvedValue(undefined);
}

describe("realtimeRouter", () => {
  it("memisahkan audience Customer, tenant, dan platform", () => {
    const customerId = formatPublicId(100);
    const tenantId = formatPublicId(1);
    const event: RealtimeEvent = {
      id: formatPublicId(1),
      eventType: "payment.status_changed",
      resource: { type: "payment_attempt", id: formatPublicId(2) },
      tenantId,
      audienceUserId: customerId,
      version: 1,
      occurredAt: new Date().toISOString(),
      hint: { status: "PAID" },
    };

    expect(
      canReceiveRealtimeEvent(event, { userId: customerId, platformScope: false }),
    ).toBe(true);
    expect(
      canReceiveRealtimeEvent(event, {
        userId: formatPublicId(101),
        platformScope: false,
      }),
    ).toBe(false);
    expect(
      canReceiveRealtimeEvent(event, {
        userId: formatPublicId(200),
        tenantId,
        platformScope: false,
      }),
    ).toBe(true);
    expect(
      canReceiveRealtimeEvent(event, {
        userId: formatPublicId(4),
        platformScope: true,
      }),
    ).toBe(true);
  });

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

  it("menutup stream terencana sebelum batas runtime provider", async () => {
    const environment = loadEnvironment({ NODE_ENV: "test" });
    const subscriber = new SuccessfulSubscriber();
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
      routers: [createRealtimeRouter(redis, {} as TenantAuthorizationService, 10)],
    });

    const response = await request(app)
      .get("/api/v1/events")
      .set("Cookie", `${environment.SESSION_COOKIE_NAME}=token`);

    expect(response.status).toBe(200);
    expect(response.text).toContain("event: ready");
    expect(subscriber.subscribe).toHaveBeenCalledOnce();
    expect(subscriber.disconnect).toHaveBeenCalledOnce();
  });
});
