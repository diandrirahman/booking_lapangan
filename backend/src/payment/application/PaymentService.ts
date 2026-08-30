import { createHash } from "node:crypto";
import { and, desc, eq, inArray, lte } from "drizzle-orm";
import type { Environment } from "../../config/environment.js";
import type { DatabaseConnection } from "../../database/client.js";
import { parsePublicId } from "../../database/ids.js";
import {
  bookingPaymentSummaries,
  bookingItems,
  bookingFinancialSnapshots,
  bookingReschedules,
  bookingSlotHistory,
  bookingSlotReservations,
  bookings,
  bookingStateTransitions,
  outboxEvents,
  paymentAttempts,
  paymentProviderEvents,
  courtSlots,
  venuePaymentSettings,
} from "../../database/schema/index.js";
import { ApiError } from "../../http/ApiError.js";
import {
  createPublicReference,
  PAYMENT_REFERENCE_PREFIX,
} from "../../security/publicReference.js";
import type { PaymentProvider } from "./PaymentProvider.js";
import { FinanceService } from "../../finance/FinanceService.js";
import { RefundService } from "./RefundService.js";
import { originalPolicySnapshot } from "../../booking/domain/cancellationPolicy.js";
import { NotificationService } from "../../identity/notifications/NotificationService.js";

export type PaymentAttemptStatus =
  "CREATED" | "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "CANCELLED";

const BALANCE_DEADLINE_GRACE_MILLISECONDS = 30 * 60_000;

export interface PaymentAttemptView {
  id: string;
  bookingId: string;
  kind: string;
  amount: number;
  status: PaymentAttemptStatus;
  redirectUrl: string | null;
  sandbox: true;
}

export interface SandboxWebhookInput {
  eventId: string;
  attemptId: string;
  transactionStatus:
    "settlement" | "capture" | "pending" | "deny" | "cancel" | "expire";
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
}

export class PaymentService {
  constructor(
    private readonly database: DatabaseConnection,
    private readonly provider: PaymentProvider,
    private readonly environment: Environment,
    private readonly publishPendingEvents: () => Promise<void> = () =>
      Promise.resolve(),
    private readonly financeService = new FinanceService(database),
    private readonly refundService = new RefundService(database, financeService),
    private readonly notificationService = new NotificationService(database),
  ) {}

  async createAttempt(
    bookingId: string,
    userId: string,
    kind: "FULL" | "DP" | "RESERVATION" | "BALANCE" | "RETRY",
    idempotencyKey: string,
    now = new Date(),
  ): Promise<PaymentAttemptView> {
    const [existing] = await this.database.db
      .select()
      .from(paymentAttempts)
      .where(eq(paymentAttempts.idempotencyKey, idempotencyKey))
      .limit(1);
    if (existing) return toView(existing, bookingId);

    const [booking] = await this.database.db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.bookingCode, bookingId),
          eq(bookings.customerUserId, parsePublicId(userId)),
        ),
      )
      .limit(1);
    if (!booking)
      throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking tidak ditemukan.");
    if (booking.status === "CANCELLED" || booking.status === "EXPIRED") {
      throw new ApiError(
        409,
        "BOOKING_NOT_PAYABLE",
        "Booking sudah tidak dapat dibayar.",
      );
    }
    if (
      kind !== "BALANCE" &&
      booking.status !== "CONFIRMED" &&
      booking.holdExpiresAt &&
      booking.holdExpiresAt <= now
    ) {
      throw new ApiError(
        409,
        "BOOKING_HOLD_EXPIRED",
        "Waktu pembayaran booking telah habis.",
      );
    }
    validateAttemptKind(booking, kind);
    if (kind === "BALANCE") {
      await this.ensureBalancePaymentOpen(booking, now);
    }
    const amount = await this.resolveAttemptAmount(booking, kind);

    const expiresAt = booking.holdExpiresAt ?? new Date(now.getTime() + 10 * 60_000);
    const paymentReference = createPublicReference(PAYMENT_REFERENCE_PREFIX);
    const [createdAttempt] = await this.database.db
      .insert(paymentAttempts)
      .values({
        paymentCode: paymentReference,
        bookingId: booking.id,
        kind,
        amount,
        status: "CREATED",
        idempotencyKey,
        expiresAt,
        sandbox: true,
      })
      .$returningId();
    if (!createdAttempt) throw new Error("MySQL tidak mengembalikan ID pembayaran.");
    const attemptDatabaseId = createdAttempt.id;
    const attemptId = paymentReference;

    try {
      const providerResult = await this.provider.createPayment({
        attemptId,
        bookingId,
        amount,
        expiresAt,
      });
      await this.database.db
        .update(paymentAttempts)
        .set({
          status: "PENDING",
          providerReference: providerResult.providerReference,
          redirectUrl: providerResult.redirectUrl,
          updatedAt: new Date(),
        })
        .where(eq(paymentAttempts.id, attemptDatabaseId));
      return {
        id: attemptId,
        bookingId,
        kind,
        amount,
        status: "PENDING",
        redirectUrl: providerResult.redirectUrl,
        sandbox: true,
      };
    } catch (error) {
      await this.database.db
        .update(paymentAttempts)
        .set({ status: "FAILED", updatedAt: new Date() })
        .where(eq(paymentAttempts.id, attemptDatabaseId));
      throw new ApiError(
        502,
        "PAYMENT_PROVIDER_UNAVAILABLE",
        "Provider sandbox tidak dapat membuat pembayaran.",
        {
          retryable: true,
          provider: "MIDTRANS_SANDBOX",
          ...(this.environment.NODE_ENV === "production"
            ? {}
            : { cause: error instanceof Error ? error.message : "unknown" }),
        },
      );
    }
  }

  async getAttempt(attemptId: string, userId: string): Promise<PaymentAttemptView> {
    const [attempt] = await this.database.db
      .select({ attempt: paymentAttempts, bookingReference: bookings.bookingCode })
      .from(paymentAttempts)
      .innerJoin(bookings, eq(bookings.id, paymentAttempts.bookingId))
      .where(
        and(
          eq(paymentAttempts.paymentCode, attemptId),
          eq(bookings.customerUserId, parsePublicId(userId)),
        ),
      )
      .limit(1);
    if (!attempt)
      throw new ApiError(
        404,
        "PAYMENT_ATTEMPT_NOT_FOUND",
        "Payment attempt tidak ditemukan.",
      );
    const view = toView(attempt.attempt, attempt.bookingReference);
    if (
      view.status === "PENDING" &&
      attempt.attempt.expiresAt &&
      attempt.attempt.expiresAt <= new Date()
    ) {
      await this.database.db
        .update(paymentAttempts)
        .set({ status: "EXPIRED", updatedAt: new Date() })
        .where(eq(paymentAttempts.paymentCode, attemptId));
      return { ...view, status: "EXPIRED" };
    }
    return view;
  }

  async processWebhook(input: SandboxWebhookInput, now = new Date()): Promise<void> {
    const signatureVerified = this.verifySignature(input);
    if (!signatureVerified) {
      throw new ApiError(
        401,
        "INVALID_WEBHOOK_SIGNATURE",
        "Signature webhook tidak valid.",
      );
    }

    await this.database.db.transaction(async (transaction) => {
      const [duplicate] = await transaction
        .select({ id: paymentProviderEvents.id })
        .from(paymentProviderEvents)
        .where(eq(paymentProviderEvents.providerEventId, input.eventId))
        .limit(1);
      if (duplicate) return;

      const [attempt] = await transaction
        .select()
        .from(paymentAttempts)
        .where(eq(paymentAttempts.paymentCode, input.attemptId))
        .limit(1)
        .for("update");
      if (!attempt)
        throw new ApiError(
          404,
          "PAYMENT_ATTEMPT_NOT_FOUND",
          "Payment attempt tidak ditemukan.",
        );
      const [booking] = await transaction
        .select()
        .from(bookings)
        .where(eq(bookings.id, attempt.bookingId))
        .limit(1)
        .for("update");
      if (!booking)
        throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking tidak ditemukan.");

      const webhookAmount = Number(input.grossAmount);
      if (!Number.isFinite(webhookAmount) || webhookAmount !== attempt.amount) {
        throw new ApiError(
          409,
          "PAYMENT_AMOUNT_MISMATCH",
          "Nominal webhook tidak sesuai dengan payment attempt.",
        );
      }

      await transaction.insert(paymentProviderEvents).values({
        providerEventId: input.eventId,
        paymentAttemptId: attempt.id,
        signatureVerified: true,
        payload: input,
        processedAt: now,
      });
      const mappedStatus = mapProviderStatus(input.transactionStatus);
      if (attempt.status === mappedStatus || attempt.status === "PAID") return;
      await transaction
        .update(paymentAttempts)
        .set({
          status: mappedStatus,
          paidAt: mappedStatus === "PAID" ? now : null,
          updatedAt: now,
        })
        .where(eq(paymentAttempts.id, attempt.id));

      if (mappedStatus === "PAID") {
        const latePayment =
          booking.status === "EXPIRED" || booking.status === "CANCELLED";
        if (latePayment) {
          await this.refundService.requestRefund(transaction, {
            bookingId: booking.id,
            paymentAttemptId: attempt.id,
            amount: attempt.amount,
            kind: "AUTOMATIC_LATE_PAYMENT",
            reason: "Pembayaran diterima setelah booking kedaluwarsa",
            idempotencyKey: `late-payment:${attempt.id}`,
            now,
          });
        } else {
          const [summary] = await transaction
            .select()
            .from(bookingPaymentSummaries)
            .where(eq(bookingPaymentSummaries.bookingId, booking.id))
            .limit(1)
            .for("update");
          if (!summary)
            throw new ApiError(
              409,
              "PAYMENT_SUMMARY_MISSING",
              "Ringkasan pembayaran tidak ditemukan.",
            );
          const totalPaid = summary.totalPaid + attempt.amount;
          const balanceDue = Math.max(0, booking.totalAmount - totalPaid);
          const paymentStatus = balanceDue === 0 ? "PAID" : "PARTIALLY_PAID";
          const requiresOwnerConfirmation =
            booking.paymentMode === "PAY_AT_VENUE" && attempt.kind === "RESERVATION";
          const confirmationExpiresAt = requiresOwnerConfirmation
            ? await resolveConfirmationExpiry(transaction, booking.venueId, now)
            : null;
          const nextBookingStatus = requiresOwnerConfirmation
            ? "PENDING_CONFIRMATION"
            : "CONFIRMED";
          await transaction
            .update(bookingPaymentSummaries)
            .set({ totalPaid, balanceDue, status: paymentStatus, updatedAt: now })
            .where(eq(bookingPaymentSummaries.bookingId, booking.id));
          await this.financeService.recordPayment(
            transaction,
            booking.id,
            attempt.id,
            attempt.amount,
            now,
          );
          await transaction
            .update(bookings)
            .set({
              status: nextBookingStatus,
              balanceDue,
              confirmationExpiresAt,
              version: booking.version + 1,
              updatedAt: now,
            })
            .where(eq(bookings.id, booking.id));
          if (attempt.kind === "RESCHEDULE") {
            await finalizePaidReschedule(transaction, booking.id, now);
          }
          await transaction
            .update(bookingSlotReservations)
            .set({
              reservationStatus: nextBookingStatus,
              expiresAt: confirmationExpiresAt,
            })
            .where(eq(bookingSlotReservations.bookingId, booking.id));
          if (booking.status !== nextBookingStatus) {
            await transaction.insert(bookingStateTransitions).values({
              bookingId: booking.id,
              fromStatus: booking.status,
              toStatus: nextBookingStatus,
              actorUserId: null,
              reason: "Pembayaran sandbox berhasil",
            });
          }
        }
      }

      await transaction.insert(outboxEvents).values({
        tenantId: booking.tenantId,
        audienceUserId: booking.customerUserId,
        eventType: "payment.status_changed",
        resourceType: "payment_attempt",
        resourceId: attempt.id,
        resourceVersion: 1,
        payload: { hint: "refetch-payment", status: mappedStatus },
        occurredAt: now,
      });
      if (mappedStatus === "PAID" && booking.customerUserId) {
        await this.notificationService.deliverInTransaction(transaction, {
          eventId: `payment-verified:${attempt.id}`,
          userId: booking.customerUserId,
          eventType: "payment.verified",
          title: "Pembayaran terverifikasi",
          body: `Pembayaran untuk booking ${booking.bookingCode} telah terverifikasi.`,
          actionPath: `/bookings/${booking.bookingCode}`,
          critical: true,
        });
      }
    });
    try {
      await this.publishPendingEvents();
    } catch {
      // The committed payment remains authoritative; the idempotent maintenance job
      // retries this outbox event when Redis or the realtime channel is unavailable.
    }
  }

  verifySignature(
    input: Pick<
      SandboxWebhookInput,
      "attemptId" | "statusCode" | "grossAmount" | "signatureKey"
    >,
  ): boolean {
    if (!this.environment.MIDTRANS_SERVER_KEY) {
      return (
        this.environment.NODE_ENV !== "production" &&
        input.signatureKey === "sandbox-local"
      );
    }
    const expected = createHash("sha512")
      .update(
        `${input.attemptId}${input.statusCode}${input.grossAmount}${this.environment.MIDTRANS_SERVER_KEY}`,
      )
      .digest("hex");
    return expected === input.signatureKey;
  }

  private async resolveAttemptAmount(
    booking: typeof bookings.$inferSelect,
    kind: "FULL" | "DP" | "RESERVATION" | "BALANCE" | "RETRY",
  ): Promise<number> {
    if (kind === "BALANCE") return booking.balanceDue;
    if (kind === "RETRY") {
      const [previousAttempt] = await this.database.db
        .select({ amount: paymentAttempts.amount })
        .from(paymentAttempts)
        .where(
          and(
            eq(paymentAttempts.bookingId, booking.id),
            inArray(paymentAttempts.status, ["FAILED", "EXPIRED", "CANCELLED"]),
          ),
        )
        .orderBy(desc(paymentAttempts.createdAt))
        .limit(1);
      if (!previousAttempt) {
        throw new ApiError(
          409,
          "PAYMENT_RETRY_NOT_AVAILABLE",
          "Tidak ada payment attempt gagal yang dapat dicoba ulang.",
        );
      }
      return previousAttempt.amount;
    }
    const [settings] = await this.database.db
      .select()
      .from(venuePaymentSettings)
      .where(eq(venuePaymentSettings.venueId, booking.venueId))
      .limit(1);
    if (!settings) {
      throw new ApiError(
        409,
        "PAYMENT_SETTINGS_MISSING",
        "Pengaturan pembayaran venue belum tersedia.",
      );
    }
    if (kind === "DP") {
      return Math.ceil((booking.totalAmount * (settings.dpPercentage ?? 100)) / 100);
    }
    if (kind === "RESERVATION") {
      return Math.min(booking.totalAmount, settings.reservationAmount ?? 0);
    }
    return booking.totalAmount;
  }

  private async ensureBalancePaymentOpen(
    booking: typeof bookings.$inferSelect,
    now: Date,
  ): Promise<void> {
    const [deadline] = await this.database.db
      .select({
        startsAt: bookingItems.startsAt,
        deadlineMinutes: venuePaymentSettings.balanceDeadlineMinutes,
      })
      .from(bookingItems)
      .innerJoin(
        venuePaymentSettings,
        eq(venuePaymentSettings.venueId, booking.venueId),
      )
      .where(eq(bookingItems.bookingId, booking.id))
      .limit(1);
    if (!deadline || deadline.deadlineMinutes === null) return;
    const paymentClosesAt = new Date(
      deadline.startsAt.getTime() -
        deadline.deadlineMinutes * 60_000 +
        BALANCE_DEADLINE_GRACE_MILLISECONDS,
    );
    if (now > paymentClosesAt) {
      throw new ApiError(
        409,
        "BALANCE_PAYMENT_DEADLINE_PASSED",
        "Batas waktu pelunasan online telah berakhir.",
      );
    }
  }

  async cancelOverdueBalances(now = new Date()): Promise<number> {
    const candidates = await this.database.db
      .select({ bookingReference: bookings.bookingCode })
      .from(bookings)
      .where(
        and(
          eq(bookings.status, "CONFIRMED"),
          inArray(bookings.paymentMode, ["DP", "PAY_AT_VENUE"]),
        ),
      )
      .limit(100);
    let cancelled = 0;
    for (const candidate of candidates) {
      if (await this.cancelOverdueBalance(candidate.bookingReference, now)) {
        cancelled += 1;
      }
    }
    return cancelled;
  }

  async expireRescheduleAdjustments(now = new Date()): Promise<number> {
    const pending = await this.database.db
      .select({ id: bookingReschedules.id })
      .from(bookingReschedules)
      .where(
        and(
          eq(bookingReschedules.status, "PAYMENT_PENDING"),
          lte(bookingReschedules.expiresAt, now),
        ),
      )
      .limit(100);
    let expired = 0;
    for (const candidate of pending) {
      const changed = await this.database.db.transaction(async (transaction) => {
        const [reschedule] = await transaction
          .select()
          .from(bookingReschedules)
          .where(eq(bookingReschedules.id, candidate.id))
          .limit(1)
          .for("update");
        if (!reschedule || reschedule.status !== "PAYMENT_PENDING") return false;
        const [booking] = await transaction
          .select()
          .from(bookings)
          .where(eq(bookings.id, reschedule.bookingId))
          .limit(1)
          .for("update");
        if (!booking) return false;
        const newSlotIds = numericIds(reschedule.newSlotIds);
        if (newSlotIds.length > 0) {
          await transaction
            .delete(bookingSlotReservations)
            .where(
              and(
                eq(bookingSlotReservations.bookingId, booking.id),
                inArray(bookingSlotReservations.courtSlotId, newSlotIds),
              ),
            );
        }
        await transaction
          .update(bookingReschedules)
          .set({ status: "EXPIRED", finalizedAt: now })
          .where(eq(bookingReschedules.id, reschedule.id));
        await transaction
          .update(paymentAttempts)
          .set({ status: "EXPIRED", updatedAt: now })
          .where(eq(paymentAttempts.idempotencyKey, `reschedule:${booking.id}`));
        const revertedVersion = booking.version + 1;
        await transaction
          .update(bookings)
          .set({
            totalAmount: booking.totalAmount - reschedule.priceDifference,
            balanceDue: Math.max(0, booking.balanceDue - reschedule.priceDifference),
            version: revertedVersion,
            cancellationPolicySnapshot: originalPolicySnapshot(
              reschedule.policySnapshot,
            ),
            updatedAt: now,
          })
          .where(eq(bookings.id, booking.id));
        const [snapshot] = await transaction
          .select()
          .from(bookingFinancialSnapshots)
          .where(eq(bookingFinancialSnapshots.bookingId, booking.id))
          .orderBy(desc(bookingFinancialSnapshots.bookingVersion))
          .limit(1);
        if (snapshot) {
          const commissionBase = Math.max(
            0,
            snapshot.commissionBase - reschedule.priceDifference,
          );
          const platformCommission = Math.floor(
            (commissionBase * snapshot.commissionRateBasisPoints) / 10_000,
          );
          await transaction.insert(bookingFinancialSnapshots).values({
            bookingId: booking.id,
            bookingVersion: revertedVersion,
            commissionConfigId: snapshot.commissionConfigId,
            promotionId: snapshot.promotionId,
            paymentMode: snapshot.paymentMode,
            reservationAmount: snapshot.reservationAmount,
            dpAmount: snapshot.dpAmount,
            courtSubtotal: Math.max(
              0,
              snapshot.courtSubtotal - reschedule.priceDifference,
            ),
            addonSubtotal: snapshot.addonSubtotal,
            ownerDiscount: snapshot.ownerDiscount,
            platformDiscount: snapshot.platformDiscount,
            commissionBase,
            commissionRateBasisPoints: snapshot.commissionRateBasisPoints,
            platformCommission,
            gatewayFee: snapshot.gatewayFee,
            gatewayFeeFunding: snapshot.gatewayFeeFunding,
            ownerNet:
              commissionBase -
              platformCommission -
              (snapshot.gatewayFeeFunding === "OWNER" ? snapshot.gatewayFee : 0),
            taxPlaceholder: snapshot.taxPlaceholder,
          });
        }
        return true;
      });
      if (changed) expired += 1;
    }
    return expired;
  }

  async cancelOverdueBalance(bookingReference: string, now: Date): Promise<boolean> {
    return this.database.db.transaction(async (transaction) => {
      const [booking] = await transaction
        .select()
        .from(bookings)
        .where(eq(bookings.bookingCode, bookingReference))
        .limit(1)
        .for("update");
      if (!booking || booking.status !== "CONFIRMED" || booking.balanceDue <= 0) {
        return false;
      }
      const [deadline] = await transaction
        .select({
          startsAt: bookingItems.startsAt,
          deadlineMinutes: venuePaymentSettings.balanceDeadlineMinutes,
        })
        .from(bookingItems)
        .innerJoin(
          venuePaymentSettings,
          eq(venuePaymentSettings.venueId, booking.venueId),
        )
        .where(eq(bookingItems.bookingId, booking.id))
        .limit(1);
      if (!deadline || deadline.deadlineMinutes === null) return false;
      const cancellationTime = new Date(
        deadline.startsAt.getTime() -
          deadline.deadlineMinutes * 60_000 +
          BALANCE_DEADLINE_GRACE_MILLISECONDS,
      );
      if (now <= cancellationTime) return false;

      const [summary] = await transaction
        .select()
        .from(bookingPaymentSummaries)
        .where(eq(bookingPaymentSummaries.bookingId, booking.id))
        .limit(1)
        .for("update");
      if (!summary) throw new Error("Ringkasan pembayaran booking tidak ditemukan.");
      const nextVersion = booking.version + 1;
      await transaction
        .update(bookings)
        .set({ status: "CANCELLED", version: nextVersion, updatedAt: now })
        .where(eq(bookings.id, booking.id));
      await transaction
        .delete(bookingSlotReservations)
        .where(eq(bookingSlotReservations.bookingId, booking.id));
      await transaction.insert(bookingStateTransitions).values({
        bookingId: booking.id,
        fromStatus: "CONFIRMED",
        toStatus: "CANCELLED",
        actorUserId: null,
        reason: "Pelunasan online melewati deadline dan grace period 30 menit",
      });
      const refundableAmount = summary.totalPaid - summary.totalRefunded;
      if (refundableAmount > 0) {
        await this.refundService.requestRefund(transaction, {
          bookingId: booking.id,
          amount: refundableAmount,
          kind: "BALANCE_TIMEOUT",
          reason: "Pelunasan online melewati deadline",
          idempotencyKey: `balance-timeout:${booking.bookingCode}`,
          now,
        });
      }
      if (booking.customerUserId) {
        await this.notificationService.deliverInTransaction(transaction, {
          eventId: `booking-status:${booking.id}:${nextVersion}`,
          userId: booking.customerUserId,
          eventType: "booking.status_changed",
          title: "Booking dibatalkan karena pelunasan terlambat",
          body: "Batas pelunasan online dan grace period 30 menit telah berakhir.",
          actionPath: `/bookings/${booking.bookingCode}`,
          critical: true,
        });
      }
      await transaction.insert(outboxEvents).values({
        tenantId: booking.tenantId,
        audienceUserId: booking.customerUserId,
        eventType: "booking.status_changed",
        resourceType: "booking",
        resourceId: booking.id,
        resourceVersion: nextVersion,
        payload: { status: "CANCELLED", hint: "refetch-booking" },
        occurredAt: now,
      });
      return true;
    });
  }

  async cancelTimedOutConfirmation(
    bookingReference: string,
    now = new Date(),
  ): Promise<boolean> {
    return this.cancelPendingConfirmation(bookingReference, {
      now,
      requireExpired: true,
      actorUserId: null,
      reason: "Konfirmasi venue melewati batas waktu",
      refundKind: "CONFIRMATION_TIMEOUT",
      refundKeyPrefix: "confirmation-timeout",
      notificationTitle: "Booking dibatalkan otomatis",
      notificationBody:
        "Venue tidak memberi konfirmasi tepat waktu. Refund reservation sedang diproses.",
    });
  }

  async rejectPendingConfirmation(
    bookingReference: string,
    actorUserId: string,
    reason: string,
    now = new Date(),
  ): Promise<void> {
    const cancelled = await this.cancelPendingConfirmation(bookingReference, {
      now,
      requireExpired: false,
      actorUserId: parsePublicId(actorUserId),
      reason,
      refundKind: "CONFIRMATION_REJECTED",
      refundKeyPrefix: "confirmation-rejected",
      notificationTitle: "Booking ditolak venue",
      notificationBody: `${reason} Refund reservation sedang diproses.`,
    });
    if (!cancelled) {
      throw new ApiError(
        409,
        "BOOKING_NOT_PENDING_CONFIRMATION",
        "Booking tidak lagi menunggu konfirmasi venue.",
      );
    }
  }

  private async cancelPendingConfirmation(
    bookingReference: string,
    options: {
      now: Date;
      requireExpired: boolean;
      actorUserId: number | null;
      reason: string;
      refundKind: "CONFIRMATION_TIMEOUT" | "CONFIRMATION_REJECTED";
      refundKeyPrefix: string;
      notificationTitle: string;
      notificationBody: string;
    },
  ): Promise<boolean> {
    const cancelled = await this.database.db.transaction(async (transaction) => {
      const [booking] = await transaction
        .select()
        .from(bookings)
        .where(eq(bookings.bookingCode, bookingReference))
        .limit(1)
        .for("update");
      if (
        !booking ||
        booking.status !== "PENDING_CONFIRMATION" ||
        (options.requireExpired &&
          (!booking.confirmationExpiresAt ||
            booking.confirmationExpiresAt > options.now))
      ) {
        return false;
      }
      const [summary] = await transaction
        .select()
        .from(bookingPaymentSummaries)
        .where(eq(bookingPaymentSummaries.bookingId, booking.id))
        .limit(1)
        .for("update");
      if (!summary) {
        throw new ApiError(
          409,
          "PAYMENT_SUMMARY_MISSING",
          "Ringkasan pembayaran tidak ditemukan.",
        );
      }
      const nextVersion = booking.version + 1;
      await transaction
        .update(bookings)
        .set({
          status: "CANCELLED",
          version: nextVersion,
          updatedAt: options.now,
        })
        .where(eq(bookings.id, booking.id));
      await transaction
        .delete(bookingSlotReservations)
        .where(eq(bookingSlotReservations.bookingId, booking.id));
      await transaction.insert(bookingStateTransitions).values({
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: "CANCELLED",
        actorUserId: options.actorUserId,
        reason: options.reason,
      });
      const refundableAmount = summary.totalPaid - summary.totalRefunded;
      if (refundableAmount > 0) {
        await this.refundService.requestRefund(transaction, {
          bookingId: booking.id,
          amount: refundableAmount,
          kind: options.refundKind,
          reason: `${options.reason}. Reservation payment dikembalikan 100%.`,
          idempotencyKey: `${options.refundKeyPrefix}:${booking.bookingCode}`,
          requestedByUserId: options.actorUserId,
          now: options.now,
        });
      }
      if (booking.customerUserId) {
        await this.notificationService.deliverInTransaction(transaction, {
          eventId: `booking-status:${booking.id}:${nextVersion}`,
          userId: booking.customerUserId,
          eventType: "booking.status_changed",
          title: options.notificationTitle,
          body: options.notificationBody,
          actionPath: `/bookings/${booking.bookingCode}`,
          critical: true,
        });
      }
      await transaction.insert(outboxEvents).values({
        tenantId: booking.tenantId,
        audienceUserId: booking.customerUserId,
        eventType: "booking.status_changed",
        resourceType: "booking",
        resourceId: booking.id,
        resourceVersion: nextVersion,
        payload: { status: "CANCELLED", hint: "refetch-booking" },
        occurredAt: options.now,
      });
      return true;
    });
    if (cancelled) {
      try {
        await this.publishPendingEvents();
      } catch {
        // The maintenance job retries committed outbox events.
      }
    }
    return cancelled;
  }

  async simulateSandboxResult(
    attemptId: string,
    userId: string,
    result: "success" | "pending" | "failed" | "expired",
  ): Promise<void> {
    if (this.environment.NODE_ENV === "production") {
      throw new ApiError(
        404,
        "SANDBOX_SIMULATION_DISABLED",
        "Simulasi tidak tersedia.",
      );
    }
    const attempt = await this.getAttempt(attemptId, userId);
    const statusByResult = {
      success: "settlement",
      pending: "pending",
      failed: "deny",
      expired: "expire",
    } as const;
    await this.processWebhook({
      eventId: `simulation:${attemptId}:${result}:${Date.now()}`,
      attemptId,
      transactionStatus: statusByResult[result],
      statusCode: result === "success" ? "200" : "202",
      grossAmount: String(attempt.amount),
      signatureKey: "sandbox-local",
    });
  }
}

function mapProviderStatus(
  status: SandboxWebhookInput["transactionStatus"],
): PaymentAttemptStatus {
  if (status === "settlement" || status === "capture") return "PAID";
  if (status === "pending") return "PENDING";
  if (status === "expire") return "EXPIRED";
  if (status === "cancel") return "CANCELLED";
  return "FAILED";
}

function validateAttemptKind(
  booking: typeof bookings.$inferSelect,
  kind: "FULL" | "DP" | "RESERVATION" | "BALANCE" | "RETRY",
): void {
  if (kind === "RETRY") return;
  if (kind === "BALANCE") {
    if (booking.status !== "CONFIRMED" || booking.balanceDue <= 0) {
      throw new ApiError(
        409,
        "BALANCE_PAYMENT_NOT_AVAILABLE",
        "Pelunasan hanya tersedia untuk booking confirmed yang masih memiliki saldo.",
      );
    }
    return;
  }
  const expectedKind = {
    FULL: "FULL",
    DP: "DP",
    PAY_AT_VENUE: "RESERVATION",
  }[booking.paymentMode];
  if (kind !== expectedKind) {
    throw new ApiError(
      409,
      "PAYMENT_KIND_NOT_ALLOWED",
      `Booking ini memerlukan payment attempt ${expectedKind}.`,
    );
  }
}

function toView(
  attempt: typeof paymentAttempts.$inferSelect,
  bookingReference: string,
): PaymentAttemptView {
  return {
    id: attempt.paymentCode,
    bookingId: bookingReference,
    kind: attempt.kind,
    amount: attempt.amount,
    status: attempt.status as PaymentAttemptStatus,
    redirectUrl: attempt.redirectUrl,
    sandbox: true,
  };
}

async function resolveConfirmationExpiry(
  transaction: Parameters<Parameters<DatabaseConnection["db"]["transaction"]>[0]>[0],
  venueId: number,
  now: Date,
): Promise<Date> {
  const [settings] = await transaction
    .select({ minutes: venuePaymentSettings.manualConfirmationMinutes })
    .from(venuePaymentSettings)
    .where(eq(venuePaymentSettings.venueId, venueId))
    .limit(1);
  if (!settings) {
    throw new ApiError(
      409,
      "PAYMENT_SETTINGS_MISSING",
      "Pengaturan pembayaran venue belum tersedia.",
    );
  }
  return new Date(now.getTime() + settings.minutes * 60_000);
}

async function finalizePaidReschedule(
  transaction: Parameters<Parameters<DatabaseConnection["db"]["transaction"]>[0]>[0],
  bookingId: number,
  now: Date,
): Promise<void> {
  const [reschedule] = await transaction
    .select()
    .from(bookingReschedules)
    .where(
      and(
        eq(bookingReschedules.bookingId, bookingId),
        eq(bookingReschedules.status, "PAYMENT_PENDING"),
      ),
    )
    .limit(1)
    .for("update");
  if (!reschedule) return;
  const previousSlotIds = numericIds(reschedule.previousSlotIds);
  const newSlotIds = numericIds(reschedule.newSlotIds);
  const newSlots = await transaction
    .select()
    .from(courtSlots)
    .where(inArray(courtSlots.id, newSlotIds))
    .orderBy(courtSlots.startsAt);
  if (newSlots.length !== newSlotIds.length) throw new Error("RESCHEDULE_SLOT_MISSING");
  const [item] = await transaction
    .select()
    .from(bookingItems)
    .where(eq(bookingItems.bookingId, bookingId))
    .limit(1)
    .for("update");
  if (!item) throw new Error("RESCHEDULE_BOOKING_ITEM_MISSING");
  if (previousSlotIds.length > 0) {
    await transaction
      .delete(bookingSlotReservations)
      .where(
        and(
          eq(bookingSlotReservations.bookingId, bookingId),
          inArray(bookingSlotReservations.courtSlotId, previousSlotIds),
        ),
      );
  }
  await transaction
    .update(bookingSlotReservations)
    .set({ reservationStatus: "CONFIRMED", expiresAt: null })
    .where(
      and(
        eq(bookingSlotReservations.bookingId, bookingId),
        inArray(bookingSlotReservations.courtSlotId, newSlotIds),
      ),
    );
  await transaction
    .update(bookingItems)
    .set({
      startsAt: newSlots[0]!.startsAt,
      endsAt: newSlots.at(-1)!.endsAt,
      subtotal: item.subtotal + reschedule.priceDifference,
    })
    .where(eq(bookingItems.id, item.id));
  await transaction
    .update(bookingReschedules)
    .set({ status: "COMPLETED", finalizedAt: now })
    .where(eq(bookingReschedules.id, reschedule.id));
  await transaction.insert(bookingSlotHistory).values([
    ...previousSlotIds.map((courtSlotId) => ({
      courtSlotId,
      bookingId,
      action: "RELEASED",
      reason: reschedule.reason,
    })),
    ...newSlotIds.map((courtSlotId) => ({
      courtSlotId,
      bookingId,
      action: "RESCHEDULED",
      reason: reschedule.reason,
    })),
  ]);
}

function numericIds(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((item): item is number => Number.isInteger(item))
    : [];
}
