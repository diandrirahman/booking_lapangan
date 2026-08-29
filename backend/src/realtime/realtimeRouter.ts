import { Router } from "express";
import type { Redis } from "ioredis";
import { asyncHandler } from "../http/asyncHandler.js";
import { publicIdSchema } from "../http/schemas/publicId.js";
import { requireSession } from "../identity/auth/sessionMiddleware.js";
import type { TenantAuthorizationService } from "../tenant/authorization/TenantAuthorizationService.js";
import { realtimeChannel, type RealtimeEvent } from "./OutboxPublisher.js";

export function createRealtimeRouter(
  redis: Redis,
  authorization: TenantAuthorizationService,
): Router {
  const router = Router();
  router.get(
    "/events",
    requireSession,
    asyncHandler(async (request, response) => {
      const tenantId = publicIdSchema.optional().parse(request.query.tenantId);
      const platformScope = request.query.scope === "platform";
      if (platformScope) {
        await authorization.requirePlatformAdmin(request.auth!.userId);
      }
      if (tenantId) {
        await authorization.requireTenantAccess(request.auth!.userId, tenantId);
      }

      response.status(200);
      response.setHeader("Content-Type", "text/event-stream");
      response.setHeader("Cache-Control", "no-cache, no-transform");
      response.setHeader("Connection", "keep-alive");
      response.flushHeaders();
      response.write(
        `event: ready\ndata: ${JSON.stringify({ restFallback: true })}\n\n`,
      );

      const subscriber = redis.duplicate();
      let closed = false;
      const heartbeat = setInterval(() => {
        if (!response.writableEnded) response.write(": heartbeat\n\n");
      }, 20_000);
      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        subscriber.disconnect();
      };
      subscriber.on("error", () => {
        if (closed) return;
        if (!response.writableEnded) {
          response.write(
            `event: degraded\ndata: ${JSON.stringify({ restFallback: true })}\n\n`,
          );
          response.end();
        }
        cleanup();
      });
      try {
        await subscriber.connect();
        await subscriber.subscribe(realtimeChannel());
      } catch {
        response.write(
          `event: degraded\ndata: ${JSON.stringify({ restFallback: true })}\n\n`,
        );
        response.end();
        cleanup();
        return;
      }
      subscriber.on("message", (_channel, rawEvent) => {
        const event = parseRealtimeEvent(rawEvent);
        if (!event) return;
        // An unscoped customer connection receives only the ready signal until
        // customer-specific subscriptions are introduced. Never broadcast a
        // tenant event merely because a user has a valid session.
        if (!platformScope && (!tenantId || event.tenantId !== tenantId)) return;
        response.write(
          `id: ${event.id}\nevent: ${event.eventType}\ndata: ${JSON.stringify(event)}\n\n`,
        );
      });
      request.on("close", cleanup);
    }),
  );
  return router;
}

function parseRealtimeEvent(value: string): RealtimeEvent | null {
  try {
    return JSON.parse(value) as RealtimeEvent;
  } catch {
    return null;
  }
}
