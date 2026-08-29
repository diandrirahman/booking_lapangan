import { describe, expect, it } from "vitest";
import { canTransitionBooking } from "./bookingStatus.js";
import { validateSlotSelection } from "./slotSelection.js";

describe("booking domain rules", () => {
  it("menolak transisi terminal dan mengizinkan lifecycle operasional", () => {
    expect(canTransitionBooking("HOLD", "CONFIRMED")).toBe(true);
    expect(canTransitionBooking("CONFIRMED", "IN_PROGRESS")).toBe(true);
    expect(canTransitionBooking("COMPLETED", "CONFIRMED")).toBe(false);
  });

  it("hanya menerima slot berurutan dalam batas durasi", () => {
    const slots = [
      slot("a", "2026-08-28T10:00:00Z", "2026-08-28T11:00:00Z"),
      slot("b", "2026-08-28T11:00:00Z", "2026-08-28T12:00:00Z"),
    ];
    expect(() =>
      validateSlotSelection(slots, {
        intervalMinutes: 60,
        minimumDurationMinutes: 60,
        maximumDurationMinutes: 180,
      }),
    ).not.toThrow();
  });

  it("menolak slot yang loncat", () => {
    const slots = [
      slot("a", "2026-08-28T10:00:00Z", "2026-08-28T11:00:00Z"),
      slot("c", "2026-08-28T12:00:00Z", "2026-08-28T13:00:00Z"),
    ];
    expect(() =>
      validateSlotSelection(slots, {
        intervalMinutes: 60,
        minimumDurationMinutes: 60,
        maximumDurationMinutes: 180,
      }),
    ).toThrow("berurutan");
  });
});

function slot(id: string, startsAt: string, endsAt: string) {
  return { id, startsAt: new Date(startsAt), endsAt: new Date(endsAt), status: "OPEN" };
}
