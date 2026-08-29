import { describe, expect, it } from "vitest";
import { calculateCheckoutTotals, calculateServerCheckoutPreview } from "./checkout";

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

  it("menghitung preview DP API sebesar 50%", () => {
    const totals = calculateServerCheckoutPreview(235_000, "DP");

    expect(totals.total).toBe(235_000);
    expect(totals.dueNow).toBe(117_500);
  });
});
