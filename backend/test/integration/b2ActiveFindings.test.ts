import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { OperationsService } from "../../src/booking/application/OperationsService.js";
import { formatPublicId, parsePublicId } from "../../src/database/ids.js";
import {
  auditLogs,
  bookingFinancialSnapshots,
  bookingItems,
  bookingPaymentSummaries,
  bookingReschedules,
  bookings,
  bookingSlotReservations,
  commandIdempotency,
  courtSlots,
  ledgerEntries,
  ledgerTransactions,
  ownerEarnings,
  outboxEvents,
  paymentAttempts,
  payoutBatches,
  payoutItems,
  priceRules,
  refunds,
} from "../../src/database/schema/index.js";
import type { LedgerAccountCode } from "../../src/finance/FinanceService.js";
import { FinanceService } from "../../src/finance/FinanceService.js";
import { RefundService } from "../../src/payment/application/RefundService.js";
import { ReviewService } from "../../src/review/ReviewService.js";
import { TenantService } from "../../src/tenant/application/TenantService.js";
import { testDatabase } from "../support/databaseTestHarness.js";

describe("Phase B2 active finding regressions", () => {
  it("memposting refund sebelum completion ke customer funds held", async () => {
    const booking = await createFinancialBooking(false, 50_000, {
      ownerNet: 45_000,
      platformCommission: 4_000,
      gatewayFee: 1_000,
    });
    try {
      const finance = new FinanceService(testDatabase);
      const refundService = new RefundService(testDatabase, finance);
      const refundId = await testDatabase.db.transaction((transaction) =>
        refundService.requestRefund(transaction, {
          bookingId: booking.id,
          amount: 20_000,
          kind: "PRE_COMPLETION",
          reason: "Regression refund sebelum completion",
          idempotencyKey: `pre-completion-${booking.id}`,
        }),
      );
      await expect(refundService.completeSandboxRefund(refundId)).resolves.toBe(true);

      const balances = await refundLedgerBalancesFor(booking.id);
      expect(balances).toMatchObject({
        CUSTOMER_FUNDS_HELD: 20_000,
        SANDBOX_CASH: -20_000,
      });
      expect(balances.REFUND_EXPENSE ?? 0).toBe(0);
      expect(sumBalances(balances)).toBe(0);

      await testDatabase.db.transaction((transaction) =>
        finance.markBookingCompleted(transaction, booking.id, new Date()),
      );
      const completedBalances = await refundLedgerBalancesFor(booking.id, [
        "REFUND_SUCCEEDED",
        "REFUND_RECONCILIATION",
      ]);
      expect(completedBalances).toMatchObject({
        OWNER_PAYABLE: 18_000,
        PLATFORM_COMMISSION_REVENUE: 1_600,
        REFUND_EXPENSE: 400,
        SANDBOX_CASH: -20_000,
      });
      expect(completedBalances.CUSTOMER_FUNDS_HELD ?? 0).toBe(0);
      expect(sumBalances(completedBalances)).toBe(0);
      const earnings = await testDatabase.db
        .select({
          amount: ownerEarnings.amount,
          availableAt: ownerEarnings.availableAt,
        })
        .from(ownerEarnings)
        .where(eq(ownerEarnings.bookingId, booking.id));
      expect(earnings.reduce((sum, earning) => sum + earning.amount, 0)).toBe(27_000);
      expect(earnings.every((earning) => earning.availableAt !== null)).toBe(true);
    } finally {
      await cleanupBookings([booking.id]);
    }
  });

  it("tidak menghidupkan kembali earning full refund sebelum completion", async () => {
    const booking = await createFinancialBooking(false, 50_000, {
      ownerNet: 45_000,
      platformCommission: 4_000,
      gatewayFee: 1_000,
    });
    const finance = new FinanceService(testDatabase);
    try {
      const refundService = new RefundService(testDatabase, finance);
      const refundId = await testDatabase.db.transaction((transaction) =>
        refundService.requestRefund(transaction, {
          bookingId: booking.id,
          amount: 50_000,
          kind: "PRE_COMPLETION_FULL",
          reason: "Full refund sebelum completion",
          idempotencyKey: `pre-completion-full-${booking.id}`,
        }),
      );
      await expect(refundService.completeSandboxRefund(refundId)).resolves.toBe(true);
      await testDatabase.db.transaction((transaction) =>
        finance.markBookingCompleted(transaction, booking.id, new Date()),
      );

      const earnings = await testDatabase.db
        .select({ amount: ownerEarnings.amount, status: ownerEarnings.status })
        .from(ownerEarnings)
        .where(eq(ownerEarnings.bookingId, booking.id));
      expect(earnings.every((earning) => earning.status === "REVERSED")).toBe(true);
      expect(
        earnings
          .filter((earning) => earning.status !== "REVERSED")
          .reduce((sum, earning) => sum + earning.amount, 0),
      ).toBe(0);
      const balances = await refundLedgerBalancesFor(booking.id, [
        "REFUND_SUCCEEDED",
        "REFUND_RECONCILIATION",
      ]);
      expect(balances).toMatchObject({
        OWNER_PAYABLE: 45_000,
        PLATFORM_COMMISSION_REVENUE: 4_000,
        REFUND_EXPENSE: 1_000,
        SANDBOX_CASH: -50_000,
      });
      expect(balances.CUSTOMER_FUNDS_HELD ?? 0).toBe(0);
      expect(sumBalances(balances)).toBe(0);
    } finally {
      await cleanupBookings([booking.id]);
    }
  });

  it("merekonsiliasi refund concurrent yang commit setelah read view completion", async () => {
    const booking = await createFinancialBooking(false, 50_000, {
      ownerNet: 45_000,
      platformCommission: 4_000,
      gatewayFee: 1_000,
    });
    const finance = new FinanceService(testDatabase);
    const refundService = new RefundService(testDatabase, finance);
    try {
      const refundId = await testDatabase.db.transaction((transaction) =>
        refundService.requestRefund(transaction, {
          bookingId: booking.id,
          amount: 20_000,
          kind: "PRECOMP_RACE",
          reason: "Refund commit setelah completion membentuk read view",
          idempotencyKey: `concurrent-pre-completion-${booking.id}`,
        }),
      );
      await completeAfterConcurrentRefund(booking.id, refundId, finance, refundService);

      const balances = await refundLedgerBalancesFor(booking.id, [
        "REFUND_SUCCEEDED",
        "REFUND_RECONCILIATION",
      ]);
      expect(balances).toMatchObject({
        OWNER_PAYABLE: 18_000,
        PLATFORM_COMMISSION_REVENUE: 1_600,
        REFUND_EXPENSE: 400,
        SANDBOX_CASH: -20_000,
      });
      expect(balances.CUSTOMER_FUNDS_HELD ?? 0).toBe(0);
      expect(sumBalances(balances)).toBe(0);
    } finally {
      await cleanupBookings([booking.id]);
    }
  });

  it("mengurangkan posting refund existing dari delta completion concurrent", async () => {
    const booking = await createFinancialBooking(false, 100_000, {
      ownerNet: 90_000,
      platformCommission: 10_000,
      gatewayFee: 0,
    });
    const finance = new FinanceService(testDatabase);
    const refundService = new RefundService(testDatabase, finance);
    try {
      const refundId = await testDatabase.db.transaction((transaction) =>
        refundService.requestRefund(transaction, {
          bookingId: booking.id,
          amount: 30_000,
          kind: "EXISTING_POSTING",
          reason: "Posting existing harus menjadi basis delta completion",
          idempotencyKey: `existing-posting-${booking.id}`,
        }),
      );
      await completeAfterConcurrentRefund(booking.id, refundId, finance, refundService);

      const balances = await refundLedgerBalancesFor(booking.id, [
        "REFUND_SUCCEEDED",
        "REFUND_RECONCILIATION",
      ]);
      expect(balances.SANDBOX_CASH).toBe(-30_000);
      expect(balances.OWNER_PAYABLE).toBe(27_000);
      expect(balances.PLATFORM_COMMISSION_REVENUE).toBe(3_000);
      expect(balances.CUSTOMER_FUNDS_HELD ?? 0).toBe(0);
      expect(sumBalances(balances)).toBe(0);
    } finally {
      await cleanupBookings([booking.id]);
    }
  });

  it("membalik owner payable, commission, promo, dan fee secara semantic", async () => {
    const finance = new FinanceService(testDatabase);
    const baseline = await finance.financeSummary(formatPublicId(1));
    const booking = await createFinancialBooking(true, 90_000, {
      ownerNet: 88_000,
      platformCommission: 10_000,
      platformDiscount: 10_000,
      gatewayFee: 2_000,
    });
    try {
      const afterCompletion = await finance.financeSummary(formatPublicId(1));
      expect(afterCompletion.commission - baseline.commission).toBe(10_000);
      expect(afterCompletion.netOwnerRevenue - baseline.netOwnerRevenue).toBe(88_000);

      const refundService = new RefundService(testDatabase);
      const firstRefundId = await testDatabase.db.transaction((transaction) =>
        refundService.requestRefund(transaction, {
          bookingId: booking.id,
          amount: 30_000,
          kind: "PARTIAL",
          reason: "Regression partial refund",
          idempotencyKey: `partial-${booking.id}`,
        }),
      );
      await expect(refundService.completeSandboxRefund(firstRefundId)).resolves.toBe(
        true,
      );
      const partialBalances = await refundLedgerBalancesFor(booking.id);
      expect(sumBalances(partialBalances)).toBe(0);
      const afterPartial = await finance.financeSummary(formatPublicId(1));
      expect(afterPartial.netOwnerRevenue - baseline.netOwnerRevenue).toBe(
        88_000 - partialBalances.OWNER_PAYABLE!,
      );

      const finalRefundId = await testDatabase.db.transaction((transaction) =>
        refundService.requestRefund(transaction, {
          bookingId: booking.id,
          amount: 60_000,
          kind: "FULL",
          reason: "Regression full refund",
          idempotencyKey: `full-${booking.id}`,
        }),
      );
      await expect(refundService.completeSandboxRefund(finalRefundId)).resolves.toBe(
        true,
      );

      const balances = await refundLedgerBalancesFor(booking.id);
      expect(balances).toMatchObject({
        OWNER_PAYABLE: 88_000,
        PLATFORM_COMMISSION_REVENUE: 10_000,
        PLATFORM_PROMO_EXPENSE: -10_000,
        REFUND_EXPENSE: 2_000,
        SANDBOX_CASH: -90_000,
      });
      expect(sumBalances(balances)).toBe(0);
      const afterRefund = await finance.financeSummary(formatPublicId(1));
      expect(afterRefund.commission).toBe(baseline.commission);
      expect(afterRefund.netOwnerRevenue).toBe(baseline.netOwnerRevenue);
    } finally {
      await cleanupBookings([booking.id]);
    }
  });

  it("membatalkan payout scheduled sebelum full refund membalik earning", async () => {
    const booking = await createFinancialBooking(true, 100_000, {
      ownerNet: 90_000,
      platformCommission: 10_000,
      gatewayFee: 0,
    });
    const otherBooking = await createFinancialBooking(true, 120_000, {
      ownerNet: 108_000,
      platformCommission: 12_000,
      gatewayFee: 0,
    });
    const finance = new FinanceService(testDatabase);
    const payoutBatchIds: number[] = [];
    try {
      const [earning] = await testDatabase.db
        .select()
        .from(ownerEarnings)
        .where(eq(ownerEarnings.sourceKey, `booking:${booking.id}`))
        .limit(1);
      if (!earning) throw new Error("Earning payout regression tidak ditemukan.");
      const [otherEarning] = await testDatabase.db
        .select()
        .from(ownerEarnings)
        .where(eq(ownerEarnings.sourceKey, `booking:${otherBooking.id}`))
        .limit(1);
      if (!otherEarning) throw new Error("Earning payout kedua tidak ditemukan.");
      const [batch] = await testDatabase.db
        .insert(payoutBatches)
        .values({
          tenantId: 1,
          status: "SCHEDULED",
          kind: "MANUAL",
          totalAmount: earning.amount + otherEarning.amount,
          idempotencyKey: `reserved-refund-${randomUUID()}`,
          requestedByUserId: 1,
        })
        .$returningId();
      if (!batch) throw new Error("Payout regression gagal dibuat.");
      payoutBatchIds.push(batch.id);
      await testDatabase.db.insert(payoutItems).values([
        {
          payoutBatchId: batch.id,
          earningId: earning.id,
          amount: earning.amount,
        },
        {
          payoutBatchId: batch.id,
          earningId: otherEarning.id,
          amount: otherEarning.amount,
        },
      ]);
      await testDatabase.db
        .update(ownerEarnings)
        .set({ status: "RESERVED_FOR_PAYOUT" })
        .where(inArray(ownerEarnings.id, [earning.id, otherEarning.id]));

      const refundService = new RefundService(testDatabase, finance);
      const refundId = await testDatabase.db.transaction((transaction) =>
        refundService.requestRefund(transaction, {
          bookingId: booking.id,
          amount: 100_000,
          kind: "FULL",
          reason: "Full refund saat payout reserved",
          idempotencyKey: `reserved-full-${booking.id}`,
        }),
      );
      await expect(refundService.completeSandboxRefund(refundId)).resolves.toBe(true);

      const [batchAfter] = await testDatabase.db
        .select({ status: payoutBatches.status })
        .from(payoutBatches)
        .where(eq(payoutBatches.id, batch.id));
      const [earningAfter] = await testDatabase.db
        .select({ status: ownerEarnings.status })
        .from(ownerEarnings)
        .where(eq(ownerEarnings.id, earning.id));
      const [otherEarningAfter] = await testDatabase.db
        .select({ status: ownerEarnings.status })
        .from(ownerEarnings)
        .where(eq(ownerEarnings.id, otherEarning.id));
      expect(batchAfter?.status).toBe("CANCELLED");
      expect(earningAfter?.status).toBe("REVERSED");
      expect(otherEarningAfter?.status).toBe("AVAILABLE");

      const [replacementBatch] = await testDatabase.db
        .insert(payoutBatches)
        .values({
          tenantId: 1,
          status: "SCHEDULED",
          kind: "WEEKLY",
          totalAmount: otherEarning.amount,
          idempotencyKey: `replacement-${randomUUID()}`,
        })
        .$returningId();
      if (!replacementBatch) throw new Error("Replacement payout gagal dibuat.");
      payoutBatchIds.push(replacementBatch.id);
      await expect(
        testDatabase.db.insert(payoutItems).values({
          payoutBatchId: replacementBatch.id,
          earningId: otherEarning.id,
          amount: otherEarning.amount,
        }),
      ).resolves.toBeDefined();
      await testDatabase.db
        .update(ownerEarnings)
        .set({ status: "RESERVED_FOR_PAYOUT" })
        .where(eq(ownerEarnings.id, otherEarning.id));

      const replacementRefundId = await testDatabase.db.transaction((transaction) =>
        refundService.requestRefund(transaction, {
          bookingId: otherBooking.id,
          amount: 120_000,
          kind: "FULL",
          reason: "Refund harus memilih payout pengganti yang masih aktif",
          idempotencyKey: `replacement-full-${otherBooking.id}`,
        }),
      );
      await expect(
        refundService.completeSandboxRefund(replacementRefundId),
      ).resolves.toBe(true);
      const [replacementAfter] = await testDatabase.db
        .select({ status: payoutBatches.status })
        .from(payoutBatches)
        .where(eq(payoutBatches.id, replacementBatch.id));
      const [otherAfterReplacementRefund] = await testDatabase.db
        .select({ status: ownerEarnings.status })
        .from(ownerEarnings)
        .where(eq(ownerEarnings.id, otherEarning.id));
      expect(replacementAfter?.status).toBe("CANCELLED");
      expect(otherAfterReplacementRefund?.status).toBe("REVERSED");

      const [audit] = await testDatabase.db
        .select({ id: auditLogs.id })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.action, "payout.status_changed"),
            eq(auditLogs.resourceId, batch.id),
          ),
        );
      const [event] = await testDatabase.db
        .select({ id: outboxEvents.id })
        .from(outboxEvents)
        .where(
          and(
            eq(outboxEvents.eventType, "payout.status_changed"),
            eq(outboxEvents.resourceId, batch.id),
          ),
        );
      expect(audit).toBeDefined();
      expect(event).toBeDefined();
      await expect(
        finance.updatePayoutStatus(
          formatPublicId(batch.id),
          "PROCESSING",
          formatPublicId(1),
          `process-cancelled-${batch.id}`,
          "Payout yang sudah dibatalkan tidak boleh diproses",
        ),
      ).rejects.toMatchObject({ code: "INVALID_PAYOUT_TRANSITION" });
    } finally {
      if (payoutBatchIds.length > 0) {
        await testDatabase.db
          .delete(auditLogs)
          .where(
            and(
              eq(auditLogs.resourceType, "payout"),
              inArray(auditLogs.resourceId, payoutBatchIds),
            ),
          );
        await testDatabase.db
          .delete(outboxEvents)
          .where(
            and(
              eq(outboxEvents.resourceType, "payout"),
              inArray(outboxEvents.resourceId, payoutBatchIds),
            ),
          );
        await testDatabase.db
          .delete(payoutItems)
          .where(inArray(payoutItems.payoutBatchId, payoutBatchIds));
        await testDatabase.db
          .delete(payoutBatches)
          .where(inArray(payoutBatches.id, payoutBatchIds));
      }
      await cleanupBookings([booking.id, otherBooking.id]);
    }
  });

  it("membatalkan payout FAILED saat partial refund dan mencatat alasan akurat", async () => {
    const booking = await createFinancialBooking(true, 100_000, {
      ownerNet: 90_000,
      platformCommission: 10_000,
      gatewayFee: 0,
    });
    const finance = new FinanceService(testDatabase);
    let batchId: number | undefined;
    try {
      const [earning] = await testDatabase.db
        .select()
        .from(ownerEarnings)
        .where(eq(ownerEarnings.sourceKey, `booking:${booking.id}`))
        .limit(1);
      if (!earning) throw new Error("Earning FAILED payout tidak ditemukan.");
      const [batch] = await testDatabase.db
        .insert(payoutBatches)
        .values({
          tenantId: 1,
          status: "FAILED",
          kind: "MANUAL",
          totalAmount: earning.amount,
          idempotencyKey: `failed-refund-${randomUUID()}`,
        })
        .$returningId();
      if (!batch) throw new Error("FAILED payout regression gagal dibuat.");
      batchId = batch.id;
      await testDatabase.db.insert(payoutItems).values({
        payoutBatchId: batch.id,
        earningId: earning.id,
        amount: earning.amount,
      });
      await testDatabase.db
        .update(ownerEarnings)
        .set({ status: "RESERVED_FOR_PAYOUT" })
        .where(eq(ownerEarnings.id, earning.id));

      const refundService = new RefundService(testDatabase, finance);
      const refundId = await testDatabase.db.transaction((transaction) =>
        refundService.requestRefund(transaction, {
          bookingId: booking.id,
          amount: 30_000,
          kind: "PARTIAL",
          reason: "Partial refund saat payout gagal",
          idempotencyKey: `failed-partial-${booking.id}`,
        }),
      );
      await expect(refundService.completeSandboxRefund(refundId)).resolves.toBe(true);

      const [batchAfter] = await testDatabase.db
        .select({ status: payoutBatches.status })
        .from(payoutBatches)
        .where(eq(payoutBatches.id, batch.id));
      const [audit] = await testDatabase.db
        .select({ reason: auditLogs.reason })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.action, "payout.status_changed"),
            eq(auditLogs.resourceId, batch.id),
          ),
        )
        .limit(1);
      expect(batchAfter?.status).toBe("CANCELLED");
      expect(audit?.reason).toBe(`Refund Rp30000 untuk booking ${booking.id}`);
      expect(audit?.reason).not.toContain("Full refund");
      await expect(
        finance.updatePayoutStatus(
          formatPublicId(batch.id),
          "PROCESSING",
          formatPublicId(1),
          `retry-failed-refunded-${batch.id}`,
          "Payout gagal yang terkena refund tidak boleh dicoba ulang",
        ),
      ).rejects.toMatchObject({ code: "INVALID_PAYOUT_TRANSITION" });
    } finally {
      if (batchId) {
        await testDatabase.db
          .delete(auditLogs)
          .where(
            and(
              eq(auditLogs.resourceType, "payout"),
              eq(auditLogs.resourceId, batchId),
            ),
          );
        await testDatabase.db
          .delete(outboxEvents)
          .where(
            and(
              eq(outboxEvents.resourceType, "payout"),
              eq(outboxEvents.resourceId, batchId),
            ),
          );
        await testDatabase.db
          .delete(payoutItems)
          .where(eq(payoutItems.payoutBatchId, batchId));
        await testDatabase.db
          .delete(payoutBatches)
          .where(eq(payoutBatches.id, batchId));
      }
      await cleanupBookings([booking.id]);
    }
  });

  it("menyerialkan refund dan transisi payout concurrent tanpa deadlock", async () => {
    const booking = await createFinancialBooking(true, 100_000, {
      ownerNet: 90_000,
      platformCommission: 10_000,
      gatewayFee: 0,
    });
    const finance = new FinanceService(testDatabase);
    let batchId: number | undefined;
    try {
      const [earning] = await testDatabase.db
        .select()
        .from(ownerEarnings)
        .where(eq(ownerEarnings.sourceKey, `booking:${booking.id}`))
        .limit(1);
      if (!earning) throw new Error("Earning concurrent payout tidak ditemukan.");
      const [batch] = await testDatabase.db
        .insert(payoutBatches)
        .values({
          tenantId: 1,
          status: "SCHEDULED",
          kind: "MANUAL",
          totalAmount: earning.amount,
          idempotencyKey: `concurrent-refund-payout-${randomUUID()}`,
        })
        .$returningId();
      if (!batch) throw new Error("Concurrent payout regression gagal dibuat.");
      batchId = batch.id;
      await testDatabase.db.insert(payoutItems).values({
        payoutBatchId: batch.id,
        earningId: earning.id,
        amount: earning.amount,
      });
      await testDatabase.db
        .update(ownerEarnings)
        .set({ status: "RESERVED_FOR_PAYOUT" })
        .where(eq(ownerEarnings.id, earning.id));
      const refundService = new RefundService(testDatabase, finance);
      const refundId = await testDatabase.db.transaction((transaction) =>
        refundService.requestRefund(transaction, {
          bookingId: booking.id,
          amount: 30_000,
          kind: "CONCURRENT_PAYOUT",
          reason: "Refund bersamaan dengan transisi payout",
          idempotencyKey: `concurrent-payout-refund-${booking.id}`,
        }),
      );

      const [refundResult, payoutResult] = await Promise.allSettled([
        refundService.completeSandboxRefund(refundId),
        finance.updatePayoutStatus(
          formatPublicId(batch.id),
          "PROCESSING",
          formatPublicId(4),
          `concurrent-process-${batch.id}`,
          "Transisi concurrent regression",
        ),
      ]);
      expect(refundResult).toMatchObject({ status: "fulfilled", value: true });
      if (payoutResult.status === "rejected") {
        expect(payoutResult.reason).toMatchObject({
          statusCode: 409,
          code: "INVALID_PAYOUT_TRANSITION",
        });
      }
      const [refundAfter] = await testDatabase.db
        .select({ status: refunds.status })
        .from(refunds)
        .where(eq(refunds.id, refundId));
      expect(refundAfter?.status).toBe("SUCCEEDED");
    } finally {
      if (batchId) {
        await testDatabase.db
          .delete(commandIdempotency)
          .where(eq(commandIdempotency.resourceId, batchId));
        await testDatabase.db
          .delete(auditLogs)
          .where(
            and(
              eq(auditLogs.resourceType, "payout"),
              eq(auditLogs.resourceId, batchId),
            ),
          );
        await testDatabase.db
          .delete(outboxEvents)
          .where(
            and(
              eq(outboxEvents.resourceType, "payout"),
              eq(outboxEvents.resourceId, batchId),
            ),
          );
        await testDatabase.db
          .delete(payoutItems)
          .where(eq(payoutItems.payoutBatchId, batchId));
        await testDatabase.db
          .delete(payoutBatches)
          .where(eq(payoutBatches.id, batchId));
      }
      await cleanupBookings([booking.id]);
    }
  });

  it("merekonsiliasi refund rolling-deploy terbaru tanpa memindai histori lama", async () => {
    const oldBooking = await createFinancialBooking(true, 100_000, {
      ownerNet: 90_000,
      platformCommission: 10_000,
      gatewayFee: 0,
    });
    const recentBooking = await createFinancialBooking(true, 100_000, {
      ownerNet: 90_000,
      platformCommission: 10_000,
      gatewayFee: 0,
    });
    const finance = new FinanceService(testDatabase);
    const cutoff = new Date("2026-08-30T00:00:00.000Z");
    try {
      await testDatabase.db
        .update(bookingPaymentSummaries)
        .set({ status: "REFUNDED", totalRefunded: 100_000 })
        .where(
          inArray(bookingPaymentSummaries.bookingId, [oldBooking.id, recentBooking.id]),
        );
      await insertLegacyRefundLedger(
        oldBooking.id,
        100_000,
        "outside-window",
        new Date("2026-08-29T00:00:00.000Z"),
      );
      await insertLegacyRefundLedger(
        recentBooking.id,
        100_000,
        "rolling-window",
        new Date("2026-08-31T00:00:00.000Z"),
      );

      await finance.reconcileLegacyRefundLedgers(
        100,
        new Date("2026-08-31T01:00:00.000Z"),
        cutoff,
      );
      const reconciliations = await testDatabase.db
        .select({ bookingId: ledgerTransactions.bookingId })
        .from(ledgerTransactions)
        .where(
          and(
            inArray(ledgerTransactions.bookingId, [oldBooking.id, recentBooking.id]),
            eq(ledgerTransactions.kind, "REFUND_RECONCILIATION"),
          ),
        );
      expect(reconciliations.map((row) => row.bookingId)).toEqual([recentBooking.id]);
    } finally {
      await cleanupBookings([oldBooking.id, recentBooking.id]);
    }
  });

  it("merekonsiliasi semantic ledger refund legacy secara idempotent", async () => {
    const finance = new FinanceService(testDatabase);
    const baseline = await finance.financeSummary(formatPublicId(1));
    const booking = await createFinancialBooking(true, 90_000, {
      ownerNet: 88_000,
      platformCommission: 10_000,
      platformDiscount: 10_000,
      gatewayFee: 2_000,
    });
    try {
      await testDatabase.db
        .update(bookingPaymentSummaries)
        .set({ status: "REFUNDED", totalRefunded: 90_000 })
        .where(eq(bookingPaymentSummaries.bookingId, booking.id));
      const [baseEarning] = await testDatabase.db
        .select()
        .from(ownerEarnings)
        .where(eq(ownerEarnings.sourceKey, `booking:${booking.id}`))
        .limit(1);
      if (!baseEarning) throw new Error("Base earning legacy tidak ditemukan.");
      await testDatabase.db.insert(ownerEarnings).values([
        {
          tenantId: baseEarning.tenantId,
          bookingId: booking.id,
          snapshotId: baseEarning.snapshotId,
          sourceKey: `refund:legacy-partial-a:${booking.id}`,
          amount: -29_334,
          status: "PENDING",
          availableAt: baseEarning.availableAt,
        },
        {
          tenantId: baseEarning.tenantId,
          bookingId: booking.id,
          snapshotId: baseEarning.snapshotId,
          sourceKey: `refund:legacy-partial-b:${booking.id}`,
          amount: -58_667,
          status: "PENDING",
          availableAt: baseEarning.availableAt,
        },
      ]);
      for (const [index, amount] of [30_000, 60_000].entries()) {
        const [legacy] = await testDatabase.db
          .insert(ledgerTransactions)
          .values({
            tenantId: 1,
            bookingId: booking.id,
            kind: "REFUND_SUCCEEDED",
            idempotencyKey: `legacy-refund-${booking.id}-${index}`,
            description: "Posting refund legacy",
          })
          .$returningId();
        if (!legacy) throw new Error("Ledger legacy regression gagal dibuat.");
        await testDatabase.db.insert(ledgerEntries).values([
          {
            transactionId: legacy.id,
            accountCode: "REFUND_EXPENSE",
            debit: amount,
            credit: 0,
          },
          {
            transactionId: legacy.id,
            accountCode: "SANDBOX_CASH",
            debit: 0,
            credit: amount,
          },
        ]);
      }
      const [priorReconciliation] = await testDatabase.db
        .insert(ledgerTransactions)
        .values({
          tenantId: 1,
          bookingId: booking.id,
          kind: "REFUND_RECONCILIATION",
          idempotencyKey: `refund-reconciliation:${booking.id}`,
          description: "Koreksi ledger dari deployment sebelumnya",
        })
        .$returningId();
      if (!priorReconciliation) {
        throw new Error("Ledger reconciliation legacy gagal dibuat.");
      }
      await testDatabase.db.insert(ledgerEntries).values([
        {
          transactionId: priorReconciliation.id,
          accountCode: "OWNER_PAYABLE",
          debit: 88_000,
          credit: 0,
        },
        {
          transactionId: priorReconciliation.id,
          accountCode: "PLATFORM_COMMISSION_REVENUE",
          debit: 10_000,
          credit: 0,
        },
        {
          transactionId: priorReconciliation.id,
          accountCode: "PLATFORM_PROMO_EXPENSE",
          debit: 0,
          credit: 10_000,
        },
        {
          transactionId: priorReconciliation.id,
          accountCode: "REFUND_EXPENSE",
          debit: 0,
          credit: 88_000,
        },
      ]);

      const before = await finance.financeSummary(formatPublicId(1));
      expect(before.commission).toBe(baseline.commission);
      expect(before.netOwnerRevenue - baseline.netOwnerRevenue).toBe(-1);
      await expect(finance.reconcileLegacyRefundLedgers()).resolves.toBeGreaterThan(0);
      await expect(finance.reconcileLegacyRefundLedgers()).resolves.toBe(0);

      const balances = await refundLedgerBalancesFor(booking.id, [
        "REFUND_SUCCEEDED",
        "REFUND_RECONCILIATION",
      ]);
      expect(balances).toMatchObject({
        OWNER_PAYABLE: 88_000,
        PLATFORM_COMMISSION_REVENUE: 10_000,
        PLATFORM_PROMO_EXPENSE: -10_000,
        REFUND_EXPENSE: 2_000,
        SANDBOX_CASH: -90_000,
      });
      expect(sumBalances(balances)).toBe(0);
      const after = await finance.financeSummary(formatPublicId(1));
      expect(after.commission).toBe(baseline.commission);
      expect(after.netOwnerRevenue).toBe(baseline.netOwnerRevenue);
      const [earningCorrection] = await testDatabase.db
        .select({ amount: ownerEarnings.amount })
        .from(ownerEarnings)
        .where(
          eq(ownerEarnings.sourceKey, `refund:reconciliation:${booking.id}:90000`),
        );
      expect(earningCorrection?.amount).toBe(1);
      const reconciliationRows = await testDatabase.db
        .select({ id: ledgerTransactions.id })
        .from(ledgerTransactions)
        .where(
          and(
            eq(ledgerTransactions.bookingId, booking.id),
            eq(ledgerTransactions.kind, "REFUND_RECONCILIATION"),
          ),
        );
      expect(reconciliationRows).toHaveLength(1);
    } finally {
      await cleanupBookings([booking.id]);
    }
  });

  it("memposting rekonsiliasi kedua berdasarkan versi cumulative refund", async () => {
    const booking = await createFinancialBooking(true, 90_000, {
      ownerNet: 88_000,
      platformCommission: 10_000,
      platformDiscount: 10_000,
      gatewayFee: 2_000,
    });
    const finance = new FinanceService(testDatabase);
    try {
      const [baseEarning] = await testDatabase.db
        .select()
        .from(ownerEarnings)
        .where(eq(ownerEarnings.sourceKey, `booking:${booking.id}`))
        .limit(1);
      if (!baseEarning) throw new Error("Base earning bertahap tidak ditemukan.");

      await testDatabase.db
        .update(bookingPaymentSummaries)
        .set({ status: "PARTIALLY_REFUNDED", totalRefunded: 30_000 })
        .where(eq(bookingPaymentSummaries.bookingId, booking.id));
      await testDatabase.db.insert(ownerEarnings).values({
        tenantId: baseEarning.tenantId,
        bookingId: booking.id,
        snapshotId: baseEarning.snapshotId,
        sourceKey: `refund:legacy-stage-one:${booking.id}`,
        amount: -29_334,
        status: "PENDING",
        availableAt: baseEarning.availableAt,
      });
      await insertLegacyRefundLedger(booking.id, 30_000, "stage-one");
      await expect(finance.reconcileLegacyRefundLedgers()).resolves.toBeGreaterThan(0);

      await testDatabase.db
        .update(bookingPaymentSummaries)
        .set({ totalRefunded: 60_000 })
        .where(eq(bookingPaymentSummaries.bookingId, booking.id));
      await testDatabase.db.insert(ownerEarnings).values({
        tenantId: baseEarning.tenantId,
        bookingId: booking.id,
        snapshotId: baseEarning.snapshotId,
        sourceKey: `refund:legacy-stage-two:${booking.id}`,
        amount: -29_334,
        status: "PENDING",
        availableAt: baseEarning.availableAt,
      });
      await insertLegacyRefundLedger(booking.id, 30_000, "stage-two");

      await expect(finance.reconcileLegacyRefundLedgers()).resolves.toBeGreaterThan(0);
      await expect(finance.reconcileLegacyRefundLedgers()).resolves.toBe(0);
      const reconciliations = await testDatabase.db
        .select({ key: ledgerTransactions.idempotencyKey })
        .from(ledgerTransactions)
        .where(
          and(
            eq(ledgerTransactions.bookingId, booking.id),
            eq(ledgerTransactions.kind, "REFUND_RECONCILIATION"),
          ),
        );
      expect(new Set(reconciliations.map((row) => row.key))).toEqual(
        new Set([
          `refund-reconciliation:${booking.id}:30000`,
          `refund-reconciliation:${booking.id}:60000`,
        ]),
      );
      const [secondEarningCorrection] = await testDatabase.db
        .select({ amount: ownerEarnings.amount })
        .from(ownerEarnings)
        .where(
          eq(ownerEarnings.sourceKey, `refund:reconciliation:${booking.id}:60000`),
        );
      expect(secondEarningCorrection?.amount).toBe(1);
    } finally {
      await cleanupBookings([booking.id]);
    }
  });

  it("mengikutkan earning rekonsiliasi pada refund berikutnya", async () => {
    const booking = await createFinancialBooking(true, 90_000, {
      ownerNet: 88_000,
      platformCommission: 10_000,
      platformDiscount: 10_000,
      gatewayFee: 2_000,
    });
    const finance = new FinanceService(testDatabase);
    try {
      const [baseEarning] = await testDatabase.db
        .select()
        .from(ownerEarnings)
        .where(eq(ownerEarnings.sourceKey, `booking:${booking.id}`))
        .limit(1);
      if (!baseEarning) throw new Error("Base earning lanjutan tidak ditemukan.");
      await testDatabase.db
        .update(bookingPaymentSummaries)
        .set({ status: "PARTIALLY_REFUNDED", totalRefunded: 60_000 })
        .where(eq(bookingPaymentSummaries.bookingId, booking.id));
      await testDatabase.db.insert(ownerEarnings).values({
        tenantId: baseEarning.tenantId,
        bookingId: booking.id,
        snapshotId: baseEarning.snapshotId,
        sourceKey: `refund:legacy-before-final:${booking.id}`,
        amount: -58_668,
        status: "PENDING",
        availableAt: baseEarning.availableAt,
      });
      await insertLegacyRefundLedger(booking.id, 60_000, "before-final");
      await expect(finance.reconcileLegacyRefundLedgers()).resolves.toBeGreaterThan(0);

      const correctionSource = `refund:reconciliation:${booking.id}:60000`;
      const [correctionBefore] = await testDatabase.db
        .select({ amount: ownerEarnings.amount, status: ownerEarnings.status })
        .from(ownerEarnings)
        .where(eq(ownerEarnings.sourceKey, correctionSource));
      expect(correctionBefore).toMatchObject({ amount: 1, status: "PENDING" });

      const refundService = new RefundService(testDatabase, finance);
      const finalRefundId = await testDatabase.db.transaction((transaction) =>
        refundService.requestRefund(transaction, {
          bookingId: booking.id,
          amount: 30_000,
          kind: "FULL",
          reason: "Refund setelah earning direkonsiliasi",
          idempotencyKey: `after-reconciliation-${booking.id}`,
        }),
      );
      await expect(refundService.completeSandboxRefund(finalRefundId)).resolves.toBe(
        true,
      );

      const earningRows = await testDatabase.db
        .select({ amount: ownerEarnings.amount, status: ownerEarnings.status })
        .from(ownerEarnings)
        .where(eq(ownerEarnings.bookingId, booking.id));
      expect(
        earningRows
          .filter((earning) => earning.status !== "REVERSED")
          .reduce((sum, earning) => sum + earning.amount, 0),
      ).toBe(0);
      const [correctionAfter] = await testDatabase.db
        .select({ status: ownerEarnings.status })
        .from(ownerEarnings)
        .where(eq(ownerEarnings.sourceKey, correctionSource));
      expect(correctionAfter?.status).toBe("REVERSED");
      const balances = await refundLedgerBalancesFor(booking.id, [
        "REFUND_SUCCEEDED",
        "REFUND_RECONCILIATION",
      ]);
      expect(balances).toMatchObject({
        OWNER_PAYABLE: 88_000,
        PLATFORM_COMMISSION_REVENUE: 10_000,
        PLATFORM_PROMO_EXPENSE: -10_000,
        REFUND_EXPENSE: 2_000,
        SANDBOX_CASH: -90_000,
      });
      expect(sumBalances(balances)).toBe(0);
    } finally {
      await cleanupBookings([booking.id]);
    }
  });

  it("mengalokasikan pembayaran multi-court tanpa menggandakan venue total", async () => {
    const finance = new FinanceService(testDatabase);
    const before = await finance.financeSummary(formatPublicId(1));
    const booking = await createFinancialBooking(true, 100_000, {
      ownerNet: 90_000,
      platformCommission: 10_000,
      gatewayFee: 0,
    });
    try {
      await testDatabase.db.insert(bookingItems).values([
        {
          bookingId: booking.id,
          courtId: 1,
          startsAt: new Date("2027-02-01T09:00:00.000Z"),
          endsAt: new Date("2027-02-01T10:00:00.000Z"),
          subtotal: 40_000,
        },
        {
          bookingId: booking.id,
          courtId: 2,
          startsAt: new Date("2027-02-01T10:00:00.000Z"),
          endsAt: new Date("2027-02-01T11:00:00.000Z"),
          subtotal: 60_000,
        },
      ]);

      const after = await finance.financeSummary(formatPublicId(1));
      const venueBefore =
        before.venueComparison.find((venue) => venue.venueId === formatPublicId(1))
          ?.paid ?? 0;
      const venueAfter =
        after.venueComparison.find((venue) => venue.venueId === formatPublicId(1))
          ?.paid ?? 0;
      const courtOneBefore =
        before.courtComparison.find((court) => court.courtId === formatPublicId(1))
          ?.paid ?? 0;
      const courtOneAfter =
        after.courtComparison.find((court) => court.courtId === formatPublicId(1))
          ?.paid ?? 0;
      const courtTwoBefore =
        before.courtComparison.find((court) => court.courtId === formatPublicId(2))
          ?.paid ?? 0;
      const courtTwoAfter =
        after.courtComparison.find((court) => court.courtId === formatPublicId(2))
          ?.paid ?? 0;

      expect(venueAfter - venueBefore).toBe(100_000);
      expect(courtOneAfter - courtOneBefore).toBe(40_000);
      expect(courtTwoAfter - courtTwoBefore).toBe(60_000);
    } finally {
      await cleanupBookings([booking.id]);
    }
  });

  it("mengisolasi refund idempotency per tenant dan booking", async () => {
    const first = await createBareBooking(1, 1);
    const sameTenant = await createBareBooking(1, 1);
    const second = await createBareBooking(2, 3);
    const service = new RefundService(testDatabase);
    const key = `shared-${randomUUID()}`;
    try {
      await addPaidSummaries([first.id, sameTenant.id, second.id]);
      const firstId = await testDatabase.db.transaction((transaction) =>
        service.requestRefund(transaction, {
          bookingId: first.id,
          amount: 1,
          kind: "IDEMPOTENCY",
          reason: "Tenant pertama",
          idempotencyKey: key,
        }),
      );
      const replayId = await testDatabase.db.transaction((transaction) =>
        service.requestRefund(transaction, {
          bookingId: first.id,
          amount: 1,
          kind: "IDEMPOTENCY",
          reason: "Tenant pertama",
          idempotencyKey: key,
        }),
      );
      const secondId = await testDatabase.db.transaction((transaction) =>
        service.requestRefund(transaction, {
          bookingId: second.id,
          amount: 1,
          kind: "IDEMPOTENCY",
          reason: "Tenant kedua",
          idempotencyKey: key,
        }),
      );
      await expect(
        testDatabase.db.transaction((transaction) =>
          service.requestRefund(transaction, {
            bookingId: sameTenant.id,
            amount: 1,
            kind: "IDEMPOTENCY",
            reason: "Booking lain tenant pertama",
            idempotencyKey: key,
          }),
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "IDEMPOTENCY_KEY_REUSED",
      });

      expect(replayId).toBe(firstId);
      expect(secondId).not.toBe(firstId);
      const rows = await testDatabase.db
        .select({ bookingId: refunds.bookingId })
        .from(refunds)
        .where(inArray(refunds.id, [firstId, secondId]));
      expect(new Set(rows.map((row) => row.bookingId))).toEqual(
        new Set([first.id, second.id]),
      );
    } finally {
      await cleanupBookings([first.id, sameTenant.id, second.id]);
    }
  });

  it("menangani concurrent refund replay dan reuse sebagai hasil deterministik", async () => {
    const first = await createBareBooking(1, 1);
    const second = await createBareBooking(1, 1);
    const service = new RefundService(testDatabase);
    const replayKey = `concurrent-replay-${randomUUID()}`;
    const conflictKey = `concurrent-conflict-${randomUUID()}`;
    try {
      await addPaidSummaries([first.id, second.id], 10);
      const replayIds = await Promise.all(
        [1, 2].map(() =>
          testDatabase.db.transaction((transaction) =>
            service.requestRefund(transaction, {
              bookingId: first.id,
              amount: 1,
              kind: "CONCURRENT",
              reason: "Concurrent retry booking sama",
              idempotencyKey: replayKey,
            }),
          ),
        ),
      );
      expect(new Set(replayIds).size).toBe(1);

      const conflict = await Promise.allSettled([
        testDatabase.db.transaction((transaction) =>
          service.requestRefund(transaction, {
            bookingId: first.id,
            amount: 1,
            kind: "CONCURRENT",
            reason: "Concurrent booking pertama",
            idempotencyKey: conflictKey,
          }),
        ),
        testDatabase.db.transaction((transaction) =>
          service.requestRefund(transaction, {
            bookingId: second.id,
            amount: 1,
            kind: "CONCURRENT",
            reason: "Concurrent booking kedua",
            idempotencyKey: conflictKey,
          }),
        ),
      ]);
      expect(conflict.filter((result) => result.status === "fulfilled")).toHaveLength(
        1,
      );
      const rejected = conflict.find((result) => result.status === "rejected");
      expect(rejected).toMatchObject({
        status: "rejected",
        reason: { statusCode: 409, code: "IDEMPOTENCY_KEY_REUSED" },
      });
    } finally {
      await cleanupBookings([first.id, second.id]);
    }
  });

  it("meng-scope decision dan retry refund ke resource yang diminta", async () => {
    const first = await createBareBooking(1, 1);
    const second = await createBareBooking(2, 3);
    const service = new RefundService(testDatabase);
    const decisionKey = `decision-${randomUUID()}`;
    const retryKey = `retry-${randomUUID()}`;
    try {
      await addPaidSummaries([first.id, second.id], 10);
      const [firstDecision] = await testDatabase.db
        .insert(refunds)
        .values({
          bookingId: first.id,
          amount: 1,
          status: "MANUAL_REQUIRED",
          decisionStatus: "MANUAL_REQUIRED",
          kind: "ADMIN_DISPUTE",
          reason: "Decision tenant pertama",
          idempotencyKey: `manual-${randomUUID()}`,
        })
        .$returningId();
      const [secondDecision] = await testDatabase.db
        .insert(refunds)
        .values({
          bookingId: second.id,
          amount: 1,
          status: "MANUAL_REQUIRED",
          decisionStatus: "MANUAL_REQUIRED",
          kind: "ADMIN_DISPUTE",
          reason: "Decision tenant kedua",
          idempotencyKey: `manual-${randomUUID()}`,
        })
        .$returningId();
      const [firstRetry] = await testDatabase.db
        .insert(refunds)
        .values({
          bookingId: first.id,
          amount: 1,
          status: "FAILED",
          decisionStatus: "APPROVED",
          kind: "OWNER_EXCEPTION",
          reason: "Retry tenant pertama",
          idempotencyKey: `failed-${randomUUID()}`,
        })
        .$returningId();
      const [secondRetry] = await testDatabase.db
        .insert(refunds)
        .values({
          bookingId: second.id,
          amount: 1,
          status: "FAILED",
          decisionStatus: "APPROVED",
          kind: "OWNER_EXCEPTION",
          reason: "Retry tenant kedua",
          idempotencyKey: `failed-${randomUUID()}`,
        })
        .$returningId();
      if (!firstDecision || !secondDecision || !firstRetry || !secondRetry) {
        throw new Error("Refund command regression gagal dibuat.");
      }

      await service.decideManualRefund(
        formatPublicId(firstDecision.id),
        formatPublicId(4),
        true,
        "Approve pertama",
        decisionKey,
      );
      await service.decideManualRefund(
        formatPublicId(secondDecision.id),
        formatPublicId(4),
        true,
        "Approve kedua",
        decisionKey,
      );
      await service.decideManualRefund(
        formatPublicId(firstDecision.id),
        formatPublicId(4),
        true,
        "Approve pertama",
        decisionKey,
      );
      await service.retryFailedRefund(
        formatPublicId(firstRetry.id),
        formatPublicId(4),
        retryKey,
      );
      await service.retryFailedRefund(
        formatPublicId(secondRetry.id),
        formatPublicId(4),
        retryKey,
      );
      await service.retryFailedRefund(
        formatPublicId(firstRetry.id),
        formatPublicId(4),
        retryKey,
      );

      const commandRows = await testDatabase.db
        .select({ scope: commandIdempotency.scope })
        .from(commandIdempotency)
        .where(
          and(
            eq(commandIdempotency.actorUserId, 4),
            inArray(commandIdempotency.idempotencyKey, [decisionKey, retryKey]),
          ),
        );
      expect(commandRows).toHaveLength(4);
      expect(new Set(commandRows.map((row) => row.scope)).size).toBe(4);
      const affected = await testDatabase.db
        .select({
          id: refunds.id,
          status: refunds.status,
          attempts: refunds.executionAttempts,
        })
        .from(refunds)
        .where(
          inArray(refunds.id, [
            firstDecision.id,
            secondDecision.id,
            firstRetry.id,
            secondRetry.id,
          ]),
        );
      expect(affected.every((row) => row.status === "PENDING")).toBe(true);
      expect(
        affected
          .filter((row) => [firstRetry.id, secondRetry.id].includes(row.id))
          .every((row) => row.attempts === 1),
      ).toBe(true);
    } finally {
      await testDatabase.db
        .delete(commandIdempotency)
        .where(inArray(commandIdempotency.idempotencyKey, [decisionKey, retryKey]));
      await cleanupBookings([first.id, second.id]);
    }
  });

  it("menolak false replay keputusan berbeda pada refund yang sama", async () => {
    const booking = await createFinancialBooking(true, 100_000, {
      ownerNet: 90_000,
      platformCommission: 10_000,
      gatewayFee: 0,
    });
    const service = new RefundService(testDatabase);
    let refundId: number | undefined;
    try {
      refundId = await testDatabase.db.transaction((transaction) =>
        service.requestRefund(transaction, {
          bookingId: booking.id,
          amount: 10_000,
          kind: "ADMIN_DISPUTE",
          reason: "Keputusan manual idempotency regression",
          idempotencyKey: `manual-decision-${booking.id}`,
          decisionStatus: "MANUAL_REQUIRED",
        }),
      );
      const key = `decision-payload-${randomUUID()}`;
      await expect(
        service.decideManualRefund(
          formatPublicId(refundId),
          formatPublicId(4),
          true,
          "Setujui refund",
          key,
        ),
      ).resolves.toBeUndefined();
      await expect(
        testDatabase.db.transaction((transaction) =>
          service.requestRefund(transaction, {
            bookingId: booking.id,
            amount: 10_000,
            kind: "ADMIN_DISPUTE",
            reason: "Keputusan manual idempotency regression",
            idempotencyKey: `manual-decision-${booking.id}`,
            decisionStatus: "MANUAL_REQUIRED",
          }),
        ),
      ).resolves.toBe(refundId);
      await expect(
        testDatabase.db.transaction((transaction) =>
          service.requestRefund(transaction, {
            bookingId: booking.id,
            amount: 10_000,
            kind: "ADMIN_DISPUTE",
            reason: "Reason create berubah setelah decision",
            idempotencyKey: `manual-decision-${booking.id}`,
            decisionStatus: "MANUAL_REQUIRED",
          }),
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "IDEMPOTENCY_KEY_REUSED",
      });
      await expect(
        service.decideManualRefund(
          formatPublicId(refundId),
          formatPublicId(4),
          true,
          "Setujui refund",
          key,
        ),
      ).resolves.toBeUndefined();
      await expect(
        service.decideManualRefund(
          formatPublicId(refundId),
          formatPublicId(4),
          false,
          "Payload berbeda tidak boleh false replay",
          key,
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "IDEMPOTENCY_KEY_REUSED",
      });
      const [stored] = await testDatabase.db
        .select({ status: refunds.status, decisionStatus: refunds.decisionStatus })
        .from(refunds)
        .where(eq(refunds.id, refundId));
      expect(stored).toMatchObject({ status: "PENDING", decisionStatus: "APPROVED" });
    } finally {
      if (refundId) {
        await testDatabase.db
          .delete(commandIdempotency)
          .where(eq(commandIdempotency.resourceId, refundId));
      }
      await cleanupBookings([booking.id]);
    }
  });

  it("menolak false replay keputusan legacy tanpa response body", async () => {
    const booking = await createFinancialBooking(true, 100_000, {
      ownerNet: 90_000,
      platformCommission: 10_000,
      gatewayFee: 0,
    });
    const service = new RefundService(testDatabase);
    const key = `legacy-decision-${randomUUID()}`;
    let refundId: number | undefined;
    try {
      refundId = await testDatabase.db.transaction((transaction) =>
        service.requestRefund(transaction, {
          bookingId: booking.id,
          amount: 10_000,
          kind: "ADMIN_DISPUTE",
          reason: "Decision legacy regression",
          idempotencyKey: `legacy-manual-${booking.id}`,
          decisionStatus: "MANUAL_REQUIRED",
        }),
      );
      await testDatabase.db
        .update(refunds)
        .set({
          status: "PENDING",
          decisionStatus: "APPROVED",
          reason:
            "Decision legacy regression\nKeputusan: Retry keputusan legacy yang sama",
        })
        .where(eq(refunds.id, refundId));
      await testDatabase.db.insert(commandIdempotency).values({
        scope: "refund.decision",
        actorUserId: 4,
        idempotencyKey: key,
        resourceId: refundId,
        responseStatus: 204,
      });

      await expect(
        service.decideManualRefund(
          formatPublicId(refundId),
          formatPublicId(4),
          true,
          "Retry keputusan legacy yang sama",
          key,
        ),
      ).resolves.toBeUndefined();
      await expect(
        service.decideManualRefund(
          formatPublicId(refundId),
          formatPublicId(4),
          false,
          "Keputusan legacy berlawanan",
          key,
        ),
      ).rejects.toMatchObject({ statusCode: 409, code: "IDEMPOTENCY_KEY_REUSED" });
    } finally {
      await testDatabase.db
        .delete(commandIdempotency)
        .where(eq(commandIdempotency.idempotencyKey, key));
      await cleanupBookings([booking.id]);
    }
  });

  it("menolak payload refund create berbeda dan tidak menggandakan audit", async () => {
    const booking = await createFinancialBooking(true, 100_000, {
      ownerNet: 90_000,
      platformCommission: 10_000,
      gatewayFee: 0,
    });
    const service = new RefundService(testDatabase);
    const key = `refund-create-payload-${randomUUID()}`;
    let refundId: number | undefined;
    const request = {
      bookingReference: booking.code,
      tenantId: formatPublicId(1),
      venueId: formatPublicId(1),
      amount: 10_000,
      reason: "Refund create payload regression",
      actorUserId: formatPublicId(1),
      idempotencyKey: key,
      manualRequired: false,
    };
    try {
      const created = await service.requestBusinessRefund(request);
      refundId = parsePublicId(created.id);
      const replay = await service.requestBusinessRefund(request);
      expect(replay).toEqual(created);
      await expect(
        service.requestBusinessRefund({ ...request, amount: 20_000 }),
      ).rejects.toMatchObject({ statusCode: 409, code: "IDEMPOTENCY_KEY_REUSED" });

      const [stored] = await testDatabase.db
        .select({ id: refunds.id, amount: refunds.amount })
        .from(refunds)
        .where(eq(refunds.bookingId, booking.id));
      if (!stored) throw new Error("Refund create regression tidak tersimpan.");
      refundId = stored.id;
      expect(stored.amount).toBe(10_000);
      const audits = await testDatabase.db
        .select({ id: auditLogs.id })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.action, "refund.requested"),
            eq(auditLogs.resourceId, stored.id),
          ),
        );
      expect(audits).toHaveLength(1);
    } finally {
      if (refundId) {
        await testDatabase.db
          .delete(auditLogs)
          .where(
            and(
              eq(auditLogs.resourceType, "refund"),
              eq(auditLogs.resourceId, refundId),
            ),
          );
      }
      await cleanupBookings([booking.id]);
    }
  });

  it("menolak false replay status payout yang berbeda", async () => {
    const finance = new FinanceService(testDatabase);
    const key = `payout-status-payload-${randomUUID()}`;
    let batchId: number | undefined;
    try {
      const [batch] = await testDatabase.db
        .insert(payoutBatches)
        .values({
          tenantId: 1,
          status: "SCHEDULED",
          kind: "MANUAL",
          totalAmount: 1,
          idempotencyKey: `payout-fixture-${randomUUID()}`,
        })
        .$returningId();
      if (!batch) throw new Error("Payout status regression gagal dibuat.");
      batchId = batch.id;
      await finance.updatePayoutStatus(
        formatPublicId(batch.id),
        "PROCESSING",
        formatPublicId(4),
        key,
        "Mulai payout regression",
      );
      await expect(
        finance.updatePayoutStatus(
          formatPublicId(batch.id),
          "PROCESSING",
          formatPublicId(4),
          key,
          "Mulai payout regression",
        ),
      ).resolves.toBeUndefined();
      await expect(
        finance.updatePayoutStatus(
          formatPublicId(batch.id),
          "SUCCEEDED",
          formatPublicId(4),
          key,
          "Status berbeda tidak boleh false replay",
        ),
      ).rejects.toMatchObject({ statusCode: 409, code: "IDEMPOTENCY_KEY_REUSED" });
      const [stored] = await testDatabase.db
        .select({ status: payoutBatches.status })
        .from(payoutBatches)
        .where(eq(payoutBatches.id, batch.id));
      expect(stored?.status).toBe("PROCESSING");
    } finally {
      if (batchId) {
        await testDatabase.db
          .delete(commandIdempotency)
          .where(eq(commandIdempotency.resourceId, batchId));
        await testDatabase.db
          .delete(auditLogs)
          .where(
            and(
              eq(auditLogs.resourceType, "payout"),
              eq(auditLogs.resourceId, batchId),
            ),
          );
        await testDatabase.db
          .delete(outboxEvents)
          .where(
            and(
              eq(outboxEvents.resourceType, "payout"),
              eq(outboxEvents.resourceId, batchId),
            ),
          );
        await testDatabase.db
          .delete(payoutBatches)
          .where(eq(payoutBatches.id, batchId));
      }
    }
  });

  it("mencadangkan refund PENDING pada aggregate cap", async () => {
    const booking = await createFinancialBooking(true, 100_000, {
      ownerNet: 90_000,
      platformCommission: 10_000,
      gatewayFee: 0,
    });
    const service = new RefundService(testDatabase);
    try {
      await testDatabase.db.transaction((transaction) =>
        service.requestRefund(transaction, {
          bookingId: booking.id,
          amount: 60_000,
          kind: "OWNER_EXCEPTION",
          reason: "Refund pertama mencadangkan saldo",
          idempotencyKey: `pending-cap-first-${booking.id}`,
        }),
      );
      await expect(
        testDatabase.db.transaction((transaction) =>
          service.requestRefund(transaction, {
            bookingId: booking.id,
            amount: 60_000,
            kind: "OWNER_EXCEPTION",
            reason: "Refund kedua melampaui sisa",
            idempotencyKey: `pending-cap-second-${booking.id}`,
          }),
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "REFUND_EXCEEDS_PAID_AMOUNT",
      });
      const pending = await testDatabase.db
        .select({ amount: refunds.amount })
        .from(refunds)
        .where(and(eq(refunds.bookingId, booking.id), eq(refunds.status, "PENDING")));
      expect(pending).toEqual([{ amount: 60_000 }]);
    } finally {
      await cleanupBookings([booking.id]);
    }
  });

  it("mengembalikan hasil cancellation yang sama untuk retry key yang sama", async () => {
    const booking = await createBareBooking(1, 1);
    const service = new RefundService(testDatabase);
    const key = `cancel-replay-${randomUUID()}`;
    try {
      await addPaidSummaries([booking.id], 0);
      await testDatabase.db.insert(bookingItems).values({
        bookingId: booking.id,
        courtId: 1,
        startsAt: new Date("2027-03-01T09:00:00.000Z"),
        endsAt: new Date("2027-03-01T10:00:00.000Z"),
        subtotal: 0,
      });
      const first = await service.cancelByCustomer(
        booking.code,
        formatPublicId(100),
        "Pembatalan idempotent",
        key,
        new Date("2027-02-01T00:00:00.000Z"),
      );
      await expect(
        service.cancelByCustomer(
          booking.code,
          formatPublicId(100),
          "Pembatalan idempotent",
          key,
          new Date("2027-02-01T00:00:00.000Z"),
        ),
      ).resolves.toEqual(first);
      await expect(
        service.cancelByCustomer(
          booking.code,
          formatPublicId(100),
          "Alasan berbeda",
          key,
          new Date("2027-02-01T00:00:00.000Z"),
        ),
      ).rejects.toMatchObject({ statusCode: 409, code: "IDEMPOTENCY_KEY_REUSED" });
    } finally {
      await cleanupBookings([booking.id]);
    }
  });

  it("membatalkan payout reserved sebelum koreksi earning legacy", async () => {
    const booking = await createFinancialBooking(true, 100_000, {
      ownerNet: 90_000,
      platformCommission: 10_000,
      gatewayFee: 0,
    });
    const finance = new FinanceService(testDatabase);
    let batchId: number | undefined;
    try {
      const [base] = await testDatabase.db
        .select()
        .from(ownerEarnings)
        .where(eq(ownerEarnings.sourceKey, `booking:${booking.id}`));
      if (!base) throw new Error("Earning payout reconciliation tidak ditemukan.");
      const [batch] = await testDatabase.db
        .insert(payoutBatches)
        .values({
          tenantId: 1,
          status: "SCHEDULED",
          kind: "MANUAL",
          totalAmount: base.amount,
          idempotencyKey: `legacy-reconciliation-payout-${randomUUID()}`,
        })
        .$returningId();
      if (!batch) throw new Error("Payout reconciliation gagal dibuat.");
      batchId = batch.id;
      await testDatabase.db.insert(payoutItems).values({
        payoutBatchId: batch.id,
        earningId: base.id,
        amount: base.amount,
      });
      await testDatabase.db
        .update(ownerEarnings)
        .set({ status: "RESERVED_FOR_PAYOUT" })
        .where(eq(ownerEarnings.id, base.id));
      await testDatabase.db
        .update(bookingPaymentSummaries)
        .set({ status: "PARTIALLY_REFUNDED", totalRefunded: 30_000 })
        .where(eq(bookingPaymentSummaries.bookingId, booking.id));
      await insertLegacyRefundLedger(booking.id, 30_000, "reserved-payout");

      await expect(finance.reconcileLegacyRefundLedgers()).resolves.toBeGreaterThan(0);
      const [storedBatch] = await testDatabase.db
        .select({ status: payoutBatches.status })
        .from(payoutBatches)
        .where(eq(payoutBatches.id, batch.id));
      expect(storedBatch?.status).toBe("CANCELLED");
      const earnings = await testDatabase.db
        .select({ amount: ownerEarnings.amount, status: ownerEarnings.status })
        .from(ownerEarnings)
        .where(eq(ownerEarnings.bookingId, booking.id));
      expect(earnings.every((earning) => earning.status === "AVAILABLE")).toBe(true);
      expect(earnings.reduce((total, earning) => total + earning.amount, 0)).toBe(
        63_000,
      );
    } finally {
      if (batchId) {
        await testDatabase.db
          .delete(payoutItems)
          .where(eq(payoutItems.payoutBatchId, batchId));
        await testDatabase.db
          .delete(payoutBatches)
          .where(eq(payoutBatches.id, batchId));
      }
      await cleanupBookings([booking.id]);
    }
  });

  it("menyelesaikan reschedule lebih murah tanpa double reversal", async () => {
    const fixture = await createRescheduleFixture();
    const finance = new FinanceService(testDatabase);
    const refundService = new RefundService(testDatabase, finance);
    const service = new OperationsService(
      testDatabase,
      {} as never,
      () => Promise.resolve(),
      refundService,
      finance,
    );
    let specialRuleId: number | undefined;
    try {
      await addFinancialStateToRescheduleBooking(
        fixture.first.id,
        fixture.amount,
        finance,
      );
      const lowerAmount = fixture.amount - 20_000;
      const [specialRule] = await testDatabase.db
        .insert(priceRules)
        .values({
          venueId: 1,
          courtId: 1,
          kind: "SPECIAL_DATE",
          priority: 100,
          specialDate: "2027-01-10",
          amount: lowerAmount,
        })
        .$returningId();
      if (!specialRule) throw new Error("Harga reschedule lebih murah gagal dibuat.");
      specialRuleId = specialRule.id;

      await service.reschedule(
        fixture.first.code,
        [formatPublicId(fixture.first.targetSlotId)],
        formatPublicId(100),
        "Reschedule lebih murah",
        new Date("2027-01-01T00:00:00.000Z"),
        `lower-reschedule-${fixture.first.id}`,
      );
      const [refund] = await testDatabase.db
        .select()
        .from(refunds)
        .where(
          and(
            eq(refunds.bookingId, fixture.first.id),
            eq(refunds.kind, "RESCHEDULE_DIFFERENCE"),
          ),
        );
      if (!refund) throw new Error("Refund selisih reschedule tidak dibuat.");
      await expect(refundService.completeSandboxRefund(refund.id)).resolves.toBe(true);
      await expect(
        testDatabase.db.transaction((transaction) =>
          finance.markBookingCompleted(transaction, fixture.first.id, new Date()),
        ),
      ).resolves.toBeUndefined();

      const refundBalances = await refundLedgerBalancesFor(fixture.first.id, [
        "REFUND_SUCCEEDED",
        "REFUND_RECONCILIATION",
      ]);
      expect(refundBalances).toMatchObject({
        CUSTOMER_FUNDS_HELD: 20_000,
        SANDBOX_CASH: -20_000,
      });
      expect(refundBalances.OWNER_PAYABLE ?? 0).toBe(0);
      expect(refundBalances.PLATFORM_COMMISSION_REVENUE ?? 0).toBe(0);
      expect(sumBalances(refundBalances)).toBe(0);
      const snapshots = await testDatabase.db
        .select({ ownerNet: bookingFinancialSnapshots.ownerNet })
        .from(bookingFinancialSnapshots)
        .where(eq(bookingFinancialSnapshots.bookingId, fixture.first.id))
        .orderBy(bookingFinancialSnapshots.bookingVersion);
      const earningRows = await testDatabase.db
        .select({ amount: ownerEarnings.amount })
        .from(ownerEarnings)
        .where(eq(ownerEarnings.bookingId, fixture.first.id));
      expect(earningRows.reduce((total, earning) => total + earning.amount, 0)).toBe(
        snapshots.at(-1)?.ownerNet,
      );
    } finally {
      if (specialRuleId) {
        await testDatabase.db
          .delete(priceRules)
          .where(eq(priceRules.id, specialRuleId));
      }
      await cleanupBookings([fixture.first.id, fixture.second.id]);
      await testDatabase.db
        .delete(courtSlots)
        .where(inArray(courtSlots.id, fixture.slotIds));
    }
  });

  it("membatasi daftar anggota Staff ke venue assignment", async () => {
    const service = new TenantService(testDatabase);
    const tenantId = formatPublicId(1);
    const venueOne = formatPublicId(1);
    const venueTwo = formatPublicId(2);
    const allMembers = await service.listMembers(tenantId);
    const assignedMembers = await service.listMembers(tenantId, [venueOne]);

    expect(assignedMembers.length).toBeGreaterThan(0);
    expect(assignedMembers.length).toBeLessThan(allMembers.length);
    expect(
      assignedMembers.every((member) => member.assignedVenueIds.includes(venueOne)),
    ).toBe(true);
    expect(
      assignedMembers.every((member) => !member.assignedVenueIds.includes(venueTwo)),
    ).toBe(true);
    expect(
      assignedMembers.some(
        (member) =>
          member.assignedVenueIds.includes(venueTwo) &&
          !member.assignedVenueIds.includes(venueOne),
      ),
    ).toBe(false);
    await expect(service.listMembers(tenantId, [])).resolves.toEqual([]);
  });

  it("mengembalikan list review kosong untuk Staff tanpa assignment", async () => {
    await expect(
      new ReviewService(testDatabase).listBusiness(formatPublicId(1), []),
    ).resolves.toEqual([]);
  });

  it("membuat reschedule retry/concurrent atomik dan resource-scoped", async () => {
    const fixture = await createRescheduleFixture();
    const publish = { count: 0 };
    const service = new OperationsService(testDatabase, {} as never, () => {
      publish.count += 1;
      return Promise.resolve();
    });
    const actorUserId = formatPublicId(100);
    const key = `reschedule-${randomUUID()}`;
    const now = new Date("2027-01-01T00:00:00.000Z");
    try {
      await Promise.all([
        service.rescheduleCustomer(
          fixture.first.code,
          [formatPublicId(fixture.first.targetSlotId)],
          actorUserId,
          key,
          now,
        ),
        service.rescheduleCustomer(
          fixture.first.code,
          [formatPublicId(fixture.first.targetSlotId)],
          actorUserId,
          key,
          now,
        ),
      ]);
      await expect(
        service.reschedule(
          fixture.first.code,
          [formatPublicId(fixture.first.targetSlotId)],
          actorUserId,
          "Retry bisnis dengan alasan berbeda",
          now,
          key,
        ),
      ).rejects.toMatchObject({ statusCode: 409, code: "IDEMPOTENCY_KEY_REUSED" });
      await expect(
        service.rescheduleCustomer(
          fixture.first.code,
          [formatPublicId(fixture.second.targetSlotId)],
          actorUserId,
          key,
          now,
        ),
      ).rejects.toMatchObject({ statusCode: 409, code: "IDEMPOTENCY_KEY_REUSED" });
      await service.rescheduleCustomer(
        fixture.second.code,
        [formatPublicId(fixture.second.targetSlotId)],
        actorUserId,
        key,
        now,
      );

      const reschedules = await testDatabase.db
        .select({ bookingId: bookingReschedules.bookingId })
        .from(bookingReschedules)
        .where(
          inArray(bookingReschedules.bookingId, [fixture.first.id, fixture.second.id]),
        );
      expect(reschedules).toHaveLength(2);
      expect(new Set(reschedules.map((row) => row.bookingId))).toEqual(
        new Set([fixture.first.id, fixture.second.id]),
      );
      const commands = await testDatabase.db
        .select({ scope: commandIdempotency.scope })
        .from(commandIdempotency)
        .where(
          and(
            eq(commandIdempotency.actorUserId, 100),
            eq(commandIdempotency.idempotencyKey, key),
          ),
        );
      expect(commands).toHaveLength(2);
      expect(new Set(commands.map((row) => row.scope)).size).toBe(2);
      expect(publish.count).toBe(2);
    } finally {
      await cleanupBookings([fixture.first.id, fixture.second.id]);
      await testDatabase.db
        .delete(courtSlots)
        .where(inArray(courtSlots.id, fixture.slotIds));
    }
  });
});

async function createBareBooking(tenantId: number, venueId: number) {
  const code = `LG-${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const [created] = await testDatabase.db
    .insert(bookings)
    .values({
      bookingCode: code,
      tenantId,
      venueId,
      customerUserId: 100,
      source: "ONLINE",
      status: "CONFIRMED",
      paymentMode: "FULL",
      totalAmount: 1,
      balanceDue: 0,
      createdByUserId: 100,
    })
    .$returningId();
  if (!created) throw new Error("Booking regression gagal dibuat.");
  return { id: created.id, code };
}

async function addPaidSummaries(bookingIds: number[], totalPaid = 1) {
  await testDatabase.db.insert(bookingPaymentSummaries).values(
    bookingIds.map((bookingId) => ({
      bookingId,
      status: "PAID",
      totalPaid,
      totalRefunded: 0,
      balanceDue: 0,
    })),
  );
}

async function createFinancialBooking(
  completed: boolean,
  customerTotal: number,
  input: {
    ownerNet: number;
    platformCommission: number;
    platformDiscount?: number;
    gatewayFee: number;
  },
) {
  const booking = await createBareBooking(1, 1);
  await testDatabase.db
    .update(bookings)
    .set({ status: completed ? "COMPLETED" : "CONFIRMED", totalAmount: customerTotal })
    .where(eq(bookings.id, booking.id));
  await testDatabase.db.insert(bookingPaymentSummaries).values({
    bookingId: booking.id,
    status: "PAID",
    totalPaid: customerTotal,
    totalRefunded: 0,
    balanceDue: 0,
  });
  await testDatabase.db.insert(bookingFinancialSnapshots).values({
    bookingId: booking.id,
    bookingVersion: 1,
    paymentMode: "FULL",
    courtSubtotal: customerTotal + (input.platformDiscount ?? 0),
    addonSubtotal: 0,
    ownerDiscount: 0,
    platformDiscount: input.platformDiscount ?? 0,
    commissionBase: customerTotal + (input.platformDiscount ?? 0),
    commissionRateBasisPoints: 1_000,
    platformCommission: input.platformCommission,
    gatewayFee: input.gatewayFee,
    gatewayFeeFunding: "OWNER",
    ownerNet: input.ownerNet,
  });
  const [attempt] = await testDatabase.db
    .insert(paymentAttempts)
    .values({
      paymentCode: `PAY-${randomUUID().replaceAll("-", "").slice(0, 14)}`,
      bookingId: booking.id,
      kind: "FULL",
      amount: customerTotal,
      status: "PAID",
      idempotencyKey: `payment-${randomUUID()}`,
      paidAt: new Date(),
    })
    .$returningId();
  if (!attempt) throw new Error("Payment regression gagal dibuat.");
  const finance = new FinanceService(testDatabase);
  await testDatabase.db.transaction(async (transaction) => {
    await finance.recordPayment(
      transaction,
      booking.id,
      attempt.id,
      customerTotal,
      new Date(),
    );
    if (completed) {
      await finance.markBookingCompleted(transaction, booking.id, new Date());
    }
  });
  return booking;
}

async function refundLedgerBalancesFor(
  bookingId: number,
  kinds = ["REFUND_SUCCEEDED"],
) {
  const rows = await testDatabase.db
    .select({
      accountCode: ledgerEntries.accountCode,
      debit: ledgerEntries.debit,
      credit: ledgerEntries.credit,
    })
    .from(ledgerEntries)
    .innerJoin(
      ledgerTransactions,
      eq(ledgerTransactions.id, ledgerEntries.transactionId),
    )
    .where(
      and(
        eq(ledgerTransactions.bookingId, bookingId),
        inArray(ledgerTransactions.kind, kinds),
      ),
    );
  return rows.reduce<Partial<Record<LedgerAccountCode, number>>>((totals, row) => {
    const accountCode = row.accountCode as LedgerAccountCode;
    totals[accountCode] = (totals[accountCode] ?? 0) + row.debit - row.credit;
    return totals;
  }, {});
}

function sumBalances(balances: Partial<Record<LedgerAccountCode, number>>) {
  return Object.values(balances).reduce((sum, value) => sum + value, 0);
}

async function insertLegacyRefundLedger(
  bookingId: number,
  amount: number,
  suffix: string,
  createdAt?: Date,
) {
  const [legacy] = await testDatabase.db
    .insert(ledgerTransactions)
    .values({
      tenantId: 1,
      bookingId,
      kind: "REFUND_SUCCEEDED",
      idempotencyKey: `legacy-refund-${bookingId}-${suffix}`,
      description: "Posting refund legacy",
      createdAt,
    })
    .$returningId();
  if (!legacy) throw new Error("Ledger refund legacy gagal dibuat.");
  await testDatabase.db.insert(ledgerEntries).values([
    {
      transactionId: legacy.id,
      accountCode: "REFUND_EXPENSE",
      debit: amount,
      credit: 0,
    },
    {
      transactionId: legacy.id,
      accountCode: "SANDBOX_CASH",
      debit: 0,
      credit: amount,
    },
  ]);
}

async function completeAfterConcurrentRefund(
  bookingId: number,
  refundId: number,
  finance: FinanceService,
  refundService: RefundService,
) {
  let markSnapshotReady!: () => void;
  let allowCompletion!: () => void;
  const snapshotReady = new Promise<void>((resolve) => {
    markSnapshotReady = resolve;
  });
  const refundCommitted = new Promise<void>((resolve) => {
    allowCompletion = resolve;
  });
  const completion = testDatabase.db.transaction(async (transaction) => {
    await transaction
      .select({ totalRefunded: bookingPaymentSummaries.totalRefunded })
      .from(bookingPaymentSummaries)
      .where(eq(bookingPaymentSummaries.bookingId, bookingId));
    markSnapshotReady();
    await refundCommitted;
    await finance.markBookingCompleted(transaction, bookingId, new Date());
  });
  await snapshotReady;
  try {
    const completed = await refundService.completeSandboxRefund(refundId);
    if (!completed) throw new Error("Refund concurrent regression tidak selesai.");
  } finally {
    allowCompletion();
  }
  await completion;
}

async function createRescheduleFixture() {
  const [basePrice] = await testDatabase.db
    .select({ amount: priceRules.amount })
    .from(priceRules)
    .where(and(eq(priceRules.courtId, 1), eq(priceRules.kind, "BASE")))
    .limit(1);
  if (!basePrice) throw new Error("Harga lapangan seed tidak tersedia.");
  const starts = [
    "2027-01-10T09:00:00.000Z",
    "2027-01-10T11:00:00.000Z",
    "2027-01-11T09:00:00.000Z",
    "2027-01-11T11:00:00.000Z",
  ].map((value) => new Date(value));
  const slotRows = [];
  for (const startsAt of starts) {
    const [slot] = await testDatabase.db
      .insert(courtSlots)
      .values({
        courtId: 1,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 60 * 60_000),
      })
      .$returningId();
    if (!slot) throw new Error("Slot reschedule regression gagal dibuat.");
    slotRows.push(slot.id);
  }
  const first = await createRescheduleBooking(
    slotRows[0]!,
    slotRows[1]!,
    basePrice.amount,
  );
  const second = await createRescheduleBooking(
    slotRows[2]!,
    slotRows[3]!,
    basePrice.amount,
  );
  return { first, second, slotIds: slotRows, amount: basePrice.amount };
}

async function addFinancialStateToRescheduleBooking(
  bookingId: number,
  amount: number,
  finance: FinanceService,
) {
  await addPaidSummaries([bookingId], amount);
  const [snapshot] = await testDatabase.db
    .insert(bookingFinancialSnapshots)
    .values({
      bookingId,
      bookingVersion: 1,
      paymentMode: "FULL",
      courtSubtotal: amount,
      addonSubtotal: 0,
      ownerDiscount: 0,
      platformDiscount: 0,
      commissionBase: amount,
      commissionRateBasisPoints: 1_000,
      platformCommission: Math.floor(amount / 10),
      gatewayFee: 0,
      gatewayFeeFunding: "OWNER",
      ownerNet: amount - Math.floor(amount / 10),
    })
    .$returningId();
  const [attempt] = await testDatabase.db
    .insert(paymentAttempts)
    .values({
      paymentCode: `PAY-${randomUUID().replaceAll("-", "").slice(0, 14)}`,
      bookingId,
      kind: "FULL",
      amount,
      status: "PAID",
      idempotencyKey: `reschedule-payment-${randomUUID()}`,
      paidAt: new Date(),
    })
    .$returningId();
  if (!snapshot || !attempt)
    throw new Error("Finance reschedule regression gagal dibuat.");
  await testDatabase.db.transaction((transaction) =>
    finance.recordPayment(transaction, bookingId, attempt.id, amount, new Date()),
  );
}

async function createRescheduleBooking(
  currentSlotId: number,
  targetSlotId: number,
  amount: number,
) {
  const booking = await createBareBooking(1, 1);
  await testDatabase.db
    .update(bookings)
    .set({ totalAmount: amount, balanceDue: 0 })
    .where(eq(bookings.id, booking.id));
  const [currentSlot] = await testDatabase.db
    .select()
    .from(courtSlots)
    .where(eq(courtSlots.id, currentSlotId))
    .limit(1);
  if (!currentSlot) throw new Error("Slot awal regression tidak ditemukan.");
  const [item] = await testDatabase.db
    .insert(bookingItems)
    .values({
      bookingId: booking.id,
      courtId: 1,
      startsAt: currentSlot.startsAt,
      endsAt: currentSlot.endsAt,
      subtotal: amount,
    })
    .$returningId();
  if (!item) throw new Error("Booking item regression gagal dibuat.");
  await testDatabase.db.insert(bookingSlotReservations).values({
    courtSlotId: currentSlotId,
    bookingId: booking.id,
    bookingItemId: item.id,
    reservationStatus: "CONFIRMED",
  });
  return { ...booking, targetSlotId };
}

async function cleanupBookings(bookingIds: number[]) {
  if (bookingIds.length === 0) return;
  await testDatabase.pool.query("SET FOREIGN_KEY_CHECKS = 0");
  try {
    const placeholders = bookingIds.map(() => "?").join(",");
    await testDatabase.pool.query(
      `DELETE FROM ledger_entries WHERE transaction_id IN (SELECT id FROM ledger_transactions WHERE booking_id IN (${placeholders}))`,
      bookingIds,
    );
    await testDatabase.pool.query(
      `DELETE FROM audit_logs WHERE resource_type = 'booking' AND resource_id IN (${placeholders})`,
      bookingIds,
    );
    for (const table of [
      "ledger_transactions",
      "owner_earnings",
      "refund_state_transitions",
      "refunds",
      "payment_attempts",
      "booking_financial_snapshots",
      "booking_payment_summaries",
      "booking_cancellations",
      "booking_reschedules",
      "booking_slot_history",
      "booking_slot_reservations",
      "booking_items",
      "outbox_events",
      "command_idempotency",
    ]) {
      if (table === "refund_state_transitions") {
        await testDatabase.pool.query(
          `DELETE FROM refund_state_transitions WHERE refund_id IN (SELECT id FROM refunds WHERE booking_id IN (${placeholders}))`,
          bookingIds,
        );
        continue;
      }
      const column =
        table === "outbox_events" || table === "command_idempotency"
          ? "resource_id"
          : "booking_id";
      await testDatabase.pool.query(
        `DELETE FROM \`${table}\` WHERE \`${column}\` IN (${placeholders})`,
        bookingIds,
      );
    }
    await testDatabase.pool.query(
      `DELETE FROM bookings WHERE id IN (${placeholders})`,
      bookingIds,
    );
  } finally {
    await testDatabase.pool.query("SET FOREIGN_KEY_CHECKS = 1");
  }
}

afterAll(async () => testDatabase.close());
