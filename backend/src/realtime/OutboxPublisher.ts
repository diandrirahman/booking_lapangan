import { asc, eq, isNull } from "drizzle-orm";
import type { Redis } from "ioredis";
import type { DatabaseConnection } from "../database/client.js";
import { formatPublicId } from "../database/ids.js";
import { outboxEvents } from "../database/schema/index.js";

const EVENT_CHANNEL = "lapangango:events";

export interface RealtimeEvent {
  id: string;
  eventType: string;
  resource: { type: string; id: string };
  tenantId: string | null;
  audienceUserId: string | null;
  version: number;
  occurredAt: string;
  hint: unknown;
}

export class OutboxPublisher {
  constructor(
    private readonly database: DatabaseConnection,
    private readonly redis: Redis,
  ) {}

  async publishPending(limit = 50): Promise<{ published: number; failed: number }> {
    const pendingEvents = await this.database.db
      .select()
      .from(outboxEvents)
      .where(isNull(outboxEvents.processedAt))
      .orderBy(asc(outboxEvents.createdAt))
      .limit(limit);
    let published = 0;
    let failed = 0;
    for (const event of pendingEvents) {
      try {
        await this.redis.publish(EVENT_CHANNEL, JSON.stringify(toRealtimeEvent(event)));
        await this.database.db
          .update(outboxEvents)
          .set({
            processedAt: new Date(),
            attemptCount: event.attemptCount + 1,
            lastError: null,
          })
          .where(eq(outboxEvents.id, event.id));
        published += 1;
      } catch (error) {
        await this.database.db
          .update(outboxEvents)
          .set({ attemptCount: event.attemptCount + 1, lastError: messageFrom(error) })
          .where(eq(outboxEvents.id, event.id));
        failed += 1;
      }
    }
    return { published, failed };
  }
}

export function realtimeChannel(): string {
  return EVENT_CHANNEL;
}

function toRealtimeEvent(event: typeof outboxEvents.$inferSelect): RealtimeEvent {
  return {
    id: formatPublicId(event.id),
    eventType: event.eventType,
    resource: { type: event.resourceType, id: formatPublicId(event.resourceId) },
    tenantId: event.tenantId === null ? null : formatPublicId(event.tenantId),
    audienceUserId:
      event.audienceUserId === null ? null : formatPublicId(event.audienceUserId),
    version: event.resourceVersion,
    occurredAt: event.occurredAt.toISOString(),
    hint: event.payload,
  };
}

function messageFrom(error: unknown): string {
  return error instanceof Error
    ? error.message.slice(0, 2_000)
    : "Unknown publish error";
}
