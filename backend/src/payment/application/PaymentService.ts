import { createHash } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { Environment } from "../../config/environment.js";
import type { DatabaseConnection } from "../../database/client.js";
import { parsePublicId } from "../../database/ids.js";
import {
  bookingPaymentSummaries,
  bookingItems,
  bookingSlotReservations,
  bookings,
  bookingStateTransitions,
  outboxEvents,
  paymentAttempts,
  paymentProviderEvents,
  refunds,
  refundStateTransitions,
  userNotifications,
  venuePaymentSettings,
} from "../../database/schema/index.js";
import { ApiError } from "../../http/ApiError.js";
import {
  createPublicReference,
  PAYMENT_REFERENCE_PREFIX,
} from "../../security/publicReference.js";
import type { PaymentProvider } from "./PaymentProvider.js";

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
          await createAutomaticRefund(
            transaction,
            booking.id,
            attempt.id,
            attempt.amount,
            now,
          );
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
        eventType: "payment.status_changed",
        resourceType: "payment_attempt",
        resourceId: attempt.id,
        resourceVersion: 1,
        payload: { hint: "refetch-payment", status: mappedStatus },
        occurredAt: now,
      });
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
        const [refund] = await transaction
          .insert(refunds)
          .values({
            bookingId: booking.id,
            amount: refundableAmount,
            status: "PENDING",
            kind: "BALANCE_TIMEOUT",
            reason: "Pelunasan online melewati deadline",
            idempotencyKey: `balance-timeout:${booking.bookingCode}`,
          })
          .$returningId();
        if (!refund) throw new Error("MySQL tidak mengembalikan ID refund deadline.");
        await transaction.insert(refundStateTransitions).values({
          refundId: refund.id,
          fromStatus: null,
          toStatus: "PENDING",
          payload: { sandbox: true, occurredAt: now.toISOString() },
        });
      }
      if (booking.customerUserId) {
        await transaction.insert(userNotifications).values({
          userId: booking.customerUserId,
          kind: "booking",
          title: "Booking dibatalkan karena pelunasan terlambat",
          body: "Batas pelunasan online dan grace period 30 menit telah berakhir.",
          actionPath: `/bookings/${booking.bookingCode}`,
        });
      }
      await transaction.insert(outboxEvents).values({
        tenantId: booking.tenantId,
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
        const [refund] = await transaction
          .insert(refunds)
          .values({
            bookingId: booking.id,
            amount: refundableAmount,
            status: "PENDING",
            kind: options.refundKind,
            reason: `${options.reason}. Reservation payment dikembalikan 100%.`,
            idempotencyKey: `${options.refundKeyPrefix}:${booking.bookingCode}`,
            requestedByUserId: options.actorUserId,
          })
          .$returningId();
        if (!refund) throw new Error("MySQL tidak mengembalikan ID refund timeout.");
        await transaction.insert(refundStateTransitions).values({
          refundId: refund.id,
          fromStatus: null,
          toStatus: "PENDING",
          payload: { sandbox: true, occurredAt: options.now.toISOString() },
        });
      }
      if (booking.customerUserId) {
        await transaction.insert(userNotifications).values({
          userId: booking.customerUserId,
          kind: "booking",
          title: options.notificationTitle,
          body: options.notificationBody,
          actionPath: `/bookings/${booking.bookingCode}`,
        });
      }
      await transaction.insert(outboxEvents).values({
        tenantId: booking.tenantId,
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

async function createAutomaticRefund(
  transaction: Parameters<Parameters<DatabaseConnection["db"]["transaction"]>[0]>[0],
  bookingId: number,
  paymentAttemptId: number,
  amount: number,
  now: Date,
): Promise<void> {
  const [createdRefund] = await transaction
    .insert(refunds)
    .values({
      bookingId,
      paymentAttemptId,
      amount,
      status: "PENDING",
      kind: "AUTOMATIC_LATE_PAYMENT",
      reason: "Pembayaran diterima setelah booking kedaluwarsa",
      idempotencyKey: `late-payment:${paymentAttemptId}`,
    })
    .$returningId();
  if (!createdRefund) throw new Error("MySQL tidak mengembalikan ID refund otomatis.");
  await transaction.insert(refundStateTransitions).values({
    refundId: createdRefund.id,
    fromStatus: null,
    toStatus: "PENDING",
    payload: { sandbox: true, occurredAt: now.toISOString() },
  });
}
