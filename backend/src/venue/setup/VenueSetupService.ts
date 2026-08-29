import { randomBytes } from "node:crypto";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import type { DatabaseConnection } from "../../database/client.js";
import { formatPublicId, parsePublicId } from "../../database/ids.js";
import {
  addons,
  auditLogs,
  bookingBufferOptions,
  bookingIntervalOptions,
  courts,
  courtBlocks,
  courtBookingSettings,
  courtWeeklySchedules,
  facilities,
  outboxEvents,
  priceRules,
  scheduleExceptions,
  sports,
  tenants,
  venueFacilities,
  venueMedia,
  venuePaymentSettings,
  venuePublicationRequests,
  venueSearchMetrics,
  venueSports,
  venues,
} from "../../database/schema/index.js";
import { ApiError } from "../../http/ApiError.js";
import {
  validateAvailabilitySettings,
  validatePaymentSettings,
  validateScheduleException,
} from "./setupRules.js";

export interface VenueProfileInput {
  name: string;
  description: string;
  phoneE164: string;
  email?: string | undefined;
  addressLine: string;
  provinceCode?: string | undefined;
  cityCode?: string | undefined;
  districtCode?: string | undefined;
  postalCode?: string | undefined;
  latitude: string;
  longitude: string;
  timezone: string;
  indoorOutdoorType: string;
  parkingInfo?: string | undefined;
  houseRules?: string;
  emergencyContact?: string | undefined;
}

export interface SetupProgress {
  percentage: number;
  complete: boolean;
  sections: Readonly<Record<string, boolean>>;
}

export interface VenueSetupSummary {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  addressLine: string;
  provinceCode: string | null;
  cityCode: string | null;
  districtCode: string | null;
  postalCode: string | null;
  status: string;
  publicationStatus: string;
  progress: SetupProgress;
  revisionReason: string | null;
}

export interface VenueSetupDetail extends VenueSetupSummary {
  description: string;
  phoneE164: string;
  email: string | null;
  latitude: string | null;
  longitude: string | null;
  timezone: string;
  indoorOutdoorType: string;
  parkingInfo: string | null;
  houseRules: string;
  emergencyContact: string | null;
  sportIds: string[];
  facilityIds: string[];
  mediaCount: number;
  courts: Array<{
    id: string;
    name: string;
    sportId: string;
    surface: string | null;
    capacity: number | null;
    status: string;
    settings: {
      intervalMinutes: number;
      bufferMinutes: number;
      minimumDurationMinutes: number;
      maximumDurationMinutes: number;
      bookingWindowDays: number;
      minimumLeadMinutes: number;
    } | null;
    weeklySchedule: Array<{
      dayOfWeek: number;
      opensAt: string;
      closesAt: string;
      active: boolean;
    }>;
  }>;
  exceptions: Array<{
    id: string;
    courtId: string | null;
    localDate: string;
    kind: string;
    opensAt: string | null;
    closesAt: string | null;
    reason: string | null;
  }>;
  blocks: Array<{
    id: string;
    courtId: string | null;
    kind: string;
    startsAt: string;
    endsAt: string;
    reason: string;
  }>;
  priceRules: Array<{
    id: string;
    courtId: string | null;
    kind: string;
    amount: number;
    active: boolean;
  }>;
  paymentSettings: {
    allowFull: boolean;
    allowDp: boolean;
    dpPercentage: number | null;
    allowPayAtVenue: boolean;
    reservationAmount: number | null;
    manualConfirmationMinutes: number;
    balanceDeadlineMinutes: number | null;
  } | null;
  addons: Array<{ id: string; name: string; price: number; active: boolean }>;
}

export class VenueSetupService {
  constructor(
    private readonly database: DatabaseConnection,
    private readonly publishPendingEvents: () => Promise<void> = () =>
      Promise.resolve(),
  ) {}

  async listForTenant(
    tenantId: string,
    allowedVenueIds: string[] | null = null,
  ): Promise<VenueSetupSummary[]> {
    if (allowedVenueIds?.length === 0) return [];
    const tenantDatabaseId = parsePublicId(tenantId);
    const venueRows = await this.database.db
      .select()
      .from(venues)
      .where(
        and(
          eq(venues.tenantId, tenantDatabaseId),
          allowedVenueIds
            ? inArray(venues.id, allowedVenueIds.map(parsePublicId))
            : undefined,
        ),
      )
      .orderBy(desc(venues.updatedAt));

    return Promise.all(
      venueRows.map(async (venue) => {
        const [progress, latestRequest] = await Promise.all([
          this.progress(formatPublicId(venue.id), tenantId),
          this.latestPublicationRequest(venue.id),
        ]);
        return {
          id: formatPublicId(venue.id),
          tenantId,
          name: venue.name,
          slug: venue.slug,
          addressLine: venue.addressLine,
          provinceCode: venue.provinceCode,
          cityCode: venue.cityCode,
          districtCode: venue.districtCode,
          postalCode: venue.postalCode,
          status: venue.status,
          publicationStatus: venue.publicationStatus,
          progress,
          revisionReason: latestRequest?.reason ?? null,
        };
      }),
    );
  }

  async detail(venueId: string, tenantId: string): Promise<VenueSetupDetail> {
    const venueDatabaseId = parsePublicId(venueId);
    const tenantDatabaseId = parsePublicId(tenantId);
    const [venue] = await this.database.db
      .select()
      .from(venues)
      .where(and(eq(venues.id, venueDatabaseId), eq(venues.tenantId, tenantDatabaseId)))
      .limit(1);
    if (!venue) throw new ApiError(404, "VENUE_NOT_FOUND", "Venue tidak ditemukan.");

    const [
      progress,
      selectedSports,
      selectedFacilities,
      mediaRows,
      courtRows,
      schedules,
      settings,
      exceptions,
      blocks,
      pricing,
      paymentRows,
      addonRows,
      latestRequest,
    ] = await Promise.all([
      this.progress(venueId, tenantId),
      this.database.db
        .select()
        .from(venueSports)
        .where(eq(venueSports.venueId, venueDatabaseId)),
      this.database.db
        .select()
        .from(venueFacilities)
        .where(eq(venueFacilities.venueId, venueDatabaseId)),
      this.database.db
        .select()
        .from(venueMedia)
        .where(eq(venueMedia.venueId, venueDatabaseId)),
      this.database.db
        .select()
        .from(courts)
        .where(eq(courts.venueId, venueDatabaseId))
        .orderBy(asc(courts.name)),
      this.database.db
        .select({ schedule: courtWeeklySchedules })
        .from(courtWeeklySchedules)
        .innerJoin(courts, eq(courts.id, courtWeeklySchedules.courtId))
        .where(eq(courts.venueId, venueDatabaseId)),
      this.database.db
        .select({ settings: courtBookingSettings })
        .from(courtBookingSettings)
        .innerJoin(courts, eq(courts.id, courtBookingSettings.courtId))
        .where(eq(courts.venueId, venueDatabaseId)),
      this.database.db
        .select()
        .from(scheduleExceptions)
        .where(eq(scheduleExceptions.venueId, venueDatabaseId)),
      this.database.db
        .select()
        .from(courtBlocks)
        .where(eq(courtBlocks.venueId, venueDatabaseId)),
      this.database.db
        .select()
        .from(priceRules)
        .where(eq(priceRules.venueId, venueDatabaseId)),
      this.database.db
        .select()
        .from(venuePaymentSettings)
        .where(eq(venuePaymentSettings.venueId, venueDatabaseId))
        .limit(1),
      this.database.db
        .select()
        .from(addons)
        .where(eq(addons.venueId, venueDatabaseId))
        .orderBy(asc(addons.name)),
      this.latestPublicationRequest(venueDatabaseId),
    ]);

    return {
      id: venueId,
      tenantId,
      name: venue.name,
      slug: venue.slug,
      addressLine: venue.addressLine,
      provinceCode: venue.provinceCode,
      cityCode: venue.cityCode,
      districtCode: venue.districtCode,
      postalCode: venue.postalCode,
      status: venue.status,
      publicationStatus: venue.publicationStatus,
      progress,
      revisionReason: latestRequest?.reason ?? null,
      description: venue.description ?? "",
      phoneE164: venue.phoneE164 ?? "",
      email: venue.email,
      latitude: venue.latitude,
      longitude: venue.longitude,
      timezone: venue.timezone,
      indoorOutdoorType: venue.indoorOutdoorType,
      parkingInfo: venue.parkingInfo,
      houseRules: venue.houseRules ?? "",
      emergencyContact: venue.emergencyContact,
      sportIds: selectedSports.map((row) => formatPublicId(row.sportId)),
      facilityIds: selectedFacilities.map((row) => formatPublicId(row.facilityId)),
      mediaCount: mediaRows.length,
      courts: courtRows.map((court) => {
        const courtSettings = settings.find(
          (row) => row.settings.courtId === court.id,
        )?.settings;
        return {
          id: formatPublicId(court.id),
          name: court.name,
          sportId: formatPublicId(court.sportId),
          surface: court.surface,
          capacity: court.capacity,
          status: court.status,
          settings: courtSettings
            ? {
                intervalMinutes: courtSettings.intervalMinutes,
                bufferMinutes: courtSettings.bufferMinutes,
                minimumDurationMinutes: courtSettings.minimumDurationMinutes,
                maximumDurationMinutes: courtSettings.maximumDurationMinutes,
                bookingWindowDays: courtSettings.bookingWindowDays,
                minimumLeadMinutes: courtSettings.minimumLeadMinutes,
              }
            : null,
          weeklySchedule: schedules
            .filter((row) => row.schedule.courtId === court.id)
            .map(({ schedule }) => ({
              dayOfWeek: schedule.dayOfWeek,
              opensAt: schedule.opensAt,
              closesAt: schedule.closesAt,
              active: schedule.active,
            })),
        };
      }),
      exceptions: exceptions.map((exception) => ({
        id: formatPublicId(exception.id),
        courtId: exception.courtId ? formatPublicId(exception.courtId) : null,
        localDate: exception.localDate,
        kind: exception.kind,
        opensAt: exception.opensAt,
        closesAt: exception.closesAt,
        reason: exception.reason,
      })),
      blocks: blocks.map((block) => ({
        id: formatPublicId(block.id),
        courtId: block.courtId ? formatPublicId(block.courtId) : null,
        kind: block.kind,
        startsAt: block.startsAt.toISOString(),
        endsAt: block.endsAt.toISOString(),
        reason: block.reason,
      })),
      priceRules: pricing.map((rule) => ({
        id: formatPublicId(rule.id),
        courtId: rule.courtId ? formatPublicId(rule.courtId) : null,
        kind: rule.kind,
        amount: rule.amount,
        active: rule.active,
      })),
      paymentSettings: paymentRows[0]
        ? {
            allowFull: paymentRows[0].allowFull,
            allowDp: paymentRows[0].allowDp,
            dpPercentage: paymentRows[0].dpPercentage,
            allowPayAtVenue: paymentRows[0].allowPayAtVenue,
            reservationAmount: paymentRows[0].reservationAmount,
            manualConfirmationMinutes: paymentRows[0].manualConfirmationMinutes,
            balanceDeadlineMinutes: paymentRows[0].balanceDeadlineMinutes,
          }
        : null,
      addons: addonRows.map((addon) => ({
        id: formatPublicId(addon.id),
        name: addon.name,
        price: addon.price,
        active: addon.active,
      })),
    };
  }

  async masters(): Promise<{
    sports: Array<{ id: string; name: string }>;
    facilities: Array<{ id: string; name: string }>;
    intervals: number[];
    buffers: number[];
  }> {
    const [sportRows, facilityRows, intervals, buffers] = await Promise.all([
      this.database.db
        .select()
        .from(sports)
        .where(eq(sports.active, true))
        .orderBy(asc(sports.name)),
      this.database.db
        .select()
        .from(facilities)
        .where(eq(facilities.active, true))
        .orderBy(asc(facilities.name)),
      this.database.db
        .select()
        .from(bookingIntervalOptions)
        .where(eq(bookingIntervalOptions.active, true))
        .orderBy(asc(bookingIntervalOptions.minutes)),
      this.database.db
        .select()
        .from(bookingBufferOptions)
        .where(eq(bookingBufferOptions.active, true))
        .orderBy(asc(bookingBufferOptions.minutes)),
    ]);
    return {
      sports: sportRows.map((row) => ({ id: formatPublicId(row.id), name: row.name })),
      facilities: facilityRows.map((row) => ({
        id: formatPublicId(row.id),
        name: row.name,
      })),
      intervals: intervals.map((row) => row.minutes),
      buffers: buffers.map((row) => row.minutes),
    };
  }

  async createDraft(
    tenantId: string,
    name: string,
  ): Promise<{ id: string; slug: string }> {
    const slug = `${slugify(name)}-${randomBytes(3).toString("hex")}`;
    return this.database.db.transaction(async (transaction) => {
      const [created] = await transaction
        .insert(venues)
        .values({
          tenantId: parsePublicId(tenantId),
          name,
          slug,
          addressLine: "",
          indoorOutdoorType: "INDOOR",
          status: "DRAFT",
          publicationStatus: "PRIVATE",
        })
        .$returningId();
      if (!created) throw new Error("MySQL tidak mengembalikan ID venue baru.");
      await transaction.insert(venueSearchMetrics).values({ venueId: created.id });
      return { id: formatPublicId(created.id), slug };
    });
  }

  async updateProfile(
    venueId: string,
    tenantId: string,
    input: VenueProfileInput,
  ): Promise<void> {
    const result = await this.database.db
      .update(venues)
      .set({
        ...input,
        version: sql`${venues.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(venues.id, parsePublicId(venueId)),
          eq(venues.tenantId, parsePublicId(tenantId)),
        ),
      );
    if (result[0].affectedRows === 0) {
      throw new ApiError(404, "VENUE_NOT_FOUND", "Venue tidak ditemukan.");
    }
  }

  async replaceCatalog(
    venueId: string,
    tenantId: string,
    sportIds: string[],
    facilityIds: string[],
  ): Promise<void> {
    const venueDatabaseId = await this.requireVenue(venueId, tenantId);
    const sportDatabaseIds = sportIds.map(parsePublicId);
    const facilityDatabaseIds = facilityIds.map(parsePublicId);

    const [validSports, validFacilities] = await Promise.all([
      this.database.db
        .select({ id: sports.id })
        .from(sports)
        .where(and(eq(sports.active, true), inArray(sports.id, sportDatabaseIds))),
      facilityDatabaseIds.length === 0
        ? Promise.resolve([])
        : this.database.db
            .select({ id: facilities.id })
            .from(facilities)
            .where(
              and(
                eq(facilities.active, true),
                inArray(facilities.id, facilityDatabaseIds),
              ),
            ),
    ]);
    if (validSports.length !== new Set(sportDatabaseIds).size) {
      throw new ApiError(422, "SPORT_INVALID", "Pilihan olahraga tidak valid.");
    }
    if (validFacilities.length !== new Set(facilityDatabaseIds).size) {
      throw new ApiError(422, "FACILITY_INVALID", "Pilihan fasilitas tidak valid.");
    }

    await this.database.db.transaction(async (transaction) => {
      await transaction
        .delete(venueSports)
        .where(eq(venueSports.venueId, venueDatabaseId));
      await transaction
        .delete(venueFacilities)
        .where(eq(venueFacilities.venueId, venueDatabaseId));
      if (sportDatabaseIds.length > 0) {
        await transaction.insert(venueSports).values(
          [...new Set(sportDatabaseIds)].map((sportId) => ({
            venueId: venueDatabaseId,
            sportId,
          })),
        );
      }
      if (facilityDatabaseIds.length > 0) {
        await transaction.insert(venueFacilities).values(
          [...new Set(facilityDatabaseIds)].map((facilityId) => ({
            venueId: venueDatabaseId,
            facilityId,
          })),
        );
      }
    });
  }

  async createCourt(
    venueId: string,
    tenantId: string,
    input: {
      sportId: string;
      name: string;
      surface?: string | undefined;
      capacity?: number | undefined;
    },
  ): Promise<{ id: string }> {
    const venueDatabaseId = await this.requireVenue(venueId, tenantId);
    const sportDatabaseId = parsePublicId(input.sportId);
    const [venueSport] = await this.database.db
      .select({ sportId: venueSports.sportId })
      .from(venueSports)
      .where(
        and(
          eq(venueSports.venueId, venueDatabaseId),
          eq(venueSports.sportId, sportDatabaseId),
        ),
      )
      .limit(1);
    if (!venueSport) {
      throw new ApiError(
        422,
        "COURT_SPORT_INVALID",
        "Olahraga lapangan harus dipilih pada profil venue.",
      );
    }
    return this.database.db.transaction(async (transaction) => {
      const [created] = await transaction
        .insert(courts)
        .values({
          venueId: venueDatabaseId,
          sportId: sportDatabaseId,
          name: input.name,
          surface: input.surface,
          capacity: input.capacity,
          status: "ACTIVE",
        })
        .$returningId();
      if (!created) throw new Error("MySQL tidak mengembalikan ID lapangan baru.");
      await transaction.insert(courtBookingSettings).values({ courtId: created.id });
      return { id: formatPublicId(created.id) };
    });
  }

  async saveCourtAvailability(
    venueId: string,
    courtId: string,
    tenantId: string,
    input: {
      intervalMinutes: number;
      bufferMinutes: number;
      minimumDurationMinutes: number;
      maximumDurationMinutes: number;
      bookingWindowDays: number;
      minimumLeadMinutes: number;
      weeklySchedule: Array<{
        dayOfWeek: number;
        opensAt: string;
        closesAt: string;
        active: boolean;
      }>;
    },
  ): Promise<void> {
    try {
      validateAvailabilitySettings(input);
    } catch (error) {
      throw new ApiError(
        422,
        "AVAILABILITY_INVALID",
        error instanceof Error ? error.message : "Pengaturan jadwal tidak valid.",
      );
    }
    const venueDatabaseId = await this.requireVenue(venueId, tenantId);
    const courtDatabaseId = parsePublicId(courtId);
    const [court] = await this.database.db
      .select({ id: courts.id })
      .from(courts)
      .where(and(eq(courts.id, courtDatabaseId), eq(courts.venueId, venueDatabaseId)))
      .limit(1);
    if (!court) throw new ApiError(404, "COURT_NOT_FOUND", "Lapangan tidak ditemukan.");

    const [intervalOption, bufferOption] = await Promise.all([
      this.database.db
        .select({ id: bookingIntervalOptions.id })
        .from(bookingIntervalOptions)
        .where(
          and(
            eq(bookingIntervalOptions.minutes, input.intervalMinutes),
            eq(bookingIntervalOptions.active, true),
          ),
        )
        .limit(1),
      this.database.db
        .select({ id: bookingBufferOptions.id })
        .from(bookingBufferOptions)
        .where(
          and(
            eq(bookingBufferOptions.minutes, input.bufferMinutes),
            eq(bookingBufferOptions.active, true),
          ),
        )
        .limit(1),
    ]);
    if (!intervalOption[0] || !bufferOption[0]) {
      throw new ApiError(
        422,
        "SCHEDULE_OPTION_INACTIVE",
        "Interval dan buffer harus menggunakan opsi Admin yang masih aktif.",
      );
    }

    await this.database.db.transaction(async (transaction) => {
      const {
        weeklySchedule,
        intervalMinutes,
        bufferMinutes,
        minimumDurationMinutes,
        maximumDurationMinutes,
        bookingWindowDays,
        minimumLeadMinutes,
      } = input;
      await transaction
        .insert(courtBookingSettings)
        .values({
          courtId: courtDatabaseId,
          intervalMinutes,
          bufferMinutes,
          minimumDurationMinutes,
          maximumDurationMinutes,
          bookingWindowDays,
          minimumLeadMinutes,
        })
        .onDuplicateKeyUpdate({
          set: {
            intervalMinutes,
            bufferMinutes,
            minimumDurationMinutes,
            maximumDurationMinutes,
            bookingWindowDays,
            minimumLeadMinutes,
            updatedAt: new Date(),
          },
        });
      await transaction
        .delete(courtWeeklySchedules)
        .where(eq(courtWeeklySchedules.courtId, courtDatabaseId));
      const activeSchedules = weeklySchedule.filter((schedule) => schedule.active);
      if (activeSchedules.length > 0) {
        await transaction.insert(courtWeeklySchedules).values(
          activeSchedules.map((schedule) => ({
            courtId: courtDatabaseId,
            dayOfWeek: schedule.dayOfWeek,
            opensAt: schedule.opensAt,
            closesAt: schedule.closesAt,
            active: true,
          })),
        );
      }
    });
  }

  async createException(
    venueId: string,
    tenantId: string,
    input: {
      courtId?: string | undefined;
      localDate: string;
      kind: "OPEN" | "CLOSED" | "CUSTOM_HOURS";
      opensAt?: string | undefined;
      closesAt?: string | undefined;
      reason?: string | undefined;
    },
  ): Promise<{ id: string }> {
    const venueDatabaseId = await this.requireVenue(venueId, tenantId);
    try {
      validateScheduleException(input);
    } catch (error) {
      throw new ApiError(
        422,
        "SCHEDULE_EXCEPTION_INVALID",
        error instanceof Error ? error.message : "Pengecualian jadwal tidak valid.",
      );
    }
    if (input.courtId) {
      const [court] = await this.database.db
        .select({ id: courts.id })
        .from(courts)
        .where(
          and(
            eq(courts.id, parsePublicId(input.courtId)),
            eq(courts.venueId, venueDatabaseId),
          ),
        )
        .limit(1);
      if (!court)
        throw new ApiError(404, "COURT_NOT_FOUND", "Lapangan tidak ditemukan.");
    }
    const [created] = await this.database.db
      .insert(scheduleExceptions)
      .values({
        venueId: venueDatabaseId,
        courtId: input.courtId ? parsePublicId(input.courtId) : null,
        localDate: input.localDate,
        kind: input.kind,
        opensAt: input.opensAt,
        closesAt: input.closesAt,
        reason: input.reason,
      })
      .$returningId();
    if (!created) throw new Error("MySQL tidak mengembalikan ID exception baru.");
    return { id: formatPublicId(created.id) };
  }

  async savePaymentSettings(
    venueId: string,
    tenantId: string,
    input: {
      allowFull: boolean;
      allowDp: boolean;
      dpPercentage: number | null;
      allowPayAtVenue: boolean;
      reservationAmount: number | null;
      manualConfirmationMinutes: number;
      balanceDeadlineMinutes: number | null;
    },
  ): Promise<void> {
    try {
      validatePaymentSettings(input);
    } catch (error) {
      throw new ApiError(
        422,
        "PAYMENT_SETTINGS_INVALID",
        error instanceof Error ? error.message : "Pengaturan pembayaran tidak valid.",
      );
    }
    const venueDatabaseId = await this.requireVenue(venueId, tenantId);
    await this.database.db
      .insert(venuePaymentSettings)
      .values({ venueId: venueDatabaseId, ...input })
      .onDuplicateKeyUpdate({ set: input });
  }

  async createAddon(
    venueId: string,
    tenantId: string,
    input: { name: string; price: number },
  ): Promise<{ id: string }> {
    const venueDatabaseId = await this.requireVenue(venueId, tenantId);
    const [created] = await this.database.db
      .insert(addons)
      .values({ venueId: venueDatabaseId, ...input })
      .$returningId();
    if (!created) throw new Error("MySQL tidak mengembalikan ID add-on baru.");
    return { id: formatPublicId(created.id) };
  }

  async progress(venueId: string, tenantId: string): Promise<SetupProgress> {
    const venueDatabaseId = parsePublicId(venueId);
    const tenantDatabaseId = parsePublicId(tenantId);
    const [venue] = await this.database.db
      .select()
      .from(venues)
      .where(and(eq(venues.id, venueDatabaseId), eq(venues.tenantId, tenantDatabaseId)))
      .limit(1);
    if (!venue) throw new ApiError(404, "VENUE_NOT_FOUND", "Venue tidak ditemukan.");

    const [
      sportCount,
      mediaCount,
      courtCount,
      scheduleCount,
      pricingCount,
      paymentCount,
    ] = await Promise.all([
      this.countRows(venueSports, eq(venueSports.venueId, venueDatabaseId)),
      this.countRows(venueMedia, eq(venueMedia.venueId, venueDatabaseId)),
      this.countRows(courts, eq(courts.venueId, venueDatabaseId)),
      this.database.db
        .select({ total: count() })
        .from(courtWeeklySchedules)
        .innerJoin(courts, eq(courts.id, courtWeeklySchedules.courtId))
        .where(eq(courts.venueId, venueDatabaseId))
        .then((rows) => rows[0]?.total ?? 0),
      this.countRows(priceRules, eq(priceRules.venueId, venueDatabaseId)),
      this.countRows(
        venuePaymentSettings,
        eq(venuePaymentSettings.venueId, venueDatabaseId),
      ),
    ]);
    const requiredProfileValues = [
      venue.name,
      venue.description,
      venue.phoneE164,
      venue.addressLine,
      venue.provinceCode,
      venue.cityCode,
      venue.districtCode,
      venue.postalCode,
      venue.timezone,
      venue.indoorOutdoorType,
      venue.parkingInfo,
      venue.emergencyContact,
    ];
    const profileIsComplete =
      requiredProfileValues.every((value) => value?.trim()) &&
      venue.latitude !== null &&
      venue.longitude !== null;
    const sections = {
      profile: profileIsComplete,
      sports: sportCount > 0,
      media: mediaCount > 0,
      courts: courtCount > 0,
      schedule: scheduleCount > 0,
      pricing: pricingCount > 0,
      payment: paymentCount > 0,
      policies: Boolean(venue.houseRules),
    };
    const completed = Object.values(sections).filter(Boolean).length;
    return {
      percentage: Math.round((completed / Object.keys(sections).length) * 100),
      complete: completed === Object.keys(sections).length,
      sections,
    };
  }

  async submit(
    venueId: string,
    tenantId: string,
    userId: string,
    requestId?: string,
  ): Promise<{ requestId: string }> {
    const progress = await this.progress(venueId, tenantId);
    if (!progress.complete) {
      throw new ApiError(
        422,
        "VENUE_SETUP_INCOMPLETE",
        "Lengkapi seluruh bagian venue sebelum mengajukan verifikasi.",
        progress,
      );
    }
    return this.database.db.transaction(async (transaction) => {
      const venueDatabaseId = parsePublicId(venueId);
      const tenantDatabaseId = parsePublicId(tenantId);
      const [venue] = await transaction
        .select()
        .from(venues)
        .where(
          and(eq(venues.id, venueDatabaseId), eq(venues.tenantId, tenantDatabaseId)),
        )
        .limit(1)
        .for("update");
      if (!venue) throw new ApiError(404, "VENUE_NOT_FOUND", "Venue tidak ditemukan.");
      if (venue.publicationStatus === "IN_REVIEW") {
        throw new ApiError(
          409,
          "VERIFICATION_ALREADY_PENDING",
          "Venue ini sudah berada dalam antrian verifikasi.",
        );
      }
      const [
        sportRows,
        facilityRows,
        courtRows,
        addonRows,
        mediaTotal,
        rules,
        payment,
      ] = await Promise.all([
        transaction
          .select({ slug: sports.slug, name: sports.name })
          .from(venueSports)
          .innerJoin(sports, eq(sports.id, venueSports.sportId))
          .where(eq(venueSports.venueId, venueDatabaseId)),
        transaction
          .select({ slug: facilities.slug, name: facilities.name })
          .from(venueFacilities)
          .innerJoin(facilities, eq(facilities.id, venueFacilities.facilityId))
          .where(eq(venueFacilities.venueId, venueDatabaseId)),
        transaction
          .select()
          .from(courts)
          .where(eq(courts.venueId, venueDatabaseId))
          .orderBy(asc(courts.name)),
        transaction
          .select({ name: addons.name, price: addons.price, active: addons.active })
          .from(addons)
          .where(eq(addons.venueId, venueDatabaseId))
          .orderBy(asc(addons.name)),
        transaction
          .select({ total: count() })
          .from(venueMedia)
          .where(eq(venueMedia.venueId, venueDatabaseId))
          .then((rows) => rows[0]?.total ?? 0),
        transaction
          .select()
          .from(priceRules)
          .where(eq(priceRules.venueId, venueDatabaseId))
          .orderBy(desc(priceRules.priority)),
        transaction
          .select()
          .from(venuePaymentSettings)
          .where(eq(venuePaymentSettings.venueId, venueDatabaseId))
          .limit(1)
          .then((rows) => rows[0] ?? null),
      ]);
      const courtIds = courtRows.map((court) => court.id);
      const exceptionRows = await transaction
        .select()
        .from(scheduleExceptions)
        .where(eq(scheduleExceptions.venueId, venueDatabaseId))
        .orderBy(asc(scheduleExceptions.localDate));
      const [availabilityRows, weeklyScheduleRows] =
        courtIds.length === 0
          ? [[], []]
          : await Promise.all([
              transaction
                .select()
                .from(courtBookingSettings)
                .where(inArray(courtBookingSettings.courtId, courtIds)),
              transaction
                .select()
                .from(courtWeeklySchedules)
                .where(inArray(courtWeeklySchedules.courtId, courtIds))
                .orderBy(
                  asc(courtWeeklySchedules.courtId),
                  asc(courtWeeklySchedules.dayOfWeek),
                ),
            ]);
      const submittedSnapshot = {
        venue: {
          name: venue.name,
          slug: venue.slug,
          description: venue.description,
          phoneE164: venue.phoneE164,
          email: venue.email,
          addressLine: venue.addressLine,
          provinceCode: venue.provinceCode,
          cityCode: venue.cityCode,
          districtCode: venue.districtCode,
          postalCode: venue.postalCode,
          latitude: venue.latitude,
          longitude: venue.longitude,
          timezone: venue.timezone,
          indoorOutdoorType: venue.indoorOutdoorType,
          parkingInfo: venue.parkingInfo,
          houseRules: venue.houseRules,
          emergencyContact: venue.emergencyContact,
        },
        sports: sportRows,
        facilities: facilityRows,
        mediaCount: mediaTotal,
        addons: addonRows,
        courts: courtRows.map((court) => {
          const availability = availabilityRows.find((row) => row.courtId === court.id);
          return {
            id: formatPublicId(court.id),
            name: court.name,
            surface: court.surface,
            status: court.status,
            availability: availability
              ? {
                  intervalMinutes: availability.intervalMinutes,
                  bufferMinutes: availability.bufferMinutes,
                  minimumDurationMinutes: availability.minimumDurationMinutes,
                  maximumDurationMinutes: availability.maximumDurationMinutes,
                  bookingWindowDays: availability.bookingWindowDays,
                  minimumLeadMinutes: availability.minimumLeadMinutes,
                }
              : null,
            weeklySchedule: weeklyScheduleRows
              .filter((row) => row.courtId === court.id)
              .map((row) => ({
                dayOfWeek: row.dayOfWeek,
                opensAt: row.opensAt,
                closesAt: row.closesAt,
                active: row.active,
              })),
            exceptions: exceptionRows
              .filter((row) => row.courtId === court.id)
              .map((row) => ({
                localDate: row.localDate,
                kind: row.kind,
                opensAt: row.opensAt,
                closesAt: row.closesAt,
                reason: row.reason,
              })),
          };
        }),
        venueExceptions: exceptionRows
          .filter((row) => row.courtId === null)
          .map((row) => ({
            localDate: row.localDate,
            kind: row.kind,
            opensAt: row.opensAt,
            closesAt: row.closesAt,
            reason: row.reason,
          })),
        pricing: rules.map((rule) => ({
          id: formatPublicId(rule.id),
          courtId: rule.courtId ? formatPublicId(rule.courtId) : null,
          kind: rule.kind,
          priority: rule.priority,
          dayOfWeek: rule.dayOfWeek,
          specialDate: rule.specialDate,
          startsAtLocal: rule.startsAtLocal,
          endsAtLocal: rule.endsAtLocal,
          amount: rule.amount,
        })),
        payment: payment
          ? {
              allowFull: payment.allowFull,
              allowDp: payment.allowDp,
              dpPercentage: payment.dpPercentage,
              allowPayAtVenue: payment.allowPayAtVenue,
              reservationAmount: payment.reservationAmount,
              manualConfirmationMinutes: payment.manualConfirmationMinutes,
              balanceDeadlineMinutes: payment.balanceDeadlineMinutes,
            }
          : null,
      };
      const [createdRequest] = await transaction
        .insert(venuePublicationRequests)
        .values({
          venueId: venueDatabaseId,
          venueVersion: venue.version,
          status: "SUBMITTED",
          submittedSnapshot: JSON.stringify(submittedSnapshot),
          submittedByUserId: parsePublicId(userId),
        })
        .$returningId();
      if (!createdRequest) {
        throw new Error("MySQL tidak mengembalikan ID pengajuan publikasi.");
      }
      await transaction
        .update(venues)
        .set({ publicationStatus: "IN_REVIEW", updatedAt: new Date() })
        .where(eq(venues.id, venueDatabaseId));
      await transaction.insert(auditLogs).values({
        tenantId: tenantDatabaseId,
        venueId: venueDatabaseId,
        actorUserId: parsePublicId(userId),
        action: "venue.publication_submitted",
        resourceType: "venue",
        resourceId: venueDatabaseId,
        reason: "Venue diajukan untuk verifikasi.",
        beforeState: { publicationStatus: venue.publicationStatus },
        afterState: {
          publicationStatus: "IN_REVIEW",
          publicationRequestId: formatPublicId(createdRequest.id),
          venueVersion: venue.version,
        },
        requestId,
      });
      return { requestId: formatPublicId(createdRequest.id) };
    });
  }

  async decide(
    requestId: string,
    adminUserId: string,
    decision: "APPROVED" | "REJECTED" | "REVISION_REQUIRED",
    reason: string,
    auditRequestId?: string,
  ): Promise<void> {
    await this.database.db.transaction(async (transaction) => {
      const [request] = await transaction
        .select()
        .from(venuePublicationRequests)
        .where(eq(venuePublicationRequests.id, parsePublicId(requestId)))
        .limit(1)
        .for("update");
      if (!request || request.status !== "SUBMITTED") {
        throw new ApiError(
          409,
          "VERIFICATION_NOT_PENDING",
          "Pengajuan tidak lagi menunggu keputusan.",
        );
      }
      const [venue] = await transaction
        .select({
          tenantId: venues.tenantId,
          status: venues.status,
          publicationStatus: venues.publicationStatus,
        })
        .from(venues)
        .where(eq(venues.id, request.venueId))
        .limit(1)
        .for("update");
      if (!venue) {
        throw new ApiError(404, "VENUE_NOT_FOUND", "Venue tidak ditemukan.");
      }
      await transaction
        .update(venuePublicationRequests)
        .set({
          status: decision,
          reason,
          decidedByUserId: parsePublicId(adminUserId),
          decidedAt: new Date(),
        })
        .where(eq(venuePublicationRequests.id, parsePublicId(requestId)));
      await transaction
        .update(venues)
        .set({
          status: decision === "APPROVED" ? "ACTIVE" : "DRAFT",
          publicationStatus: decision,
          publishedAt: decision === "APPROVED" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(venues.id, request.venueId));
      if (decision === "APPROVED") {
        await transaction
          .update(tenants)
          .set({ status: "ACTIVE", updatedAt: new Date() })
          .where(eq(tenants.id, venue.tenantId));
      }
      await transaction.insert(auditLogs).values({
        tenantId: venue.tenantId,
        venueId: request.venueId,
        actorUserId: parsePublicId(adminUserId),
        action: "venue.publication_decided",
        resourceType: "venue",
        resourceId: request.venueId,
        reason,
        beforeState: {
          status: venue.status,
          publicationStatus: venue.publicationStatus,
          requestStatus: request.status,
        },
        afterState: {
          status: decision === "APPROVED" ? "ACTIVE" : "DRAFT",
          publicationStatus: decision,
          requestStatus: decision,
        },
        requestId: auditRequestId,
      });
      await transaction.insert(outboxEvents).values({
        tenantId: venue.tenantId,
        eventType: "venue.publication_changed",
        resourceType: "venue",
        resourceId: request.venueId,
        resourceVersion: request.venueVersion,
        payload: { status: decision, hint: "refetch-venue" },
        occurredAt: new Date(),
      });
    });
    try {
      await this.publishPendingEvents();
    } catch {
      // Publication is already committed and will be delivered by the outbox retry job.
    }
  }

  private async countRows(
    table:
      | typeof venueSports
      | typeof venueMedia
      | typeof courts
      | typeof priceRules
      | typeof venuePaymentSettings,
    condition: ReturnType<typeof eq>,
  ): Promise<number> {
    const rows = await this.database.db
      .select({ total: count() })
      .from(table)
      .where(condition);
    return rows[0]?.total ?? 0;
  }

  private async requireVenue(venueId: string, tenantId: string): Promise<number> {
    const venueDatabaseId = parsePublicId(venueId);
    const [venue] = await this.database.db
      .select({ id: venues.id })
      .from(venues)
      .where(
        and(
          eq(venues.id, venueDatabaseId),
          eq(venues.tenantId, parsePublicId(tenantId)),
        ),
      )
      .limit(1);
    if (!venue) throw new ApiError(404, "VENUE_NOT_FOUND", "Venue tidak ditemukan.");
    return venue.id;
  }

  private async latestPublicationRequest(venueId: number) {
    const [request] = await this.database.db
      .select()
      .from(venuePublicationRequests)
      .where(eq(venuePublicationRequests.venueId, venueId))
      .orderBy(desc(venuePublicationRequests.createdAt))
      .limit(1);
    return request;
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
