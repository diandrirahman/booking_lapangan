import { sql } from "drizzle-orm";
import {
  boolean,
  datetime,
  index,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { bigId, bigReference, entityReference } from "./columns.js";
import { bookings } from "./booking.js";
import { tenants, users } from "./identity.js";
import { paymentAttempts, refunds } from "./payment.js";

export const supportTickets = mysqlTable(
  "support_tickets",
  {
    id: bigId(),
    ticketCode: varchar("ticket_code", { length: 20 }).notNull(),
    customerUserId: bigReference("customer_user_id").references(() => users.id),
    tenantId: entityReference("tenant_id").references(() => tenants.id),
    venueId: entityReference("venue_id"),
    bookingId: bigReference("booking_id").references(() => bookings.id),
    paymentAttemptId: bigReference("payment_attempt_id").references(
      () => paymentAttempts.id,
    ),
    refundId: bigReference("refund_id").references(() => refunds.id),
    category: varchar("category", { length: 32 }).notNull(),
    subject: varchar("subject", { length: 120 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("OPEN"),
    transactionDispute: boolean("transaction_dispute").notNull().default(false),
    assignedAdminUserId: bigReference("assigned_admin_user_id").references(
      () => users.id,
    ),
    resolution: text("resolution"),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    uniqueIndex("support_ticket_code_unique").on(table.ticketCode),
    index("support_ticket_scope_idx").on(table.tenantId, table.status),
  ],
);

export const supportTicketMessages = mysqlTable("support_ticket_messages", {
  id: bigId(),
  ticketId: bigReference("ticket_id")
    .notNull()
    .references(() => supportTickets.id),
  authorUserId: bigReference("author_user_id")
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`),
});
