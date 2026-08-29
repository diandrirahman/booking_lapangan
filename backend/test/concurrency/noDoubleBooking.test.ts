import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BookingService } from "../../src/booking/application/BookingService.js";
import { ApiError } from "../../src/http/ApiError.js";
import { removeBookingsForSlot, testDatabase } from "../support/databaseTestHarness.js";
import type { RowDataPacket } from "mysql2";
import { formatPublicId } from "../../src/database/ids.js";

const databaseSlotId = "10100";
const venueId = formatPublicId(1);
const courtId = formatPublicId(1);
const slotId = formatPublicId(10_100);
const userId = formatPublicId(100);

describe("booking concurrency guard", () => {
  beforeAll(async () => removeBookingsForSlot(databaseSlotId));

  it("50 permintaan slot sama menghasilkan tepat satu reservation aktif", async () => {
    const service = new BookingService(testDatabase);
    const results = await Promise.allSettled(
      Array.from({ length: 50 }, (_, index) =>
        service.create(
          { venueId, courtId, slotIds: [slotId], paymentMode: "FULL" },
          userId,
          `concurrency-${Date.now()}-${index}`,
          new Date("2026-08-27T00:00:00Z"),
        ),
      ),
    );
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(49);
    expect(
      rejected.every(
        (result) =>
          result.status === "rejected" &&
          result.reason instanceof ApiError &&
          result.reason.code === "SLOT_ALREADY_RESERVED",
      ),
    ).toBe(true);

    const [reservationRows] = await testDatabase.pool.execute<RowDataPacket[]>(
      "SELECT court_slot_id FROM booking_slot_reservations WHERE court_slot_id = ?",
      [databaseSlotId],
    );
    expect(reservationRows).toHaveLength(1);

    const booking = fulfilled[0]!.value;
    expect(booking.id).toMatch(/^LG-[A-Za-z0-9_-]{16}$/);
    await expect(
      service.getForUser(booking.id, formatPublicId(101)),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "BOOKING_NOT_FOUND",
    });
  }, 60_000);
});

afterAll(async () => {
  await removeBookingsForSlot(databaseSlotId);
  await testDatabase.close();
});
