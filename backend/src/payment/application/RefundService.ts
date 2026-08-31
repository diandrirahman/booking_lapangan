import { createHash } from "node:crypto";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { DatabaseConnection } from "../../database/client.js";
import {
  bookingPaymentSummaries,
  auditLogs,
  bookingCancellations,
  bookingItems,
  bookingSlotReservations,
  cancellationPolicyTemplates,
  cancellationPolicyTiers,
  commandIdempotency,
  bookings,
  outboxEvents,
  refunds,
  refundStateTransitions,
  venuePolicyAssignments,
} from "../../database/schema/index.js";
import { FinanceService } from "../../finance/FinanceService.js";
import { ApiError } from "../../http/ApiError.js";
import type { RequestAuditContext } from "../../http/requestAuditContext.js";
import { formatPublicId, parsePublicId } from "../../database/ids.js";
import {
  normalizeCancellationPolicyTiers,
  refundBasisPointsAt,
} from "../../booking/domain/cancellationPolicy.js";
import { NotificationService } from "../../identity/notifications/NotificationService.js";

type Transaction = Parameters<
  Parameters<DatabaseConnection["db"]["transaction"]>[0]
>[0];

export class RefundService {
  constructor(
    private readonly database: DatabaseConnection,
    private readonly financeService = new FinanceService(database),
    private readonly notificationService = new NotificationService(database),
  ) {}

  async requestRefund(
    transaction: Transaction,
    input: {
      bookingId: number;
      paymentAttemptId?: number | null | undefined;
      amount: number;
      kind: string;
      reason: string;
      idempotencyKey: string;
      requestedByUserId?: number | null | undefined;
      decisionStatus?: "APPROVED" | "MANUAL_REQUIRED" | undefined;
      now?: Date | undefined;
    },
  ): Promise<number> {
    const [booking] = await transaction
      .select({ tenantId: bookings.tenantId })
      .from(bookings)
      .where(eq(bookings.id, input.bookingId))
      .limit(1);
    if (!booking) throw new Error("Booking refund tidak ditemukan.");
    const scopedIdempotencyKey = refundIdempotencyKey(
      booking.tenantId,
      input.idempotencyKey,
    );
    const existing = await findRefundReplay(
      transaction,
      booking.tenantId,
      input.idempotencyKey,
    );
    if (existing) {
      await assertRefundReplayMatches(transaction, existing, input);
      return existing.id;
    }
    if (input.decisionStatus !== "MANUAL_REQUIRED") {
      await this.assertRefundCapacity(transaction, input.bookingId, input.amount);
    }
    let createdRows: Array<{ id: number }>;
    try {
      createdRows = await transaction
        .insert(refunds)
        .values({
          bookingId: input.bookingId,
          paymentAttemptId: input.paymentAttemptId,
          amount: input.amount,
          status:
            input.decisionStatus === "MANUAL_REQUIRED" ? "MANUAL_REQUIRED" : "PENDING",
          decisionStatus: input.decisionStatus ?? "APPROVED",
          kind: input.kind,
          reason: input.reason,
          idempotencyKey: scopedIdempotencyKey,
          requestedByUserId: input.requestedByUserId,
          decidedByUserId:
            input.decisionStatus === "MANUAL_REQUIRED" ? null : input.requestedByUserId,
          decidedAt:
            input.decisionStatus === "MANUAL_REQUIRED"
              ? null
              : (input.now ?? new Date()),
        })
        .$returningId();
    } catch (error) {
      if (!isDuplicateEntry(error)) throw error;
      const [concurrent] = await transaction
        .select()
        .from(refunds)
        .where(eq(refunds.idempotencyKey, scopedIdempotencyKey))
        .limit(1)
        .for("update");
      if (!concurrent) throw error;
      await assertRefundReplayMatches(transaction, concurrent, input);
      return concurrent.id;
    }
    const created = createdRows[0];
    if (!created) throw new Error("MySQL tidak mengembalikan ID refund.");
    await transaction.insert(refundStateTransitions).values({
      refundId: created.id,
      fromStatus: null,
      toStatus:
        input.decisionStatus === "MANUAL_REQUIRED" ? "MANUAL_REQUIRED" : "PENDING",
      payload: { sandbox: true, decisionStatus: input.decisionStatus ?? "APPROVED" },
    });
    return created.id;
  }

  async cancelByCustomer(
    bookingReference: string,
    userId: string,
    reason: string,
    idempotencyKey: string,
    now = new Date(),
  ) {
    return this.database.db.transaction(async (transaction) => {
      const [row] = await transaction
        .select({ booking: bookings, startsAt: bookingItems.startsAt })
        .from(bookings)
        .innerJoin(bookingItems, eq(bookingItems.bookingId, bookings.id))
        .where(
          and(
            eq(bookings.bookingCode, bookingReference),
            eq(bookings.customerUserId, parsePublicId(userId)),
          ),
        )
        .limit(1)
        .for("update");
      if (!row)
        throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking tidak ditemukan.");
      const actorUserId = parsePublicId(userId);
      const commandScope = `booking.cancel:${row.booking.id}`;
      const [existingCommand] = await transaction
        .select({ responseBody: commandIdempotency.responseBody })
        .from(commandIdempotency)
        .where(
          and(
            eq(commandIdempotency.scope, commandScope),
            eq(commandIdempotency.actorUserId, actorUserId),
            eq(commandIdempotency.idempotencyKey, idempotencyKey),
          ),
        )
        .limit(1);
      if (existingCommand) {
        const replay = cancellationReplayFromResponse(existingCommand.responseBody);
        if (!replay || replay.reason !== reason) {
          throw new ApiError(
            409,
            "IDEMPOTENCY_KEY_REUSED",
            "Idempotency-Key telah digunakan untuk pembatalan yang berbeda.",
          );
        }
        return replay.result;
      }
      if (!["HOLD", "CONFIRMED", "PENDING_CONFIRMATION"].includes(row.booking.status)) {
        throw new ApiError(
          409,
          "BOOKING_NOT_CANCELLABLE",
          "Booking tidak dapat dibatalkan.",
        );
      }
      const [summary] = await transaction
        .select()
        .from(bookingPaymentSummaries)
        .where(eq(bookingPaymentSummaries.bookingId, row.booking.id))
        .limit(1)
        .for("update");
      const refundBasisPoints = refundBasisPointsAt(
        row.booking.cancellationPolicySnapshot,
        row.startsAt,
        now,
      );
      const refundablePaid = Math.max(
        0,
        (summary?.totalPaid ?? 0) - (summary?.totalRefunded ?? 0),
      );
      const refundableAmount = Math.floor(
        (refundablePaid * refundBasisPoints) / 10_000,
      );
      await transaction.insert(bookingCancellations).values({
        bookingId: row.booking.id,
        actorUserId,
        reason,
        kind: "CUSTOMER_POLICY",
        refundBasisPoints,
        refundableAmount,
        decision: refundBasisPoints > 0 ? "APPROVED" : "NO_REFUND",
      });
      await transaction
        .update(bookings)
        .set({ status: "CANCELLED", version: row.booking.version + 1, updatedAt: now })
        .where(eq(bookings.id, row.booking.id));
      await transaction
        .delete(bookingSlotReservations)
        .where(eq(bookingSlotReservations.bookingId, row.booking.id));
      await this.financeService.releaseUnusedFinancialReservations(
        transaction,
        row.booking.id,
      );
      if (refundableAmount > 0) {
        await this.requestRefund(transaction, {
          bookingId: row.booking.id,
          amount: refundableAmount,
          kind: "CUSTOMER_CANCELLATION",
          reason,
          idempotencyKey,
          requestedByUserId: actorUserId,
          now,
        });
      }
      if (row.booking.customerUserId) {
        await this.notificationService.deliverInTransaction(transaction, {
          eventId: `booking-status:${row.booking.id}:${row.booking.version + 1}`,
          userId: row.booking.customerUserId,
          eventType: "booking.status_changed",
          title: "Booking dibatalkan",
          body: `Pembatalan tercatat. Estimasi refund mengikuti kebijakan sebesar ${refundBasisPoints / 100}%.`,
          actionPath: `/bookings/${row.booking.bookingCode}`,
          critical: true,
        });
      }
      await transaction.insert(outboxEvents).values({
        tenantId: row.booking.tenantId,
        audienceUserId: row.booking.customerUserId,
        eventType: "booking.status_changed",
        resourceType: "booking",
        resourceId: row.booking.id,
        resourceVersion: row.booking.version + 1,
        payload: { status: "CANCELLED", hint: "refetch-booking" },
        occurredAt: now,
      });
      const result = {
        status: "CANCELLED" as const,
        refundBasisPoints,
        refundableAmount,
      };
      await transaction.insert(commandIdempotency).values({
        scope: commandScope,
        idempotencyKey,
        actorUserId,
        resourceId: row.booking.id,
        responseStatus: 200,
        responseBody: { reason, result },
      });
      return result;
    });
  }

  async createPolicyTemplate(
    name: string,
    tiers: Array<{
      minimumHoursBefore: number;
      maximumHoursBefore?: number | undefined;
      refundBasisPoints: number;
    }>,
    actorUserId: string,
    auditContext: RequestAuditContext = {},
  ) {
    const normalizedTiers = normalizeCancellationPolicyTiers(
      tiers.map((tier) => ({
        ...tier,
        maximumHoursBefore: tier.maximumHoursBefore ?? null,
      })),
    );
    if (!normalizedTiers) {
      throw new ApiError(
        422,
        "INVALID_CANCELLATION_POLICY_TIERS",
        "Tier refund harus berurutan, tidak overlap, dan mencakup seluruh rentang waktu.",
      );
    }
    return this.database.db.transaction(async (transaction) => {
      const rows = await transaction
        .insert(cancellationPolicyTemplates)
        .values({ name, createdByUserId: parsePublicId(actorUserId) })
        .$returningId();
      const created = rows[0];
      if (!created) throw new Error("MySQL tidak mengembalikan ID policy.");
      await transaction
        .insert(cancellationPolicyTiers)
        .values(normalizedTiers.map((tier) => ({ templateId: created.id, ...tier })));
      await transaction.insert(auditLogs).values({
        actorUserId: parsePublicId(actorUserId),
        action: "cancellation_policy.created",
        resourceType: "refund_policy",
        resourceId: created.id,
        reason: `Template ${name} dibuat`,
        afterState: { name, tiers: normalizedTiers },
        ...auditContext,
      });
      return { id: formatPublicId(created.id) };
    });
  }

  async listPolicyTemplates() {
    const templates = await this.database.db
      .select()
      .from(cancellationPolicyTemplates)
      .where(eq(cancellationPolicyTemplates.active, true));
    const tiers = await this.database.db.select().from(cancellationPolicyTiers);
    return templates.map((template) => ({
      id: formatPublicId(template.id),
      name: template.name,
      tiers: tiers
        .filter((tier) => tier.templateId === template.id)
        .sort((left, right) => left.minimumHoursBefore - right.minimumHoursBefore)
        .map(({ minimumHoursBefore, maximumHoursBefore, refundBasisPoints }) => ({
          minimumHoursBefore,
          maximumHoursBefore,
          refundBasisPoints,
        })),
    }));
  }

  async assignPolicy(
    venueId: string,
    templateId: string,
    tenantId: string,
    actorUserId: string,
    reason: string,
    auditContext: RequestAuditContext = {},
  ): Promise<void> {
    await this.database.db.transaction(async (transaction) => {
      const venueDatabaseId = parsePublicId(venueId);
      const [before] = await transaction
        .select()
        .from(venuePolicyAssignments)
        .where(eq(venuePolicyAssignments.venueId, venueDatabaseId))
        .limit(1);
      await transaction
        .insert(venuePolicyAssignments)
        .values({ venueId: venueDatabaseId, templateId: parsePublicId(templateId) })
        .onDuplicateKeyUpdate({ set: { templateId: parsePublicId(templateId) } });
      await transaction.insert(auditLogs).values({
        tenantId: parsePublicId(tenantId),
        venueId: venueDatabaseId,
        actorUserId: parsePublicId(actorUserId),
        action: "cancellation_policy.assigned",
        resourceType: "venue",
        resourceId: venueDatabaseId,
        reason,
        beforeState: before ?? null,
        afterState: { templateId },
        ...auditContext,
      });
    });
  }

  async requestBusinessRefund(
    input: {
      bookingReference: string;
      tenantId: string;
      venueId: string;
      amount: number;
      reason: string;
      actorUserId: string;
      idempotencyKey: string;
      manualRequired: boolean;
    },
    auditContext: RequestAuditContext = {},
  ) {
    return this.database.db.transaction(async (transaction) => {
      const [booking] = await transaction
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.bookingCode, input.bookingReference),
            eq(bookings.tenantId, parsePublicId(input.tenantId)),
            eq(bookings.venueId, parsePublicId(input.venueId)),
          ),
        )
        .limit(1)
        .for("update");
      if (!booking)
        throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking tidak ditemukan.");
      const replay = await findRefundReplay(
        transaction,
        booking.tenantId,
        input.idempotencyKey,
      );
      if (replay) {
        await assertRefundReplayMatches(transaction, replay, {
          bookingId: booking.id,
          amount: input.amount,
          kind: input.manualRequired ? "ADMIN_DISPUTE" : "OWNER_EXCEPTION",
          reason: input.reason,
          requestedByUserId: parsePublicId(input.actorUserId),
          decisionStatus: input.manualRequired ? "MANUAL_REQUIRED" : "APPROVED",
        });
        return refundCreateView(replay);
      }
      const id = await this.requestRefund(transaction, {
        bookingId: booking.id,
        amount: input.amount,
        kind: input.manualRequired ? "ADMIN_DISPUTE" : "OWNER_EXCEPTION",
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
        requestedByUserId: parsePublicId(input.actorUserId),
        decisionStatus: input.manualRequired ? "MANUAL_REQUIRED" : "APPROVED",
      });
      await transaction.insert(auditLogs).values({
        tenantId: booking.tenantId,
        venueId: booking.venueId,
        actorUserId: parsePublicId(input.actorUserId),
        action: "refund.requested",
        resourceType: "refund",
        resourceId: id,
        reason: input.reason,
        afterState: {
          amount: input.amount,
          decisionStatus: input.manualRequired ? "MANUAL_REQUIRED" : "APPROVED",
        },
        ...auditContext,
      });
      return refundCreateView({
        id,
        kind: input.manualRequired ? "ADMIN_DISPUTE" : "OWNER_EXCEPTION",
      });
    });
  }

  async decideManualRefund(
    refundId: string,
    actorUserId: string,
    approved: boolean,
    reason: string,
    idempotencyKey: string,
    auditContext: RequestAuditContext = {},
  ): Promise<void> {
    await this.database.db.transaction(async (transaction) => {
      const id = parsePublicId(refundId);
      const actorDatabaseId = parsePublicId(actorUserId);
      const [refund] = await transaction
        .select()
        .from(refunds)
        .where(eq(refunds.id, id))
        .limit(1)
        .for("update");
      const [existing] = await transaction
        .select({
          id: commandIdempotency.id,
          responseBody: commandIdempotency.responseBody,
        })
        .from(commandIdempotency)
        .where(
          refundCommandReplayWhere("decision", id, actorDatabaseId, idempotencyKey),
        )
        .limit(1)
        .for("update");
      if (existing) {
        const recordedDecision =
          refundDecisionFromResponse(existing.responseBody) ??
          refundDecisionFromState(refund?.decisionStatus);
        const recordedReason =
          refundDecisionReasonFromResponse(existing.responseBody) ??
          refundDecisionReasonFromState(refund?.reason);
        if (
          recordedDecision === null ||
          recordedDecision !== approved ||
          recordedReason !== reason
        ) {
          throw new ApiError(
            409,
            "IDEMPOTENCY_KEY_REUSED",
            "Idempotency-Key telah digunakan untuk keputusan refund yang berbeda.",
          );
        }
        return;
      }
      if (!refund || refund.status !== "MANUAL_REQUIRED")
        throw new ApiError(
          409,
          "REFUND_NOT_AWAITING_DECISION",
          "Refund tidak menunggu keputusan manual.",
        );
      if (approved) {
        await this.assertRefundCapacity(transaction, refund.bookingId, refund.amount);
      }
      const status = approved ? "PENDING" : "REJECTED";
      await transaction
        .update(refunds)
        .set({
          status,
          decisionStatus: approved ? "APPROVED" : "REJECTED",
          decidedByUserId: actorDatabaseId,
          decidedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(refunds.id, id));
      await transaction.insert(refundStateTransitions).values({
        refundId: id,
        fromStatus: "MANUAL_REQUIRED",
        toStatus: status,
        payload: { actorUserId, reason },
      });
      const [booking] = await transaction
        .select({ tenantId: bookings.tenantId, venueId: bookings.venueId })
        .from(bookings)
        .where(eq(bookings.id, refund.bookingId))
        .limit(1);
      await transaction.insert(auditLogs).values({
        tenantId: booking?.tenantId ?? null,
        venueId: booking?.venueId ?? null,
        actorUserId: actorDatabaseId,
        action: "refund.decided",
        resourceType: "refund",
        resourceId: refund.id,
        reason,
        beforeState: { status: refund.status, decisionStatus: refund.decisionStatus },
        afterState: { status, approved },
        ...auditContext,
      });
      await transaction.insert(commandIdempotency).values({
        scope: refundCommandScope("decision", id),
        idempotencyKey,
        actorUserId: actorDatabaseId,
        resourceId: id,
        responseStatus: 204,
        responseBody: { approved, reason },
      });
    });
  }

  private async assertRefundCapacity(
    transaction: Transaction,
    bookingId: number,
    amount: number,
  ): Promise<void> {
    const [summary] = await transaction
      .select()
      .from(bookingPaymentSummaries)
      .where(eq(bookingPaymentSummaries.bookingId, bookingId))
      .limit(1)
      .for("update");
    const pending = await transaction
      .select({ amount: refunds.amount })
      .from(refunds)
      .where(and(eq(refunds.bookingId, bookingId), eq(refunds.status, "PENDING")));
    const reserved = pending.reduce((total, refund) => total + refund.amount, 0);
    const available = Math.max(
      0,
      (summary?.totalPaid ?? 0) - (summary?.totalRefunded ?? 0) - reserved,
    );
    if (amount > available) {
      throw new ApiError(
        409,
        "REFUND_EXCEEDS_PAID_AMOUNT",
        "Refund melebihi pembayaran berhasil yang belum dicadangkan.",
      );
    }
  }

  async retryFailedRefund(
    refundId: string,
    actorUserId: string,
    idempotencyKey: string,
    auditContext: RequestAuditContext = {},
  ): Promise<void> {
    const id = parsePublicId(refundId);
    const actorDatabaseId = parsePublicId(actorUserId);
    await this.database.db.transaction(async (transaction) => {
      const [refund] = await transaction
        .select({ id: refunds.id, status: refunds.status })
        .from(refunds)
        .where(eq(refunds.id, id))
        .limit(1)
        .for("update");
      const [existing] = await transaction
        .select({ id: commandIdempotency.id })
        .from(commandIdempotency)
        .where(refundCommandReplayWhere("retry", id, actorDatabaseId, idempotencyKey))
        .limit(1)
        .for("update");
      if (existing) return;
      if (!refund || refund.status !== "FAILED") {
        throw new ApiError(
          409,
          "REFUND_NOT_RETRYABLE",
          "Refund tidak dapat dicoba ulang.",
        );
      }
      const result = await transaction
        .update(refunds)
        .set({
          status: "PENDING",
          executionAttempts: sql`${refunds.executionAttempts} + 1`,
          failureReason: null,
          updatedAt: new Date(),
        })
        .where(and(eq(refunds.id, id), eq(refunds.status, "FAILED")));
      if (result[0].affectedRows === 0)
        throw new ApiError(
          409,
          "REFUND_NOT_RETRYABLE",
          "Refund tidak dapat dicoba ulang.",
        );
      await transaction.insert(commandIdempotency).values({
        scope: refundCommandScope("retry", id),
        idempotencyKey,
        actorUserId: actorDatabaseId,
        resourceId: id,
        responseStatus: 204,
      });
      await transaction.insert(auditLogs).values({
        actorUserId: actorDatabaseId,
        action: "refund.retry_requested",
        resourceType: "refund",
        resourceId: id,
        reason: "Mencoba ulang refund sandbox",
        ...auditContext,
      });
    });
  }

  async listRefunds(tenantId?: string, venueIds?: string[]) {
    const venueDatabaseIds = venueIds?.map(parsePublicId);
    const rows = await this.database.db
      .select({
        refund: refunds,
        bookingCode: bookings.bookingCode,
        tenantId: bookings.tenantId,
      })
      .from(refunds)
      .innerJoin(bookings, eq(bookings.id, refunds.bookingId))
      .where(
        and(
          tenantId ? eq(bookings.tenantId, parsePublicId(tenantId)) : undefined,
          venueDatabaseIds
            ? venueDatabaseIds.length > 0
              ? inArray(bookings.venueId, venueDatabaseIds)
              : sql`false`
            : undefined,
        ),
      );
    return rows.map(({ refund, bookingCode, tenantId: databaseTenantId }) => ({
      ...refund,
      id: formatPublicId(refund.id),
      bookingId: bookingCode,
      tenantId: formatPublicId(databaseTenantId),
      requestedByUserId: refund.requestedByUserId
        ? formatPublicId(refund.requestedByUserId)
        : null,
    }));
  }

  async completePendingBatch(limit = 100, now = new Date()): Promise<number> {
    const pendingRefunds = await this.database.db
      .select({ id: refunds.id })
      .from(refunds)
      .where(eq(refunds.status, "PENDING"))
      .limit(limit);
    let completed = 0;
    for (const refund of pendingRefunds) {
      if (await this.completeSandboxRefund(refund.id, now)) completed += 1;
    }
    return completed;
  }

  async completeSandboxRefund(refundId: number, now = new Date()): Promise<boolean> {
    return this.database.db.transaction(async (transaction) => {
      const [refund] = await transaction
        .select()
        .from(refunds)
        .where(eq(refunds.id, refundId))
        .limit(1)
        .for("update");
      if (!refund || refund.status !== "PENDING") return false;

      const [summary] = await transaction
        .select()
        .from(bookingPaymentSummaries)
        .where(eq(bookingPaymentSummaries.bookingId, refund.bookingId))
        .limit(1)
        .for("update");
      if (!summary) throw new Error("Ringkasan pembayaran refund tidak ditemukan.");

      const refundableAmount = summary.totalPaid - summary.totalRefunded;
      if (refund.amount > refundableAmount) {
        await transaction
          .update(refunds)
          .set({ status: "FAILED", updatedAt: now })
          .where(eq(refunds.id, refund.id));
        await transaction.insert(refundStateTransitions).values({
          refundId: refund.id,
          fromStatus: "PENDING",
          toStatus: "FAILED",
          payload: {
            sandbox: true,
            reason: "REFUND_EXCEEDS_SUCCESSFUL_PAID_AMOUNT",
          },
        });
        return false;
      }

      const totalRefunded = summary.totalRefunded + refund.amount;
      const summaryStatus =
        totalRefunded === summary.totalPaid ? "REFUNDED" : "PARTIALLY_REFUNDED";
      await transaction
        .update(refunds)
        .set({
          status: "SUCCEEDED",
          providerReference: `SANDBOX-REFUND-${refund.id}`,
          updatedAt: now,
        })
        .where(eq(refunds.id, refund.id));
      await transaction.insert(refundStateTransitions).values({
        refundId: refund.id,
        fromStatus: "PENDING",
        toStatus: "SUCCEEDED",
        payload: { sandbox: true, occurredAt: now.toISOString() },
      });
      await transaction
        .update(bookingPaymentSummaries)
        .set({ status: summaryStatus, totalRefunded, updatedAt: now })
        .where(eq(bookingPaymentSummaries.bookingId, refund.bookingId));
      await this.financeService.recordRefund(
        transaction,
        refund.id,
        refund.bookingId,
        refund.amount,
        now,
      );

      const [booking] = await transaction
        .select({
          tenantId: bookings.tenantId,
          version: bookings.version,
          customerUserId: bookings.customerUserId,
          bookingCode: bookings.bookingCode,
        })
        .from(bookings)
        .where(eq(bookings.id, refund.bookingId))
        .limit(1);
      if (booking) {
        await transaction.insert(outboxEvents).values({
          tenantId: booking.tenantId,
          audienceUserId: booking.customerUserId,
          eventType: "refund.status_changed",
          resourceType: "refund",
          resourceId: refund.id,
          resourceVersion: 1,
          payload: { status: "SUCCEEDED", hint: "refetch-booking" },
          occurredAt: now,
        });
        if (booking.customerUserId) {
          await this.notificationService.deliverInTransaction(transaction, {
            eventId: `refund-result:${refund.id}`,
            userId: booking.customerUserId,
            eventType: "refund.result",
            title: "Refund berhasil diproses",
            body: `Refund booking ${booking.bookingCode} sebesar Rp${refund.amount.toLocaleString("id-ID")} selesai.`,
            actionPath: `/bookings/${booking.bookingCode}`,
            critical: true,
          });
        }
      }
      return true;
    });
  }
}

function refundIdempotencyKey(tenantId: number, rawKey: string): string {
  const digest = createHash("sha256")
    .update(`${tenantId}:${rawKey}`)
    .digest("base64url");
  return `refund:${digest}`;
}

function refundCommandScope(action: "decision" | "retry", refundId: number): string {
  return `refund.${action}:${refundId}`;
}

function refundCommandReplayWhere(
  action: "decision" | "retry",
  refundId: number,
  actorUserId: number,
  idempotencyKey: string,
) {
  return and(
    eq(commandIdempotency.actorUserId, actorUserId),
    eq(commandIdempotency.idempotencyKey, idempotencyKey),
    or(
      eq(commandIdempotency.scope, refundCommandScope(action, refundId)),
      and(
        eq(commandIdempotency.scope, `refund.${action}`),
        eq(commandIdempotency.resourceId, refundId),
      ),
    ),
  );
}

function refundDecisionFromResponse(value: unknown): boolean | null {
  if (!value || typeof value !== "object" || !("approved" in value)) return null;
  return typeof value.approved === "boolean" ? value.approved : null;
}

function refundDecisionReasonFromResponse(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("reason" in value)) return null;
  return typeof value.reason === "string" ? value.reason : null;
}

function refundDecisionReasonFromState(value: string | undefined): string | null {
  if (!value) return null;
  const marker = "\nKeputusan: ";
  const markerIndex = value.lastIndexOf(marker);
  return markerIndex < 0 ? null : value.slice(markerIndex + marker.length);
}

function refundDecisionFromState(value: string | undefined): boolean | null {
  if (value === "APPROVED") return true;
  if (value === "REJECTED") return false;
  return null;
}

async function findRefundReplay(
  transaction: Transaction,
  tenantId: number,
  idempotencyKey: string,
) {
  const scopedIdempotencyKey = refundIdempotencyKey(tenantId, idempotencyKey);
  const [existing] = await transaction
    .select({ refund: refunds })
    .from(refunds)
    .innerJoin(bookings, eq(bookings.id, refunds.bookingId))
    .where(
      and(
        eq(bookings.tenantId, tenantId),
        or(
          eq(refunds.idempotencyKey, scopedIdempotencyKey),
          eq(refunds.idempotencyKey, idempotencyKey),
        ),
      ),
    )
    .limit(1);
  return existing?.refund;
}

async function assertRefundReplayMatches(
  transaction: Transaction,
  existing: typeof refunds.$inferSelect,
  input: {
    bookingId: number;
    paymentAttemptId?: number | null | undefined;
    amount: number;
    kind: string;
    reason: string;
    requestedByUserId?: number | null | undefined;
    decisionStatus?: "APPROVED" | "MANUAL_REQUIRED" | undefined;
  },
): Promise<void> {
  const [initialTransition] = await transaction
    .select({ toStatus: refundStateTransitions.toStatus })
    .from(refundStateTransitions)
    .where(
      and(
        eq(refundStateTransitions.refundId, existing.id),
        isNull(refundStateTransitions.fromStatus),
      ),
    )
    .limit(1);
  const initialDecisionStatus =
    initialTransition?.toStatus === "MANUAL_REQUIRED"
      ? "MANUAL_REQUIRED"
      : existing.decisionStatus;
  const decisionMarker = "\nKeputusan: ";
  const markerIndex = existing.reason.lastIndexOf(decisionMarker);
  const initialReason =
    initialDecisionStatus === "MANUAL_REQUIRED" &&
    existing.decisionStatus !== "MANUAL_REQUIRED" &&
    markerIndex >= 0
      ? existing.reason.slice(0, markerIndex)
      : existing.reason;
  const matches =
    existing.bookingId === input.bookingId &&
    existing.paymentAttemptId === (input.paymentAttemptId ?? null) &&
    existing.amount === input.amount &&
    existing.kind === input.kind &&
    initialReason === input.reason &&
    initialDecisionStatus === (input.decisionStatus ?? "APPROVED") &&
    existing.requestedByUserId === (input.requestedByUserId ?? null);
  if (matches) return;
  throw new ApiError(
    409,
    "IDEMPOTENCY_KEY_REUSED",
    "Idempotency-Key telah digunakan untuk request refund yang berbeda.",
  );
}

function cancellationReplayFromResponse(value: unknown): {
  reason: string;
  result: { status: "CANCELLED"; refundBasisPoints: number; refundableAmount: number };
} | null {
  if (
    !value ||
    typeof value !== "object" ||
    !("reason" in value) ||
    !("result" in value)
  ) {
    return null;
  }
  const result = value.result;
  if (
    typeof value.reason !== "string" ||
    !result ||
    typeof result !== "object" ||
    !("status" in result) ||
    result.status !== "CANCELLED" ||
    !("refundBasisPoints" in result) ||
    typeof result.refundBasisPoints !== "number" ||
    !("refundableAmount" in result) ||
    typeof result.refundableAmount !== "number"
  ) {
    return null;
  }
  return {
    reason: value.reason,
    result: {
      status: "CANCELLED",
      refundBasisPoints: result.refundBasisPoints,
      refundableAmount: result.refundableAmount,
    },
  };
}

function refundCreateView(input: { id: number; kind: string }) {
  return {
    id: formatPublicId(input.id),
    status: input.kind === "ADMIN_DISPUTE" ? "MANUAL_REQUIRED" : "PENDING",
  };
}

function isDuplicateEntry(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const cause = "cause" in error ? error.cause : undefined;
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    String(cause.code) === "ER_DUP_ENTRY"
  );
}
