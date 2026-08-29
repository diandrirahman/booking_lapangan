import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { BookingService } from "../../src/booking/application/BookingService.js";
import { OperationsService } from "../../src/booking/application/OperationsService.js";
import { formatPublicId, parsePublicId } from "../../src/database/ids.js";
import {
  bookings,
  outboxEvents,
  userNotifications,
} from "../../src/database/schema/index.js";
import { NotificationService } from "../../src/identity/notifications/NotificationService.js";
import {
  removeBooking,
  removeBookingsForSlot,
  testDatabase,
} from "../support/databaseTestHarness.js";

const CUSTOMER_ID = formatPublicId(100);
const OTHER_CUSTOMER_ID = formatPublicId(101);
const FREE_SLOT_DATABASE_ID = "10104";

describe("Customer notification integration", () => {
  it("membuat notifikasi milik customer setelah pembatalan closure", async () => {
    await removeBookingsForSlot(FREE_SLOT_DATABASE_ID);
    const bookingService = new BookingService(testDatabase);
    const booking = await bookingService.create(
      {
        venueId: formatPublicId(1),
        courtId: formatPublicId(1),
        slotIds: [formatPublicId(Number(FREE_SLOT_DATABASE_ID))],
        paymentMode: "FULL",
      },
      CUSTOMER_ID,
      `closure-notification-${Date.now()}`,
      new Date("2026-08-27T00:00:00Z"),
    );
    await bookingService.transition(
      booking.id,
      "CONFIRMED",
      CUSTOMER_ID,
      "Payment sandbox berhasil",
    );

    const operations = new OperationsService(testDatabase, bookingService);
    await operations.cancelForClosure(
      booking.id,
      formatPublicId(1),
      "Venue ditutup sementara untuk perawatan.",
    );

    const notifications = new NotificationService(testDatabase);
    const feed = await notifications.list(CUSTOMER_ID, false);
    const created = feed.items.find(
      (notification) => notification.actionPath === `/bookings/${booking.id}`,
    );
    expect(created).toMatchObject({
      kind: "booking",
      title: "Booking dibatalkan oleh venue",
      read: false,
    });
    await expect(
      notifications.markRead(OTHER_CUSTOMER_ID, created!.id),
    ).rejects.toMatchObject({ statusCode: 404, code: "NOTIFICATION_NOT_FOUND" });
    await notifications.markRead(CUSTOMER_ID, created!.id);
    await expect(notifications.list(CUSTOMER_ID, true)).resolves.toEqual({
      items: expect.not.arrayContaining([expect.objectContaining({ id: created!.id })]),
    });

    const notificationDatabaseId = parsePublicId(created!.id);
    await testDatabase.db
      .delete(outboxEvents)
      .where(
        and(
          eq(outboxEvents.resourceType, "notification"),
          eq(outboxEvents.resourceId, notificationDatabaseId),
        ),
      );
    await testDatabase.db
      .delete(userNotifications)
      .where(
        and(
          eq(userNotifications.id, notificationDatabaseId),
          eq(userNotifications.userId, parsePublicId(CUSTOMER_ID)),
        ),
      );
    const [createdBooking] = await testDatabase.db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.bookingCode, booking.id))
      .limit(1);
    if (createdBooking) await removeBooking(String(createdBooking.id));
  });
});

afterAll(async () => testDatabase.close());
