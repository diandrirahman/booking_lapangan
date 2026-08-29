import { sql } from "drizzle-orm";
import {
  datetime,
  index,
  int,
  json,
  mysqlTable,
  smallint,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { bigId, bigReference, entityReference } from "./columns.js";
import { tenants, users } from "./identity.js";

export const userNotifications = mysqlTable(
  "user_notifications",
  {
    id: bigId(),
    userId: bigReference("user_id")
      .notNull()
      .references(() => users.id),
    kind: varchar("kind", { length: 20 }).notNull(),
    title: varchar("title", { length: 80 }).notNull(),
    body: varchar("body", { length: 240 }).notNull(),
    actionPath: varchar("action_path", { length: 180 }).notNull(),
    readAt: datetime("read_at", { mode: "date", fsp: 3 }),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [index("user_notifications_feed_idx").on(table.userId, table.createdAt)],
);

export const commandIdempotency = mysqlTable(
  "command_idempotency",
  {
    id: bigId(),
    scope: varchar("scope", { length: 50 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 100 }).notNull(),
    actorUserId: bigReference("actor_user_id")
      .notNull()
      .references(() => users.id),
    resourceId: bigReference("resource_id"),
    responseStatus: smallint("response_status", { unsigned: true }),
    responseBody: json("response_body"),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    uniqueIndex("command_idempotency_unique").on(
      table.scope,
      table.actorUserId,
      table.idempotencyKey,
    ),
  ],
);

export const outboxEvents = mysqlTable(
  "outbox_events",
  {
    id: bigId(),
    tenantId: entityReference("tenant_id").references(() => tenants.id),
    eventType: varchar("event_type", { length: 80 }).notNull(),
    resourceType: varchar("resource_type", { length: 40 }).notNull(),
    resourceId: bigReference("resource_id").notNull(),
    resourceVersion: int("resource_version", { unsigned: true }).notNull(),
    payload: json("payload").notNull(),
    occurredAt: datetime("occurred_at", { mode: "date", fsp: 3 }).notNull(),
    processedAt: datetime("processed_at", { mode: "date", fsp: 3 }),
    attemptCount: smallint("attempt_count", { unsigned: true }).notNull().default(0),
    lastError: text("last_error"),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [index("outbox_pending_idx").on(table.processedAt, table.createdAt)],
);

export const inboxEvents = mysqlTable(
  "inbox_events",
  {
    id: bigId(),
    source: varchar("source", { length: 40 }).notNull(),
    externalEventId: varchar("external_event_id", { length: 100 }).notNull(),
    payload: json("payload").notNull(),
    processedAt: datetime("processed_at", { mode: "date", fsp: 3 }),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    uniqueIndex("inbox_source_event_unique").on(table.source, table.externalEventId),
  ],
);
