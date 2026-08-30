import type { RowDataPacket } from "mysql2";
import { afterAll, describe, expect, it } from "vitest";
import { BookingService } from "../../src/booking/application/BookingService.js";
import { formatPublicId } from "../../src/database/ids.js";
import { FinanceService } from "../../src/finance/FinanceService.js";
import { testDatabase } from "../support/databaseTestHarness.js";

interface SlotRow extends RowDataPacket {
  id: number;
}

const TEST_NOW = new Date("2026-08-27T00:00:00.000Z");

describe("promotion quota concurrency", () => {
  it("tidak melampaui quota ketika 50 booking dibuat bersamaan", async () => {
    const finance = new FinanceService(testDatabase);
    const booking = new BookingService(testDatabase, undefined, finance);
    const code = `Q${Date.now()}`;
    await finance.createPromotion({
      tenantId: formatPublicId(1),
      code,
      name: "Promo concurrency B2",
      discountType: "FIXED",
      discountValue: 1_000,
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
      endsAt: new Date("2026-12-31T00:00:00.000Z"),
      quota: 5,
      perUserLimit: 100,
      fundingSource: "OWNER",
      actorUserId: formatPublicId(1),
      reason: "Bukti quota concurrency B2",
      idempotencyKey: `promotion-${code}`,
    });

    const [slots] = await testDatabase.pool.execute<SlotRow[]>(
      `SELECT cs.id
         FROM court_slots cs
         LEFT JOIN booking_slot_reservations reservation
           ON reservation.court_slot_id = cs.id
        WHERE cs.court_id = 1
          AND cs.starts_at > ?
          AND reservation.court_slot_id IS NULL
        ORDER BY cs.starts_at
        LIMIT 16`,
      [TEST_NOW],
    );
    expect(slots.length).toBeGreaterThanOrEqual(5);

    const attempts = await Promise.allSettled(
      Array.from({ length: 50 }, (_, index) =>
        booking.create(
          {
            venueId: formatPublicId(1),
            courtId: formatPublicId(1),
            slotIds: [formatPublicId(slots[index % slots.length]!.id)],
            paymentMode: "FULL",
            promotionCode: code.toLowerCase(),
          },
          formatPublicId(100),
          `promo-concurrency-${code}-${index}`,
          TEST_NOW,
        ),
      ),
    );

    expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(5);
    const [rows] = await testDatabase.pool.execute<
      Array<RowDataPacket & { quota_used: number; budget_used: number; status: string }>
    >("SELECT quota_used, budget_used, status FROM promotions WHERE code = ?", [code]);
    expect(rows[0]).toMatchObject({
      quota_used: 5,
      budget_used: 5_000,
      status: "EXHAUSTED",
    });
  }, 30_000);
});

afterAll(async () => testDatabase.close());
