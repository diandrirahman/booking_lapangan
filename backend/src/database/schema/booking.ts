import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  datetime,
  foreignKey,
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
import { addons, courts, venues } from "./catalog.js";
import { tenants, users } from "./identity.js";
import { courtSlots } from "./scheduling.js";

export const bookings = mysqlTable(
  "bookings",
  {
    id: bigId(),
    bookingCode: varchar("booking_code", { length: 20 }).notNull(),
    tenantId: entityReference("tenant_id")
      .notNull()
      .references(() => tenants.id),
    venueId: entityReference("venue_id")
      .notNull()
      .references(() => venues.id),
    customerUserId: bigReference("customer_user_id").references(() => users.id),
    source: varchar("source", { length: 12 }).notNull(),
    status: varchar("status", { length: 24 }).notNull(),
    paymentMode: varchar("payment_mode", { length: 20 }).notNull(),
    totalAmount: bigint("total_amount", { mode: "number", unsigned: true }).notNull(),
    balanceDue: bigint("balance_due", { mode: "number", unsigned: true }).notNull(),
    holdExpiresAt: datetime("hold_expires_at", { mode: "date" }),
    confirmationExpiresAt: datetime("confirmation_expires_at", { mode: "date" }),
    cancellationPolicySnapshot: json("cancellation_policy_snapshot"),
    version: int("version", { unsigned: true }).notNull().default(1),
    createdByUserId: bigReference("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: datetime("created_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime("updated_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("booking_code_unique").on(table.bookingCode),
    index("booking_tenant_status_idx").on(table.tenantId, table.status),
    index("booking_customer_created_idx").on(table.customerUserId, table.createdAt),
    index("booking_hold_expiry_idx").on(table.holdExpiresAt, table.status),
  ],
);

export const bookingItems = mysqlTable("booking_items", {
  id: bigId(),
  bookingId: bigReference("booking_id")
    .notNull()
    .references(() => bookings.id),
  courtId: entityReference("court_id")
    .notNull()
    .references(() => courts.id),
  startsAt: datetime("starts_at", { mode: "date" }).notNull(),
  endsAt: datetime("ends_at", { mode: "date" }).notNull(),
  subtotal: bigint("subtotal", { mode: "number", unsigned: true }).notNull(),
});

export const bookingSlotReservations = mysqlTable("booking_slot_reservations", {
  courtSlotId: bigReference("court_slot_id")
    .primaryKey()
    .references(() => courtSlots.id),
  bookingId: bigReference("booking_id")
    .notNull()
    .references(() => bookings.id),
  bookingItemId: bigReference("booking_item_id")
    .notNull()
    .references(() => bookingItems.id),
  reservationStatus: varchar("reservation_status", { length: 20 }).notNull(),
  expiresAt: datetime("expires_at", { mode: "date" }),
  createdAt: datetime("created_at", { mode: "date" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const bookingSlotHistory = mysqlTable(
  "booking_slot_history",
  {
    id: bigId(),
    courtSlotId: bigReference("court_slot_id")
      .notNull()
      .references(() => courtSlots.id),
    bookingId: bigReference("booking_id")
      .notNull()
      .references(() => bookings.id),
    action: varchar("action", { length: 20 }).notNull(),
    reason: varchar("reason", { length: 255 }),
    occurredAt: datetime("occurred_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [index("booking_slot_history_idx").on(table.bookingId, table.occurredAt)],
);

export const bookingAddonItems = mysqlTable("booking_addon_items", {
  id: bigId(),
  bookingId: bigReference("booking_id")
    .notNull()
    .references(() => bookings.id),
  addonId: entityReference("addon_id")
    .notNull()
    .references(() => addons.id),
  nameSnapshot: varchar("name_snapshot", { length: 60 }).notNull(),
  unitPrice: bigint("unit_price", { mode: "number", unsigned: true }).notNull(),
  quantity: smallint("quantity", { unsigned: true }).notNull().default(1),
  totalPrice: bigint("total_price", { mode: "number", unsigned: true }).notNull(),
});

export const offlineBookingDetails = mysqlTable("offline_booking_details", {
  bookingId: bigReference("booking_id")
    .primaryKey()
    .references(() => bookings.id),
  customerName: varchar("customer_name", { length: 50 }).notNull(),
  customerPhone: varchar("customer_phone", { length: 16 }),
  channel: varchar("channel", { length: 20 }).notNull(),
  originalAmount: bigint("original_amount", {
    mode: "number",
    unsigned: true,
  }).notNull(),
  adjustedAmount: bigint("adjusted_amount", { mode: "number", unsigned: true }),
  adjustmentReason: text("adjustment_reason"),
});

export const bookingStateTransitions = mysqlTable(
  "booking_state_transitions",
  {
    id: bigId(),
    bookingId: bigReference("booking_id")
      .notNull()
      .references(() => bookings.id),
    fromStatus: varchar("from_status", { length: 24 }),
    toStatus: varchar("to_status", { length: 24 }).notNull(),
    actorUserId: bigReference("actor_user_id").references(() => users.id),
    reason: text("reason"),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [index("booking_transition_idx").on(table.bookingId, table.createdAt)],
);

export const attendanceRecords = mysqlTable("attendance_records", {
  id: bigId(),
  bookingId: bigReference("booking_id")
    .notNull()
    .references(() => bookings.id),
  status: varchar("status", { length: 16 }).notNull().default("PENDING"),
  checkedInAt: datetime("checked_in_at", { mode: "date" }),
  markedByUserId: bigReference("marked_by_user_id").references(() => users.id),
  reason: text("reason"),
});

export const bookingQrTokens = mysqlTable(
  "booking_qr_tokens",
  {
    id: bigId(),
    bookingId: bigReference("booking_id")
      .notNull()
      .references(() => bookings.id),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    active: boolean("active").notNull().default(true),
    expiresAt: datetime("expires_at", { mode: "date" }).notNull(),
    createdAt: datetime("created_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("booking_qr_token_hash_unique").on(table.tokenHash)],
);

export const bookingPriceLines = mysqlTable("booking_price_lines", {
  id: bigId(),
  bookingId: bigReference("booking_id")
    .notNull()
    .references(() => bookings.id),
  lineType: varchar("line_type", { length: 20 }).notNull(),
  referenceId: bigReference("reference_id"),
  label: varchar("label", { length: 100 }).notNull(),
  quantity: smallint("quantity", { unsigned: true }).notNull().default(1),
  unitAmount: bigint("unit_amount", { mode: "number", unsigned: true }).notNull(),
  totalAmount: bigint("total_amount", { mode: "number", unsigned: true }).notNull(),
  ruleSnapshot: json("rule_snapshot"),
});

export const bookingCancellations = mysqlTable("booking_cancellations", {
  id: bigId(),
  bookingId: bigReference("booking_id")
    .notNull()
    .references(() => bookings.id),
  actorUserId: bigReference("actor_user_id").references(() => users.id),
  reason: text("reason").notNull(),
  kind: varchar("kind", { length: 24 }).notNull(),
  refundBasisPoints: int("refund_basis_points", { unsigned: true }),
  refundableAmount: bigint("refundable_amount", { mode: "number", unsigned: true }),
  decision: varchar("decision", { length: 20 }),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`),
});

export const bookingReschedules = mysqlTable(
  "booking_reschedules",
  {
    id: bigId(),
    bookingId: bigReference("booking_id")
      .notNull()
      .references(() => bookings.id),
    previousSlotIds: json("previous_slot_ids").notNull(),
    newSlotIds: json("new_slot_ids").notNull(),
    reason: text("reason").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("COMPLETED"),
    priceDifference: bigint("price_difference", { mode: "number" })
      .notNull()
      .default(0),
    policySnapshot: json("policy_snapshot"),
    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }),
    finalizedAt: datetime("finalized_at", { mode: "date", fsp: 3 }),
    actorUserId: bigReference("actor_user_id").references(() => users.id),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [uniqueIndex("booking_reschedule_once_unique").on(table.bookingId)],
);

export const cancellationPolicyTemplates = mysqlTable("cancellation_policy_templates", {
  id: bigId(),
  name: varchar("name", { length: 80 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdByUserId: bigReference("created_by_user_id").references(() => users.id),
  createdAt: datetime("created_at", { mode: "date" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const cancellationPolicyTiers = mysqlTable(
  "cancellation_policy_tiers",
  {
    id: bigId(),
    templateId: bigReference("template_id").notNull(),
    minimumHoursBefore: int("minimum_hours_before", { unsigned: true }).notNull(),
    maximumHoursBefore: int("maximum_hours_before", { unsigned: true }),
    refundBasisPoints: int("refund_basis_points", { unsigned: true }).notNull(),
  },
  (table) => [
    index("cancellation_policy_tier_idx").on(table.templateId),
    foreignKey({
      name: "cancel_policy_tier_template_fk",
      columns: [table.templateId],
      foreignColumns: [cancellationPolicyTemplates.id],
    }),
  ],
);

export const venuePolicyAssignments = mysqlTable(
  "venue_policy_assignments",
  {
    venueId: entityReference("venue_id")
      .primaryKey()
      .references(() => venues.id),
    templateId: bigReference("template_id").notNull(),
  },
  (table) => [
    foreignKey({
      name: "venue_policy_template_fk",
      columns: [table.templateId],
      foreignColumns: [cancellationPolicyTemplates.id],
    }),
  ],
);
