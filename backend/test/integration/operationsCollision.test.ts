import { and, eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { BookingService } from "../../src/booking/application/BookingService.js";
import { OperationsService } from "../../src/booking/application/OperationsService.js";
import { formatPublicId, parsePublicId } from "../../src/database/ids.js";
import {
  auditLogs,
  attendanceRecords,
  bookingItems,
  bookings,
  courtBlocks,
} from "../../src/database/schema/index.js";
import {
  removeBooking,
  removeBookingsForSlot,
  testDatabase,
} from "../support/databaseTestHarness.js";

const COLLISION_SLOT_DATABASE_ID = "10101";

describe("Owner operations integration", () => {
  it("menghasilkan availability, outstanding, jadwal, dan activity dashboard", async () => {
    const dashboard = await new OperationsService(testDatabase, {} as never).dashboard(
      formatPublicId(1),
      null,
    );

    expect(dashboard.activeVenues).toBeGreaterThan(0);
    expect(dashboard.availableSlotsToday).toBeGreaterThanOrEqual(0);
    expect(dashboard.outstandingAmount).toBeGreaterThanOrEqual(0);
    expect(dashboard.recentActivity.length).toBeGreaterThan(0);
  });

  it("mendeteksi booking aktif yang terdampak closure", async () => {
    const [activeBooking] = await testDatabase.db
      .select({
        bookingReference: bookings.bookingCode,
        tenantId: bookings.tenantId,
        venueId: bookings.venueId,
        courtId: bookingItems.courtId,
        startsAt: bookingItems.startsAt,
        endsAt: bookingItems.endsAt,
      })
      .from(bookings)
      .innerJoin(bookingItems, eq(bookingItems.bookingId, bookings.id))
      .where(inArray(bookings.status, ["HOLD", "PENDING_CONFIRMATION", "CONFIRMED"]))
      .limit(1);
    if (!activeBooking) throw new Error("Seed tidak menyediakan booking aktif.");

    const operations = new OperationsService(testDatabase, {} as never);
    const result = await operations.createClosure({
      tenantId: formatPublicId(activeBooking.tenantId),
      venueId: formatPublicId(activeBooking.venueId),
      courtId: formatPublicId(activeBooking.courtId),
      startsAt: activeBooking.startsAt,
      endsAt: activeBooking.endsAt,
      kind: "MAINTENANCE",
      reason: "Perawatan permukaan lapangan",
    });

    expect(result.impactedBookingIds).toContain(activeBooking.bookingReference);
    await testDatabase.db
      .delete(courtBlocks)
      .where(eq(courtBlocks.id, parsePublicId(result.blockId)));
  });

  it("booking offline tidak dapat mengambil slot booking online", async () => {
    await removeBookingsForSlot(COLLISION_SLOT_DATABASE_ID);
    const bookingService = new BookingService(testDatabase);
    const online = await bookingService.create(
      {
        venueId: formatPublicId(1),
        courtId: formatPublicId(1),
        slotIds: [formatPublicId(Number(COLLISION_SLOT_DATABASE_ID))],
        paymentMode: "FULL",
      },
      formatPublicId(100),
      `online-collision-${Date.now()}`,
      new Date("2026-08-27T00:00:00Z"),
    );

    const result = bookingService.create(
      {
        venueId: formatPublicId(1),
        courtId: formatPublicId(1),
        slotIds: [formatPublicId(Number(COLLISION_SLOT_DATABASE_ID))],
        paymentMode: "PAY_AT_VENUE",
        source: "OFFLINE",
        offlineCustomer: {
          name: "Rendi Saputra",
          phone: "+6281212345678",
          channel: "WALK_IN",
        },
      },
      formatPublicId(1),
      `offline-collision-${Date.now()}`,
      new Date("2026-08-27T00:00:00Z"),
    );

    await expect(result).rejects.toMatchObject({
      statusCode: 409,
      code: "SLOT_ALREADY_RESERVED",
    });
    const [createdBooking] = await testDatabase.db
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(eq(bookings.bookingCode, online.id), eq(bookings.source, "ONLINE")))
      .limit(1);
    if (createdBooking) await removeBooking(String(createdBooking.id));
  });

  it("booking offline langsung confirmed dan adjustment memiliki audit before/after", async () => {
    const slotDatabaseId = "10102";
    await removeBookingsForSlot(slotDatabaseId);
    const booking = await new BookingService(testDatabase).create(
      {
        venueId: formatPublicId(1),
        courtId: formatPublicId(1),
        slotIds: [formatPublicId(Number(slotDatabaseId))],
        paymentMode: "PAY_AT_VENUE",
        source: "OFFLINE",
        offlineCustomer: {
          name: "Rendi Saputra",
          phone: "+6281212345678",
          channel: "WALK_IN",
          adjustedAmount: 80_000,
          adjustmentReason: "Diskon komunitas yang disetujui Owner.",
        },
      },
      formatPublicId(1),
      `offline-adjustment-${Date.now()}`,
      new Date("2026-08-27T00:00:00Z"),
    );

    expect(booking).toMatchObject({
      status: "CONFIRMED",
      totalAmount: 80_000,
      balanceDue: 80_000,
      holdExpiresAt: null,
    });
    const [createdBooking] = await testDatabase.db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.bookingCode, booking.id))
      .limit(1);
    if (!createdBooking) throw new Error("Booking offline test tidak tersimpan.");
    const [audit] = await testDatabase.db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        reason: auditLogs.reason,
        beforeState: auditLogs.beforeState,
        afterState: auditLogs.afterState,
      })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.resourceType, "booking"),
          eq(auditLogs.resourceId, createdBooking.id),
        ),
      )
      .limit(1);
    expect(audit).toMatchObject({
      action: "booking.offline_price_adjusted",
      reason: "Diskon komunitas yang disetujui Owner.",
      beforeState: { totalAmount: 85_000 },
      afterState: { totalAmount: 80_000 },
    });
    if (audit) {
      await testDatabase.db.delete(auditLogs).where(eq(auditLogs.id, audit.id));
    }
    await removeBooking(String(createdBooking.id));
  });

  it("memisahkan attendance dan menegakkan grace period no-show", async () => {
    const slotDatabaseId = "10203";
    await removeBookingsForSlot(slotDatabaseId);
    const bookingService = new BookingService(testDatabase);
    const booking = await bookingService.create(
      {
        venueId: formatPublicId(1),
        courtId: formatPublicId(2),
        slotIds: [formatPublicId(Number(slotDatabaseId))],
        paymentMode: "FULL",
      },
      formatPublicId(100),
      `attendance-${Date.now()}`,
      new Date("2026-08-27T00:00:00Z"),
    );
    await bookingService.transition(
      booking.id,
      "CONFIRMED",
      formatPublicId(100),
      "Pembayaran sandbox berhasil",
    );
    const operations = new OperationsService(testDatabase, bookingService);
    const slotStartsAt = new Date("2026-08-28T12:00:00Z");
    await expect(
      operations.recordAttendance(
        booking.id,
        formatPublicId(1),
        "NO_SHOW",
        "Customer belum hadir.",
        new Date(slotStartsAt.getTime() + 14 * 60_000),
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: "NO_SHOW_GRACE_ACTIVE" });
    await operations.recordAttendance(
      booking.id,
      formatPublicId(1),
      "NO_SHOW",
      "Customer tidak hadir setelah grace period.",
      new Date(slotStartsAt.getTime() + 16 * 60_000),
    );

    const [createdBooking] = await testDatabase.db
      .select({ id: bookings.id, status: bookings.status })
      .from(bookings)
      .where(eq(bookings.bookingCode, booking.id))
      .limit(1);
    if (!createdBooking) throw new Error("Booking attendance tidak tersimpan.");
    const [attendance] = await testDatabase.db
      .select({ status: attendanceRecords.status })
      .from(attendanceRecords)
      .where(eq(attendanceRecords.bookingId, createdBooking.id))
      .limit(1);
    expect(attendance?.status).toBe("NO_SHOW");
    expect(createdBooking.status).toBe("CONFIRMED");
    const readModel = await operations.listBookings({
      tenantId: formatPublicId(1),
      allowedVenueIds: null,
    });
    expect(readModel.find((item) => item.id === booking.id)?.attendanceStatus).toBe(
      "NO_SHOW",
    );
    await removeBooking(String(createdBooking.id));
  });

  it("memakai satu aturan kolektibilitas untuk daftar, dashboard, dan settlement", async () => {
    const candidates = await testDatabase.db
      .select({
        id: bookings.id,
        bookingCode: bookings.bookingCode,
        status: bookings.status,
        balanceDue: bookings.balanceDue,
      })
      .from(bookings)
      .where(eq(bookings.tenantId, 1))
      .limit(3);
    if (candidates.length < 3) {
      throw new Error(
        "Seed tidak menyediakan tiga booking untuk pengujian outstanding.",
      );
    }

    const [cancelled, expired, completed] = candidates;
    if (!cancelled || !expired || !completed)
      throw new Error("Booking test tidak lengkap.");
    const operations = new OperationsService(testDatabase, {} as never);

    try {
      await Promise.all([
        testDatabase.db
          .update(bookings)
          .set({ status: "CANCELLED", balanceDue: 11_111 })
          .where(eq(bookings.id, cancelled.id)),
        testDatabase.db
          .update(bookings)
          .set({ status: "EXPIRED", balanceDue: 22_222 })
          .where(eq(bookings.id, expired.id)),
        testDatabase.db
          .update(bookings)
          .set({ status: "COMPLETED", balanceDue: 33_333 })
          .where(eq(bookings.id, completed.id)),
      ]);

      const outstanding = await operations.listBookings({
        tenantId: formatPublicId(1),
        allowedVenueIds: null,
        outstandingOnly: true,
      });
      expect(outstanding.some((item) => item.id === cancelled.bookingCode)).toBe(false);
      expect(outstanding.some((item) => item.id === expired.bookingCode)).toBe(false);
      expect(outstanding.some((item) => item.id === completed.bookingCode)).toBe(true);

      const allBookings = await operations.listBookings({
        tenantId: formatPublicId(1),
        allowedVenueIds: null,
      });
      const expectedOutstanding = allBookings
        .filter(
          (item) =>
            item.balanceDue > 0 &&
            item.status !== "CANCELLED" &&
            item.status !== "EXPIRED",
        )
        .reduce((total, item) => total + item.balanceDue, 0);
      const dashboard = await operations.dashboard(formatPublicId(1), null);
      expect(dashboard.outstandingAmount).toBe(expectedOutstanding);

      await expect(
        operations.settleOutstanding(
          cancelled.bookingCode,
          formatPublicId(1),
          `terminal-settlement-${Date.now()}`,
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "OUTSTANDING_NOT_COLLECTIBLE",
      });
    } finally {
      await Promise.all(
        candidates.map((candidate) =>
          testDatabase.db
            .update(bookings)
            .set({ status: candidate.status, balanceDue: candidate.balanceDue })
            .where(eq(bookings.id, candidate.id)),
        ),
      );
    }
  });
});

afterAll(async () => testDatabase.close());
