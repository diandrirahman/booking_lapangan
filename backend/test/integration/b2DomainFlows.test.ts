import { and, desc, eq, like, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { formatPublicId, parsePublicId } from "../../src/database/ids.js";
import {
  auditLogs,
  bookingFinancialSnapshots,
  bookings,
  commissionConfigs,
  ledgerEntries,
  ledgerTransactions,
  notificationDeliveries,
  ownerEarnings,
  payoutBatches,
  payoutItems,
  reviewReplies,
  reviewReports,
  reviews,
  supportTicketMessages,
  supportTickets,
  tenantFinanceSettings,
  userNotifications,
  venueSearchMetrics,
} from "../../src/database/schema/index.js";
import { FinanceService } from "../../src/finance/FinanceService.js";
import { BookingService } from "../../src/booking/application/BookingService.js";
import { NotificationService } from "../../src/identity/notifications/NotificationService.js";
import { ReviewService } from "../../src/review/ReviewService.js";
import { SupportService } from "../../src/support/SupportService.js";
import { TenantAuthorizationService } from "../../src/tenant/authorization/TenantAuthorizationService.js";
import { testDatabase } from "../support/databaseTestHarness.js";

const ADMIN_USER_ID = formatPublicId(4);

describe("Phase B2 domain integration", () => {
  it("menerapkan role permission dan venue assignment Staff", async () => {
    const authorization = new TenantAuthorizationService(testDatabase);
    const staffUserId = formatPublicId(200);
    const access = await authorization.requirePermission(
      staffUserId,
      formatPublicId(1),
      "schedule.manage",
      formatPublicId(1),
    );

    expect(access.role).toBe("STAFF");
    expect(access.assignedVenueIds).toEqual([formatPublicId(1)]);
    await expect(
      authorization.requirePermission(staffUserId, formatPublicId(1), "finance.view"),
    ).rejects.toMatchObject({ statusCode: 403, code: "PERMISSION_REQUIRED" });
    await expect(
      authorization.requirePermission(
        staffUserId,
        formatPublicId(1),
        "schedule.manage",
        formatPublicId(2),
      ),
    ).rejects.toMatchObject({ statusCode: 403, code: "VENUE_ACCESS_DENIED" });
  });

  it("menjaga semua transaksi ledger seed tetap seimbang", async () => {
    const rows = await testDatabase.db
      .select({
        transactionId: ledgerTransactions.id,
        debit: sql<number>`sum(${ledgerEntries.debit})`,
        credit: sql<number>`sum(${ledgerEntries.credit})`,
      })
      .from(ledgerTransactions)
      .innerJoin(ledgerEntries, eq(ledgerEntries.transactionId, ledgerTransactions.id))
      .groupBy(ledgerTransactions.id);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => Number(row.debit) === Number(row.credit))).toBe(true);

    const csv = await new FinanceService(testDatabase).exportFinance(
      formatPublicId(1),
      "bookings",
      "csv",
    );
    const xlsx = await new FinanceService(testDatabase).exportFinance(
      formatPublicId(1),
      "payments",
      "xlsx",
    );
    expect(csv.body.subarray(0, 3).toString("utf8")).toBe("﻿");
    expect(xlsx.body.subarray(0, 2).toString("utf8")).toBe("PK");
  });

  it("mengagregasi hanya financial snapshot versi terbaru", async () => {
    const finance = new FinanceService(testDatabase);
    const tenantId = formatPublicId(1);
    const [current] = await testDatabase.db
      .select({ snapshot: bookingFinancialSnapshots })
      .from(bookingFinancialSnapshots)
      .innerJoin(bookings, eq(bookings.id, bookingFinancialSnapshots.bookingId))
      .where(eq(bookings.tenantId, 1))
      .orderBy(desc(bookingFinancialSnapshots.bookingVersion))
      .limit(1);
    if (!current) throw new Error("Seed financial snapshot tidak tersedia.");

    const before = await finance.financeSummary(tenantId);
    const snapshot = current.snapshot;
    const version = snapshot.bookingVersion + 100;
    const courtSubtotal = snapshot.courtSubtotal + 12_345;
    try {
      await testDatabase.db.insert(bookingFinancialSnapshots).values({
        bookingId: snapshot.bookingId,
        bookingVersion: version,
        commissionConfigId: snapshot.commissionConfigId,
        promotionId: snapshot.promotionId,
        paymentMode: snapshot.paymentMode,
        reservationAmount: snapshot.reservationAmount,
        dpAmount: snapshot.dpAmount,
        courtSubtotal,
        addonSubtotal: snapshot.addonSubtotal,
        ownerDiscount: snapshot.ownerDiscount,
        platformDiscount: snapshot.platformDiscount,
        commissionBase: snapshot.commissionBase,
        commissionRateBasisPoints: snapshot.commissionRateBasisPoints,
        platformCommission: snapshot.platformCommission,
        gatewayFee: snapshot.gatewayFee,
        gatewayFeeFunding: snapshot.gatewayFeeFunding,
        ownerNet: snapshot.ownerNet,
        taxPlaceholder: snapshot.taxPlaceholder,
      });

      const after = await finance.financeSummary(tenantId);
      expect(after.grossRevenue - before.grossRevenue).toBe(
        courtSubtotal - snapshot.courtSubtotal,
      );
      expect(after.totalPaid).toBe(before.totalPaid);
    } finally {
      await testDatabase.db
        .delete(bookingFinancialSnapshots)
        .where(
          and(
            eq(bookingFinancialSnapshots.bookingId, snapshot.bookingId),
            eq(bookingFinancialSnapshots.bookingVersion, version),
          ),
        );
    }
  });

  it("menghitung gateway fee dari commission config dan menjaga subsidy cap", async () => {
    const finance = new FinanceService(testDatabase);
    const now = new Date();
    const [created] = await testDatabase.db
      .insert(commissionConfigs)
      .values({
        tenantId: 1,
        rateBasisPoints: 800,
        effectiveFrom: new Date(now.getTime() - 1_000),
        effectiveTo: new Date(now.getTime() + 60_000),
        trialDays: 36_500,
        gatewayFeeFunding: "PLATFORM",
        gatewayFeeBasisPoints: 300,
        subsidyBudget: 3_000,
        reason: "Regression gateway fee source of truth",
        createdByUserId: 4,
      })
      .$returningId();
    if (!created) throw new Error("Commission config test gagal dibuat.");
    const input = {
      tenantId: 1,
      venueId: 1,
      courtId: 1,
      sportId: 1,
      userId: 100,
      paymentMode: "FULL",
      courtSubtotal: 100_000,
      addonSubtotal: 0,
      timezone: "Asia/Jakarta",
      now,
    };
    try {
      const prepared = await testDatabase.db.transaction((transaction) =>
        finance.prepareBookingFinancials(transaction, input),
      );
      expect(prepared).toMatchObject({
        gatewayFee: 3_000,
        gatewayFeeFunding: "PLATFORM",
        ownerNet: 100_000,
      });
      await expect(
        testDatabase.db.transaction((transaction) =>
          finance.prepareBookingFinancials(transaction, input),
        ),
      ).rejects.toMatchObject({ code: "GATEWAY_SUBSIDY_EXHAUSTED" });
    } finally {
      await testDatabase.db
        .delete(commissionConfigs)
        .where(eq(commissionConfigs.id, created.id));
    }
  });

  it("menolak promo dan owner adjustment pada booking yang sama", async () => {
    const finance = new FinanceService(testDatabase);
    await expect(
      testDatabase.db.transaction((transaction) =>
        finance.prepareBookingFinancials(transaction, {
          tenantId: 1,
          venueId: 1,
          courtId: 1,
          sportId: 1,
          userId: 100,
          paymentMode: "FULL",
          courtSubtotal: 100_000,
          addonSubtotal: 0,
          promotionCode: "PROMO-APA-PUN",
          ownerAdjustment: 10_000,
          timezone: "Asia/Jakarta",
          now: new Date(),
        }),
      ),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: "PROMOTION_WITH_OWNER_ADJUSTMENT_NOT_ALLOWED",
    });
  });

  it("membatasi ringkasan dan export finance sesuai venue assignment", async () => {
    const finance = new FinanceService(testDatabase);
    const tenantId = formatPublicId(1);
    const assignedVenueId = formatPublicId(1);
    const [outsideBooking] = await testDatabase.db
      .select({ code: bookings.bookingCode })
      .from(bookings)
      .where(and(eq(bookings.tenantId, 1), eq(bookings.venueId, 2)))
      .limit(1);
    if (!outsideBooking) throw new Error("Seed booking venue kedua tidak tersedia.");

    const owner = await finance.financeSummary(tenantId);
    const staff = await finance.financeSummary(tenantId, [assignedVenueId]);
    const unassigned = await finance.financeSummary(tenantId, []);
    expect(
      staff.venueComparison.every((venue) => venue.venueId === assignedVenueId),
    ).toBe(true);
    expect(owner.courtComparison.every((court) => court.venueName.length > 0)).toBe(
      true,
    );
    expect(
      staff.courtComparison.every((court) =>
        owner.courtComparison.some(
          (ownerCourt) =>
            ownerCourt.courtId === court.courtId &&
            ownerCourt.venueName === court.venueName,
        ),
      ),
    ).toBe(true);
    expect(owner.totalPaid).toBeGreaterThanOrEqual(staff.totalPaid);
    expect(unassigned).toMatchObject({ totalPaid: 0, grossRevenue: 0, refunds: 0 });

    const exportResult = await finance.exportFinance(tenantId, "bookings", "csv", [
      assignedVenueId,
    ]);
    expect(exportResult.body.toString("utf8")).not.toContain(outsideBooking.code);
  });

  it("mencegah formula injection pada CSV export", async () => {
    const reason = '=HYPERLINK("https://example.invalid","x")';
    const [created] = await testDatabase.db
      .insert(auditLogs)
      .values({
        tenantId: 1,
        venueId: 1,
        actorUserId: 4,
        action: "finance.csv_injection_test",
        resourceType: "finance",
        reason,
      })
      .$returningId();
    if (!created) throw new Error("Audit CSV test gagal dibuat.");
    try {
      const csv = await new FinanceService(testDatabase).exportFinance(
        formatPublicId(1),
        "staff-activity",
        "csv",
        [formatPublicId(1)],
      );
      expect(csv.body.toString("utf8")).toContain(`"'${reason.replaceAll('"', '""')}"`);
    } finally {
      await testDatabase.db.delete(auditLogs).where(eq(auditLogs.id, created.id));
    }
  });

  it("meng-scope payout idempotency per tenant", async () => {
    const idempotencyKey = `cross-tenant-payout-${Date.now()}`;
    const [settingsBefore] = await testDatabase.db
      .select()
      .from(tenantFinanceSettings)
      .where(eq(tenantFinanceSettings.tenantId, 2))
      .limit(1);
    const [foreignBatch] = await testDatabase.db
      .insert(payoutBatches)
      .values({
        tenantId: 1,
        status: "SCHEDULED",
        kind: "MANUAL",
        totalAmount: 1,
        idempotencyKey,
        requestedByUserId: 1,
      })
      .$returningId();
    if (!foreignBatch) throw new Error("Payout test gagal dibuat.");
    await testDatabase.db
      .insert(tenantFinanceSettings)
      .values({
        tenantId: 2,
        minimumPayoutAmount: 9_000_000_000,
        manualPayoutEnabled: true,
      })
      .onDuplicateKeyUpdate({
        set: { minimumPayoutAmount: 9_000_000_000, manualPayoutEnabled: true },
      });
    try {
      await expect(
        new FinanceService(testDatabase).createPayout(
          formatPublicId(2),
          formatPublicId(2),
          idempotencyKey,
          "MANUAL",
        ),
      ).rejects.toMatchObject({ code: "PAYOUT_MINIMUM_NOT_MET" });
    } finally {
      await testDatabase.db
        .delete(payoutItems)
        .where(eq(payoutItems.payoutBatchId, foreignBatch.id));
      await testDatabase.db
        .delete(payoutBatches)
        .where(eq(payoutBatches.id, foreignBatch.id));
      if (settingsBefore) {
        await testDatabase.db
          .update(tenantFinanceSettings)
          .set({
            minimumPayoutAmount: settingsBefore.minimumPayoutAmount,
            manualPayoutEnabled: settingsBefore.manualPayoutEnabled,
            payoutAccountLabel: settingsBefore.payoutAccountLabel,
            payoutAccountLast4: settingsBefore.payoutAccountLast4,
          })
          .where(eq(tenantFinanceSettings.tenantId, 2));
      } else {
        await testDatabase.db
          .delete(tenantFinanceSettings)
          .where(eq(tenantFinanceSettings.tenantId, 2));
      }
    }
  });

  it("membatasi review ke booking COMPLETED milik customer dan satu review", async () => {
    const [booking] = await testDatabase.db
      .select({
        id: bookings.id,
        code: bookings.bookingCode,
        userId: bookings.customerUserId,
        venueId: bookings.venueId,
      })
      .from(bookings)
      .where(and(eq(bookings.status, "COMPLETED"), eq(bookings.customerUserId, 100)))
      .limit(1);
    if (!booking?.userId)
      throw new Error("Seed booking COMPLETED customer tidak tersedia.");

    const service = new ReviewService(testDatabase);
    const [metricsBefore] = await testDatabase.db
      .select()
      .from(venueSearchMetrics)
      .where(eq(venueSearchMetrics.venueId, booking.venueId))
      .limit(1);
    const input = {
      rating: 5,
      cleanliness: 4,
      courtQuality: 5,
      facility: 4,
      service: 5,
      value: 4,
      comment: "Lapangan bersih dan pelayanan baik.",
    };
    const created = await service.create(
      booking.code,
      formatPublicId(booking.userId),
      input,
    );
    const customerBookings = await new BookingService(testDatabase).listForUser(
      formatPublicId(booking.userId),
    );
    expect(customerBookings.find((item) => item.id === booking.code)?.reviewId).toBe(
      created.id,
    );
    await expect(
      service.create(booking.code, formatPublicId(booking.userId), input),
    ).rejects.toMatchObject({ statusCode: 409, code: "REVIEW_ALREADY_EXISTS" });

    await testDatabase.db.transaction(async (transaction) => {
      const reviewId = parsePublicId(created.id);
      await transaction
        .delete(reviewReports)
        .where(eq(reviewReports.reviewId, reviewId));
      await transaction
        .delete(reviewReplies)
        .where(eq(reviewReplies.reviewId, reviewId));
      await transaction.delete(reviews).where(eq(reviews.id, reviewId));
      if (metricsBefore) {
        await transaction
          .update(venueSearchMetrics)
          .set({
            ratingAverage: metricsBefore.ratingAverage,
            reviewCount: metricsBefore.reviewCount,
          })
          .where(eq(venueSearchMetrics.venueId, booking.venueId));
      }
    });
  });

  it("membekukan earning hanya selama dispute aktif dan mempertahankan status asal", async () => {
    const [target] = await testDatabase.db
      .select({
        bookingCode: bookings.bookingCode,
        customerUserId: bookings.customerUserId,
        earningId: ownerEarnings.id,
        earningStatus: ownerEarnings.status,
      })
      .from(bookings)
      .innerJoin(ownerEarnings, eq(ownerEarnings.bookingId, bookings.id))
      .where(and(eq(bookings.status, "COMPLETED"), eq(bookings.customerUserId, 101)))
      .limit(1);
    if (!target?.customerUserId)
      throw new Error("Seed earning dispute tidak tersedia.");

    const service = new SupportService(
      testDatabase,
      new NotificationService(testDatabase),
    );
    const ticket = await service.createCustomerTicket({
      userId: formatPublicId(target.customerUserId),
      bookingReference: target.bookingCode,
      category: "PAYMENT",
      subject: "Selisih pembayaran sandbox",
      message: "Mohon periksa transaksi booking ini.",
      transactionDispute: true,
    });
    const ticketId = parsePublicId(ticket.id);
    const [frozen] = await testDatabase.db
      .select({ ticketId: ownerEarnings.frozenBySupportTicketId })
      .from(ownerEarnings)
      .where(eq(ownerEarnings.id, target.earningId));
    expect(frozen?.ticketId).toBe(ticketId);

    await service.updateByAdmin({
      ticketId: ticket.id,
      actorUserId: ADMIN_USER_ID,
      status: "RESOLVED",
      resolution: "Transaksi sandbox telah direkonsiliasi.",
    });
    const [released] = await testDatabase.db
      .select({
        status: ownerEarnings.status,
        ticketId: ownerEarnings.frozenBySupportTicketId,
      })
      .from(ownerEarnings)
      .where(eq(ownerEarnings.id, target.earningId));
    expect(released).toEqual({ status: target.earningStatus, ticketId: null });

    await service.updateByAdmin({
      ticketId: ticket.id,
      actorUserId: ADMIN_USER_ID,
      status: "OPEN",
      resolution: "Dispute dibuka kembali untuk verifikasi tambahan.",
    });
    const [refrozen] = await testDatabase.db
      .select({ ticketId: ownerEarnings.frozenBySupportTicketId })
      .from(ownerEarnings)
      .where(eq(ownerEarnings.id, target.earningId));
    expect(refrozen?.ticketId).toBe(ticketId);

    await service.updateByAdmin({
      ticketId: ticket.id,
      actorUserId: ADMIN_USER_ID,
      status: "RESOLVED",
      resolution: "Dispute selesai setelah verifikasi tambahan.",
    });

    await testDatabase.db.transaction(async (transaction) => {
      await transaction
        .delete(userNotifications)
        .where(like(userNotifications.eventId, `support-status:${ticketId}:%`));
      await transaction
        .delete(notificationDeliveries)
        .where(like(notificationDeliveries.eventId, `support-status:${ticketId}:%`));
      await transaction
        .delete(supportTicketMessages)
        .where(eq(supportTicketMessages.ticketId, ticketId));
      await transaction.delete(supportTickets).where(eq(supportTickets.id, ticketId));
    });
  });

  it("tidak mengizinkan preference critical dimatikan", async () => {
    const notifications = new NotificationService(testDatabase);
    await expect(
      notifications.setPreference(
        formatPublicId(100),
        "payment.verified",
        "EMAIL",
        false,
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "CRITICAL_NOTIFICATION_REQUIRED",
    });
  });
});

afterAll(async () => testDatabase.close());
