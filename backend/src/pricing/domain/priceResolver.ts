export type PriceRuleKind = "BASE" | "WEEKDAY_WEEKEND" | "DAY_TIME" | "SPECIAL_DATE";

export interface PriceRuleCandidate {
  id: number;
  kind: PriceRuleKind;
  amount: number;
  courtId: number | null;
  dayOfWeek: number | null;
  specialDate: string | null;
  startsAtLocal: string | null;
  endsAtLocal: string | null;
}

export interface PriceContext {
  courtId: number;
  localDate: string;
  dayOfWeek: number;
  localTime: string;
}

const kindPriority: Readonly<Record<PriceRuleKind, number>> = {
  BASE: 1,
  WEEKDAY_WEEKEND: 2,
  DAY_TIME: 3,
  SPECIAL_DATE: 4,
};

export function resolvePrice(
  rules: readonly PriceRuleCandidate[],
  context: PriceContext,
): PriceRuleCandidate {
  const applicableRules = rules.filter((rule) => isApplicable(rule, context));
  const selectedRule = applicableRules.sort(compareSpecificity)[0];
  if (!selectedRule) {
    throw new Error("Tidak ada aturan harga yang berlaku untuk slot ini.");
  }
  return selectedRule;
}

export function priceRulesOverlap(
  left: PriceRuleCandidate,
  right: PriceRuleCandidate,
): boolean {
  if (left.kind !== right.kind || left.courtId !== right.courtId) return false;
  if (left.specialDate !== right.specialDate || left.dayOfWeek !== right.dayOfWeek) {
    return false;
  }
  if (
    !left.startsAtLocal ||
    !left.endsAtLocal ||
    !right.startsAtLocal ||
    !right.endsAtLocal
  ) {
    return true;
  }
  return (
    left.startsAtLocal < right.endsAtLocal && right.startsAtLocal < left.endsAtLocal
  );
}

function isApplicable(rule: PriceRuleCandidate, context: PriceContext): boolean {
  if (rule.courtId !== null && rule.courtId !== context.courtId) return false;
  if (rule.specialDate !== null && rule.specialDate !== context.localDate) return false;
  if (rule.dayOfWeek !== null && rule.dayOfWeek !== context.dayOfWeek) return false;
  if (rule.startsAtLocal !== null && context.localTime < rule.startsAtLocal)
    return false;
  if (rule.endsAtLocal !== null && context.localTime >= rule.endsAtLocal) return false;
  return true;
}

function compareSpecificity(
  left: PriceRuleCandidate,
  right: PriceRuleCandidate,
): number {
  const kindDifference = kindPriority[right.kind] - kindPriority[left.kind];
  if (kindDifference !== 0) return kindDifference;
  return Number(right.courtId !== null) - Number(left.courtId !== null);
}
