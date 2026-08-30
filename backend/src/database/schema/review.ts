import { sql } from "drizzle-orm";
import {
  datetime,
  index,
  mysqlTable,
  text,
  tinyint,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { bigId, bigReference, entityReference } from "./columns.js";
import { bookings } from "./booking.js";
import { venues } from "./catalog.js";
import { users } from "./identity.js";

export const reviews = mysqlTable(
  "reviews",
  {
    id: bigId(),
    bookingId: bigReference("booking_id")
      .notNull()
      .references(() => bookings.id),
    venueId: entityReference("venue_id")
      .notNull()
      .references(() => venues.id),
    customerUserId: bigReference("customer_user_id")
      .notNull()
      .references(() => users.id),
    rating: tinyint("rating", { unsigned: true }).notNull(),
    cleanliness: tinyint("cleanliness", { unsigned: true }).notNull(),
    courtQuality: tinyint("court_quality", { unsigned: true }).notNull(),
    facility: tinyint("facility", { unsigned: true }).notNull(),
    service: tinyint("service", { unsigned: true }).notNull(),
    value: tinyint("value", { unsigned: true }).notNull(),
    comment: text("comment").notNull(),
    status: varchar("status", { length: 16 }).notNull().default("VISIBLE"),
    editedAt: datetime("edited_at", { mode: "date", fsp: 3 }),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    uniqueIndex("review_booking_unique").on(table.bookingId),
    index("review_venue_status_idx").on(table.venueId, table.status),
  ],
);

export const reviewReplies = mysqlTable("review_replies", {
  id: bigId(),
  reviewId: bigReference("review_id")
    .notNull()
    .unique()
    .references(() => reviews.id),
  authorUserId: bigReference("author_user_id")
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`),
});

export const reviewReports = mysqlTable(
  "review_reports",
  {
    id: bigId(),
    reviewId: bigReference("review_id")
      .notNull()
      .references(() => reviews.id),
    reporterUserId: bigReference("reporter_user_id")
      .notNull()
      .references(() => users.id),
    reason: text("reason").notNull(),
    status: varchar("status", { length: 16 }).notNull().default("OPEN"),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    uniqueIndex("review_reporter_unique").on(table.reviewId, table.reporterUserId),
  ],
);
