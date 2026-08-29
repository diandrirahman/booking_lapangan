import { and, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { DatabaseConnection } from "../../database/client.js";
import {
  courtBookingSettings,
  courtSlots,
  courts,
  courtWeeklySchedules,
  scheduleExceptions,
  venues,
} from "../../database/schema/index.js";
import { localDateBoundsUtc, localDateTimeToUtc } from "./timeZone.js";

interface LocalTimeRange {
  opensAt: string;
  closesAt: string;
}

export class SlotMaterializer {
  constructor(private readonly database: DatabaseConnection) {}

  async ensureDate(courtId: number, localDate: string): Promise<void> {
    const [court] = await this.database.db
      .select({
        venueId: courts.venueId,
        timezone: venues.timezone,
        intervalMinutes: courtBookingSettings.intervalMinutes,
      })
      .from(courts)
      .innerJoin(venues, eq(venues.id, courts.venueId))
      .innerJoin(courtBookingSettings, eq(courtBookingSettings.courtId, courts.id))
      .where(eq(courts.id, courtId))
      .limit(1);
    if (!court) return;

    const dayOfWeek = new Date(`${localDate}T12:00:00Z`).getUTCDay();
    const [weeklySchedules, exceptions] = await Promise.all([
      this.database.db
        .select({
          opensAt: courtWeeklySchedules.opensAt,
          closesAt: courtWeeklySchedules.closesAt,
        })
        .from(courtWeeklySchedules)
        .where(
          and(
            eq(courtWeeklySchedules.courtId, courtId),
            eq(courtWeeklySchedules.dayOfWeek, dayOfWeek),
            eq(courtWeeklySchedules.active, true),
          ),
        ),
      this.database.db
        .select()
        .from(scheduleExceptions)
        .where(
          and(
            eq(scheduleExceptions.venueId, court.venueId),
            eq(scheduleExceptions.localDate, localDate),
            or(
              eq(scheduleExceptions.courtId, courtId),
              isNull(scheduleExceptions.courtId),
            ),
          ),
        ),
    ]);
    const courtException = exceptions.find(
      (exception) => exception.courtId === courtId,
    );
    const venueException = exceptions.find((exception) => exception.courtId === null);
    const effectiveRanges = resolveEffectiveRanges(
      courtException ?? venueException,
      weeklySchedules,
    );
    const desiredSlots = materializeRanges(
      localDate,
      court.timezone,
      court.intervalMinutes,
      effectiveRanges,
    );
    if (desiredSlots.length > 0) {
      await this.database.db
        .insert(courtSlots)
        .values(
          desiredSlots.map((slot) => ({
            courtId,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            status: "OPEN",
          })),
        )
        .onDuplicateKeyUpdate({ set: { version: sql`${courtSlots.version}` } });
    }

    const bounds = localDateBoundsUtc(localDate, court.timezone);
    const existingSlots = await this.database.db
      .select({
        id: courtSlots.id,
        startsAt: courtSlots.startsAt,
        endsAt: courtSlots.endsAt,
      })
      .from(courtSlots)
      .where(
        and(
          eq(courtSlots.courtId, courtId),
          gte(courtSlots.startsAt, bounds.start),
          lt(courtSlots.startsAt, bounds.end),
        ),
      );
    if (existingSlots.length === 0) return;

    const desiredKeys = new Set(
      desiredSlots.map((slot) => rangeKey(slot.startsAt, slot.endsAt)),
    );
    const openSlotIds = existingSlots
      .filter((slot) => desiredKeys.has(rangeKey(slot.startsAt, slot.endsAt)))
      .map((slot) => slot.id);
    await this.database.db.transaction(async (transaction) => {
      await transaction
        .update(courtSlots)
        .set({ status: "BLOCKED" })
        .where(
          inArray(
            courtSlots.id,
            existingSlots.map((slot) => slot.id),
          ),
        );
      if (openSlotIds.length === 0) return;
      await transaction
        .update(courtSlots)
        .set({ status: "OPEN" })
        .where(inArray(courtSlots.id, openSlotIds));
    });
  }
}

function resolveEffectiveRanges(
  exception: typeof scheduleExceptions.$inferSelect | undefined,
  weeklySchedules: LocalTimeRange[],
): LocalTimeRange[] {
  if (exception?.kind === "CLOSED") return [];
  if (exception?.opensAt && exception.closesAt) {
    return [{ opensAt: exception.opensAt, closesAt: exception.closesAt }];
  }
  return weeklySchedules;
}

function materializeRanges(
  localDate: string,
  timezone: string,
  intervalMinutes: number,
  ranges: LocalTimeRange[],
): Array<{ startsAt: Date; endsAt: Date }> {
  const durationMilliseconds = intervalMinutes * 60_000;
  return ranges.flatMap((range) => {
    const opensAt = localDateTimeToUtc(localDate, range.opensAt, timezone);
    const closesAt = localDateTimeToUtc(localDate, range.closesAt, timezone);
    const slots: Array<{ startsAt: Date; endsAt: Date }> = [];
    for (
      let startsAt = opensAt;
      startsAt.getTime() + durationMilliseconds <= closesAt.getTime();
      startsAt = new Date(startsAt.getTime() + durationMilliseconds)
    ) {
      slots.push({
        startsAt,
        endsAt: new Date(startsAt.getTime() + durationMilliseconds),
      });
    }
    return slots;
  });
}

function rangeKey(startsAt: Date, endsAt: Date): string {
  return `${startsAt.toISOString()}_${endsAt.toISOString()}`;
}
