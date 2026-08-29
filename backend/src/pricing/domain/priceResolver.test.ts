import { describe, expect, it } from "vitest";
import {
  priceRulesOverlap,
  resolvePrice,
  type PriceRuleCandidate,
} from "./priceResolver.js";

const baseRule: PriceRuleCandidate = {
  id: 1,
  kind: "BASE",
  amount: 100_000,
  courtId: null,
  dayOfWeek: null,
  specialDate: null,
  startsAtLocal: null,
  endsAtLocal: null,
};

describe("price resolver", () => {
  it("memilih special date sebelum rule lain", () => {
    const specialRule: PriceRuleCandidate = {
      ...baseRule,
      id: 2,
      kind: "SPECIAL_DATE",
      amount: 150_000,
      specialDate: "2026-08-28",
    };
    expect(
      resolvePrice([baseRule, specialRule], {
        courtId: 1,
        localDate: "2026-08-28",
        dayOfWeek: 5,
        localTime: "10:00:00",
      }).id,
    ).toBe(2);
  });

  it("mendeteksi overlap pada scope yang sama", () => {
    const first = {
      ...baseRule,
      kind: "DAY_TIME" as const,
      startsAtLocal: "10:00:00",
      endsAtLocal: "12:00:00",
    };
    const second = {
      ...first,
      id: 3,
      startsAtLocal: "11:00:00",
      endsAtLocal: "13:00:00",
    };
    expect(priceRulesOverlap(first, second)).toBe(true);
  });
});
