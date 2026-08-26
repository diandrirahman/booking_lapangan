import { describe, expect, it } from "vitest";
import { calculateCheckoutTotals } from "./checkout";

describe("checkout totals", () => {
  it("menghitung add-on, promo, dan DP dari total yang sama", () => {
    const totals = calculateCheckoutTotals({
      amount: 100_000,
      paymentMethod: "dp",
      addOnSelected: true,
      promoApplied: true,
    });
    expect(totals.total).toBe(105_000);
    expect(totals.dueNow).toBe(31_500);
  });

  it("tidak meminta pembayaran sekarang untuk pay-at-venue", () => {
    const totals = calculateCheckoutTotals({
      amount: 85_000,
      paymentMethod: "venue",
      addOnSelected: false,
      promoApplied: false,
    });
    expect(totals.dueNow).toBe(0);
  });
});
