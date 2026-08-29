import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  datetime,
  index,
  int,
  mysqlTable,
  smallint,
  time,
  tinyint,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { bigId, entityId, entityReference, masterId } from "./columns.js";
import { courts, venues } from "./catalog.js";

export const bookingIntervalOptions = mysqlTable(
  "booking_interval_options",
  {
    id: masterId(),
    minutes: smallint("minutes", { unsigned: true }).notNull(),
    active: boolean("active").notNull().default(true),
  },
  (table) => [uniqueIndex("booking_interval_minutes_unique").on(table.minutes)],
);

export const bookingBufferOptions = mysqlTable(
  "booking_buffer_options",
  {
    id: masterId(),
    minutes: smallint("minutes", { unsigned: true }).notNull(),
    active: boolean("active").notNull().default(true),
  },
  (table) => [uniqueIndex("booking_buffer_minutes_unique").on(table.minutes)],
);

export const courtBookingSettings = mysqlTable("court_booking_settings", {
  courtId: entityReference("court_id")
    .primaryKey()
    .references(() => courts.id),
  intervalMinutes: smallint("interval_minutes", { unsigned: true })
    .notNull()
    .default(60),
  bufferMinutes: smallint("buffer_minutes", { unsigned: true }).notNull().default(0),
  minimumDurationMinutes: smallint("minimum_duration_minutes", { unsigned: true })
    .notNull()
    .default(60),
  maximumDurationMinutes: smallint("maximum_duration_minutes", { unsigned: true })
    .notNull()
    .default(180),
  bookingWindowDays: smallint("booking_window_days", { unsigned: true })
    .notNull()
    .default(30),
  minimumLeadMinutes: int("minimum_lead_minutes", { unsigned: true })
    .notNull()
    .default(60),
  updatedAt: datetime("updated_at", { mode: "date" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const venueOperatingHours = mysqlTable(
  "venue_operating_hours",
  {
    id: entityId(),
    venueId: entityReference("venue_id")
      .notNull()
      .references(() => venues.id),
    dayOfWeek: tinyint("day_of_week", { unsigned: true }).notNull(),
    opensAt: time("opens_at"),
    closesAt: time("closes_at"),
    closed: boolean("closed").notNull().default(false),
  },
  (table) => [
    uniqueIndex("venue_operating_day_unique").on(table.venueId, table.dayOfWeek),
  ],
);

export const courtWeeklySchedules = mysqlTable(
  "court_weekly_schedules",
  {
    id: entityId(),
    courtId: entityReference("court_id")
      .notNull()
      .references(() => courts.id),
    dayOfWeek: tinyint("day_of_week", { unsigned: true }).notNull(),
    opensAt: time("opens_at").notNull(),
    closesAt: time("closes_at").notNull(),
    active: boolean("active").notNull().default(true),
  },
  (table) => [
    uniqueIndex("court_weekly_range_unique").on(
      table.courtId,
      table.dayOfWeek,
      table.opensAt,
      table.closesAt,
    ),
  ],
);

export const scheduleExceptions = mysqlTable(
  "schedule_exceptions",
  {
    id: entityId(),
    venueId: entityReference("venue_id")
      .notNull()
      .references(() => venues.id),
    courtId: entityReference("court_id").references(() => courts.id),
    localDate: date("local_date", { mode: "string" }).notNull(),
    kind: varchar("kind", { length: 20 }).notNull(),
    opensAt: time("opens_at"),
    closesAt: time("closes_at"),
    reason: varchar("reason", { length: 255 }),
  },
  (table) => [index("schedule_exception_date_idx").on(table.venueId, table.localDate)],
);

export const courtBlocks = mysqlTable(
  "court_blocks",
  {
    id: entityId(),
    venueId: entityReference("venue_id")
      .notNull()
      .references(() => venues.id),
    courtId: entityReference("court_id").references(() => courts.id),
    kind: varchar("kind", { length: 20 }).notNull(),
    startsAt: datetime("starts_at", { mode: "date" }).notNull(),
    endsAt: datetime("ends_at", { mode: "date" }).notNull(),
    reason: varchar("reason", { length: 255 }).notNull(),
    createdAt: datetime("created_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("court_blocks_range_idx").on(table.venueId, table.startsAt)],
);

export const courtSlots = mysqlTable(
  "court_slots",
  {
    id: bigId(),
    courtId: entityReference("court_id")
      .notNull()
      .references(() => courts.id),
    startsAt: datetime("starts_at", { mode: "date" }).notNull(),
    endsAt: datetime("ends_at", { mode: "date" }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("OPEN"),
    version: int("version", { unsigned: true }).notNull().default(1),
  },
  (table) => [
    uniqueIndex("court_slot_range_unique").on(
      table.courtId,
      table.startsAt,
      table.endsAt,
    ),
    index("court_slot_lookup_idx").on(table.courtId, table.startsAt),
  ],
);

export const priceRules = mysqlTable(
  "price_rules",
  {
    id: entityId(),
    venueId: entityReference("venue_id")
      .notNull()
      .references(() => venues.id),
    courtId: entityReference("court_id").references(() => courts.id),
    kind: varchar("kind", { length: 20 }).notNull(),
    priority: smallint("priority", { unsigned: true }).notNull(),
    dayOfWeek: tinyint("day_of_week", { unsigned: true }),
    specialDate: date("special_date", { mode: "string" }),
    startsAtLocal: time("starts_at_local"),
    endsAtLocal: time("ends_at_local"),
    amount: bigint("amount", { mode: "number", unsigned: true }).notNull(),
    active: boolean("active").notNull().default(true),
    validFrom: datetime("valid_from", { mode: "date" }),
    validUntil: datetime("valid_until", { mode: "date" }),
    createdAt: datetime("created_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("price_rule_scope_idx").on(
      table.venueId,
      table.courtId,
      table.priority,
      table.active,
    ),
  ],
);

export const paymentMethodOptions = mysqlTable(
  "payment_method_options",
  {
    id: masterId(),
    code: varchar("code", { length: 24 }).notNull(),
    label: varchar("label", { length: 50 }).notNull(),
    active: boolean("active").notNull().default(true),
  },
  (table) => [uniqueIndex("payment_method_code_unique").on(table.code)],
);

export const venuePaymentSettings = mysqlTable("venue_payment_settings", {
  venueId: entityReference("venue_id")
    .primaryKey()
    .references(() => venues.id),
  allowFull: boolean("allow_full").notNull().default(true),
  allowDp: boolean("allow_dp").notNull().default(false),
  dpPercentage: tinyint("dp_percentage", { unsigned: true }),
  allowPayAtVenue: boolean("allow_pay_at_venue").notNull().default(false),
  reservationAmount: bigint("reservation_amount", { mode: "number", unsigned: true }),
  manualConfirmationMinutes: smallint("manual_confirmation_minutes", {
    unsigned: true,
  })
    .notNull()
    .default(30),
  balanceDeadlineMinutes: int("balance_deadline_minutes", { unsigned: true }),
});
