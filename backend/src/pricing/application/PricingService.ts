import { and, eq } from "drizzle-orm";
import type { DatabaseConnection } from "../../database/client.js";
import { formatPublicId, parsePublicId } from "../../database/ids.js";
import {
  courts,
  priceRules,
  venueSearchMetrics,
  venues,
} from "../../database/schema/index.js";
import { ApiError } from "../../http/ApiError.js";
import {
  priceRulesOverlap,
  resolvePrice,
  type PriceRuleCandidate,
  type PriceRuleKind,
} from "../domain/priceResolver.js";

export interface CreatePriceRuleInput {
  tenantId: string;
  venueId: string;
  courtId: string | null;
  kind: PriceRuleKind;
  amount: number;
  dayOfWeek: number | null;
  specialDate: string | null;
  startsAtLocal: string | null;
  endsAtLocal: string | null;
}

export class PricingService {
  constructor(private readonly database: DatabaseConnection) {}

  async createRule(input: CreatePriceRuleInput): Promise<{ id: string }> {
    const tenantDatabaseId = parsePublicId(input.tenantId);
    const venueDatabaseId = parsePublicId(input.venueId);
    const courtDatabaseId = input.courtId ? parsePublicId(input.courtId) : null;

    return this.database.db.transaction(async (transaction) => {
      const [venue] = await transaction
        .select({ id: venues.id })
        .from(venues)
        .where(
          and(eq(venues.id, venueDatabaseId), eq(venues.tenantId, tenantDatabaseId)),
        )
        .limit(1)
        .for("update");
      if (!venue) throw new ApiError(404, "VENUE_NOT_FOUND", "Venue tidak ditemukan.");
      if (courtDatabaseId !== null) {
        const [court] = await transaction
          .select({ id: courts.id })
          .from(courts)
          .where(
            and(eq(courts.id, courtDatabaseId), eq(courts.venueId, venueDatabaseId)),
          )
          .limit(1);
        if (!court) {
          throw new ApiError(
            404,
            "COURT_NOT_FOUND",
            "Lapangan tidak ditemukan pada venue ini.",
          );
        }
      }
      const existingRules = await transaction
        .select()
        .from(priceRules)
        .where(
          and(eq(priceRules.venueId, venueDatabaseId), eq(priceRules.active, true)),
        )
        .for("update");
      const candidate: PriceRuleCandidate = {
        id: 0,
        ...input,
        courtId: courtDatabaseId,
      };
      const overlappingRule = existingRules
        .map(toCandidate)
        .filter((rule): rule is PriceRuleCandidate => rule !== null)
        .find((rule) => priceRulesOverlap(rule, candidate));
      if (overlappingRule) {
        throw new ApiError(
          409,
          "PRICE_RULE_OVERLAP",
          "Aturan harga bertumpuk pada scope dan rentang waktu yang sama.",
          {
            conflictingRuleId: formatPublicId(overlappingRule.id),
            conflictingKind: overlappingRule.kind,
          },
        );
      }
      const [created] = await transaction
        .insert(priceRules)
        .values({
          venueId: venueDatabaseId,
          courtId: courtDatabaseId,
          kind: input.kind,
          amount: input.amount,
          dayOfWeek: input.dayOfWeek,
          specialDate: input.specialDate,
          startsAtLocal: input.startsAtLocal,
          endsAtLocal: input.endsAtLocal,
          priority: priorityFor(input.kind),
        })
        .$returningId();
      if (!created) throw new Error("MySQL tidak mengembalikan ID aturan harga.");
      if (input.kind === "BASE") {
        await transaction
          .update(venueSearchMetrics)
          .set({ minimumPrice: input.amount, updatedAt: new Date() })
          .where(eq(venueSearchMetrics.venueId, venueDatabaseId));
      }
      return { id: formatPublicId(created.id) };
    });
  }

  async preview(input: {
    tenantId: string;
    venueId: string;
    courtId: string;
    samples: Array<{ localDate: string; localTime: string }>;
    candidate?: CreatePriceRuleInput | undefined;
  }): Promise<{
    items: Array<{
      localDate: string;
      localTime: string;
      amount: number;
      selectedRuleId: string;
      selectedKind: PriceRuleKind;
      scope: "COURT" | "VENUE";
    }>;
  }> {
    const tenantDatabaseId = parsePublicId(input.tenantId);
    const venueDatabaseId = parsePublicId(input.venueId);
    const courtDatabaseId = parsePublicId(input.courtId);
    const [court] = await this.database.db
      .select({ id: courts.id })
      .from(courts)
      .innerJoin(venues, eq(venues.id, courts.venueId))
      .where(
        and(
          eq(courts.id, courtDatabaseId),
          eq(courts.venueId, venueDatabaseId),
          eq(venues.tenantId, tenantDatabaseId),
        ),
      )
      .limit(1);
    if (!court) {
      throw new ApiError(
        404,
        "COURT_NOT_FOUND",
        "Lapangan tidak ditemukan pada venue ini.",
      );
    }
    const rules = (
      await this.database.db
        .select()
        .from(priceRules)
        .where(
          and(eq(priceRules.venueId, venueDatabaseId), eq(priceRules.active, true)),
        )
    )
      .map(toCandidate)
      .filter((rule): rule is PriceRuleCandidate => rule !== null);
    if (input.candidate) {
      const candidateCourtId = input.candidate.courtId
        ? parsePublicId(input.candidate.courtId)
        : null;
      if (candidateCourtId !== null && candidateCourtId !== courtDatabaseId) {
        const [candidateCourt] = await this.database.db
          .select({ id: courts.id })
          .from(courts)
          .where(
            and(eq(courts.id, candidateCourtId), eq(courts.venueId, venueDatabaseId)),
          )
          .limit(1);
        if (!candidateCourt) {
          throw new ApiError(
            404,
            "COURT_NOT_FOUND",
            "Lapangan kandidat harga tidak ditemukan pada venue ini.",
          );
        }
      }
      const candidate: PriceRuleCandidate = {
        id: 0,
        kind: input.candidate.kind,
        amount: input.candidate.amount,
        courtId: candidateCourtId,
        dayOfWeek: input.candidate.dayOfWeek,
        specialDate: input.candidate.specialDate,
        startsAtLocal: input.candidate.startsAtLocal,
        endsAtLocal: input.candidate.endsAtLocal,
      };
      const conflictingRule = rules.find((rule) => priceRulesOverlap(rule, candidate));
      if (conflictingRule) {
        throw new ApiError(
          409,
          "PRICE_RULE_OVERLAP",
          "Kandidat aturan bertumpuk dengan aturan harga aktif.",
          {
            conflictingRuleId: formatPublicId(conflictingRule.id),
            conflictingKind: conflictingRule.kind,
          },
        );
      }
      rules.push(candidate);
    }

    return {
      items: input.samples.map((sample) => {
        let selectedRule: PriceRuleCandidate;
        try {
          selectedRule = resolvePrice(rules, {
            courtId: courtDatabaseId,
            localDate: sample.localDate,
            dayOfWeek: dayOfWeek(sample.localDate),
            localTime: sample.localTime,
          });
        } catch {
          throw new ApiError(
            422,
            "PRICE_RULE_NOT_FOUND",
            `Tidak ada harga yang berlaku pada ${sample.localDate} ${sample.localTime.slice(0, 5)}.`,
          );
        }
        return {
          ...sample,
          amount: selectedRule.amount,
          selectedRuleId:
            selectedRule.id === 0 ? "candidate" : formatPublicId(selectedRule.id),
          selectedKind: selectedRule.kind,
          scope:
            selectedRule.courtId === null ? ("VENUE" as const) : ("COURT" as const),
        };
      }),
    };
  }
}

function dayOfWeek(localDate: string): number {
  return new Date(`${localDate}T12:00:00Z`).getUTCDay();
}

function toCandidate(rule: typeof priceRules.$inferSelect): PriceRuleCandidate | null {
  if (!isKind(rule.kind)) return null;
  return {
    id: rule.id,
    kind: rule.kind,
    amount: rule.amount,
    courtId: rule.courtId,
    dayOfWeek: rule.dayOfWeek,
    specialDate: rule.specialDate,
    startsAtLocal: rule.startsAtLocal,
    endsAtLocal: rule.endsAtLocal,
  };
}

function isKind(value: string): value is PriceRuleKind {
  return (
    value === "BASE" ||
    value === "WEEKDAY_WEEKEND" ||
    value === "DAY_TIME" ||
    value === "SPECIAL_DATE"
  );
}

function priorityFor(kind: PriceRuleKind): number {
  return { BASE: 1, WEEKDAY_WEEKEND: 2, DAY_TIME: 3, SPECIAL_DATE: 4 }[kind];
}
