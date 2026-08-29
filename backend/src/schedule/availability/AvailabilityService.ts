import { and, asc, eq, gt, gte, inArray, isNull, lt, or } from "drizzle-orm";
import type { DatabaseConnection } from "../../database/client.js";
import { formatPublicId, parsePublicId } from "../../database/ids.js";
import {
  bookingSlotReservations,
  courtBlocks,
  courtBookingSettings,
  courtSlots,
  courts,
  priceRules,
  venues,
} from "../../database/schema/index.js";
import { ApiError } from "../../http/ApiError.js";
import {
  resolvePrice,
  type PriceRuleCandidate,
  type PriceRuleKind,
} from "../../pricing/domain/priceResolver.js";
import { datePartsInTimeZone, localDateBoundsUtc } from "./timeZone.js";
import { SlotMaterializer } from "./SlotMaterializer.js";

export interface AvailabilitySlotView {
  id: string;
  startsAt: string;
  endsAt: string;
  price: number;
  status: "AVAILABLE" | "HELD" | "BOOKED" | "BLOCKED";
}

export class AvailabilityService {
  private readonly slotMaterializer: SlotMaterializer;

  constructor(private readonly database: DatabaseConnection) {
    this.slotMaterializer = new SlotMaterializer(database);
  }

  async get(
    courtId: string,
    localDate: string,
    now = new Date(),
  ): Promise<{ items: AvailabilitySlotView[]; version: number }> {
    const courtDatabaseId = parsePublicId(courtId);
    const [court] = await this.database.db
      .select({
        venueId: courts.venueId,
        timezone: venues.timezone,
        minimumLeadMinutes: courtBookingSettings.minimumLeadMinutes,
        bookingWindowDays: courtBookingSettings.bookingWindowDays,
      })
      .from(courts)
      .innerJoin(venues, eq(venues.id, courts.venueId))
      .innerJoin(courtBookingSettings, eq(courtBookingSettings.courtId, courts.id))
      .where(and(eq(courts.id, courtDatabaseId), eq(courts.status, "ACTIVE")))
      .limit(1);
    if (!court) throw new ApiError(404, "COURT_NOT_FOUND", "Lapangan tidak ditemukan.");

    await this.slotMaterializer.ensureDate(courtDatabaseId, localDate);

    const bounds = localDateBoundsUtc(localDate, court.timezone);
    const slots = await this.database.db
      .select()
      .from(courtSlots)
      .where(
        and(
          eq(courtSlots.courtId, courtDatabaseId),
          gte(courtSlots.startsAt, bounds.start),
          lt(courtSlots.startsAt, bounds.end),
        ),
      )
      .orderBy(asc(courtSlots.startsAt));
    if (slots.length === 0) return { items: [], version: 0 };

    const [blocks, reservations, rules] = await Promise.all([
      this.database.db
        .select()
        .from(courtBlocks)
        .where(
          and(
            eq(courtBlocks.venueId, court.venueId),
            or(eq(courtBlocks.courtId, courtDatabaseId), isNull(courtBlocks.courtId)),
            lt(courtBlocks.startsAt, bounds.end),
            gt(courtBlocks.endsAt, bounds.start),
          ),
        ),
      this.database.db
        .select()
        .from(bookingSlotReservations)
        .where(
          inArray(
            bookingSlotReservations.courtSlotId,
            slots.map((slot) => slot.id),
          ),
        ),
      this.database.db
        .select()
        .from(priceRules)
        .where(
          and(
            eq(priceRules.venueId, court.venueId),
            eq(priceRules.active, true),
            or(eq(priceRules.courtId, courtDatabaseId), isNull(priceRules.courtId)),
          ),
        ),
    ]);
    const ruleCandidates = rules.map(toPriceRuleCandidate).filter(isPriceRuleCandidate);
    const reservationBySlot = new Map(
      reservations.map((reservation) => [reservation.courtSlotId, reservation]),
    );
    const earliestBookableTime = new Date(
      now.getTime() + court.minimumLeadMinutes * 60_000,
    );
    const latestBookableTime = new Date(
      now.getTime() + court.bookingWindowDays * 24 * 60 * 60_000,
    );

    return {
      items: slots.map((slot) => {
        const parts = datePartsInTimeZone(slot.startsAt, court.timezone);
        const price = resolvePrice(ruleCandidates, {
          courtId: courtDatabaseId,
          ...parts,
        }).amount;
        const blocked = blocks.some(
          (block) => block.startsAt < slot.endsAt && block.endsAt > slot.startsAt,
        );
        const reservation = reservationBySlot.get(slot.id);
        const outsideBookingWindow =
          slot.startsAt < earliestBookableTime || slot.startsAt > latestBookableTime;
        return {
          id: formatPublicId(slot.id),
          startsAt: slot.startsAt.toISOString(),
          endsAt: slot.endsAt.toISOString(),
          price,
          status: resolveAvailabilityStatus(
            slot.status,
            blocked || outsideBookingWindow,
            reservation,
            now,
          ),
        };
      }),
      version: Math.max(...slots.map((slot) => slot.version)),
    };
  }
}

function resolveAvailabilityStatus(
  slotStatus: string,
  blocked: boolean,
  reservation: typeof bookingSlotReservations.$inferSelect | undefined,
  now: Date,
): AvailabilitySlotView["status"] {
  if (blocked || slotStatus !== "OPEN") return "BLOCKED";
  if (!reservation) return "AVAILABLE";
  if (reservation.expiresAt !== null && reservation.expiresAt <= now)
    return "AVAILABLE";
  return reservation.reservationStatus === "CONFIRMED" ? "BOOKED" : "HELD";
}

function toPriceRuleCandidate(
  rule: typeof priceRules.$inferSelect,
): PriceRuleCandidate | null {
  if (!isPriceRuleKind(rule.kind)) return null;
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

function isPriceRuleCandidate(
  value: PriceRuleCandidate | null,
): value is PriceRuleCandidate {
  return value !== null;
}

function isPriceRuleKind(value: string): value is PriceRuleKind {
  return (
    value === "BASE" ||
    value === "WEEKDAY_WEEKEND" ||
    value === "DAY_TIME" ||
    value === "SPECIAL_DATE"
  );
}
