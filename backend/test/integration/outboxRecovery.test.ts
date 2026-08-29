import { eq } from "drizzle-orm";
import type { Redis } from "ioredis";
import { afterAll, describe, expect, it } from "vitest";
import { outboxEvents } from "../../src/database/schema/index.js";
import { OutboxPublisher } from "../../src/realtime/OutboxPublisher.js";
import { testDatabase } from "../support/databaseTestHarness.js";

describe("outbox recovery", () => {
  it("menyimpan kegagalan publish lalu memulihkannya secara idempotent", async () => {
    const [created] = await testDatabase.db
      .insert(outboxEvents)
      .values({
        tenantId: 1,
        eventType: "qa.outbox.recovery",
        resourceType: "venue",
        resourceId: 1,
        resourceVersion: 99,
        payload: { hint: "qa-recovery" },
        occurredAt: new Date(),
      })
      .$returningId();
    if (!created) throw new Error("Gagal membuat event outbox test.");

    const failingRedis = {
      publish: () => Promise.reject(new Error("Redis test tidak tersedia")),
    } as unknown as Redis;
    await new OutboxPublisher(testDatabase, failingRedis).publishPending(10_000);

    const [failedEvent] = await testDatabase.db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, created.id))
      .limit(1);
    expect(failedEvent).toMatchObject({
      processedAt: null,
      attemptCount: 1,
      lastError: "Redis test tidak tersedia",
    });

    const publishedPayloads: string[] = [];
    const recoveredRedis = {
      publish: (_channel: string, payload: string) => {
        publishedPayloads.push(payload);
        return Promise.resolve(1);
      },
    } as unknown as Redis;
    await new OutboxPublisher(testDatabase, recoveredRedis).publishPending(10_000);

    const [recoveredEvent] = await testDatabase.db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, created.id))
      .limit(1);
    expect(recoveredEvent?.processedAt).toBeInstanceOf(Date);
    expect(recoveredEvent?.attemptCount).toBe(2);
    expect(
      publishedPayloads.some((payload) => payload.includes("qa.outbox.recovery")),
    ).toBe(true);

    await testDatabase.db.delete(outboxEvents).where(eq(outboxEvents.id, created.id));
  });
});

afterAll(async () => testDatabase.close());
