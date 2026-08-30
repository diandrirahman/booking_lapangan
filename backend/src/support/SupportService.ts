import { and, desc, eq, inArray, ne, notInArray } from "drizzle-orm";
import type { DatabaseConnection } from "../database/client.js";
import { formatPublicId, parsePublicId } from "../database/ids.js";
import {
  auditLogs,
  bookings,
  ownerEarnings,
  outboxEvents,
  paymentAttempts,
  refunds,
  supportTicketMessages,
  supportTickets,
} from "../database/schema/index.js";
import { ApiError } from "../http/ApiError.js";
import type { RequestAuditContext } from "../http/requestAuditContext.js";
import { createPublicReference } from "../security/publicReference.js";
import { NotificationService } from "../identity/notifications/NotificationService.js";

export class SupportService {
  constructor(
    private readonly database: DatabaseConnection,
    private readonly notificationService = new NotificationService(database),
  ) {}

  async createCustomerTicket(input: {
    userId: string;
    bookingReference?: string | undefined;
    paymentAttemptId?: string | undefined;
    refundId?: string | undefined;
    category: string;
    subject: string;
    message: string;
    transactionDispute: boolean;
  }) {
    return this.database.db.transaction(async (transaction) => {
      const booking = input.bookingReference
        ? await findOwnedBooking(transaction, input.bookingReference, input.userId)
        : null;
      if (input.transactionDispute && !booking) {
        throw new ApiError(
          422,
          "DISPUTE_BOOKING_REQUIRED",
          "Dispute transaksi wajib merujuk booking.",
        );
      }
      if (booking && input.transactionDispute) {
        const [active] = await transaction
          .select({ id: supportTickets.id })
          .from(supportTickets)
          .where(
            and(
              eq(supportTickets.bookingId, booking.id),
              eq(supportTickets.transactionDispute, true),
              notInArray(supportTickets.status, ["RESOLVED", "CLOSED"]),
            ),
          )
          .limit(1);
        if (active)
          throw new ApiError(
            409,
            "ACTIVE_DISPUTE_EXISTS",
            "Booking sudah memiliki dispute aktif.",
          );
      }
      const paymentAttemptId = input.paymentAttemptId
        ? parsePublicId(input.paymentAttemptId)
        : null;
      const refundId = input.refundId ? parsePublicId(input.refundId) : null;
      if ((paymentAttemptId || refundId) && !booking) {
        throw new ApiError(
          422,
          "SUPPORT_BOOKING_REQUIRED",
          "Referensi pembayaran atau refund wajib disertai booking.",
        );
      }
      if (paymentAttemptId) {
        const [attempt] = await transaction
          .select({ id: paymentAttempts.id })
          .from(paymentAttempts)
          .where(
            and(
              eq(paymentAttempts.id, paymentAttemptId),
              eq(paymentAttempts.bookingId, booking!.id),
            ),
          )
          .limit(1);
        if (!attempt)
          throw new ApiError(
            404,
            "PAYMENT_ATTEMPT_NOT_FOUND",
            "Pembayaran tidak ditemukan.",
          );
      }
      if (refundId) {
        const [refund] = await transaction
          .select({ id: refunds.id })
          .from(refunds)
          .where(and(eq(refunds.id, refundId), eq(refunds.bookingId, booking!.id)))
          .limit(1);
        if (!refund)
          throw new ApiError(404, "REFUND_NOT_FOUND", "Refund tidak ditemukan.");
      }
      const createdRows = await transaction
        .insert(supportTickets)
        .values({
          ticketCode: createPublicReference("SUP"),
          customerUserId: parsePublicId(input.userId),
          tenantId: booking?.tenantId ?? null,
          venueId: booking?.venueId ?? null,
          bookingId: booking?.id ?? null,
          paymentAttemptId,
          refundId,
          category: input.category,
          subject: input.subject,
          transactionDispute: input.transactionDispute,
        })
        .$returningId();
      const created = createdRows[0];
      if (!created) throw new Error("MySQL tidak mengembalikan ID support ticket.");
      await transaction.insert(supportTicketMessages).values({
        ticketId: created.id,
        authorUserId: parsePublicId(input.userId),
        body: input.message,
      });
      if (booking && input.transactionDispute) {
        await transaction
          .update(ownerEarnings)
          .set({ frozenBySupportTicketId: created.id, updatedAt: new Date() })
          .where(eq(ownerEarnings.bookingId, booking.id));
        await transaction.insert(outboxEvents).values({
          tenantId: booking.tenantId,
          audienceUserId: parsePublicId(input.userId),
          eventType: "transaction.dispute",
          resourceType: "support_ticket",
          resourceId: created.id,
          resourceVersion: 1,
          payload: { status: "OPEN", hint: "refetch-finance" },
          occurredAt: new Date(),
        });
      }
      const [ticket] = await transaction
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.id, created.id))
        .limit(1);
      return ticketView(ticket!);
    });
  }

  async listCustomer(userId: string) {
    const rows = await this.database.db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.customerUserId, parsePublicId(userId)))
      .orderBy(desc(supportTickets.id));
    return rows.map(ticketView);
  }

  async listTenant(tenantId: string, venueIds?: string[]) {
    const venueDatabaseIds = venueIds?.map(parsePublicId);
    if (venueDatabaseIds?.length === 0) return [];
    const rows = await this.database.db
      .select()
      .from(supportTickets)
      .where(
        and(
          eq(supportTickets.tenantId, parsePublicId(tenantId)),
          venueDatabaseIds
            ? inArray(supportTickets.venueId, venueDatabaseIds)
            : undefined,
        ),
      )
      .orderBy(desc(supportTickets.id));
    return rows.map(ticketView);
  }

  async listAdmin() {
    return (
      await this.database.db
        .select()
        .from(supportTickets)
        .orderBy(desc(supportTickets.id))
        .limit(200)
    ).map(ticketView);
  }

  async listMessagesForCustomer(ticketCode: string, userId: string) {
    const [ticket] = await this.database.db
      .select()
      .from(supportTickets)
      .where(
        and(
          eq(supportTickets.ticketCode, ticketCode),
          eq(supportTickets.customerUserId, parsePublicId(userId)),
        ),
      )
      .limit(1);
    if (!ticket)
      throw new ApiError(404, "SUPPORT_TICKET_NOT_FOUND", "Tiket tidak ditemukan.");
    return this.messages(ticket.id);
  }

  async addCustomerMessage(
    ticketCode: string,
    userId: string,
    body: string,
  ): Promise<void> {
    const [ticket] = await this.database.db
      .select()
      .from(supportTickets)
      .where(
        and(
          eq(supportTickets.ticketCode, ticketCode),
          eq(supportTickets.customerUserId, parsePublicId(userId)),
        ),
      )
      .limit(1);
    if (!ticket)
      throw new ApiError(404, "SUPPORT_TICKET_NOT_FOUND", "Tiket tidak ditemukan.");
    if (ticket.status === "CLOSED")
      throw new ApiError(409, "SUPPORT_TICKET_CLOSED", "Tiket sudah ditutup.");
    await this.database.db
      .insert(supportTicketMessages)
      .values({ ticketId: ticket.id, authorUserId: parsePublicId(userId), body });
  }

  async listMessagesForTenant(ticketId: string, tenantId: string, venueIds?: string[]) {
    const ticket = await this.requireTenantTicket(ticketId, tenantId, venueIds);
    return this.messages(ticket.id);
  }

  async addTenantMessage(
    ticketId: string,
    tenantId: string,
    venueIds: string[] | undefined,
    userId: string,
    body: string,
  ): Promise<void> {
    const ticket = await this.requireTenantTicket(ticketId, tenantId, venueIds);
    if (ticket.status === "CLOSED")
      throw new ApiError(409, "SUPPORT_TICKET_CLOSED", "Tiket sudah ditutup.");
    await this.database.db
      .insert(supportTicketMessages)
      .values({ ticketId: ticket.id, authorUserId: parsePublicId(userId), body });
  }

  async listMessagesForAdmin(ticketId: string) {
    const ticket = await this.requireTicket(ticketId);
    return this.messages(ticket.id);
  }

  async addAdminMessage(ticketId: string, userId: string, body: string): Promise<void> {
    const ticket = await this.requireTicket(ticketId);
    if (ticket.status === "CLOSED")
      throw new ApiError(409, "SUPPORT_TICKET_CLOSED", "Tiket sudah ditutup.");
    await this.database.db
      .insert(supportTicketMessages)
      .values({ ticketId: ticket.id, authorUserId: parsePublicId(userId), body });
  }

  async updateByAdmin(input: {
    ticketId: string;
    actorUserId: string;
    status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
    resolution?: string | undefined;
    assigneeUserId?: string | undefined;
    reverseEarning?: boolean | undefined;
    auditContext?: RequestAuditContext | undefined;
  }): Promise<void> {
    await this.database.db.transaction(async (transaction) => {
      const now = new Date();
      const ticketDatabaseId = parsePublicId(input.ticketId);
      const [ticket] = await transaction
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.id, ticketDatabaseId))
        .limit(1)
        .for("update");
      if (!ticket)
        throw new ApiError(404, "SUPPORT_TICKET_NOT_FOUND", "Tiket tidak ditemukan.");
      const disputeIsActive =
        ticket.transactionDispute &&
        (input.status === "OPEN" || input.status === "IN_PROGRESS");
      if (disputeIsActive && ticket.bookingId) {
        const [otherActiveDispute] = await transaction
          .select({ id: supportTickets.id })
          .from(supportTickets)
          .where(
            and(
              eq(supportTickets.bookingId, ticket.bookingId),
              eq(supportTickets.transactionDispute, true),
              ne(supportTickets.id, ticket.id),
              notInArray(supportTickets.status, ["RESOLVED", "CLOSED"]),
            ),
          )
          .limit(1)
          .for("update");
        if (otherActiveDispute) {
          throw new ApiError(
            409,
            "ACTIVE_DISPUTE_EXISTS",
            "Booking sudah memiliki dispute aktif.",
          );
        }
      }
      await transaction
        .update(supportTickets)
        .set({
          status: input.status,
          resolution: input.resolution,
          assignedAdminUserId: input.assigneeUserId
            ? parsePublicId(input.assigneeUserId)
            : ticket.assignedAdminUserId,
          updatedAt: now,
        })
        .where(eq(supportTickets.id, ticket.id));
      if (ticket.transactionDispute && ticket.bookingId && disputeIsActive) {
        await transaction
          .update(ownerEarnings)
          .set({ frozenBySupportTicketId: ticket.id, updatedAt: now })
          .where(eq(ownerEarnings.bookingId, ticket.bookingId));
      } else if (ticket.transactionDispute && ticket.bookingId) {
        await transaction
          .update(ownerEarnings)
          .set({
            frozenBySupportTicketId: null,
            ...(input.reverseEarning ? { status: "REVERSED" } : {}),
            updatedAt: now,
          })
          .where(
            and(
              eq(ownerEarnings.bookingId, ticket.bookingId),
              eq(ownerEarnings.frozenBySupportTicketId, ticket.id),
            ),
          );
      }
      await transaction.insert(auditLogs).values({
        tenantId: ticket.tenantId,
        venueId: ticket.venueId,
        actorUserId: parsePublicId(input.actorUserId),
        action: "support.status_changed",
        resourceType: "support_ticket",
        resourceId: ticket.id,
        reason: input.resolution,
        beforeState: {
          status: ticket.status,
          assigneeUserId: ticket.assignedAdminUserId,
        },
        afterState: {
          status: input.status,
          assigneeUserId: input.assigneeUserId ?? ticket.assignedAdminUserId,
          reverseEarning: input.reverseEarning ?? false,
        },
        ...input.auditContext,
      });
      if (ticket.customerUserId) {
        await this.notificationService.deliverInTransaction(transaction, {
          eventId: `support-status:${ticket.id}:${ticket.status}-${input.status}:${now.getTime()}`,
          userId: ticket.customerUserId,
          eventType: ticket.transactionDispute
            ? "transaction.dispute"
            : "support.status_changed",
          title: ticket.transactionDispute
            ? "Status dispute diperbarui"
            : "Status tiket diperbarui",
          body: input.resolution ?? `Status tiket kini ${input.status}.`,
          actionPath: "/support",
          critical: ticket.transactionDispute,
        });
      }
      if (ticket.tenantId) {
        await transaction.insert(outboxEvents).values({
          tenantId: ticket.tenantId,
          audienceUserId: ticket.customerUserId,
          eventType: ticket.transactionDispute
            ? "transaction.dispute"
            : "support.status_changed",
          resourceType: "support_ticket",
          resourceId: ticket.id,
          resourceVersion: Math.floor(now.getTime() / 1_000),
          payload: { status: input.status, hint: "refetch-support" },
          occurredAt: now,
        });
      }
    });
  }

  private async messages(ticketId: number) {
    const rows = await this.database.db
      .select()
      .from(supportTicketMessages)
      .where(eq(supportTicketMessages.ticketId, ticketId))
      .orderBy(supportTicketMessages.id);
    return rows.map((row) => ({
      id: formatPublicId(row.id),
      body: row.body,
      authorUserId: formatPublicId(row.authorUserId),
      createdAt: row.createdAt.toISOString(),
    }));
  }

  private async requireTicket(ticketId: string) {
    const [ticket] = await this.database.db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, parsePublicId(ticketId)))
      .limit(1);
    if (!ticket)
      throw new ApiError(404, "SUPPORT_TICKET_NOT_FOUND", "Tiket tidak ditemukan.");
    return ticket;
  }

  private async requireTenantTicket(
    ticketId: string,
    tenantId: string,
    venueIds?: string[],
  ) {
    const ticket = await this.requireTicket(ticketId);
    if (ticket.tenantId !== parsePublicId(tenantId))
      throw new ApiError(404, "SUPPORT_TICKET_NOT_FOUND", "Tiket tidak ditemukan.");
    if (
      venueIds &&
      (!ticket.venueId || !venueIds.map(parsePublicId).includes(ticket.venueId))
    ) {
      throw new ApiError(404, "SUPPORT_TICKET_NOT_FOUND", "Tiket tidak ditemukan.");
    }
    return ticket;
  }
}

type Transaction = Parameters<
  Parameters<DatabaseConnection["db"]["transaction"]>[0]
>[0];

async function findOwnedBooking(
  transaction: Transaction,
  reference: string,
  userId: string,
) {
  const [booking] = await transaction
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.bookingCode, reference),
        eq(bookings.customerUserId, parsePublicId(userId)),
      ),
    )
    .limit(1)
    .for("update");
  if (!booking)
    throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking tidak ditemukan.");
  return booking;
}

function ticketView(ticket: typeof supportTickets.$inferSelect) {
  return {
    ...ticket,
    id: formatPublicId(ticket.id),
    customerUserId: ticket.customerUserId
      ? formatPublicId(ticket.customerUserId)
      : null,
    tenantId: ticket.tenantId ? formatPublicId(ticket.tenantId) : null,
    venueId: ticket.venueId ? formatPublicId(ticket.venueId) : null,
    bookingId: ticket.bookingId ? formatPublicId(ticket.bookingId) : null,
    paymentAttemptId: ticket.paymentAttemptId
      ? formatPublicId(ticket.paymentAttemptId)
      : null,
    refundId: ticket.refundId ? formatPublicId(ticket.refundId) : null,
    assignedAdminUserId: ticket.assignedAdminUserId
      ? formatPublicId(ticket.assignedAdminUserId)
      : null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}
