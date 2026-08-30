import { describe, expect, it } from "vitest";
import { calculateFinancialSnapshot } from "./calculateFinancialSnapshot.js";

describe("calculateFinancialSnapshot", () => {
  it("tidak mengurangi commission base untuk promo platform", () => {
    const result = calculateFinancialSnapshot({
      courtSubtotal: 100_000,
      addonSubtotal: 20_000,
      discountAmount: 10_000,
      discountFunding: "PLATFORM",
      commissionRateBasisPoints: 800,
      gatewayFee: 0,
      gatewayFeeFunding: "OWNER",
    });
    expect(result).toMatchObject({
      customerTotal: 110_000,
      commissionBase: 120_000,
      platformCommission: 9_600,
      ownerNet: 110_400,
    });
  });

  it("mengurangi commission base untuk promo owner", () => {
    const result = calculateFinancialSnapshot({
      courtSubtotal: 100_000,
      addonSubtotal: 20_000,
      discountAmount: 10_000,
      discountFunding: "OWNER",
      commissionRateBasisPoints: 800,
      gatewayFee: 0,
      gatewayFeeFunding: "OWNER",
    });
    expect(result).toMatchObject({
      customerTotal: 110_000,
      commissionBase: 110_000,
      platformCommission: 8_800,
      ownerNet: 101_200,
    });
  });

  it("membebankan gateway fee owner hanya ke owner net", () => {
    const result = calculateFinancialSnapshot({
      courtSubtotal: 100_000,
      addonSubtotal: 0,
      discountAmount: 0,
      discountFunding: null,
      commissionRateBasisPoints: 800,
      gatewayFee: 3_000,
      gatewayFeeFunding: "OWNER",
    });
    expect(result).toMatchObject({
      platformCommission: 8_000,
      ownerNet: 89_000,
      platformMargin: 8_000,
    });
  });

  it("membebankan gateway fee platform hanya ke platform margin", () => {
    const result = calculateFinancialSnapshot({
      courtSubtotal: 100_000,
      addonSubtotal: 0,
      discountAmount: 0,
      discountFunding: null,
      commissionRateBasisPoints: 800,
      gatewayFee: 3_000,
      gatewayFeeFunding: "PLATFORM",
    });
    expect(result).toMatchObject({
      platformCommission: 8_000,
      ownerNet: 92_000,
      platformMargin: 5_000,
    });
  });
});
