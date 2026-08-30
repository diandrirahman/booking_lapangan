import { describe, expect, it } from "vitest";
import {
  normalizeCancellationPolicyTiers,
  refundBasisPointsAt,
  stricterPolicySnapshot,
} from "./cancellationPolicy.js";

const original = {
  templateId: "original",
  name: "Original",
  tiers: [
    { minimumHoursBefore: 24, maximumHoursBefore: null, refundBasisPoints: 10_000 },
    { minimumHoursBefore: 6, maximumHoursBefore: 24, refundBasisPoints: 5_000 },
    { minimumHoursBefore: 0, maximumHoursBefore: 6, refundBasisPoints: 0 },
  ],
};

describe("cancellation policy", () => {
  it("menerima hanya rangkaian tier yang kontigu dan lengkap", () => {
    expect(normalizeCancellationPolicyTiers(original.tiers)).toEqual([
      { minimumHoursBefore: 0, maximumHoursBefore: 6, refundBasisPoints: 0 },
      { minimumHoursBefore: 6, maximumHoursBefore: 24, refundBasisPoints: 5_000 },
      {
        minimumHoursBefore: 24,
        maximumHoursBefore: null,
        refundBasisPoints: 10_000,
      },
    ]);
    expect(
      normalizeCancellationPolicyTiers([
        { minimumHoursBefore: 0, maximumHoursBefore: 5, refundBasisPoints: 0 },
        { minimumHoursBefore: 6, maximumHoursBefore: null, refundBasisPoints: 5_000 },
      ]),
    ).toBeNull();
    expect(
      normalizeCancellationPolicyTiers([
        { minimumHoursBefore: 0, maximumHoursBefore: 8, refundBasisPoints: 0 },
        { minimumHoursBefore: 6, maximumHoursBefore: null, refundBasisPoints: 5_000 },
      ]),
    ).toBeNull();
    expect(
      normalizeCancellationPolicyTiers([
        { minimumHoursBefore: 0, maximumHoursBefore: 6, refundBasisPoints: 0 },
      ]),
    ).toBeNull();
  });

  it("menghitung tier terhadap waktu absolut", () => {
    const startsAt = new Date("2026-09-02T00:00:00.000Z");
    expect(
      refundBasisPointsAt(original, startsAt, new Date("2026-09-01T00:00:00.000Z")),
    ).toBe(10_000);
    expect(
      refundBasisPointsAt(original, startsAt, new Date("2026-09-01T18:00:00.000Z")),
    ).toBe(5_000);
  });

  it("mempertahankan rule yang lebih ketat setelah reschedule", () => {
    const current = {
      templateId: "current",
      name: "Current",
      tiers: [
        { minimumHoursBefore: 24, maximumHoursBefore: null, refundBasisPoints: 7_500 },
        { minimumHoursBefore: 0, maximumHoursBefore: 24, refundBasisPoints: 2_500 },
      ],
    };
    const result = stricterPolicySnapshot(original, current);
    const startsAt = new Date("2026-09-03T00:00:00.000Z");
    expect(
      refundBasisPointsAt(result, startsAt, new Date("2026-09-01T00:00:00.000Z")),
    ).toBe(7_500);
    expect(
      refundBasisPointsAt(result, startsAt, new Date("2026-09-02T12:00:00.000Z")),
    ).toBe(2_500);
  });
});
