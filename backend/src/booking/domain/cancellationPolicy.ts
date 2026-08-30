export interface CancellationPolicyTier {
  minimumHoursBefore: number;
  maximumHoursBefore: number | null;
  refundBasisPoints: number;
}

export interface CancellationPolicySnapshot {
  templateId: string | null;
  name: string;
  tiers: CancellationPolicyTier[];
  original?: unknown;
  current?: unknown;
}

export function normalizeCancellationPolicyTiers(
  tiers: readonly CancellationPolicyTier[],
): CancellationPolicyTier[] | null {
  const sorted = [...tiers].sort(
    (left, right) => left.minimumHoursBefore - right.minimumHoursBefore,
  );
  if (sorted.length === 0 || sorted[0]?.minimumHoursBefore !== 0) return null;

  for (const [index, tier] of sorted.entries()) {
    const next = sorted[index + 1];
    if (
      tier.minimumHoursBefore < 0 ||
      tier.refundBasisPoints < 0 ||
      tier.refundBasisPoints > 10_000 ||
      (tier.maximumHoursBefore !== null &&
        tier.maximumHoursBefore <= tier.minimumHoursBefore) ||
      (next
        ? tier.maximumHoursBefore !== next.minimumHoursBefore
        : tier.maximumHoursBefore !== null)
    ) {
      return null;
    }
  }
  return sorted;
}

export function refundBasisPointsAt(
  snapshot: unknown,
  startsAt: Date,
  now: Date,
): number {
  const hoursBefore = Math.max(0, (startsAt.getTime() - now.getTime()) / 3_600_000);
  return basisPointsForHours(policyTiers(snapshot), hoursBefore);
}

export function stricterPolicySnapshot(
  original: unknown,
  current: unknown,
): CancellationPolicySnapshot {
  const originalTiers = policyTiers(original);
  const currentTiers = policyTiers(current);
  const boundaries = [
    ...new Set([
      0,
      ...originalTiers.flatMap((tier) =>
        [tier.minimumHoursBefore, tier.maximumHoursBefore].filter(
          (value): value is number => value !== null,
        ),
      ),
      ...currentTiers.flatMap((tier) =>
        [tier.minimumHoursBefore, tier.maximumHoursBefore].filter(
          (value): value is number => value !== null,
        ),
      ),
    ]),
  ].sort((left, right) => left - right);
  const tiers = boundaries.map((minimumHoursBefore, index) => {
    const maximumHoursBefore = boundaries[index + 1] ?? null;
    const sample =
      maximumHoursBefore === null
        ? minimumHoursBefore + 1
        : (minimumHoursBefore + maximumHoursBefore) / 2;
    return {
      minimumHoursBefore,
      maximumHoursBefore,
      refundBasisPoints: Math.min(
        basisPointsForHours(originalTiers, sample),
        basisPointsForHours(currentTiers, sample),
      ),
    };
  });
  return {
    templateId: null,
    name: "Kebijakan lebih ketat setelah reschedule",
    tiers,
    original,
    current,
  };
}

export function originalPolicySnapshot(snapshot: unknown): unknown {
  return snapshot && typeof snapshot === "object" && "original" in snapshot
    ? snapshot.original
    : snapshot;
}

function basisPointsForHours(
  tiers: CancellationPolicyTier[],
  hoursBefore: number,
): number {
  return (
    tiers.find(
      (tier) =>
        hoursBefore >= tier.minimumHoursBefore &&
        (tier.maximumHoursBefore === null || hoursBefore < tier.maximumHoursBefore),
    )?.refundBasisPoints ?? 0
  );
}

function policyTiers(snapshot: unknown): CancellationPolicyTier[] {
  if (
    !snapshot ||
    typeof snapshot !== "object" ||
    !("tiers" in snapshot) ||
    !Array.isArray(snapshot.tiers)
  )
    return BASELINE_TIERS;
  const parsed = snapshot.tiers.flatMap((tier) => {
    if (!tier || typeof tier !== "object") return [];
    const value = tier as Record<string, unknown>;
    if (
      typeof value.minimumHoursBefore !== "number" ||
      typeof value.refundBasisPoints !== "number"
    )
      return [];
    return [
      {
        minimumHoursBefore: value.minimumHoursBefore,
        maximumHoursBefore:
          typeof value.maximumHoursBefore === "number"
            ? value.maximumHoursBefore
            : null,
        refundBasisPoints: value.refundBasisPoints,
      },
    ];
  });
  return normalizeCancellationPolicyTiers(parsed) ?? BASELINE_TIERS;
}

const BASELINE_TIERS: CancellationPolicyTier[] = [
  { minimumHoursBefore: 0, maximumHoursBefore: 6, refundBasisPoints: 0 },
  { minimumHoursBefore: 6, maximumHoursBefore: 24, refundBasisPoints: 5_000 },
  { minimumHoursBefore: 24, maximumHoursBefore: null, refundBasisPoints: 10_000 },
];
