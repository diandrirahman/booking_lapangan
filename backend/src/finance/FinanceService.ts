import ExcelJS from "exceljs";
import {
  and,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  like,
  lte,
  or,
  sql,
} from "drizzle-orm";
import type { DatabaseConnection } from "../database/client.js";
import { formatPublicId, parsePublicId } from "../database/ids.js";
import {
  auditLogs,
  bookingItems,
  bookingFinancialSnapshots,
  bookingPaymentSummaries,
  bookings,
  commissionConfigs,
  commandIdempotency,
  ledgerEntries,
  ledgerTransactions,
  ownerEarnings,
  outboxEvents,
  payoutBatches,
  payoutItems,
  paymentAttempts,
  promotionRedemptions,
  promotions,
  promotionScopes,
  refunds,
  sports,
  tenantFinanceSettings,
  tenants,
  courts,
  venueSports,
  venues,
} from "../database/schema/index.js";
import { ApiError } from "../http/ApiError.js";
import { calculateFinancialSnapshot } from "./domain/calculateFinancialSnapshot.js";
import { datePartsInTimeZone } from "../schedule/availability/timeZone.js";
import type { RequestAuditContext } from "../http/requestAuditContext.js";

type Transaction = Parameters<
  Parameters<DatabaseConnection["db"]["transaction"]>[0]
>[0];

export type LedgerAccountCode =
  | "SANDBOX_CASH"
  | "CUSTOMER_FUNDS_HELD"
  | "OWNER_PAYABLE"
  | "PLATFORM_COMMISSION_REVENUE"
  | "PLATFORM_PROMO_EXPENSE"
  | "GATEWAY_FEE_EXPENSE"
  | "REFUND_EXPENSE"
  | "SANDBOX_PAYOUT";

export interface PreparedBookingFinancials {
  commissionConfigId: number | null;
  promotionId: number | null;
  promotionCode: string | null;
  paymentMode: string;
  reservationAmount: number;
  dpAmount: number;
  discountAmount: number;
  discountFunding: "OWNER" | "PLATFORM" | null;
  courtSubtotal: number;
  addonSubtotal: number;
  customerTotal: number;
  ownerDiscount: number;
  platformDiscount: number;
  commissionBase: number;
  commissionRateBasisPoints: number;
  platformCommission: number;
  gatewayFee: number;
  gatewayFeeFunding: "OWNER" | "PLATFORM";
  ownerNet: number;
}

export interface PromotionInput {
  tenantId: string | null;
  code: string;
  name: string;
  description?: string | undefined;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  minimumAmount?: number | undefined;
  maximumDiscount?: number | undefined;
  startsAt: Date;
  endsAt: Date;
  startsAtTime?: string | undefined;
  endsAtTime?: string | undefined;
  quota?: number | undefined;
  perUserLimit?: number | undefined;
  firstBookingOnly?: boolean | undefined;
  paymentMethod?: "FULL" | "DP" | "PAY_AT_VENUE" | undefined;
  fundingSource: "OWNER" | "PLATFORM";
  budgetAmount?: number | undefined;
  scopes?:
    Array<{ type: "VENUE" | "SPORT" | "COURT"; referenceId: string }> | undefined;
  actorUserId?: string | undefined;
  reason?: string | undefined;
  idempotencyKey: string;
  allowedVenueIds?: string[] | undefined;
}

export class FinanceService {
  constructor(private readonly database: DatabaseConnection) {}

  async prepareBookingFinancials(
    transaction: Transaction,
    input: {
      tenantId: number;
      venueId: number;
      courtId: number;
      sportId: number;
      userId: number;
      paymentMode: string;
      dpPercentage?: number | null | undefined;
      reservationAmount?: number | null | undefined;
      courtSubtotal: number;
      addonSubtotal: number;
      promotionCode?: string | undefined;
      ownerAdjustment?: number | undefined;
      timezone: string;
      now: Date;
    },
  ): Promise<PreparedBookingFinancials> {
    const commission = await this.resolveCommission(
      transaction,
      input.tenantId,
      input.now,
    );
    if (input.promotionCode && (input.ownerAdjustment ?? 0) > 0) {
      throw new ApiError(
        422,
        "PROMOTION_WITH_OWNER_ADJUSTMENT_NOT_ALLOWED",
        "Promo tidak dapat digabungkan dengan penyesuaian harga Owner.",
      );
    }
    const promotion = input.promotionCode
      ? await this.resolvePromotion(transaction, input)
      : null;
    const grossAmount = input.courtSubtotal + input.addonSubtotal;
    const ownerAdjustment = Math.max(0, input.ownerAdjustment ?? 0);
    const promotionDiscount = promotion
      ? discountForPromotion(promotion, grossAmount)
      : 0;
    const discountAmount = Math.max(ownerAdjustment, promotionDiscount);
    const promotionFunding =
      promotion?.fundingSource === "OWNER" || promotion?.fundingSource === "PLATFORM"
        ? promotion.fundingSource
        : null;
    const discountFunding: "OWNER" | "PLATFORM" | null =
      ownerAdjustment > 0 ? "OWNER" : promotionFunding;
    const customerTotalBeforeFee = grossAmount - discountAmount;
    const onlineAmount =
      input.paymentMode === "FULL"
        ? customerTotalBeforeFee
        : input.paymentMode === "DP"
          ? Math.ceil((customerTotalBeforeFee * (input.dpPercentage ?? 100)) / 100)
          : Math.min(customerTotalBeforeFee, input.reservationAmount ?? 0);
    const gatewayFee = Math.floor(
      (onlineAmount * commission.gatewayFeeBasisPoints) / 10_000,
    );
    if (gatewayFee > 0 && commission.gatewayFeeFunding === "PLATFORM") {
      await this.reserveGatewaySubsidy(transaction, commission, gatewayFee);
    }
    const calculation = calculateFinancialSnapshot({
      courtSubtotal: input.courtSubtotal,
      addonSubtotal: input.addonSubtotal,
      discountAmount,
      discountFunding,
      commissionRateBasisPoints: commission.rateBasisPoints,
      gatewayFee,
      gatewayFeeFunding: commission.gatewayFeeFunding,
    });
    return {
      commissionConfigId: commission.id,
      promotionId: promotion?.id ?? null,
      promotionCode: promotion?.code ?? null,
      paymentMode: input.paymentMode,
      reservationAmount:
        input.paymentMode === "PAY_AT_VENUE"
          ? Math.min(calculation.customerTotal, input.reservationAmount ?? 0)
          : 0,
      dpAmount:
        input.paymentMode === "DP"
          ? Math.ceil((calculation.customerTotal * (input.dpPercentage ?? 100)) / 100)
          : 0,
      discountAmount,
      discountFunding,
      courtSubtotal: input.courtSubtotal,
      addonSubtotal: input.addonSubtotal,
      customerTotal: calculation.customerTotal,
      ownerDiscount: calculation.ownerDiscount,
      platformDiscount: calculation.platformDiscount,
      commissionBase: calculation.commissionBase,
      commissionRateBasisPoints: commission.rateBasisPoints,
      platformCommission: calculation.platformCommission,
      gatewayFee,
      gatewayFeeFunding: commission.gatewayFeeFunding,
      ownerNet: calculation.ownerNet,
    };
  }

  async persistBookingFinancials(
    transaction: Transaction,
    bookingId: number,
    bookingVersion: number,
    userId: number,
    prepared: PreparedBookingFinancials,
  ): Promise<void> {
    await transaction.insert(bookingFinancialSnapshots).values({
      bookingId,
      bookingVersion,
      commissionConfigId: prepared.commissionConfigId,
      promotionId: prepared.promotionId,
      paymentMode: prepared.paymentMode,
      reservationAmount: prepared.reservationAmount,
      dpAmount: prepared.dpAmount,
      courtSubtotal: prepared.courtSubtotal,
      addonSubtotal: prepared.addonSubtotal,
      ownerDiscount: prepared.ownerDiscount,
      platformDiscount: prepared.platformDiscount,
      commissionBase: prepared.commissionBase,
      commissionRateBasisPoints: prepared.commissionRateBasisPoints,
      platformCommission: prepared.platformCommission,
      gatewayFee: prepared.gatewayFee,
      gatewayFeeFunding: prepared.gatewayFeeFunding,
      ownerNet: prepared.ownerNet,
      taxPlaceholder: 0,
    });
    if (prepared.promotionId !== null) {
      await transaction.insert(promotionRedemptions).values({
        promotionId: prepared.promotionId,
        bookingId,
        userId,
        discountAmount: prepared.discountAmount,
        status: "RESERVED",
      });
      await transaction
        .update(promotions)
        .set({
          quotaUsed: sql`${promotions.quotaUsed} + 1`,
          budgetUsed: sql`${promotions.budgetUsed} + ${prepared.discountAmount}`,
          status: sql`case
            when ${promotions.quota} is not null and ${promotions.quotaUsed} + 1 >= ${promotions.quota} then 'EXHAUSTED'
            when ${promotions.budgetAmount} is not null and ${promotions.budgetUsed} + ${prepared.discountAmount} >= ${promotions.budgetAmount} then 'EXHAUSTED'
            else ${promotions.status}
          end`,
        })
        .where(eq(promotions.id, prepared.promotionId));
    }
  }

  async recordPayment(
    transaction: Transaction,
    bookingId: number,
    paymentAttemptId: number,
    amount: number,
    now: Date,
  ): Promise<void> {
    await transaction
      .update(promotionRedemptions)
      .set({ status: "CONSUMED" })
      .where(
        and(
          eq(promotionRedemptions.bookingId, bookingId),
          eq(promotionRedemptions.status, "RESERVED"),
        ),
      );
    await this.postLedger(transaction, {
      tenantId: await tenantIdForBooking(transaction, bookingId),
      bookingId,
      kind: "PAYMENT_RECEIVED",
      idempotencyKey: `payment:${paymentAttemptId}`,
      description: "Pembayaran sandbox terverifikasi",
      entries: [
        { accountCode: "SANDBOX_CASH", debit: amount, credit: 0 },
        { accountCode: "CUSTOMER_FUNDS_HELD", debit: 0, credit: amount },
      ],
    });
    const [booking] = await transaction
      .select({ status: bookings.status })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);
    if (booking?.status === "EXPIRED" || booking?.status === "CANCELLED") return;
    const [snapshot] = await transaction
      .select()
      .from(bookingFinancialSnapshots)
      .where(eq(bookingFinancialSnapshots.bookingId, bookingId))
      .orderBy(desc(bookingFinancialSnapshots.bookingVersion))
      .limit(1);
    if (!snapshot) return;
    const [paymentSummary] = await transaction
      .select({ totalPaid: bookingPaymentSummaries.totalPaid })
      .from(bookingPaymentSummaries)
      .where(eq(bookingPaymentSummaries.bookingId, bookingId))
      .limit(1);
    const customerTotal =
      snapshot.courtSubtotal +
      snapshot.addonSubtotal -
      snapshot.ownerDiscount -
      snapshot.platformDiscount;
    const earnedAmount =
      customerTotal > 0
        ? Math.floor(
            (snapshot.ownerNet * (paymentSummary?.totalPaid ?? amount)) / customerTotal,
          )
        : 0;
    await transaction
      .insert(ownerEarnings)
      .values({
        tenantId: await tenantIdForBooking(transaction, bookingId),
        bookingId,
        snapshotId: snapshot.id,
        sourceKey: `booking:${bookingId}`,
        amount: Math.min(snapshot.ownerNet, earnedAmount),
        status: "PENDING",
        updatedAt: now,
      })
      .onDuplicateKeyUpdate({
        set: { amount: Math.min(snapshot.ownerNet, earnedAmount), updatedAt: now },
      });
  }

  async syncOwnerEarningToLatestSnapshot(
    transaction: Transaction,
    bookingId: number,
    now: Date,
  ): Promise<void> {
    const [snapshot] = await transaction
      .select()
      .from(bookingFinancialSnapshots)
      .where(eq(bookingFinancialSnapshots.bookingId, bookingId))
      .orderBy(desc(bookingFinancialSnapshots.bookingVersion))
      .limit(1);
    const [summary] = await transaction
      .select({ totalPaid: bookingPaymentSummaries.totalPaid })
      .from(bookingPaymentSummaries)
      .where(eq(bookingPaymentSummaries.bookingId, bookingId))
      .limit(1)
      .for("update");
    if (!snapshot || !summary) return;
    const customerTotal = snapshotCustomerTotal(snapshot);
    const amount =
      customerTotal > 0
        ? Math.min(
            snapshot.ownerNet,
            Math.floor((snapshot.ownerNet * summary.totalPaid) / customerTotal),
          )
        : 0;
    await transaction
      .update(ownerEarnings)
      .set({ snapshotId: snapshot.id, amount, updatedAt: now })
      .where(eq(ownerEarnings.sourceKey, `booking:${bookingId}`));
  }

  async releaseUnusedFinancialReservations(
    transaction: Transaction,
    bookingId: number,
  ): Promise<void> {
    const [payment] = await transaction
      .select({ totalPaid: bookingPaymentSummaries.totalPaid })
      .from(bookingPaymentSummaries)
      .where(eq(bookingPaymentSummaries.bookingId, bookingId))
      .limit(1);
    if ((payment?.totalPaid ?? 0) > 0) return;

    const [snapshot] = await transaction
      .select()
      .from(bookingFinancialSnapshots)
      .where(eq(bookingFinancialSnapshots.bookingId, bookingId))
      .orderBy(desc(bookingFinancialSnapshots.bookingVersion))
      .limit(1)
      .for("update");
    if (
      snapshot?.commissionConfigId &&
      snapshot.gatewayFeeFunding === "PLATFORM" &&
      snapshot.gatewayFee > 0
    ) {
      await transaction
        .update(commissionConfigs)
        .set({
          subsidyUsed: sql`greatest(0, ${commissionConfigs.subsidyUsed} - ${snapshot.gatewayFee})`,
        })
        .where(eq(commissionConfigs.id, snapshot.commissionConfigId));
    }

    const [redemption] = await transaction
      .select()
      .from(promotionRedemptions)
      .where(
        and(
          eq(promotionRedemptions.bookingId, bookingId),
          eq(promotionRedemptions.status, "RESERVED"),
        ),
      )
      .limit(1)
      .for("update");
    if (!redemption) return;

    await transaction
      .update(promotionRedemptions)
      .set({ status: "RELEASED" })
      .where(eq(promotionRedemptions.id, redemption.id));
    await transaction
      .update(promotions)
      .set({
        quotaUsed: sql`greatest(0, ${promotions.quotaUsed} - 1)`,
        budgetUsed: sql`greatest(0, ${promotions.budgetUsed} - ${redemption.discountAmount})`,
        status: sql`case when ${promotions.status} = 'EXHAUSTED' then 'ACTIVE' else ${promotions.status} end`,
      })
      .where(eq(promotions.id, redemption.promotionId));
  }

  async markBookingCompleted(
    transaction: Transaction,
    bookingId: number,
    completedAt: Date,
  ): Promise<void> {
    const [snapshot] = await transaction
      .select()
      .from(bookingFinancialSnapshots)
      .where(eq(bookingFinancialSnapshots.bookingId, bookingId))
      .orderBy(desc(bookingFinancialSnapshots.bookingVersion))
      .limit(1);
    if (!snapshot) return;
    const [summary] = await transaction
      .select()
      .from(bookingPaymentSummaries)
      .where(eq(bookingPaymentSummaries.bookingId, bookingId))
      .limit(1);
    if (!summary || summary.totalPaid <= 0) return;
    const entries: LedgerEntryInput[] = [
      {
        accountCode: "CUSTOMER_FUNDS_HELD",
        debit: snapshotCustomerTotal(snapshot),
        credit: 0,
      },
      { accountCode: "OWNER_PAYABLE", debit: 0, credit: snapshot.ownerNet },
      {
        accountCode: "PLATFORM_COMMISSION_REVENUE",
        debit: 0,
        credit: snapshot.platformCommission,
      },
    ];
    if (snapshot.platformDiscount > 0) {
      entries.push({
        accountCode: "PLATFORM_PROMO_EXPENSE",
        debit: snapshot.platformDiscount,
        credit: 0,
      });
    }
    if (snapshot.gatewayFee > 0) {
      entries.push({
        accountCode: "SANDBOX_CASH",
        debit: 0,
        credit: snapshot.gatewayFee,
      });
      if (snapshot.gatewayFeeFunding === "PLATFORM") {
        entries.push({
          accountCode: "GATEWAY_FEE_EXPENSE",
          debit: snapshot.gatewayFee,
          credit: 0,
        });
      }
    }
    await this.postLedger(transaction, {
      tenantId: await tenantIdForBooking(transaction, bookingId),
      bookingId,
      kind: "BOOKING_COMPLETED",
      idempotencyKey: `booking-completed:${bookingId}`,
      description: "Booking selesai, commission earned",
      entries,
    });
    const { cumulativeRefund, entries: refundEntries } =
      await this.refundLedgerCorrection(transaction, bookingId);
    if (refundEntries.length > 0) {
      await this.postLedger(transaction, {
        tenantId: await tenantIdForBooking(transaction, bookingId),
        bookingId,
        kind: "REFUND_RECONCILIATION",
        idempotencyKey: `refund-after-completion:${bookingId}:${cumulativeRefund}`,
        description: "Koreksi refund yang diproses sebelum booking selesai",
        entries: refundEntries,
      });
    }
    await transaction
      .update(ownerEarnings)
      .set({
        status: "PENDING",
        availableAt: new Date(completedAt.getTime() + 24 * 60 * 60_000),
        updatedAt: completedAt,
      })
      .where(
        and(
          eq(ownerEarnings.bookingId, bookingId),
          eq(ownerEarnings.status, "PENDING"),
        ),
      );
  }

  async recordRefund(
    transaction: Transaction,
    refundId: number,
    bookingId: number,
    amount: number,
    now: Date,
  ): Promise<void> {
    const tenantId = await tenantIdForBooking(transaction, bookingId);
    await lockTenantFinance(transaction, tenantId);
    const { semanticRefund, entries, ownerReversal, snapshot } =
      await this.refundLedgerCorrection(transaction, bookingId);
    const cashEntry = entries.find((entry) => entry.accountCode === "SANDBOX_CASH");
    if ((cashEntry?.credit ?? 0) - (cashEntry?.debit ?? 0) !== amount) {
      throw new Error("REFUND_LEDGER_AMOUNT_MISMATCH");
    }
    await this.postLedger(transaction, {
      tenantId,
      bookingId,
      kind: "REFUND_SUCCEEDED",
      idempotencyKey: `refund:${refundId}`,
      description: "Refund sandbox berhasil",
      entries,
    });
    const [earning] = await transaction
      .select()
      .from(ownerEarnings)
      .where(
        and(
          eq(ownerEarnings.bookingId, bookingId),
          eq(ownerEarnings.sourceKey, `booking:${bookingId}`),
        ),
      )
      .limit(1)
      .for("update");
    if (!earning) return;
    if (!snapshot) return;
    const customerTotal =
      snapshot.courtSubtotal +
      snapshot.addonSubtotal -
      snapshot.ownerDiscount -
      snapshot.platformDiscount;
    const priorAdjustments = await transaction
      .select({ id: ownerEarnings.id, amount: ownerEarnings.amount })
      .from(ownerEarnings)
      .where(refundEarningScope(bookingId));
    const priorOwnerReversal = -sumBy(priorAdjustments, (row) => row.amount);
    const ownerReversalDelta = Math.max(0, ownerReversal - priorOwnerReversal);
    if (
      earning.status === "RESERVED_FOR_PAYOUT" &&
      (await this.cancelPayoutContainingEarning(
        transaction,
        earning.id,
        `Refund Rp${amount} untuk booking ${bookingId}`,
        now,
      ))
    ) {
      earning.status = "AVAILABLE";
    }
    const fullReversal = customerTotal > 0 && semanticRefund >= customerTotal;
    if (
      fullReversal &&
      earning.status !== "PAID_OUT" &&
      earning.status !== "RESERVED_FOR_PAYOUT"
    ) {
      await transaction
        .update(ownerEarnings)
        .set({ status: "REVERSED", updatedAt: now })
        .where(or(eq(ownerEarnings.id, earning.id), refundEarningScope(bookingId)));
      return;
    }
    if (ownerReversalDelta === 0) return;
    if (earning.status === "PAID_OUT") {
      await transaction.insert(ownerEarnings).values({
        tenantId: earning.tenantId,
        bookingId,
        snapshotId: earning.snapshotId,
        sourceKey: `refund:${refundId}`,
        amount: -ownerReversalDelta,
        status: "AVAILABLE",
        availableAt: now,
        updatedAt: now,
      });
    } else {
      await transaction.insert(ownerEarnings).values({
        tenantId: earning.tenantId,
        bookingId,
        snapshotId: earning.snapshotId,
        sourceKey: `refund:${refundId}`,
        amount: -ownerReversalDelta,
        status: earning.status === "PENDING" ? "PENDING" : "AVAILABLE",
        availableAt: earning.availableAt,
        updatedAt: now,
      });
    }
  }

  async reconcileLegacyRefundLedgers(
    batchSize = 100,
    now = new Date(),
    since?: Date,
  ): Promise<number> {
    let reconciled = 0;
    let bookingCursor = 0;
    while (true) {
      const candidates = await this.database.db
        .select({ bookingId: ledgerTransactions.bookingId })
        .from(ledgerTransactions)
        .where(
          and(
            eq(ledgerTransactions.kind, "REFUND_SUCCEEDED"),
            gt(ledgerTransactions.bookingId, bookingCursor),
            since ? gte(ledgerTransactions.createdAt, since) : undefined,
          ),
        )
        .groupBy(ledgerTransactions.bookingId)
        .orderBy(ledgerTransactions.bookingId)
        .limit(batchSize);
      if (candidates.length === 0) break;
      for (const candidate of candidates) {
        if (candidate.bookingId === null) continue;
        const corrected = await this.database.db.transaction(async (transaction) => {
          const tenantId = await tenantIdForBooking(transaction, candidate.bookingId!);
          await lockTenantFinance(transaction, tenantId);
          const { cumulativeRefund, entries, ownerReversal, snapshot } =
            await this.refundLedgerCorrection(transaction, candidate.bookingId!);
          const earningCorrection = await this.reconcileLegacyOwnerEarning(
            transaction,
            candidate.bookingId!,
            snapshot,
            ownerReversal,
            cumulativeRefund,
            now,
          );
          const cashEntry = entries.find(
            (entry) => entry.accountCode === "SANDBOX_CASH",
          );
          if ((cashEntry?.credit ?? 0) - (cashEntry?.debit ?? 0) !== 0) {
            throw new Error("REFUND_RECONCILIATION_CASH_MISMATCH");
          }
          const ledgerCorrected = entries.length > 0;
          if (ledgerCorrected) {
            await this.postLedger(transaction, {
              tenantId,
              bookingId: candidate.bookingId!,
              kind: "REFUND_RECONCILIATION",
              idempotencyKey: `refund-reconciliation:${candidate.bookingId}:${cumulativeRefund}`,
              description: "Koreksi semantic ledger refund legacy",
              entries,
            });
          }
          if (ledgerCorrected || earningCorrection !== 0) {
            await transaction.insert(auditLogs).values({
              tenantId,
              actorUserId: null,
              action: "finance.refund_reconciled",
              resourceType: "booking",
              resourceId: candidate.bookingId!,
              reason: "Koreksi ledger dan owner earning refund legacy saat migration",
              afterState: { ledgerCorrected, earningCorrection },
            });
          }
          return ledgerCorrected || earningCorrection !== 0;
        });
        if (corrected) reconciled += 1;
      }
      bookingCursor = candidates.at(-1)?.bookingId ?? bookingCursor;
      if (candidates.length < batchSize) break;
    }
    return reconciled;
  }

  async releaseAvailableEarnings(limit = 100, now = new Date()): Promise<number> {
    return this.database.db.transaction(async (transaction) => {
      const due = await transaction
        .select({ id: ownerEarnings.id, tenantId: ownerEarnings.tenantId })
        .from(ownerEarnings)
        .where(
          and(
            eq(ownerEarnings.status, "PENDING"),
            lte(ownerEarnings.availableAt, now),
            isNull(ownerEarnings.frozenBySupportTicketId),
          ),
        )
        .limit(limit)
        .for("update");
      if (due.length === 0) return 0;
      await transaction
        .update(ownerEarnings)
        .set({ status: "AVAILABLE", updatedAt: now })
        .where(
          inArray(
            ownerEarnings.id,
            due.map((earning) => earning.id),
          ),
        );
      await transaction.insert(outboxEvents).values(
        due.map((earning) => ({
          tenantId: earning.tenantId,
          eventType: "earning.status_changed",
          resourceType: "earning",
          resourceId: earning.id,
          resourceVersion: 1,
          payload: { status: "AVAILABLE", hint: "refetch-finance" },
          occurredAt: now,
        })),
      );
      return due.length;
    });
  }

  async createPayout(
    tenantId: string,
    actorUserId: string | null,
    idempotencyKey: string,
    kind: "MANUAL" | "WEEKLY",
    now = new Date(),
    auditContext: RequestAuditContext = {},
  ): Promise<{ id: string; totalAmount: number; status: string }> {
    return this.database.db.transaction(async (transaction) => {
      const tenantDatabaseId = parsePublicId(tenantId);
      await lockTenantFinance(transaction, tenantDatabaseId);
      const [existing] = await transaction
        .select()
        .from(payoutBatches)
        .where(
          and(
            eq(payoutBatches.tenantId, tenantDatabaseId),
            eq(payoutBatches.idempotencyKey, idempotencyKey),
          ),
        )
        .limit(1);
      if (existing) return payoutView(existing);
      const [settings] = await transaction
        .select()
        .from(tenantFinanceSettings)
        .where(eq(tenantFinanceSettings.tenantId, tenantDatabaseId))
        .limit(1);
      if (kind === "MANUAL" && settings && !settings.manualPayoutEnabled) {
        throw new ApiError(409, "MANUAL_PAYOUT_DISABLED", "Payout manual tidak aktif.");
      }
      const available = await transaction
        .select()
        .from(ownerEarnings)
        .where(
          and(
            eq(ownerEarnings.tenantId, tenantDatabaseId),
            eq(ownerEarnings.status, "AVAILABLE"),
            isNull(ownerEarnings.frozenBySupportTicketId),
          ),
        )
        .for("update");
      const totalAmount = available.reduce(
        (total, earning) => total + earning.amount,
        0,
      );
      const minimum = settings?.minimumPayoutAmount ?? 100_000;
      if (totalAmount < minimum) {
        throw new ApiError(
          409,
          "PAYOUT_MINIMUM_NOT_MET",
          `Saldo tersedia belum mencapai minimum Rp${minimum.toLocaleString("id-ID")}.`,
        );
      }
      const [created] = await transaction
        .insert(payoutBatches)
        .values({
          tenantId: tenantDatabaseId,
          status: "SCHEDULED",
          kind,
          totalAmount,
          idempotencyKey,
          requestedByUserId: actorUserId ? parsePublicId(actorUserId) : null,
          updatedAt: now,
        })
        .$returningId();
      if (!created) throw new Error("MySQL tidak mengembalikan ID payout.");
      await transaction.insert(payoutItems).values(
        available.map((earning) => ({
          payoutBatchId: created.id,
          earningId: earning.id,
          amount: earning.amount,
        })),
      );
      await transaction
        .update(ownerEarnings)
        .set({ status: "RESERVED_FOR_PAYOUT", updatedAt: now })
        .where(
          inArray(
            ownerEarnings.id,
            available.map((earning) => earning.id),
          ),
        );
      await transaction.insert(auditLogs).values({
        tenantId: tenantDatabaseId,
        actorUserId: actorUserId ? parsePublicId(actorUserId) : null,
        action: "payout.created",
        resourceType: "payout",
        resourceId: created.id,
        reason:
          kind === "MANUAL"
            ? "Payout manual sandbox diminta"
            : "Payout mingguan sandbox dibuat",
        afterState: { status: "SCHEDULED", totalAmount, kind },
        ...auditContext,
      });
      await transaction.insert(outboxEvents).values({
        tenantId: tenantDatabaseId,
        eventType: "payout.status_changed",
        resourceType: "payout",
        resourceId: created.id,
        resourceVersion: Math.floor(now.getTime() / 1_000),
        payload: { status: "SCHEDULED", hint: "refetch-finance" },
        occurredAt: now,
      });
      return { id: formatPublicId(created.id), totalAmount, status: "SCHEDULED" };
    });
  }

  async createWeeklyPayouts(now = new Date()): Promise<number> {
    const settings = await this.database.db
      .select({ tenantId: tenants.id })
      .from(tenants);
    const weekKey = weeklyPayoutKey(now);
    let created = 0;
    for (const setting of settings) {
      const idempotencyKey = `weekly:${setting.tenantId}:${weekKey}`;
      const [existing] = await this.database.db
        .select({ id: payoutBatches.id })
        .from(payoutBatches)
        .where(
          and(
            eq(payoutBatches.tenantId, setting.tenantId),
            eq(payoutBatches.idempotencyKey, idempotencyKey),
          ),
        )
        .limit(1);
      if (existing) continue;
      try {
        await this.createPayout(
          formatPublicId(setting.tenantId),
          null,
          idempotencyKey,
          "WEEKLY",
          now,
        );
        created += 1;
      } catch (error) {
        if (error instanceof ApiError && error.code === "PAYOUT_MINIMUM_NOT_MET") {
          continue;
        }
        throw error;
      }
    }
    return created;
  }

  async updatePayoutStatus(
    payoutId: string,
    status: "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED",
    actorUserId: string,
    idempotencyKey: string,
    reason: string,
    now = new Date(),
  ): Promise<void> {
    await this.database.db.transaction(async (transaction) => {
      const payoutDatabaseId = parsePublicId(payoutId);
      const [batchReference] = await transaction
        .select({ tenantId: payoutBatches.tenantId })
        .from(payoutBatches)
        .where(eq(payoutBatches.id, payoutDatabaseId))
        .limit(1);
      if (!batchReference)
        throw new ApiError(404, "PAYOUT_NOT_FOUND", "Payout tidak ditemukan.");
      await lockTenantFinance(transaction, batchReference.tenantId);
      const [batch] = await transaction
        .select()
        .from(payoutBatches)
        .where(eq(payoutBatches.id, payoutDatabaseId))
        .limit(1)
        .for("update");
      if (!batch)
        throw new ApiError(404, "PAYOUT_NOT_FOUND", "Payout tidak ditemukan.");
      const actorDatabaseId = parsePublicId(actorUserId);
      const [existingCommand] = await transaction
        .select({
          resourceId: commandIdempotency.resourceId,
          responseBody: commandIdempotency.responseBody,
        })
        .from(commandIdempotency)
        .where(
          and(
            eq(commandIdempotency.scope, "payout.status"),
            eq(commandIdempotency.actorUserId, actorDatabaseId),
            eq(commandIdempotency.idempotencyKey, idempotencyKey),
          ),
        )
        .limit(1);
      if (existingCommand) {
        if (existingCommand.resourceId === batch.id) {
          const recordedStatus = payoutStatusFromResponse(existingCommand.responseBody);
          const recordedReason = payoutReasonFromResponse(existingCommand.responseBody);
          if (recordedStatus === status && recordedReason === reason) return;
          throw new ApiError(
            409,
            "IDEMPOTENCY_KEY_REUSED",
            recordedStatus === null || recordedReason === null
              ? "Idempotency-Key payout legacy tidak dapat diverifikasi; gunakan key baru."
              : "Idempotency-Key telah digunakan untuk perubahan payout yang berbeda.",
          );
        }
        throw new ApiError(
          409,
          "IDEMPOTENCY_KEY_REUSED",
          "Idempotency-Key telah digunakan untuk payout lain.",
        );
      }
      if (batch.status === status) {
        await transaction.insert(commandIdempotency).values({
          scope: "payout.status",
          idempotencyKey,
          actorUserId: actorDatabaseId,
          resourceId: batch.id,
          responseStatus: 204,
          responseBody: { status, reason },
        });
        return;
      }
      const allowed: Record<string, string[]> = {
        SCHEDULED: ["PROCESSING", "CANCELLED"],
        PROCESSING: ["SUCCEEDED", "FAILED"],
        FAILED: ["PROCESSING", "CANCELLED"],
      };
      if (!allowed[batch.status]?.includes(status)) {
        throw new ApiError(
          409,
          "INVALID_PAYOUT_TRANSITION",
          "Transisi payout tidak valid.",
        );
      }
      await transaction
        .update(payoutBatches)
        .set({ status, updatedAt: now })
        .where(eq(payoutBatches.id, payoutDatabaseId));
      const items = await transaction
        .select()
        .from(payoutItems)
        .where(eq(payoutItems.payoutBatchId, payoutDatabaseId));
      if (status === "SUCCEEDED") {
        await transaction
          .update(ownerEarnings)
          .set({ status: "PAID_OUT", updatedAt: now })
          .where(
            inArray(
              ownerEarnings.id,
              items.map((item) => item.earningId),
            ),
          );
        await this.postLedger(transaction, {
          tenantId: batch.tenantId,
          bookingId: null,
          kind: "PAYOUT_SUCCEEDED",
          idempotencyKey: `payout:${batch.id}`,
          description: "Payout sandbox berhasil",
          entries: [
            { accountCode: "OWNER_PAYABLE", debit: batch.totalAmount, credit: 0 },
            { accountCode: "SANDBOX_PAYOUT", debit: 0, credit: batch.totalAmount },
          ],
        });
      } else if (status === "CANCELLED") {
        await transaction
          .update(ownerEarnings)
          .set({ status: "AVAILABLE", updatedAt: now })
          .where(
            inArray(
              ownerEarnings.id,
              items.map((item) => item.earningId),
            ),
          );
      }
      await this.recordPayoutStatusChange(transaction, {
        batchId: batch.id,
        tenantId: batch.tenantId,
        actorUserId: actorDatabaseId,
        beforeStatus: batch.status,
        status,
        reason,
        now,
      });
      await transaction.insert(commandIdempotency).values({
        scope: "payout.status",
        idempotencyKey,
        actorUserId: actorDatabaseId,
        resourceId: batch.id,
        responseStatus: 204,
        responseBody: { status, reason },
      });
    });
  }

  async financeSummary(
    tenantId: string,
    venueIds?: string[],
  ): Promise<{
    sandbox: true;
    grossRevenue: number;
    onlineRevenue: number;
    offlineRevenue: number;
    totalPaid: number;
    balanceDue: number;
    discounts: number;
    commission: number;
    refunds: number;
    pendingBalance: number;
    availableBalance: number;
    paidOut: number;
    netOwnerRevenue: number;
    dpPaid: number;
    cashRevenue: number;
    gatewayFees: number;
    heldBalance: number;
    trends: Array<{ date: string; paid: number }>;
    venueComparison: Array<{ venueId: string; name: string; paid: number }>;
    courtComparison: Array<{
      courtId: string;
      name: string;
      venueName: string;
      paid: number;
    }>;
  }> {
    const tenantDatabaseId = parsePublicId(tenantId);
    const venueDatabaseIds = venueIds?.map(parsePublicId);
    const bookingScope = and(
      eq(bookings.tenantId, tenantDatabaseId),
      venueDatabaseIds
        ? venueDatabaseIds.length > 0
          ? inArray(bookings.venueId, venueDatabaseIds)
          : sql`false`
        : undefined,
    );
    const latestSnapshots = this.database.db
      .select({
        bookingId: bookingFinancialSnapshots.bookingId,
        latestBookingVersion:
          sql<number>`max(${bookingFinancialSnapshots.bookingVersion})`.as(
            "latest_booking_version",
          ),
      })
      .from(bookingFinancialSnapshots)
      .groupBy(bookingFinancialSnapshots.bookingId)
      .as("latest_financial_snapshots");
    const bookingRows = await this.database.db
      .select({
        booking: bookings,
        snapshot: bookingFinancialSnapshots,
        payment: bookingPaymentSummaries,
      })
      .from(bookings)
      .leftJoin(latestSnapshots, eq(latestSnapshots.bookingId, bookings.id))
      .leftJoin(
        bookingFinancialSnapshots,
        and(
          eq(bookingFinancialSnapshots.bookingId, latestSnapshots.bookingId),
          eq(
            bookingFinancialSnapshots.bookingVersion,
            latestSnapshots.latestBookingVersion,
          ),
        ),
      )
      .leftJoin(
        bookingPaymentSummaries,
        eq(bookingPaymentSummaries.bookingId, bookings.id),
      )
      .where(bookingScope);
    const earningRows = (
      await this.database.db
        .select({ earning: ownerEarnings })
        .from(ownerEarnings)
        .innerJoin(bookings, eq(bookings.id, ownerEarnings.bookingId))
        .where(bookingScope)
    ).map((row) => row.earning);
    const refundRows = await this.database.db
      .select({ amount: refunds.amount })
      .from(refunds)
      .innerJoin(bookings, eq(bookings.id, refunds.bookingId))
      .where(and(bookingScope, eq(refunds.status, "SUCCEEDED")));
    const comparisonRows = await this.database.db
      .select({
        bookingId: bookings.id,
        itemId: bookingItems.id,
        venueId: venues.id,
        venueName: venues.name,
        courtId: courts.id,
        courtName: courts.name,
        itemSubtotal: bookingItems.subtotal,
        paid: bookingPaymentSummaries.totalPaid,
      })
      .from(bookings)
      .innerJoin(bookingItems, eq(bookingItems.bookingId, bookings.id))
      .innerJoin(courts, eq(courts.id, bookingItems.courtId))
      .innerJoin(venues, eq(venues.id, bookings.venueId))
      .leftJoin(
        bookingPaymentSummaries,
        eq(bookingPaymentSummaries.bookingId, bookings.id),
      )
      .where(bookingScope);
    const trends = new Map<string, number>();
    const venueTotals = new Map<number, { name: string; paid: number }>();
    const courtTotals = new Map<
      number,
      { name: string; venueName: string; paid: number }
    >();
    const comparisonRowsByBooking = new Map<number, typeof comparisonRows>();
    for (const row of bookingRows) {
      const date = row.booking.createdAt.toISOString().slice(0, 10);
      trends.set(date, (trends.get(date) ?? 0) + (row.payment?.totalPaid ?? 0));
    }
    for (const row of comparisonRows) {
      const rows = comparisonRowsByBooking.get(row.bookingId) ?? [];
      rows.push(row);
      comparisonRowsByBooking.set(row.bookingId, rows);
    }
    for (const rows of comparisonRowsByBooking.values()) {
      const sortedRows = [...rows].sort((left, right) => left.itemId - right.itemId);
      const first = sortedRows[0];
      if (!first) continue;
      const paid = first.paid ?? 0;
      venueTotals.set(first.venueId, {
        name: first.venueName,
        paid: (venueTotals.get(first.venueId)?.paid ?? 0) + paid,
      });
      const totalSubtotal = sumBy(sortedRows, (row) => row.itemSubtotal);
      let allocated = 0;
      sortedRows.forEach((row, index) => {
        const courtPaid =
          index === sortedRows.length - 1
            ? paid - allocated
            : totalSubtotal > 0
              ? Math.floor((paid * row.itemSubtotal) / totalSubtotal)
              : 0;
        allocated += courtPaid;
        courtTotals.set(row.courtId, {
          name: row.courtName,
          venueName: row.venueName,
          paid: (courtTotals.get(row.courtId)?.paid ?? 0) + courtPaid,
        });
      });
    }
    return {
      sandbox: true,
      grossRevenue:
        sumBy(
          bookingRows,
          (row) => row.snapshot?.courtSubtotal ?? row.booking.totalAmount,
        ) + sumBy(bookingRows, (row) => row.snapshot?.addonSubtotal ?? 0),
      onlineRevenue: sumBy(
        bookingRows.filter((row) => row.booking.source === "ONLINE"),
        (row) => row.payment?.totalPaid ?? 0,
      ),
      offlineRevenue: sumBy(
        bookingRows.filter((row) => row.booking.source === "OFFLINE"),
        (row) => row.payment?.totalPaid ?? 0,
      ),
      totalPaid: sumBy(bookingRows, (row) => row.payment?.totalPaid ?? 0),
      balanceDue: sumBy(
        bookingRows,
        (row) => row.payment?.balanceDue ?? row.booking.balanceDue,
      ),
      discounts: sumBy(
        bookingRows,
        (row) =>
          (row.snapshot?.ownerDiscount ?? 0) + (row.snapshot?.platformDiscount ?? 0),
      ),
      commission: await this.recognizedCommission(bookingScope),
      refunds: sumBy(refundRows, (row) => row.amount),
      pendingBalance: sumBy(
        earningRows.filter(
          (row) => row.status === "PENDING" || row.status === "RESERVED_FOR_PAYOUT",
        ),
        (row) => row.amount,
      ),
      availableBalance: sumBy(
        earningRows.filter((row) => row.status === "AVAILABLE"),
        (row) => row.amount,
      ),
      paidOut: sumBy(
        earningRows.filter((row) => row.status === "PAID_OUT"),
        (row) => row.amount,
      ),
      netOwnerRevenue: sumBy(
        earningRows.filter((row) => row.status !== "REVERSED"),
        (row) => row.amount,
      ),
      dpPaid: sumBy(
        bookingRows.filter((row) => row.booking.paymentMode === "DP"),
        (row) => row.payment?.totalPaid ?? 0,
      ),
      cashRevenue: sumBy(
        bookingRows.filter(
          (row) =>
            row.booking.source === "OFFLINE" ||
            row.booking.paymentMode === "PAY_AT_VENUE",
        ),
        (row) => row.payment?.totalPaid ?? 0,
      ),
      gatewayFees: sumBy(bookingRows, (row) => row.snapshot?.gatewayFee ?? 0),
      heldBalance: sumBy(
        earningRows.filter(
          (row) => row.status === "PENDING" || row.status === "RESERVED_FOR_PAYOUT",
        ),
        (row) => row.amount,
      ),
      trends: [...trends]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, paid]) => ({ date, paid })),
      venueComparison: [...venueTotals].map(([venueId, value]) => ({
        venueId: formatPublicId(venueId),
        ...value,
      })),
      courtComparison: [...courtTotals].map(([courtId, value]) => ({
        courtId: formatPublicId(courtId),
        ...value,
      })),
    };
  }

  async listLedger(tenantId?: string, limit = 50, venueIds?: string[]) {
    const venueDatabaseIds = venueIds?.map(parsePublicId);
    const transactionRows = await this.database.db
      .select({ transaction: ledgerTransactions })
      .from(ledgerTransactions)
      .leftJoin(bookings, eq(bookings.id, ledgerTransactions.bookingId))
      .where(
        and(
          tenantId
            ? eq(ledgerTransactions.tenantId, parsePublicId(tenantId))
            : undefined,
          venueDatabaseIds
            ? venueDatabaseIds.length > 0
              ? inArray(bookings.venueId, venueDatabaseIds)
              : sql`false`
            : undefined,
        ),
      )
      .orderBy(desc(ledgerTransactions.id))
      .limit(limit);
    if (transactionRows.length === 0) return [];
    const entryRows = await this.database.db
      .select()
      .from(ledgerEntries)
      .where(
        inArray(
          ledgerEntries.transactionId,
          transactionRows.map((row) => row.transaction.id),
        ),
      );
    const entriesByTransaction = new Map<number, typeof entryRows>();
    for (const entry of entryRows) {
      const entries = entriesByTransaction.get(entry.transactionId) ?? [];
      entries.push(entry);
      entriesByTransaction.set(entry.transactionId, entries);
    }
    return transactionRows.map(({ transaction }) => ({
      id: formatPublicId(transaction.id),
      kind: transaction.kind,
      description: transaction.description,
      createdAt: transaction.createdAt.toISOString(),
      entries: (entriesByTransaction.get(transaction.id) ?? []).map((entry) => ({
        accountCode: entry.accountCode,
        debit: entry.debit,
        credit: entry.credit,
      })),
    }));
  }

  async listPayouts(tenantId?: string, venueIds?: string[]) {
    const rows = await this.database.db
      .select()
      .from(payoutBatches)
      .where(tenantId ? eq(payoutBatches.tenantId, parsePublicId(tenantId)) : undefined)
      .orderBy(desc(payoutBatches.id));
    if (!venueIds) return rows.map(payoutView);
    if (venueIds.length === 0 || rows.length === 0) return [];
    const batchIds = rows.map((row) => row.id);
    const itemVenues = await this.database.db
      .select({ batchId: payoutItems.payoutBatchId, venueId: bookings.venueId })
      .from(payoutItems)
      .innerJoin(ownerEarnings, eq(ownerEarnings.id, payoutItems.earningId))
      .innerJoin(bookings, eq(bookings.id, ownerEarnings.bookingId))
      .where(inArray(payoutItems.payoutBatchId, batchIds));
    const allowed = new Set(venueIds.map(parsePublicId));
    const visibleBatchIds = new Set(
      rows
        .filter((batch) => {
          const venuesInBatch = itemVenues.filter((row) => row.batchId === batch.id);
          return (
            venuesInBatch.length > 0 &&
            venuesInBatch.every((row) => allowed.has(row.venueId))
          );
        })
        .map((batch) => batch.id),
    );
    return rows.filter((row) => visibleBatchIds.has(row.id)).map(payoutView);
  }

  async listPayments(tenantId: string, venueIds?: string[]) {
    return this.exportRows(parsePublicId(tenantId), "payments", venueIds);
  }

  async getFinanceSettings(tenantId: string) {
    const [settings] = await this.database.db
      .select()
      .from(tenantFinanceSettings)
      .where(eq(tenantFinanceSettings.tenantId, parsePublicId(tenantId)))
      .limit(1);
    return {
      minimumPayoutAmount: settings?.minimumPayoutAmount ?? 100_000,
      manualPayoutEnabled: settings?.manualPayoutEnabled ?? true,
      payoutAccountLabel: settings?.payoutAccountLabel ?? null,
      payoutAccountLast4: settings?.payoutAccountLast4 ?? null,
      sandbox: true as const,
    };
  }

  async updateFinanceSettings(
    tenantId: string,
    input: {
      minimumPayoutAmount: number;
      manualPayoutEnabled: boolean;
      payoutAccountLabel?: string | null | undefined;
      payoutAccountLast4?: string | null | undefined;
    },
    actorUserId?: string,
    reason = "Pengaturan finance diperbarui",
    auditContext: RequestAuditContext = {},
  ): Promise<void> {
    await this.database.db.transaction(async (transaction) => {
      const tenantDatabaseId = parsePublicId(tenantId);
      const [before] = await transaction
        .select()
        .from(tenantFinanceSettings)
        .where(eq(tenantFinanceSettings.tenantId, tenantDatabaseId))
        .limit(1);
      await transaction
        .insert(tenantFinanceSettings)
        .values({ tenantId: tenantDatabaseId, ...input })
        .onDuplicateKeyUpdate({ set: { ...input, updatedAt: new Date() } });
      await transaction.insert(auditLogs).values({
        tenantId: tenantDatabaseId,
        actorUserId: actorUserId ? parsePublicId(actorUserId) : null,
        action: "finance.settings_updated",
        resourceType: "tenant_finance",
        resourceId: tenantDatabaseId,
        reason,
        beforeState: before ?? null,
        afterState: input,
        ...auditContext,
      });
    });
  }

  async exportFinance(
    tenantId: string,
    dataset:
      | "bookings"
      | "payments"
      | "refunds"
      | "payouts"
      | "promotions"
      | "staff-activity"
      | "offline-bookings",
    format: "csv" | "xlsx",
    venueIds?: string[],
  ): Promise<{ contentType: string; filename: string; body: Buffer }> {
    const rows = await this.exportRows(parsePublicId(tenantId), dataset, venueIds);
    const columns = rows.length > 0 ? Object.keys(rows[0]!) : ["status"];
    const normalizedRows = rows.length > 0 ? rows : [{ status: "Tidak ada data" }];
    const filename = `lapangango-sandbox-${dataset}.${format}`;
    if (format === "csv") {
      const csv = [
        columns.join(","),
        ...normalizedRows.map((row) =>
          columns.map((column) => csvCell(row[column])).join(","),
        ),
      ].join("\r\n");
      return {
        contentType: "text/csv; charset=utf-8",
        filename,
        body: Buffer.from(`\uFEFF${csv}`, "utf8"),
      };
    }
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "LapanganGo Sandbox";
    const sheet = workbook.addWorksheet("Simulasi");
    sheet.columns = columns.map((column) => ({ header: column, key: column }));
    sheet.addRows(normalizedRows);
    const buffer = await workbook.xlsx.writeBuffer();
    return {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename,
      body: Buffer.from(buffer),
    };
  }

  async createCommissionConfig(
    input: {
      tenantId: string | null;
      rateBasisPoints: number;
      effectiveFrom: Date;
      effectiveTo?: Date | undefined;
      trialDays?: number | undefined;
      trialCompletedBookingLimit?: number | undefined;
      gatewayFeeFunding: "OWNER" | "PLATFORM";
      gatewayFeeBasisPoints?: number | undefined;
      subsidyBudget?: number | undefined;
      reason: string;
      actorUserId: string;
      idempotencyKey: string;
    },
    auditContext: RequestAuditContext = {},
  ) {
    return this.database.db.transaction(async (transaction) => {
      const actorUserId = parsePublicId(input.actorUserId);
      const tenantDatabaseId = input.tenantId ? parsePublicId(input.tenantId) : null;
      const scope = tenantCommandScope("commission.create", input.tenantId);
      const fingerprint = commissionCommandFingerprint(input, tenantDatabaseId);
      const [existing] = await transaction
        .select({
          resourceId: commandIdempotency.resourceId,
          responseBody: commandIdempotency.responseBody,
          config: commissionConfigs,
        })
        .from(commandIdempotency)
        .innerJoin(
          commissionConfigs,
          eq(commissionConfigs.id, commandIdempotency.resourceId),
        )
        .where(
          and(
            eq(commandIdempotency.scope, scope),
            eq(commandIdempotency.actorUserId, actorUserId),
            eq(commandIdempotency.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      if (existing?.resourceId) {
        assertCommandReplay(
          existing.responseBody,
          fingerprint,
          commissionConfigMatches(
            existing.config,
            input,
            tenantDatabaseId,
            actorUserId,
          ),
        );
        return { id: formatPublicId(existing.resourceId) };
      }
      const [legacy] = await transaction
        .select({
          resourceId: commandIdempotency.resourceId,
          responseBody: commandIdempotency.responseBody,
          config: commissionConfigs,
        })
        .from(commandIdempotency)
        .innerJoin(
          commissionConfigs,
          eq(commissionConfigs.id, commandIdempotency.resourceId),
        )
        .where(
          and(
            eq(commandIdempotency.scope, "commission.create"),
            eq(commandIdempotency.actorUserId, actorUserId),
            eq(commandIdempotency.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      if (legacy?.resourceId && legacy.config.tenantId === tenantDatabaseId) {
        assertCommandReplay(
          legacy.responseBody,
          fingerprint,
          commissionConfigMatches(legacy.config, input, tenantDatabaseId, actorUserId),
        );
        return { id: formatPublicId(legacy.resourceId) };
      }
      try {
        await transaction.insert(commandIdempotency).values({
          scope,
          idempotencyKey: input.idempotencyKey,
          actorUserId,
          responseBody: { fingerprint },
        });
      } catch (error) {
        if (!isDuplicateEntry(error)) throw error;
        const [concurrent] = await transaction
          .select({
            resourceId: commandIdempotency.resourceId,
            responseBody: commandIdempotency.responseBody,
            config: commissionConfigs,
          })
          .from(commandIdempotency)
          .innerJoin(
            commissionConfigs,
            eq(commissionConfigs.id, commandIdempotency.resourceId),
          )
          .where(
            and(
              eq(commandIdempotency.scope, scope),
              eq(commandIdempotency.actorUserId, actorUserId),
              eq(commandIdempotency.idempotencyKey, input.idempotencyKey),
            ),
          )
          .limit(1)
          .for("update");
        if (!concurrent?.resourceId) throw error;
        assertCommandReplay(
          concurrent.responseBody,
          fingerprint,
          commissionConfigMatches(
            concurrent.config,
            input,
            tenantDatabaseId,
            actorUserId,
          ),
        );
        return { id: formatPublicId(concurrent.resourceId) };
      }
      const createdRows = await transaction
        .insert(commissionConfigs)
        .values({
          tenantId: tenantDatabaseId,
          rateBasisPoints: input.rateBasisPoints,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: input.effectiveTo,
          trialDays: input.trialDays,
          trialCompletedBookingLimit: input.trialCompletedBookingLimit,
          gatewayFeeFunding: input.gatewayFeeFunding,
          gatewayFeeBasisPoints: input.gatewayFeeBasisPoints ?? 250,
          subsidyBudget: input.subsidyBudget,
          reason: input.reason,
          createdByUserId: actorUserId,
        })
        .$returningId();
      const created = createdRows[0];
      if (!created) throw new Error("MySQL tidak mengembalikan ID commission config.");
      await transaction.insert(auditLogs).values({
        tenantId: input.tenantId ? parsePublicId(input.tenantId) : null,
        actorUserId,
        action: "commission.config_created",
        resourceType: "commission_config",
        resourceId: created.id,
        reason: input.reason,
        afterState: {
          rateBasisPoints: input.rateBasisPoints,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: input.effectiveTo ?? null,
        },
        ...auditContext,
      });
      await transaction
        .update(commandIdempotency)
        .set({
          resourceId: created.id,
          responseStatus: 201,
          responseBody: { id: formatPublicId(created.id), fingerprint },
        })
        .where(
          and(
            eq(commandIdempotency.scope, scope),
            eq(commandIdempotency.actorUserId, actorUserId),
            eq(commandIdempotency.idempotencyKey, input.idempotencyKey),
          ),
        );
      return { id: formatPublicId(created.id) };
    });
  }

  async listCommissionConfigs() {
    const rows = await this.database.db
      .select()
      .from(commissionConfigs)
      .orderBy(desc(commissionConfigs.effectiveFrom));
    return rows.map((row) => ({
      ...row,
      id: formatPublicId(row.id),
      tenantId: row.tenantId ? formatPublicId(row.tenantId) : null,
    }));
  }

  async createPromotion(input: PromotionInput, auditContext: RequestAuditContext = {}) {
    const normalizedCode = input.code.trim().toUpperCase();
    if (input.endsAt <= input.startsAt) {
      throw new ApiError(
        422,
        "PROMOTION_PERIOD_INVALID",
        "Akhir periode promo harus setelah waktu mulai.",
      );
    }
    if (
      input.startsAtTime &&
      input.endsAtTime &&
      input.endsAtTime <= input.startsAtTime
    ) {
      throw new ApiError(
        422,
        "PROMOTION_HOURS_INVALID",
        "Jam akhir promo harus setelah jam mulai.",
      );
    }
    const created = await this.database.db.transaction(async (transaction) => {
      if (!input.actorUserId) {
        throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Akun aktif diperlukan.");
      }
      const actorUserId = parsePublicId(input.actorUserId);
      const tenantDatabaseId = input.tenantId ? parsePublicId(input.tenantId) : null;
      const scope = tenantCommandScope("promotion.create", input.tenantId);
      const fingerprint = promotionCommandFingerprint(
        input,
        normalizedCode,
        tenantDatabaseId,
      );
      await this.validatePromotionScopes(transaction, input, tenantDatabaseId);
      const [existing] = await transaction
        .select({
          resourceId: commandIdempotency.resourceId,
          responseBody: commandIdempotency.responseBody,
          promotion: promotions,
        })
        .from(commandIdempotency)
        .innerJoin(promotions, eq(promotions.id, commandIdempotency.resourceId))
        .where(
          and(
            eq(commandIdempotency.scope, scope),
            eq(commandIdempotency.actorUserId, actorUserId),
            eq(commandIdempotency.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      if (existing?.resourceId) {
        await this.assertPromotionCommandReplay(
          transaction,
          existing.promotion,
          existing.responseBody,
          input,
          normalizedCode,
          tenantDatabaseId,
          fingerprint,
        );
        return {
          id: existing.resourceId,
          code: existing.promotion.code ?? normalizedCode,
        };
      }
      const [legacy] = await transaction
        .select({
          resourceId: commandIdempotency.resourceId,
          responseBody: commandIdempotency.responseBody,
          promotion: promotions,
        })
        .from(commandIdempotency)
        .innerJoin(promotions, eq(promotions.id, commandIdempotency.resourceId))
        .where(
          and(
            eq(commandIdempotency.scope, "promotion.create"),
            eq(commandIdempotency.actorUserId, actorUserId),
            eq(commandIdempotency.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      if (legacy?.resourceId && legacy.promotion.tenantId === tenantDatabaseId) {
        await this.assertPromotionCommandReplay(
          transaction,
          legacy.promotion,
          legacy.responseBody,
          input,
          normalizedCode,
          tenantDatabaseId,
          fingerprint,
        );
        return {
          id: legacy.resourceId,
          code: legacy.promotion.code ?? normalizedCode,
        };
      }
      try {
        await transaction.insert(commandIdempotency).values({
          scope,
          idempotencyKey: input.idempotencyKey,
          actorUserId,
          responseBody: { fingerprint },
        });
      } catch (error) {
        if (!isDuplicateEntry(error)) throw error;
        const [concurrent] = await transaction
          .select({
            resourceId: commandIdempotency.resourceId,
            responseBody: commandIdempotency.responseBody,
            promotion: promotions,
          })
          .from(commandIdempotency)
          .innerJoin(promotions, eq(promotions.id, commandIdempotency.resourceId))
          .where(
            and(
              eq(commandIdempotency.scope, scope),
              eq(commandIdempotency.actorUserId, actorUserId),
              eq(commandIdempotency.idempotencyKey, input.idempotencyKey),
            ),
          )
          .limit(1)
          .for("update");
        if (!concurrent?.resourceId) throw error;
        await this.assertPromotionCommandReplay(
          transaction,
          concurrent.promotion,
          concurrent.responseBody,
          input,
          normalizedCode,
          tenantDatabaseId,
          fingerprint,
        );
        return {
          id: concurrent.resourceId,
          code: concurrent.promotion.code ?? normalizedCode,
        };
      }
      const createdRows = await transaction
        .insert(promotions)
        .values({
          tenantId: tenantDatabaseId,
          code: normalizedCode,
          name: input.name,
          description: input.description,
          status: "ACTIVE",
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          startsAtTime: input.startsAtTime,
          endsAtTime: input.endsAtTime,
          discountType: input.discountType,
          discountValue: input.discountValue,
          minimumAmount: input.minimumAmount ?? 0,
          maximumDiscount: input.maximumDiscount,
          quota: input.quota,
          perUserLimit: input.perUserLimit ?? 1,
          firstBookingOnly: input.firstBookingOnly ?? false,
          paymentMethod: input.paymentMethod,
          fundingSource: input.fundingSource,
          budgetAmount: input.budgetAmount,
          discoveryOnly: false,
        })
        .$returningId();
      const result = createdRows[0];
      if (!result) throw new Error("MySQL tidak mengembalikan ID promo.");
      if (input.scopes?.length) {
        await transaction.insert(promotionScopes).values(
          input.scopes.map((scope) => ({
            promotionId: result.id,
            scopeType: scope.type,
            scopeReferenceId: parsePublicId(scope.referenceId),
            includeExclude: "INCLUDE",
          })),
        );
      }
      await transaction.insert(auditLogs).values({
        tenantId: input.tenantId ? parsePublicId(input.tenantId) : null,
        actorUserId,
        action: "promotion.created",
        resourceType: "promotion",
        resourceId: result.id,
        reason: input.reason ?? "Promo dibuat",
        afterState: {
          code: normalizedCode,
          fundingSource: input.fundingSource,
          budgetAmount: input.budgetAmount ?? null,
          quota: input.quota ?? null,
        },
        ...auditContext,
      });
      await transaction
        .update(commandIdempotency)
        .set({
          resourceId: result.id,
          responseStatus: 201,
          responseBody: {
            id: formatPublicId(result.id),
            code: normalizedCode,
            fingerprint,
          },
        })
        .where(
          and(
            eq(commandIdempotency.scope, scope),
            eq(commandIdempotency.actorUserId, actorUserId),
            eq(commandIdempotency.idempotencyKey, input.idempotencyKey),
          ),
        );
      return { id: result.id, code: normalizedCode };
    });
    return { id: formatPublicId(created.id), code: created.code };
  }

  private async assertPromotionCommandReplay(
    transaction: Transaction,
    promotion: typeof promotions.$inferSelect,
    responseBody: unknown,
    input: PromotionInput,
    normalizedCode: string,
    tenantId: number | null,
    fingerprint: string,
  ): Promise<void> {
    const scopes = await transaction
      .select({
        type: promotionScopes.scopeType,
        referenceId: promotionScopes.scopeReferenceId,
      })
      .from(promotionScopes)
      .where(eq(promotionScopes.promotionId, promotion.id));
    assertCommandReplay(
      responseBody,
      fingerprint,
      promotionMatches(promotion, scopes, input, normalizedCode, tenantId),
    );
  }

  async listPromotions(tenantId?: string, allowedVenueIds?: string[]) {
    if (allowedVenueIds?.length === 0) return [];
    const rows = await this.database.db
      .select()
      .from(promotions)
      .where(
        tenantId
          ? or(
              isNull(promotions.tenantId),
              eq(promotions.tenantId, parsePublicId(tenantId)),
            )
          : undefined,
      )
      .orderBy(desc(promotions.startsAt));
    const visibleRows = allowedVenueIds
      ? await this.filterPromotionsForVenues(rows, allowedVenueIds)
      : rows;
    return visibleRows.map((row) => ({
      ...row,
      id: formatPublicId(row.id),
      tenantId: row.tenantId ? formatPublicId(row.tenantId) : null,
    }));
  }

  private async validatePromotionScopes(
    transaction: Transaction,
    input: PromotionInput,
    tenantId: number | null,
  ): Promise<void> {
    const scopes = input.scopes ?? [];
    const venueIds = scopes
      .filter((scope) => scope.type === "VENUE")
      .map((scope) => parsePublicId(scope.referenceId));
    const courtIds = scopes
      .filter((scope) => scope.type === "COURT")
      .map((scope) => parsePublicId(scope.referenceId));
    const sportIds = scopes
      .filter((scope) => scope.type === "SPORT")
      .map((scope) => parsePublicId(scope.referenceId));
    const venueRows = venueIds.length
      ? await transaction
          .select({ id: venues.id, tenantId: venues.tenantId })
          .from(venues)
          .where(inArray(venues.id, venueIds))
      : [];
    const courtRows = courtIds.length
      ? await transaction
          .select({ id: courts.id, venueId: courts.venueId, tenantId: venues.tenantId })
          .from(courts)
          .innerJoin(venues, eq(venues.id, courts.venueId))
          .where(inArray(courts.id, courtIds))
      : [];
    const sportRows = sportIds.length
      ? await transaction
          .select({ id: sports.id })
          .from(sports)
          .where(inArray(sports.id, sportIds))
      : [];
    if (
      venueRows.length !== new Set(venueIds).size ||
      courtRows.length !== new Set(courtIds).size ||
      sportRows.length !== new Set(sportIds).size ||
      (tenantId !== null &&
        [...venueRows, ...courtRows].some((row) => row.tenantId !== tenantId))
    ) {
      throw new ApiError(
        404,
        "PROMOTION_SCOPE_NOT_FOUND",
        "Scope promo tidak ditemukan pada workspace aktif.",
      );
    }
    if (input.allowedVenueIds === undefined) return;
    const allowedVenueIds = new Set(input.allowedVenueIds.map(parsePublicId));
    const scopedVenueIds = new Set([
      ...venueRows.map((row) => row.id),
      ...courtRows.map((row) => row.venueId),
    ]);
    if (
      allowedVenueIds.size === 0 ||
      scopedVenueIds.size === 0 ||
      [...scopedVenueIds].some((venueId) => !allowedVenueIds.has(venueId))
    ) {
      throw new ApiError(
        403,
        "PROMOTION_VENUE_ACCESS_DENIED",
        "Staff hanya dapat mengelola promo untuk venue yang ditugaskan.",
      );
    }
  }

  private async filterPromotionsForVenues<TRow extends { id: number }>(
    rows: TRow[],
    allowedVenueIds: string[],
  ): Promise<TRow[]> {
    if (rows.length === 0) return [];
    const venueIds = allowedVenueIds.map(parsePublicId);
    const [scopeRows, courtRows, sportRows] = await Promise.all([
      this.database.db
        .select()
        .from(promotionScopes)
        .where(
          inArray(
            promotionScopes.promotionId,
            rows.map((row) => row.id),
          ),
        ),
      this.database.db
        .select({ id: courts.id, venueId: courts.venueId })
        .from(courts)
        .where(inArray(courts.venueId, venueIds)),
      this.database.db
        .select({ venueId: venueSports.venueId, sportId: venueSports.sportId })
        .from(venueSports)
        .where(inArray(venueSports.venueId, venueIds)),
    ]);
    return rows.filter((promotion) => {
      const scopes = scopeRows.filter((scope) => scope.promotionId === promotion.id);
      if (scopes.length === 0) return true;
      return venueIds.some((venueId) => {
        const courtsAtVenue = new Set(
          courtRows
            .filter((court) => court.venueId === venueId)
            .map((court) => court.id),
        );
        const sportsAtVenue = new Set(
          sportRows
            .filter((sport) => sport.venueId === venueId)
            .map((sport) => sport.sportId),
        );
        return ["VENUE", "COURT", "SPORT"].every((scopeType) => {
          const typedScopes = scopes.filter((scope) => scope.scopeType === scopeType);
          if (typedScopes.length === 0) return true;
          if (scopeType === "VENUE") {
            return typedScopes.some((scope) => scope.scopeReferenceId === venueId);
          }
          const allowedReferences =
            scopeType === "COURT" ? courtsAtVenue : sportsAtVenue;
          return typedScopes.some(
            (scope) =>
              scope.scopeReferenceId !== null &&
              allowedReferences.has(scope.scopeReferenceId),
          );
        });
      });
    });
  }

  private async resolveCommission(
    transaction: Transaction,
    tenantId: number,
    now: Date,
  ): Promise<{
    id: number | null;
    rateBasisPoints: number;
    gatewayFeeFunding: "OWNER" | "PLATFORM";
    gatewayFeeBasisPoints: number;
    subsidyBudget: number | null;
    subsidyUsed: number;
  }> {
    const activeWindow = and(
      lte(commissionConfigs.effectiveFrom, now),
      or(
        isNull(commissionConfigs.effectiveTo),
        gte(commissionConfigs.effectiveTo, now),
      ),
    );
    const [tenantConfig] = await transaction
      .select()
      .from(commissionConfigs)
      .where(and(eq(commissionConfigs.tenantId, tenantId), activeWindow))
      .orderBy(desc(commissionConfigs.effectiveFrom))
      .limit(1)
      .for("update");
    const [defaultConfig] = tenantConfig
      ? [tenantConfig]
      : await transaction
          .select()
          .from(commissionConfigs)
          .where(and(isNull(commissionConfigs.tenantId), activeWindow))
          .orderBy(desc(commissionConfigs.effectiveFrom))
          .limit(1)
          .for("update");
    const config = tenantConfig ?? defaultConfig;
    if (!config)
      return {
        id: null,
        rateBasisPoints: 0,
        gatewayFeeFunding: "OWNER",
        gatewayFeeBasisPoints: 250,
        subsidyBudget: null,
        subsidyUsed: 0,
      };
    let rateBasisPoints = config.rateBasisPoints;
    let trialActive = false;
    if (config.trialDays !== null || config.trialCompletedBookingLimit !== null) {
      const [tenant] = await transaction
        .select({ createdAt: tenants.createdAt })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
      const [completedRow] = await transaction
        .select({ completed: sql<number>`count(*)` })
        .from(bookings)
        .where(and(eq(bookings.tenantId, tenantId), eq(bookings.status, "COMPLETED")));
      const withinDays =
        config.trialDays === null ||
        Boolean(
          tenant &&
          now.getTime() < tenant.createdAt.getTime() + config.trialDays * 86_400_000,
        );
      const withinBookings =
        config.trialCompletedBookingLimit === null ||
        Number(completedRow?.completed ?? 0) < config.trialCompletedBookingLimit;
      trialActive = withinDays && withinBookings;
      if (trialActive) rateBasisPoints = 0;
    }
    return {
      id: config.id,
      rateBasisPoints,
      gatewayFeeFunding:
        trialActive && config.gatewayFeeFunding === "PLATFORM" ? "PLATFORM" : "OWNER",
      gatewayFeeBasisPoints: config.gatewayFeeBasisPoints,
      subsidyBudget: config.subsidyBudget,
      subsidyUsed: config.subsidyUsed,
    };
  }

  private async reserveGatewaySubsidy(
    transaction: Transaction,
    commission: {
      id: number | null;
      subsidyBudget: number | null;
      subsidyUsed: number;
    },
    gatewayFee: number,
  ): Promise<void> {
    if (
      commission.id === null ||
      commission.subsidyBudget === null ||
      commission.subsidyUsed + gatewayFee > commission.subsidyBudget
    ) {
      throw new ApiError(
        409,
        "GATEWAY_SUBSIDY_EXHAUSTED",
        "Budget subsidi gateway fee telah habis.",
      );
    }
    await transaction
      .update(commissionConfigs)
      .set({ subsidyUsed: sql`${commissionConfigs.subsidyUsed} + ${gatewayFee}` })
      .where(eq(commissionConfigs.id, commission.id));
  }

  private async resolvePromotion(
    transaction: Transaction,
    input: {
      tenantId: number;
      venueId: number;
      courtId: number;
      sportId: number;
      userId: number;
      paymentMode: string;
      courtSubtotal: number;
      addonSubtotal: number;
      promotionCode?: string | undefined;
      timezone: string;
      now: Date;
    },
  ) {
    const [promotion] = await transaction
      .select()
      .from(promotions)
      .where(eq(promotions.code, input.promotionCode!.trim().toUpperCase()))
      .limit(1)
      .for("update");
    const gross = input.courtSubtotal + input.addonSubtotal;
    const localTime = datePartsInTimeZone(input.now, input.timezone).localTime;
    if (
      !promotion ||
      promotion.discoveryOnly ||
      promotion.status !== "ACTIVE" ||
      promotion.startsAt > input.now ||
      promotion.endsAt < input.now ||
      (promotion.tenantId !== null && promotion.tenantId !== input.tenantId) ||
      gross < promotion.minimumAmount ||
      (promotion.paymentMethod && promotion.paymentMethod !== input.paymentMode) ||
      (promotion.startsAtTime !== null && localTime < promotion.startsAtTime) ||
      (promotion.endsAtTime !== null && localTime >= promotion.endsAtTime) ||
      (promotion.quota !== null && promotion.quotaUsed >= promotion.quota)
    ) {
      throw new ApiError(
        409,
        "PROMOTION_NOT_ELIGIBLE",
        "Kode promo tidak dapat digunakan.",
      );
    }
    const scopes = await transaction
      .select()
      .from(promotionScopes)
      .where(eq(promotionScopes.promotionId, promotion.id));
    const scopeValues: Record<string, number> = {
      VENUE: input.venueId,
      COURT: input.courtId,
      SPORT: input.sportId,
    };
    const includedScopes = scopes.filter((scope) => scope.includeExclude === "INCLUDE");
    const scopeTypes = new Set(includedScopes.map((scope) => scope.scopeType));
    if (
      [...scopeTypes].some(
        (scopeType) =>
          !includedScopes.some(
            (scope) =>
              scope.scopeType === scopeType &&
              scope.scopeReferenceId === scopeValues[scopeType],
          ),
      )
    ) {
      throw new ApiError(
        409,
        "PROMOTION_SCOPE_MISMATCH",
        "Promo tidak berlaku untuk pilihan ini.",
      );
    }
    const [redemptionCount] = await transaction
      .select({ total: sql<number>`count(*)` })
      .from(promotionRedemptions)
      .where(
        and(
          eq(promotionRedemptions.promotionId, promotion.id),
          eq(promotionRedemptions.userId, input.userId),
          inArray(promotionRedemptions.status, ["RESERVED", "CONSUMED"]),
        ),
      );
    if (Number(redemptionCount?.total ?? 0) >= promotion.perUserLimit) {
      throw new ApiError(
        409,
        "PROMOTION_USER_LIMIT",
        "Batas penggunaan promo tercapai.",
      );
    }
    if (promotion.firstBookingOnly) {
      const [bookingCount] = await transaction
        .select({ bookingsTotal: sql<number>`count(*)` })
        .from(bookings)
        .where(eq(bookings.customerUserId, input.userId));
      if (Number(bookingCount?.bookingsTotal ?? 0) > 0) {
        throw new ApiError(
          409,
          "PROMOTION_FIRST_BOOKING_ONLY",
          "Promo hanya untuk booking pertama.",
        );
      }
    }
    const discount = discountForPromotion(promotion, gross);
    if (
      promotion.fundingSource === "PLATFORM" &&
      (promotion.budgetAmount === null ||
        promotion.budgetUsed + discount > promotion.budgetAmount)
    ) {
      throw new ApiError(
        409,
        "PROMOTION_BUDGET_EXHAUSTED",
        "Budget promo telah habis.",
      );
    }
    return promotion;
  }

  private async postLedger(
    transaction: Transaction,
    input: {
      tenantId: number | null;
      bookingId: number | null;
      kind: string;
      idempotencyKey: string;
      description: string;
      entries: LedgerEntryInput[];
    },
  ): Promise<void> {
    const debit = sumBy(input.entries, (entry) => entry.debit);
    const credit = sumBy(input.entries, (entry) => entry.credit);
    if (debit !== credit || debit <= 0) throw new Error("LEDGER_NOT_BALANCED");
    const [existing] = await transaction
      .select({ id: ledgerTransactions.id })
      .from(ledgerTransactions)
      .where(eq(ledgerTransactions.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (existing) return;
    const [created] = await transaction
      .insert(ledgerTransactions)
      .values({
        tenantId: input.tenantId,
        bookingId: input.bookingId,
        kind: input.kind,
        idempotencyKey: input.idempotencyKey,
        description: input.description,
      })
      .$returningId();
    if (!created) throw new Error("MySQL tidak mengembalikan ID ledger transaction.");
    await transaction
      .insert(ledgerEntries)
      .values(input.entries.map((entry) => ({ transactionId: created.id, ...entry })));
  }

  private async refundLedgerCorrection(
    transaction: Transaction,
    bookingId: number,
  ): Promise<{
    cumulativeRefund: number;
    semanticRefund: number;
    entries: LedgerEntryInput[];
    ownerReversal: number;
    snapshot: typeof bookingFinancialSnapshots.$inferSelect | undefined;
  }> {
    const [summary] = await transaction
      .select()
      .from(bookingPaymentSummaries)
      .where(eq(bookingPaymentSummaries.bookingId, bookingId))
      .limit(1)
      .for("update");
    if (!summary) throw new Error("Ringkasan pembayaran refund tidak ditemukan.");
    const [snapshot] = await transaction
      .select()
      .from(bookingFinancialSnapshots)
      .where(eq(bookingFinancialSnapshots.bookingId, bookingId))
      .orderBy(desc(bookingFinancialSnapshots.bookingVersion))
      .limit(1);
    const [completion] = await transaction
      .select({ id: ledgerTransactions.id })
      .from(ledgerTransactions)
      .where(
        and(
          eq(ledgerTransactions.bookingId, bookingId),
          eq(ledgerTransactions.kind, "BOOKING_COMPLETED"),
        ),
      )
      .limit(1);
    if (completion && !snapshot) {
      throw new Error("REFUND_FINANCIAL_SNAPSHOT_MISSING");
    }
    const rescheduleRefunds = await transaction
      .select({ amount: refunds.amount })
      .from(refunds)
      .where(
        and(
          eq(refunds.bookingId, bookingId),
          eq(refunds.status, "SUCCEEDED"),
          eq(refunds.kind, "RESCHEDULE_DIFFERENCE"),
        ),
      );
    const rescheduleRefund = sumBy(rescheduleRefunds, (refund) => refund.amount);
    const semanticRefund = Math.max(0, summary.totalRefunded - rescheduleRefund);
    const priorRefundEntries = await transaction
      .select({ entry: ledgerEntries })
      .from(ledgerEntries)
      .innerJoin(
        ledgerTransactions,
        eq(ledgerTransactions.id, ledgerEntries.transactionId),
      )
      .where(
        and(
          eq(ledgerTransactions.bookingId, bookingId),
          inArray(ledgerTransactions.kind, [
            "REFUND_SUCCEEDED",
            "REFUND_RECONCILIATION",
          ]),
        ),
      )
      .for("update");
    const desiredBalances = refundLedgerBalances(
      semanticRefund,
      completion ? snapshot : undefined,
    );
    desiredBalances.set(
      "SANDBOX_CASH",
      (desiredBalances.get("SANDBOX_CASH") ?? 0) - rescheduleRefund,
    );
    if (rescheduleRefund > 0) {
      desiredBalances.set(
        "CUSTOMER_FUNDS_HELD",
        (desiredBalances.get("CUSTOMER_FUNDS_HELD") ?? 0) + rescheduleRefund,
      );
    }
    const existingBalances = new Map<LedgerAccountCode, number>();
    for (const { entry } of priorRefundEntries) {
      const accountCode = entry.accountCode as LedgerAccountCode;
      existingBalances.set(
        accountCode,
        (existingBalances.get(accountCode) ?? 0) + entry.debit - entry.credit,
      );
    }
    return {
      cumulativeRefund: summary.totalRefunded,
      semanticRefund,
      entries: refundLedgerDelta(desiredBalances, existingBalances),
      ownerReversal: snapshot
        ? refundSemanticAmounts(semanticRefund, snapshot).ownerReversal
        : 0,
      snapshot,
    };
  }

  private async reconcileLegacyOwnerEarning(
    transaction: Transaction,
    bookingId: number,
    snapshot: typeof bookingFinancialSnapshots.$inferSelect | undefined,
    ownerReversal: number,
    cumulativeRefund: number,
    now: Date,
  ): Promise<number> {
    if (!snapshot) return 0;
    let earnings = await transaction
      .select()
      .from(ownerEarnings)
      .where(eq(ownerEarnings.bookingId, bookingId))
      .for("update");
    for (const earning of earnings.filter(
      (candidate) => candidate.status === "RESERVED_FOR_PAYOUT",
    )) {
      await this.cancelPayoutContainingEarning(
        transaction,
        earning.id,
        `Rekonsiliasi refund booking ${bookingId}`,
        now,
      );
    }
    earnings = await transaction
      .select()
      .from(ownerEarnings)
      .where(eq(ownerEarnings.bookingId, bookingId))
      .for("update");
    const base = earnings.find(
      (earning) => earning.sourceKey === `booking:${bookingId}`,
    );
    if (!base) return 0;
    const recognized = sumBy(
      earnings.filter((earning) => earning.status !== "REVERSED"),
      (earning) => earning.amount,
    );
    const correction = snapshot.ownerNet - ownerReversal - recognized;
    if (correction === 0) return 0;
    await transaction.insert(ownerEarnings).values({
      tenantId: base.tenantId,
      bookingId,
      snapshotId: snapshot.id,
      sourceKey: `refund:reconciliation:${bookingId}:${cumulativeRefund}`,
      amount: correction,
      status: base.status === "PENDING" ? "PENDING" : "AVAILABLE",
      availableAt: base.status === "PENDING" ? base.availableAt : now,
      frozenBySupportTicketId: base.frozenBySupportTicketId,
      updatedAt: now,
    });
    return correction;
  }

  private async cancelPayoutContainingEarning(
    transaction: Transaction,
    earningId: number,
    reason: string,
    now: Date,
  ): Promise<boolean> {
    const [reserved] = await transaction
      .select({ batch: payoutBatches })
      .from(payoutItems)
      .innerJoin(payoutBatches, eq(payoutBatches.id, payoutItems.payoutBatchId))
      .where(
        and(
          eq(payoutItems.earningId, earningId),
          inArray(payoutBatches.status, ["SCHEDULED", "FAILED"]),
        ),
      )
      .orderBy(desc(payoutBatches.id))
      .limit(1)
      .for("update");
    if (!reserved) return false;
    const batchItems = await transaction
      .select()
      .from(payoutItems)
      .where(eq(payoutItems.payoutBatchId, reserved.batch.id));
    await transaction
      .update(payoutBatches)
      .set({ status: "CANCELLED", updatedAt: now })
      .where(eq(payoutBatches.id, reserved.batch.id));
    await transaction
      .update(ownerEarnings)
      .set({ status: "AVAILABLE", updatedAt: now })
      .where(
        inArray(
          ownerEarnings.id,
          batchItems.map((item) => item.earningId),
        ),
      );
    await this.recordPayoutStatusChange(transaction, {
      batchId: reserved.batch.id,
      tenantId: reserved.batch.tenantId,
      actorUserId: null,
      beforeStatus: reserved.batch.status,
      status: "CANCELLED",
      reason,
      now,
    });
    return true;
  }

  private async recordPayoutStatusChange(
    transaction: Transaction,
    input: {
      batchId: number;
      tenantId: number;
      actorUserId: number | null;
      beforeStatus: string;
      status: string;
      reason: string;
      now: Date;
    },
  ): Promise<void> {
    await transaction.insert(auditLogs).values({
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      action: "payout.status_changed",
      resourceType: "payout",
      resourceId: input.batchId,
      reason: input.reason,
      beforeState: { status: input.beforeStatus },
      afterState: { status: input.status },
    });
    await transaction.insert(outboxEvents).values({
      tenantId: input.tenantId,
      eventType: "payout.status_changed",
      resourceType: "payout",
      resourceId: input.batchId,
      resourceVersion: Math.floor(input.now.getTime() / 1_000),
      payload: { status: input.status, hint: "refetch-finance" },
      occurredAt: input.now,
    });
  }

  private async exportRows(
    tenantId: number,
    dataset: string,
    venueIds?: string[],
  ): Promise<Array<Record<string, unknown>>> {
    const venueDatabaseIds = venueIds?.map(parsePublicId);
    const bookingScope = and(
      eq(bookings.tenantId, tenantId),
      venueDatabaseIds
        ? venueDatabaseIds.length > 0
          ? inArray(bookings.venueId, venueDatabaseIds)
          : sql`false`
        : undefined,
    );
    if (dataset === "payouts") {
      return (await this.listPayouts(formatPublicId(tenantId), venueIds)).map(
        (row) => ({
          ...row,
        }),
      );
    }
    if (dataset === "promotions") {
      return (await this.listPromotions(formatPublicId(tenantId), venueIds)).map(
        (row) => ({ sandbox: true, ...row }),
      );
    }
    if (dataset === "refunds") {
      return this.database.db
        .select({
          reference: refunds.id,
          status: refunds.status,
          amount: refunds.amount,
          reason: refunds.reason,
          createdAt: refunds.createdAt,
        })
        .from(refunds)
        .innerJoin(bookings, eq(bookings.id, refunds.bookingId))
        .where(bookingScope);
    }
    if (dataset === "payments") {
      return this.database.db
        .select({
          paymentCode: paymentAttempts.paymentCode,
          bookingCode: bookings.bookingCode,
          kind: paymentAttempts.kind,
          provider: paymentAttempts.provider,
          status: paymentAttempts.status,
          amount: paymentAttempts.amount,
          paidAt: paymentAttempts.paidAt,
          createdAt: paymentAttempts.createdAt,
        })
        .from(paymentAttempts)
        .innerJoin(bookings, eq(bookings.id, paymentAttempts.bookingId))
        .where(bookingScope);
    }
    if (dataset === "staff-activity") {
      return this.database.db
        .select({
          action: auditLogs.action,
          reason: auditLogs.reason,
          actorUserId: auditLogs.actorUserId,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.tenantId, tenantId),
            venueDatabaseIds
              ? venueDatabaseIds.length > 0
                ? inArray(auditLogs.venueId, venueDatabaseIds)
                : sql`false`
              : undefined,
          ),
        );
    }
    const sourceFilter =
      dataset === "offline-bookings" ? eq(bookings.source, "OFFLINE") : undefined;
    return this.database.db
      .select({
        bookingCode: bookings.bookingCode,
        source: bookings.source,
        status: bookings.status,
        totalAmount: bookings.totalAmount,
        balanceDue: bookings.balanceDue,
        createdAt: bookings.createdAt,
      })
      .from(bookings)
      .where(and(bookingScope, sourceFilter));
  }

  private async recognizedCommission(
    bookingScope: ReturnType<typeof and>,
  ): Promise<number> {
    const rows = await this.database.db
      .select({ debit: ledgerEntries.debit, credit: ledgerEntries.credit })
      .from(ledgerEntries)
      .innerJoin(
        ledgerTransactions,
        eq(ledgerTransactions.id, ledgerEntries.transactionId),
      )
      .innerJoin(bookings, eq(bookings.id, ledgerTransactions.bookingId))
      .where(
        and(bookingScope, eq(ledgerEntries.accountCode, "PLATFORM_COMMISSION_REVENUE")),
      );
    return sumBy(rows, (row) => row.credit - row.debit);
  }
}

function weeklyPayoutKey(date: Date): string {
  const utcDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const weekday = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - weekday);
  const firstDay = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((utcDate.getTime() - firstDay.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${utcDate.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

interface LedgerEntryInput {
  accountCode: LedgerAccountCode;
  debit: number;
  credit: number;
}

function refundLedgerBalances(
  cumulativeRefund: number,
  snapshot: typeof bookingFinancialSnapshots.$inferSelect | undefined,
): Map<LedgerAccountCode, number> {
  const balances = new Map<LedgerAccountCode, number>([
    ["SANDBOX_CASH", -cumulativeRefund],
  ]);
  if (!snapshot) {
    balances.set("CUSTOMER_FUNDS_HELD", cumulativeRefund);
    return balances;
  }
  const { promotionReversal, commissionReversal, gatewayFeeExpense, ownerReversal } =
    refundSemanticAmounts(cumulativeRefund, snapshot);
  balances.set("OWNER_PAYABLE", ownerReversal);
  balances.set("PLATFORM_COMMISSION_REVENUE", commissionReversal);
  if (promotionReversal > 0) {
    balances.set("PLATFORM_PROMO_EXPENSE", -promotionReversal);
  }
  if (gatewayFeeExpense > 0) balances.set("REFUND_EXPENSE", gatewayFeeExpense);
  return balances;
}

function refundSemanticAmounts(
  cumulativeRefund: number,
  snapshot: typeof bookingFinancialSnapshots.$inferSelect,
) {
  const customerTotal =
    snapshot.courtSubtotal +
    snapshot.addonSubtotal -
    snapshot.ownerDiscount -
    snapshot.platformDiscount;
  if (customerTotal <= 0) throw new Error("REFUND_CUSTOMER_TOTAL_INVALID");
  const refunded = Math.min(cumulativeRefund, customerTotal);
  const proportional = (value: number) =>
    refunded === customerTotal ? value : Math.floor((value * refunded) / customerTotal);
  const promotionReversal = proportional(snapshot.platformDiscount);
  const commissionReversal = proportional(snapshot.platformCommission);
  const gatewayFeeExpense =
    snapshot.gatewayFeeFunding === "OWNER" ? proportional(snapshot.gatewayFee) : 0;
  return {
    promotionReversal,
    commissionReversal,
    gatewayFeeExpense,
    ownerReversal:
      refunded + promotionReversal - commissionReversal - gatewayFeeExpense,
  };
}

function snapshotCustomerTotal(
  snapshot: typeof bookingFinancialSnapshots.$inferSelect,
): number {
  return (
    snapshot.courtSubtotal +
    snapshot.addonSubtotal -
    snapshot.ownerDiscount -
    snapshot.platformDiscount
  );
}

function refundLedgerDelta(
  desired: Map<LedgerAccountCode, number>,
  existing: Map<LedgerAccountCode, number>,
): LedgerEntryInput[] {
  const accounts = new Set([...desired.keys(), ...existing.keys()]);
  return [...accounts]
    .map((accountCode): LedgerEntryInput | null => {
      const delta = (desired.get(accountCode) ?? 0) - (existing.get(accountCode) ?? 0);
      if (delta === 0) return null;
      return {
        accountCode,
        debit: Math.max(0, delta),
        credit: Math.max(0, -delta),
      };
    })
    .filter((entry): entry is LedgerEntryInput => entry !== null);
}

function discountForPromotion(
  promotion: typeof promotions.$inferSelect,
  grossAmount: number,
): number {
  if (!promotion.discountType || promotion.discountValue === null) return 0;
  const calculated =
    promotion.discountType === "PERCENT"
      ? Math.floor((grossAmount * promotion.discountValue) / 10_000)
      : promotion.discountValue;
  return Math.min(calculated, promotion.maximumDiscount ?? calculated, grossAmount);
}

async function tenantIdForBooking(
  transaction: Transaction,
  bookingId: number,
): Promise<number> {
  const [booking] = await transaction
    .select({ tenantId: bookings.tenantId })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!booking) throw new Error("Booking finance tidak ditemukan.");
  return booking.tenantId;
}

async function lockTenantFinance(
  transaction: Transaction,
  tenantId: number,
): Promise<void> {
  // ponytail: tenant-wide finance serialization; narrow only if measured throughput requires it.
  const [tenant] = await transaction
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)
    .for("update");
  if (!tenant) throw new Error("Tenant finance tidak ditemukan.");
}

function refundEarningScope(bookingId: number) {
  return and(
    eq(ownerEarnings.bookingId, bookingId),
    or(
      like(ownerEarnings.sourceKey, "refund:%"),
      like(ownerEarnings.sourceKey, "refund-reconciliation:%"),
    ),
  );
}

function sumBy<T>(items: readonly T[], selector: (item: T) => number): number {
  return items.reduce((total, item) => total + selector(item), 0);
}

function payoutView(row: typeof payoutBatches.$inferSelect) {
  return {
    id: formatPublicId(row.id),
    tenantId: formatPublicId(row.tenantId),
    status: row.status,
    kind: row.kind,
    totalAmount: row.totalAmount,
    sandbox: true as const,
    createdAt: row.createdAt.toISOString(),
  };
}

function payoutStatusFromResponse(
  value: unknown,
): "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | null {
  if (!value || typeof value !== "object" || !("status" in value)) return null;
  const status = value.status;
  return status === "PROCESSING" ||
    status === "SUCCEEDED" ||
    status === "FAILED" ||
    status === "CANCELLED"
    ? status
    : null;
}

function payoutReasonFromResponse(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("reason" in value)) return null;
  return typeof value.reason === "string" ? value.reason : null;
}

function csvCell(value: unknown): string {
  const serialized =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "string"
        ? value
        : typeof value === "number" ||
            typeof value === "boolean" ||
            typeof value === "bigint"
          ? value.toString()
          : value == null
            ? ""
            : (JSON.stringify(value) ?? "");
  const safeValue = /^\s*[=+\-@]/.test(serialized) ? `'${serialized}` : serialized;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

function tenantCommandScope(
  command: "commission.create" | "promotion.create",
  tenantId: string | null,
) {
  return `${command}:${tenantId ?? "platform"}`;
}

function commissionCommandFingerprint(
  input: Parameters<FinanceService["createCommissionConfig"]>[0],
  tenantId: number | null,
): string {
  return JSON.stringify({
    tenantId,
    rateBasisPoints: input.rateBasisPoints,
    effectiveFrom: input.effectiveFrom.toISOString(),
    effectiveTo: input.effectiveTo?.toISOString() ?? null,
    trialDays: input.trialDays ?? null,
    trialCompletedBookingLimit: input.trialCompletedBookingLimit ?? null,
    gatewayFeeFunding: input.gatewayFeeFunding,
    gatewayFeeBasisPoints: input.gatewayFeeBasisPoints ?? 250,
    subsidyBudget: input.subsidyBudget ?? null,
    reason: input.reason,
  });
}

function commissionConfigMatches(
  config: typeof commissionConfigs.$inferSelect,
  input: Parameters<FinanceService["createCommissionConfig"]>[0],
  tenantId: number | null,
  actorUserId: number,
): boolean {
  return (
    config.tenantId === tenantId &&
    config.rateBasisPoints === input.rateBasisPoints &&
    config.effectiveFrom.getTime() === input.effectiveFrom.getTime() &&
    (config.effectiveTo?.getTime() ?? null) ===
      (input.effectiveTo?.getTime() ?? null) &&
    config.trialDays === (input.trialDays ?? null) &&
    config.trialCompletedBookingLimit === (input.trialCompletedBookingLimit ?? null) &&
    config.gatewayFeeFunding === input.gatewayFeeFunding &&
    config.gatewayFeeBasisPoints === (input.gatewayFeeBasisPoints ?? 250) &&
    config.subsidyBudget === (input.subsidyBudget ?? null) &&
    config.reason === input.reason &&
    config.createdByUserId === actorUserId
  );
}

function promotionCommandFingerprint(
  input: PromotionInput,
  normalizedCode: string,
  tenantId: number | null,
): string {
  return JSON.stringify({
    tenantId,
    code: normalizedCode,
    name: input.name,
    description: input.description ?? null,
    discountType: input.discountType,
    discountValue: input.discountValue,
    minimumAmount: input.minimumAmount ?? 0,
    maximumDiscount: input.maximumDiscount ?? null,
    startsAt: input.startsAt.toISOString(),
    endsAt: input.endsAt.toISOString(),
    startsAtTime: input.startsAtTime ?? null,
    endsAtTime: input.endsAtTime ?? null,
    quota: input.quota ?? null,
    perUserLimit: input.perUserLimit ?? 1,
    firstBookingOnly: input.firstBookingOnly ?? false,
    paymentMethod: input.paymentMethod ?? null,
    fundingSource: input.fundingSource,
    budgetAmount: input.budgetAmount ?? null,
    scopes: canonicalPromotionScopes(input.scopes),
    reason: input.reason ?? null,
  });
}

function promotionMatches(
  promotion: typeof promotions.$inferSelect,
  scopes: Array<{ type: string; referenceId: number | null }>,
  input: PromotionInput,
  normalizedCode: string,
  tenantId: number | null,
): boolean {
  return (
    promotion.tenantId === tenantId &&
    promotion.code === normalizedCode &&
    promotion.name === input.name &&
    promotion.description === (input.description ?? null) &&
    promotion.discountType === input.discountType &&
    promotion.discountValue === input.discountValue &&
    promotion.minimumAmount === (input.minimumAmount ?? 0) &&
    promotion.maximumDiscount === (input.maximumDiscount ?? null) &&
    promotion.startsAt.getTime() === input.startsAt.getTime() &&
    promotion.endsAt.getTime() === input.endsAt.getTime() &&
    promotion.startsAtTime === (input.startsAtTime ?? null) &&
    promotion.endsAtTime === (input.endsAtTime ?? null) &&
    promotion.quota === (input.quota ?? null) &&
    promotion.perUserLimit === (input.perUserLimit ?? 1) &&
    promotion.firstBookingOnly === (input.firstBookingOnly ?? false) &&
    promotion.paymentMethod === (input.paymentMethod ?? null) &&
    promotion.fundingSource === input.fundingSource &&
    promotion.budgetAmount === (input.budgetAmount ?? null) &&
    JSON.stringify(
      scopes.map((scope) => `${scope.type}:${scope.referenceId ?? ""}`).sort(),
    ) === JSON.stringify(canonicalPromotionScopes(input.scopes))
  );
}

function canonicalPromotionScopes(scopes: PromotionInput["scopes"]): string[] {
  return (scopes ?? [])
    .map((scope) => `${scope.type}:${parsePublicId(scope.referenceId)}`)
    .sort();
}

function assertCommandReplay(
  responseBody: unknown,
  expectedFingerprint: string,
  legacyMatches: boolean,
): void {
  const recordedFingerprint =
    responseBody &&
    typeof responseBody === "object" &&
    "fingerprint" in responseBody &&
    typeof responseBody.fingerprint === "string"
      ? responseBody.fingerprint
      : null;
  if (
    (recordedFingerprint !== null && recordedFingerprint === expectedFingerprint) ||
    (recordedFingerprint === null && legacyMatches)
  ) {
    return;
  }
  throw new ApiError(
    409,
    "IDEMPOTENCY_KEY_REUSED",
    "Idempotency-Key telah digunakan untuk request yang berbeda.",
  );
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
