import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  datetime,
  foreignKey,
  index,
  json,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { bigId, bigReference } from "./columns.js";
import { bookings } from "./booking.js";
import { users } from "./identity.js";

export const paymentAttempts = mysqlTable(
  "payment_attempts",
  {
    id: bigId(),
    paymentCode: varchar("payment_code", { length: 20 }).notNull(),
    bookingId: bigReference("booking_id")
      .notNull()
      .references(() => bookings.id),
    kind: varchar("kind", { length: 20 }).notNull(),
    amount: bigint("amount", { mode: "number", unsigned: true }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("CREATED"),
    provider: varchar("provider", { length: 20 }).notNull().default("MIDTRANS"),
    providerReference: varchar("provider_reference", { length: 100 }),
    redirectUrl: varchar("redirect_url", { length: 2048 }),
    idempotencyKey: varchar("idempotency_key", { length: 100 }).notNull(),
    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }),
    paidAt: datetime("paid_at", { mode: "date", fsp: 3 }),
    sandbox: boolean("sandbox").notNull().default(true),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    uniqueIndex("payment_attempt_code_unique").on(table.paymentCode),
    uniqueIndex("payment_attempt_idempotency_unique").on(table.idempotencyKey),
    index("payment_booking_created_idx").on(table.bookingId, table.createdAt),
  ],
);

export const paymentProviderEvents = mysqlTable(
  "payment_provider_events",
  {
    id: bigId(),
    providerEventId: varchar("provider_event_id", { length: 100 }).notNull(),
    paymentAttemptId: bigReference("payment_attempt_id"),
    signatureVerified: boolean("signature_verified").notNull(),
    payload: json("payload").notNull(),
    processedAt: datetime("processed_at", { mode: "date", fsp: 3 }),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    uniqueIndex("payment_provider_event_unique").on(table.providerEventId),
    foreignKey({
      name: "payment_provider_events_attempt_fk",
      columns: [table.paymentAttemptId],
      foreignColumns: [paymentAttempts.id],
    }),
  ],
);

export const bookingPaymentSummaries = mysqlTable("booking_payment_summaries", {
  bookingId: bigReference("booking_id")
    .primaryKey()
    .references(() => bookings.id),
  status: varchar("status", { length: 20 }).notNull().default("UNPAID"),
  totalPaid: bigint("total_paid", { mode: "number", unsigned: true })
    .notNull()
    .default(0),
  totalRefunded: bigint("total_refunded", { mode: "number", unsigned: true })
    .notNull()
    .default(0),
  balanceDue: bigint("balance_due", { mode: "number", unsigned: true }).notNull(),
  updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`),
});

export const refunds = mysqlTable(
  "refunds",
  {
    id: bigId(),
    bookingId: bigReference("booking_id")
      .notNull()
      .references(() => bookings.id),
    paymentAttemptId: bigReference("payment_attempt_id").references(
      () => paymentAttempts.id,
    ),
    amount: bigint("amount", { mode: "number", unsigned: true }).notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    kind: varchar("kind", { length: 24 }).notNull(),
    reason: text("reason").notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 100 }).notNull(),
    requestedByUserId: bigReference("requested_by_user_id").references(() => users.id),
    providerReference: varchar("provider_reference", { length: 100 }),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    uniqueIndex("refund_idempotency_unique").on(table.idempotencyKey),
    index("refund_booking_status_idx").on(table.bookingId, table.status),
  ],
);

export const refundStateTransitions = mysqlTable("refund_state_transitions", {
  id: bigId(),
  refundId: bigReference("refund_id")
    .notNull()
    .references(() => refunds.id),
  fromStatus: varchar("from_status", { length: 20 }),
  toStatus: varchar("to_status", { length: 20 }).notNull(),
  payload: json("payload"),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`),
});
