import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { BookingService } from "../../src/booking/application/BookingService.js";
import { formatPublicId } from "../../src/database/ids.js";
import {
  bookingAddonItems,
  bookingPriceLines,
  bookings,
} from "../../src/database/schema/index.js";
import {
  removeBooking,
  removeBookingsForSlot,
  testDatabase,
} from "../support/databaseTestHarness.js";

const FREE_SLOT_DATABASE_ID = "10103";
const ADDON_DATABASE_ID = 11;

describe("Booking add-on integration", () => {
  it("menghitung add-on dan menyimpan nama serta harga sebagai snapshot", async () => {
    await removeBookingsForSlot(FREE_SLOT_DATABASE_ID);
    const bookingService = new BookingService(testDatabase);
    const booking = await bookingService.create(
      {
        venueId: formatPublicId(1),
        courtId: formatPublicId(1),
        slotIds: [formatPublicId(Number(FREE_SLOT_DATABASE_ID))],
        addonIds: [formatPublicId(ADDON_DATABASE_ID)],
        paymentMode: "FULL",
      },
      formatPublicId(100),
      `addon-snapshot-${Date.now()}`,
      new Date("2026-08-27T00:00:00Z"),
    );

    const [createdBooking] = await testDatabase.db
      .select({ id: bookings.id, totalAmount: bookings.totalAmount })
      .from(bookings)
      .where(eq(bookings.bookingCode, booking.id))
      .limit(1);
    if (!createdBooking) throw new Error("Booking add-on tidak tersimpan.");
    const [addonSnapshot] = await testDatabase.db
      .select()
      .from(bookingAddonItems)
      .where(eq(bookingAddonItems.bookingId, createdBooking.id))
      .limit(1);
    const addonPriceLine = await testDatabase.db
      .select()
      .from(bookingPriceLines)
      .where(eq(bookingPriceLines.bookingId, createdBooking.id));

    expect(createdBooking.totalAmount).toBe(110_000);
    expect(addonSnapshot).toMatchObject({
      addonId: ADDON_DATABASE_ID,
      nameSnapshot: "Sewa perlengkapan premium",
      unitPrice: 25_000,
      totalPrice: 25_000,
    });
    expect(addonPriceLine).toContainEqual(
      expect.objectContaining({
        lineType: "ADDON",
        label: "Sewa perlengkapan premium",
        unitAmount: 25_000,
      }),
    );

    await removeBooking(String(createdBooking.id));
  });
});

afterAll(async () => testDatabase.close());
