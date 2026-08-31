import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  datetime,
  foreignKey,
  index,
  int,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { bigId, bigReference, entityReference } from "./columns.js";
import { bookings } from "./booking.js";
import { promotions } from "./catalog.js";
import { tenants, users } from "./identity.js";

export const commissionConfigs = mysqlTable(
  "commission_configs",
  {
    id: bigId(),
    tenantId: entityReference("tenant_id").references(() => tenants.id),
    rateBasisPoints: int("rate_basis_points", { unsigned: true }).notNull(),
    effectiveFrom: datetime("effective_from", { mode: "date" }).notNull(),
    effectiveTo: datetime("effective_to", { mode: "date" }),
    trialDays: int("trial_days", { unsigned: true }),
    trialCompletedBookingLimit: int("trial_completed_booking_limit", {
      unsigned: true,
    }),
    gatewayFeeFunding: varchar("gateway_fee_funding", { length: 20 })
      .notNull()
      .default("OWNER"),
    gatewayFeeBasisPoints: int("gateway_fee_basis_points", { unsigned: true })
      .notNull()
      .default(250),
    subsidyBudget: bigint("subsidy_budget", { mode: "number", unsigned: true }),
    subsidyUsed: bigint("subsidy_used", { mode: "number", unsigned: true })
      .notNull()
      .default(0),
    reason: text("reason").notNull(),
    createdByUserId: bigReference("created_by_user_id").references(() => users.id),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    index("commission_config_effective_idx").on(table.tenantId, table.effectiveFrom),
  ],
);

export const bookingFinancialSnapshots = mysqlTable(
  "booking_financial_snapshots",
  {
    id: bigId(),
    bookingId: bigReference("booking_id")
      .notNull()
      .references(() => bookings.id),
    bookingVersion: int("booking_version", { unsigned: true }).notNull(),
    commissionConfigId: bigReference("commission_config_id"),
    promotionId: entityReference("promotion_id").references(() => promotions.id),
    paymentMode: varchar("payment_mode", { length: 20 }).notNull(),
    reservationAmount: bigint("reservation_amount", { mode: "number", unsigned: true })
      .notNull()
      .default(0),
    dpAmount: bigint("dp_amount", { mode: "number", unsigned: true })
      .notNull()
      .default(0),
    courtSubtotal: bigint("court_subtotal", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    addonSubtotal: bigint("addon_subtotal", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    ownerDiscount: bigint("owner_discount", { mode: "number", unsigned: true })
      .notNull()
      .default(0),
    platformDiscount: bigint("platform_discount", { mode: "number", unsigned: true })
      .notNull()
      .default(0),
    commissionBase: bigint("commission_base", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    commissionRateBasisPoints: int("commission_rate_basis_points", {
      unsigned: true,
    }).notNull(),
    platformCommission: bigint("platform_commission", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    gatewayFee: bigint("gateway_fee", { mode: "number", unsigned: true })
      .notNull()
      .default(0),
    gatewayFeeFunding: varchar("gateway_fee_funding", { length: 20 })
      .notNull()
      .default("OWNER"),
    ownerNet: bigint("owner_net", { mode: "number" }).notNull(),
    taxPlaceholder: bigint("tax_placeholder", { mode: "number", unsigned: true })
      .notNull()
      .default(0),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    uniqueIndex("financial_snapshot_booking_version_unique").on(
      table.bookingId,
      table.bookingVersion,
    ),
    foreignKey({
      name: "financial_snapshot_commission_fk",
      columns: [table.commissionConfigId],
      foreignColumns: [commissionConfigs.id],
    }),
  ],
);

export const ledgerTransactions = mysqlTable(
  "ledger_transactions",
  {
    id: bigId(),
    tenantId: entityReference("tenant_id").references(() => tenants.id),
    bookingId: bigReference("booking_id").references(() => bookings.id),
    kind: varchar("kind", { length: 32 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 120 }).notNull(),
    description: varchar("description", { length: 180 }).notNull(),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    uniqueIndex("ledger_transaction_idempotency_unique").on(table.idempotencyKey),
  ],
);

export const ledgerEntries = mysqlTable(
  "ledger_entries",
  {
    id: bigId(),
    transactionId: bigReference("transaction_id")
      .notNull()
      .references(() => ledgerTransactions.id),
    accountCode: varchar("account_code", { length: 40 }).notNull(),
    debit: bigint("debit", { mode: "number", unsigned: true }).notNull().default(0),
    credit: bigint("credit", { mode: "number", unsigned: true }).notNull().default(0),
  },
  (table) => [index("ledger_entries_transaction_idx").on(table.transactionId)],
);

export const ownerEarnings = mysqlTable(
  "owner_earnings",
  {
    id: bigId(),
    tenantId: entityReference("tenant_id")
      .notNull()
      .references(() => tenants.id),
    bookingId: bigReference("booking_id")
      .notNull()
      .references(() => bookings.id),
    snapshotId: bigReference("snapshot_id")
      .notNull()
      .references(() => bookingFinancialSnapshots.id),
    sourceKey: varchar("source_key", { length: 100 }).notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    status: varchar("status", { length: 24 }).notNull(),
    availableAt: datetime("available_at", { mode: "date", fsp: 3 }),
    frozenBySupportTicketId: bigReference("frozen_by_support_ticket_id"),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    uniqueIndex("owner_earning_source_unique").on(table.sourceKey),
    index("owner_earning_booking_idx").on(table.bookingId),
    index("owner_earning_payout_idx").on(
      table.tenantId,
      table.status,
      table.availableAt,
    ),
  ],
);

export const tenantFinanceSettings = mysqlTable("tenant_finance_settings", {
  tenantId: entityReference("tenant_id")
    .primaryKey()
    .references(() => tenants.id),
  minimumPayoutAmount: bigint("minimum_payout_amount", {
    mode: "number",
    unsigned: true,
  })
    .notNull()
    .default(100_000),
  manualPayoutEnabled: boolean("manual_payout_enabled").notNull().default(true),
  payoutAccountLabel: varchar("payout_account_label", { length: 80 }),
  payoutAccountLast4: varchar("payout_account_last4", { length: 4 }),
  updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`),
});

export const payoutBatches = mysqlTable(
  "payout_batches",
  {
    id: bigId(),
    tenantId: entityReference("tenant_id")
      .notNull()
      .references(() => tenants.id),
    status: varchar("status", { length: 20 }).notNull(),
    kind: varchar("kind", { length: 12 }).notNull(),
    totalAmount: bigint("total_amount", { mode: "number", unsigned: true }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 100 }).notNull(),
    requestedByUserId: bigReference("requested_by_user_id").references(() => users.id),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    uniqueIndex("payout_batch_idempotency_unique").on(
      table.tenantId,
      table.idempotencyKey,
    ),
    index("payout_batch_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

export const payoutItems = mysqlTable(
  "payout_items",
  {
    id: bigId(),
    payoutBatchId: bigReference("payout_batch_id")
      .notNull()
      .references(() => payoutBatches.id),
    earningId: bigReference("earning_id")
      .notNull()
      .references(() => ownerEarnings.id),
    // Negative adjustments are reserved in the same payout batch so they are
    // consumed exactly once together with the positive earnings they offset.
    amount: bigint("amount", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("payout_item_batch_earning_unique").on(
      table.earningId,
      table.payoutBatchId,
    ),
  ],
);
