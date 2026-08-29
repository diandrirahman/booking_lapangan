import {
  and,
  asc,
  desc,
  eq,
  exists,
  gt,
  gte,
  inArray,
  isNull,
  like,
  lt,
  lte,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { DatabaseConnection } from "../../database/client.js";
import { formatPublicId, parsePublicId } from "../../database/ids.js";
import {
  bookingSlotReservations,
  courtBlocks,
  courtBookingSettings,
  courts,
  courtSlots,
  facilities,
  mediaAssets,
  addons,
  promotionScopes,
  promotions,
  sports,
  tenants,
  venueFacilities,
  venueMedia,
  venuePaymentSettings,
  venueSearchMetrics,
  venueSports,
  venues,
} from "../../database/schema/index.js";
import { ApiError } from "../../http/ApiError.js";

export type VenueSearchSort =
  "RELEVANT" | "NEAREST" | "PRICE_LOWEST" | "RATING_HIGHEST" | "POPULAR" | "NEWEST";

export type VenuePaymentMode = "FULL" | "DP" | "PAY_AT_VENUE";

export interface VenueSearchParameters {
  query?: string | undefined;
  area?: string | undefined;
  cityCode?: string | undefined;
  sport?: string | undefined;
  facilitySlugs?: string[] | undefined;
  date?: string | undefined;
  time?: string | undefined;
  minimumPrice?: number | undefined;
  maximumPrice?: number | undefined;
  indoorOutdoorType?: "INDOOR" | "OUTDOOR" | "MIXED" | undefined;
  paymentMode?: VenuePaymentMode | undefined;
  hasPromo?: boolean | undefined;
  minimumRating?: number | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  maximumDistanceKm?: number | undefined;
  sort?: VenueSearchSort | undefined;
  cursor?: string | undefined;
  limit: number;
}

export interface VenueView {
  id: string;
  slug: string;
  name: string;
  location: string;
  cityCode: string | null;
  indoorOutdoorType: string;
  sport: string;
  sports: string[];
  rating: number;
  reviewCount: number;
  priceFrom: number;
  hasPromo: boolean;
  promoLabel: string | null;
  nearestSlotStartsAt: string | null;
  paymentModes: VenuePaymentMode[];
  distanceKm: number | null;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
}

export interface VenueDetailView extends VenueView {
  description: string;
  galleryUrls: string[];
  facilities: string[];
  parkingInfo: string | null;
  houseRules: string | null;
  timezone: string;
  courts: Array<{
    id: string;
    name: string;
    sport: string;
    surface: string | null;
  }>;
  addons: Array<{
    id: string;
    name: string;
    price: number;
  }>;
}

const EARTH_RADIUS_KM = 6_371;

export class CatalogService {
  constructor(
    private readonly database: DatabaseConnection,
    private readonly publicMediaBaseUrl = "",
  ) {}

  async search(
    parameters: VenueSearchParameters,
    now = new Date(),
  ): Promise<{ items: VenueView[]; nextCursor: string | null }> {
    const distanceExpression = createDistanceExpression(parameters);
    const nearestSlotExpression = createNearestSlotExpression(now);
    const cursorCondition = await this.createCursorCondition(
      parameters,
      distanceExpression,
      nearestSlotExpression,
    );
    const conditions = this.createSearchConditions(
      parameters,
      distanceExpression,
      cursorCondition,
    );
    const order = createSortOrder(
      parameters.sort ?? "RELEVANT",
      distanceExpression,
      parameters.latitude !== undefined && parameters.longitude !== undefined,
      nearestSlotExpression,
    );

    const rows = await this.database.db
      .select({
        id: venues.id,
        slug: venues.slug,
        name: venues.name,
        location: venues.addressLine,
        cityCode: venues.cityCode,
        indoorOutdoorType: venues.indoorOutdoorType,
        rating: venueSearchMetrics.ratingAverage,
        reviewCount: venueSearchMetrics.reviewCount,
        priceFrom: venueSearchMetrics.minimumPrice,
        nearestSlotStartsAt: nearestSlotExpression,
        latitude: venues.latitude,
        longitude: venues.longitude,
        allowFull: venuePaymentSettings.allowFull,
        allowDp: venuePaymentSettings.allowDp,
        allowPayAtVenue: venuePaymentSettings.allowPayAtVenue,
        distanceKm: distanceExpression.as("distance_km"),
      })
      .from(venues)
      .innerJoin(tenants, eq(tenants.id, venues.tenantId))
      .innerJoin(venueSearchMetrics, eq(venueSearchMetrics.venueId, venues.id))
      .leftJoin(venuePaymentSettings, eq(venuePaymentSettings.venueId, venues.id))
      .where(and(...conditions))
      .orderBy(...order)
      .limit(parameters.limit + 1);

    const pageRows = rows.slice(0, parameters.limit);
    const relatedData = await this.loadRelatedData(pageRows.map((row) => row.id));
    const items = pageRows.map((row) => {
      const venueSports = relatedData.sportsByVenue.get(row.id) ?? [];
      const promotionLabel = relatedData.promotionByVenue.get(row.id) ?? null;
      return {
        id: formatPublicId(row.id),
        slug: row.slug,
        name: row.name,
        location: row.location,
        cityCode: row.cityCode,
        indoorOutdoorType: row.indoorOutdoorType,
        sport: venueSports[0] ?? "Olahraga",
        sports: venueSports,
        rating: Number(row.rating),
        reviewCount: row.reviewCount,
        priceFrom: row.priceFrom,
        hasPromo: promotionLabel !== null,
        promoLabel: promotionLabel,
        nearestSlotStartsAt: toIsoString(row.nearestSlotStartsAt),
        paymentModes: paymentModesFor(row),
        distanceKm:
          row.distanceKm === null ? null : Math.round(Number(row.distanceKm) * 10) / 10,
        latitude: row.latitude === null ? null : Number(row.latitude),
        longitude: row.longitude === null ? null : Number(row.longitude),
        imageUrl: relatedData.imageByVenue.get(row.id) ?? null,
      } satisfies VenueView;
    });

    return {
      items,
      nextCursor: rows.length > parameters.limit ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async getBySlug(slug: string): Promise<VenueDetailView> {
    const page = await this.search({ query: slug, sort: "RELEVANT", limit: 20 });
    const venue = page.items.find((item) => item.slug === slug);
    if (!venue) throw new ApiError(404, "VENUE_NOT_FOUND", "Venue tidak ditemukan.");
    const venueDatabaseId = parsePublicId(venue.id);
    const [detailRows, facilityRows, courtRows, mediaRows, addonRows] =
      await Promise.all([
        this.database.db
          .select({
            description: venues.description,
            parkingInfo: venues.parkingInfo,
            houseRules: venues.houseRules,
            timezone: venues.timezone,
          })
          .from(venues)
          .where(eq(venues.id, venueDatabaseId))
          .limit(1),
        this.database.db
          .select({ name: facilities.name })
          .from(venueFacilities)
          .innerJoin(facilities, eq(facilities.id, venueFacilities.facilityId))
          .where(eq(venueFacilities.venueId, venueDatabaseId)),
        this.database.db
          .select({
            id: courts.id,
            name: courts.name,
            sport: sports.name,
            surface: courts.surface,
          })
          .from(courts)
          .innerJoin(sports, eq(sports.id, courts.sportId))
          .where(and(eq(courts.venueId, venueDatabaseId), eq(courts.status, "ACTIVE"))),
        this.database.db
          .select({ storageKey: mediaAssets.storageKey })
          .from(venueMedia)
          .innerJoin(mediaAssets, eq(mediaAssets.id, venueMedia.mediaAssetId))
          .where(
            and(
              eq(venueMedia.venueId, venueDatabaseId),
              eq(mediaAssets.visibility, "PUBLIC"),
            ),
          )
          .orderBy(asc(venueMedia.sortOrder)),
        this.database.db
          .select({ id: addons.id, name: addons.name, price: addons.price })
          .from(addons)
          .where(and(eq(addons.venueId, venueDatabaseId), eq(addons.active, true)))
          .orderBy(asc(addons.name)),
      ]);
    const details = detailRows[0];
    if (!details) {
      throw new ApiError(404, "VENUE_NOT_FOUND", "Venue tidak ditemukan.");
    }
    return {
      ...venue,
      description: details.description ?? "",
      galleryUrls: mediaRows.flatMap((media) => {
        const url = publicObjectUrl(this.publicMediaBaseUrl, media.storageKey);
        return url ? [url] : [];
      }),
      facilities: facilityRows.map((facility) => facility.name),
      parkingInfo: details.parkingInfo,
      houseRules: details.houseRules,
      timezone: details.timezone,
      courts: courtRows.map((court) => ({
        ...court,
        id: formatPublicId(court.id),
      })),
      addons: addonRows.map((addon) => ({
        id: formatPublicId(addon.id),
        name: addon.name,
        price: addon.price,
      })),
    };
  }

  private createSearchConditions(
    parameters: VenueSearchParameters,
    distanceExpression: SQL<number | null>,
    cursorCondition: SQL | null,
  ): SQL[] {
    const conditions: SQL[] = [
      eq(venues.status, "ACTIVE"),
      eq(venues.publicationStatus, "APPROVED"),
      eq(tenants.status, "ACTIVE"),
    ];
    const searchPattern = parameters.query ? `%${parameters.query}%` : undefined;
    const areaPattern = parameters.area ? `%${parameters.area}%` : undefined;

    if (cursorCondition) conditions.push(cursorCondition);
    if (searchPattern) {
      conditions.push(
        or(
          like(venues.name, searchPattern),
          like(venues.addressLine, searchPattern),
          like(venues.slug, searchPattern),
        )!,
      );
    }
    if (areaPattern) conditions.push(like(venues.addressLine, areaPattern));
    if (parameters.cityCode) conditions.push(eq(venues.cityCode, parameters.cityCode));
    if (parameters.indoorOutdoorType) {
      conditions.push(eq(venues.indoorOutdoorType, parameters.indoorOutdoorType));
    }
    if (parameters.minimumPrice !== undefined) {
      conditions.push(gte(venueSearchMetrics.minimumPrice, parameters.minimumPrice));
    }
    if (parameters.maximumPrice !== undefined) {
      conditions.push(lte(venueSearchMetrics.minimumPrice, parameters.maximumPrice));
    }
    if (parameters.minimumRating !== undefined) {
      conditions.push(
        gte(venueSearchMetrics.ratingAverage, String(parameters.minimumRating)),
      );
    }
    if (parameters.date) {
      const range = createJakartaSearchRange(parameters.date, parameters.time);
      conditions.push(
        exists(
          this.database.db
            .select({ id: courtSlots.id })
            .from(courtSlots)
            .innerJoin(courts, eq(courts.id, courtSlots.courtId))
            .where(
              and(
                eq(courts.venueId, venues.id),
                eq(courts.status, "ACTIVE"),
                eq(courtSlots.status, "OPEN"),
                gte(courtSlots.startsAt, range.startsAt),
                lt(courtSlots.startsAt, range.endsAt),
                notExists(
                  this.database.db
                    .select({ id: bookingSlotReservations.courtSlotId })
                    .from(bookingSlotReservations)
                    .where(eq(bookingSlotReservations.courtSlotId, courtSlots.id)),
                ),
              ),
            ),
        ),
      );
    }
    if (parameters.sport) {
      conditions.push(
        exists(
          this.database.db
            .select({ id: venueSports.venueId })
            .from(venueSports)
            .innerJoin(sports, eq(sports.id, venueSports.sportId))
            .where(
              and(
                eq(venueSports.venueId, venues.id),
                eq(sports.slug, parameters.sport),
              ),
            ),
        ),
      );
    }
    for (const facilitySlug of parameters.facilitySlugs ?? []) {
      conditions.push(
        exists(
          this.database.db
            .select({ id: venueFacilities.venueId })
            .from(venueFacilities)
            .innerJoin(facilities, eq(facilities.id, venueFacilities.facilityId))
            .where(
              and(
                eq(venueFacilities.venueId, venues.id),
                eq(facilities.slug, facilitySlug),
              ),
            ),
        ),
      );
    }
    if (parameters.hasPromo) {
      conditions.push(
        exists(
          this.database.db
            .select({ id: promotionScopes.id })
            .from(promotionScopes)
            .innerJoin(promotions, eq(promotions.id, promotionScopes.promotionId))
            .where(
              and(
                eq(promotionScopes.scopeType, "VENUE"),
                eq(promotionScopes.scopeReferenceId, venues.id),
                eq(promotionScopes.includeExclude, "INCLUDE"),
                eq(promotions.status, "ACTIVE"),
                eq(promotions.discoveryOnly, true),
              ),
            ),
        ),
      );
    }
    if (parameters.paymentMode) {
      const paymentColumn = {
        FULL: venuePaymentSettings.allowFull,
        DP: venuePaymentSettings.allowDp,
        PAY_AT_VENUE: venuePaymentSettings.allowPayAtVenue,
      }[parameters.paymentMode];
      conditions.push(eq(paymentColumn, true));
    }
    if (
      parameters.latitude !== undefined &&
      parameters.longitude !== undefined &&
      parameters.maximumDistanceKm !== undefined
    ) {
      conditions.push(lte(distanceExpression, parameters.maximumDistanceKm));
    }
    return conditions;
  }

  private async createCursorCondition(
    parameters: VenueSearchParameters,
    distanceExpression: SQL<number | null>,
    nearestSlotExpression: SQL<Date | null>,
  ): Promise<SQL | null> {
    if (!parameters.cursor) return null;
    const cursorId = parsePublicId(parameters.cursor);
    const [cursor] = await this.database.db
      .select({
        id: venues.id,
        publishedAt: venues.publishedAt,
        price: venueSearchMetrics.minimumPrice,
        rating: venueSearchMetrics.ratingAverage,
        popularity: venueSearchMetrics.popularityScore,
        nearestSlot: nearestSlotExpression,
        distanceKm: distanceExpression.as("cursor_distance_km"),
      })
      .from(venues)
      .innerJoin(venueSearchMetrics, eq(venueSearchMetrics.venueId, venues.id))
      .where(eq(venues.id, cursorId))
      .limit(1);
    if (!cursor) {
      throw new ApiError(422, "INVALID_CURSOR", "Cursor pencarian tidak valid.");
    }

    const tieBreaker = gt(venues.id, cursor.id);
    switch (parameters.sort ?? "RELEVANT") {
      case "PRICE_LOWEST":
        return or(
          gt(venueSearchMetrics.minimumPrice, cursor.price),
          and(eq(venueSearchMetrics.minimumPrice, cursor.price), tieBreaker),
        )!;
      case "RATING_HIGHEST":
        return or(
          lt(venueSearchMetrics.ratingAverage, cursor.rating),
          and(eq(venueSearchMetrics.ratingAverage, cursor.rating), tieBreaker),
        )!;
      case "POPULAR":
      case "RELEVANT":
        return or(
          lt(venueSearchMetrics.popularityScore, cursor.popularity),
          and(eq(venueSearchMetrics.popularityScore, cursor.popularity), tieBreaker),
        )!;
      case "NEWEST":
        return cursor.publishedAt
          ? or(
              lt(venues.publishedAt, cursor.publishedAt),
              and(eq(venues.publishedAt, cursor.publishedAt), tieBreaker),
            )!
          : tieBreaker;
      case "NEAREST": {
        const hasLocation =
          parameters.latitude !== undefined && parameters.longitude !== undefined;
        if (hasLocation && cursor.distanceKm !== null) {
          const cursorDistance = Number(cursor.distanceKm);
          return or(
            gt(distanceExpression, cursorDistance),
            and(eq(distanceExpression, cursorDistance), tieBreaker),
          )!;
        }
        return cursor.nearestSlot
          ? or(
              gt(nearestSlotExpression, cursor.nearestSlot),
              isNull(nearestSlotExpression),
              and(eq(nearestSlotExpression, cursor.nearestSlot), tieBreaker),
            )!
          : and(isNull(nearestSlotExpression), tieBreaker)!;
      }
    }
  }

  private async loadRelatedData(venueIds: number[]): Promise<{
    sportsByVenue: Map<number, string[]>;
    promotionByVenue: Map<number, string>;
    imageByVenue: Map<number, string>;
  }> {
    if (venueIds.length === 0) {
      return {
        sportsByVenue: new Map(),
        promotionByVenue: new Map(),
        imageByVenue: new Map(),
      };
    }
    const [sportRows, promotionRows, mediaRows] = await Promise.all([
      this.database.db
        .select({ venueId: venueSports.venueId, name: sports.name })
        .from(venueSports)
        .innerJoin(sports, eq(sports.id, venueSports.sportId))
        .where(inArray(venueSports.venueId, venueIds))
        .orderBy(asc(sports.name)),
      this.database.db
        .select({ venueId: promotionScopes.scopeReferenceId, label: promotions.name })
        .from(promotionScopes)
        .innerJoin(promotions, eq(promotions.id, promotionScopes.promotionId))
        .where(
          and(
            inArray(promotionScopes.scopeReferenceId, venueIds),
            eq(promotionScopes.scopeType, "VENUE"),
            eq(promotionScopes.includeExclude, "INCLUDE"),
            eq(promotions.status, "ACTIVE"),
            eq(promotions.discoveryOnly, true),
          ),
        ),
      this.database.db
        .select({ venueId: venueMedia.venueId, storageKey: mediaAssets.storageKey })
        .from(venueMedia)
        .innerJoin(mediaAssets, eq(mediaAssets.id, venueMedia.mediaAssetId))
        .where(
          and(
            inArray(venueMedia.venueId, venueIds),
            eq(venueMedia.purpose, "COVER"),
            eq(mediaAssets.visibility, "PUBLIC"),
          ),
        ),
    ]);
    const sportsByVenue = new Map<number, string[]>();
    for (const row of sportRows) {
      sportsByVenue.set(row.venueId, [
        ...(sportsByVenue.get(row.venueId) ?? []),
        row.name,
      ]);
    }
    return {
      sportsByVenue,
      promotionByVenue: new Map(
        promotionRows.flatMap((row) =>
          row.venueId === null ? [] : ([[row.venueId, row.label]] as const),
        ),
      ),
      imageByVenue: new Map(
        mediaRows.flatMap((row) => {
          const url = publicObjectUrl(this.publicMediaBaseUrl, row.storageKey);
          return url ? ([[row.venueId, url]] as const) : [];
        }),
      ),
    };
  }
}

function publicObjectUrl(baseUrl: string, storageKey: string): string | null {
  if (!baseUrl) return `/api/v1/media?key=${encodeURIComponent(storageKey)}`;
  const encodedKey = storageKey.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl.replace(/\/$/, "")}/${encodedKey}`;
}

function toIsoString(value: Date | string | null): string | null {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  const utcValue = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  return new Date(utcValue).toISOString();
}

function createDistanceExpression(
  parameters: VenueSearchParameters,
): SQL<number | null> {
  if (parameters.latitude === undefined || parameters.longitude === undefined) {
    return sql<number | null>`NULL`;
  }
  const latitude = parameters.latitude;
  const longitude = parameters.longitude;
  // Haversine uses portable MySQL functions and stays read-only; reservation logic never
  // depends on this approximate discovery distance.
  return sql<number | null>`
    ${EARTH_RADIUS_KM} * 2 * ASIN(SQRT(
      POWER(SIN((RADIANS(${venues.latitude}) - RADIANS(${latitude})) / 2), 2) +
      COS(RADIANS(${latitude})) * COS(RADIANS(${venues.latitude})) *
      POWER(SIN((RADIANS(${venues.longitude}) - RADIANS(${longitude})) / 2), 2)
    ))
  `;
}

function createSortOrder(
  sort: VenueSearchSort,
  distanceExpression: SQL<number | null>,
  hasLocation: boolean,
  nearestSlotExpression: SQL<Date | null>,
): SQL[] {
  const tieBreaker = asc(venues.id);
  switch (sort) {
    case "NEAREST":
      return hasLocation
        ? [asc(distanceExpression), tieBreaker]
        : [
            asc(sql`${nearestSlotExpression} IS NULL`),
            asc(nearestSlotExpression),
            tieBreaker,
          ];
    case "PRICE_LOWEST":
      return [asc(venueSearchMetrics.minimumPrice), tieBreaker];
    case "RATING_HIGHEST":
      return [desc(venueSearchMetrics.ratingAverage), tieBreaker];
    case "POPULAR":
      return [desc(venueSearchMetrics.popularityScore), tieBreaker];
    case "NEWEST":
      return [desc(venues.publishedAt), tieBreaker];
    case "RELEVANT":
      return [desc(venueSearchMetrics.popularityScore), tieBreaker];
  }
}

function createNearestSlotExpression(now: Date): SQL<Date | null> {
  return sql<Date | null>`(
    SELECT MIN(${courtSlots.startsAt})
    FROM ${courtSlots}
    INNER JOIN ${courts} ON ${courts.id} = ${courtSlots.courtId}
    INNER JOIN ${courtBookingSettings}
      ON ${courtBookingSettings.courtId} = ${courts.id}
    WHERE ${courts.venueId} = ${venues.id}
      AND ${courts.status} = 'ACTIVE'
      AND ${courtSlots.status} = 'OPEN'
      AND ${courtSlots.startsAt} >= DATE_ADD(
        ${now}, INTERVAL ${courtBookingSettings.minimumLeadMinutes} MINUTE
      )
      AND ${courtSlots.startsAt} <= DATE_ADD(
        ${now}, INTERVAL ${courtBookingSettings.bookingWindowDays} DAY
      )
      AND NOT EXISTS (
        SELECT 1
        FROM ${bookingSlotReservations}
        WHERE ${bookingSlotReservations.courtSlotId} = ${courtSlots.id}
          AND (
            ${bookingSlotReservations.expiresAt} IS NULL
            OR ${bookingSlotReservations.expiresAt} > ${now}
          )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM ${courtBlocks}
        WHERE ${courtBlocks.venueId} = ${venues.id}
          AND (
            ${courtBlocks.courtId} IS NULL
            OR ${courtBlocks.courtId} = ${courts.id}
          )
          AND ${courtBlocks.startsAt} < ${courtSlots.endsAt}
          AND ${courtBlocks.endsAt} > ${courtSlots.startsAt}
      )
  )`;
}

function createJakartaSearchRange(
  date: string,
  time?: string,
): {
  startsAt: Date;
  endsAt: Date;
} {
  const startsAt = new Date(`${date}T${time ?? "00:00"}:00+07:00`);
  const endsAt = new Date(`${date}T23:59:59.999+07:00`);
  return { startsAt, endsAt };
}

function paymentModesFor(input: {
  allowFull: boolean | null;
  allowDp: boolean | null;
  allowPayAtVenue: boolean | null;
}): VenuePaymentMode[] {
  const modes: VenuePaymentMode[] = [];
  if (input.allowFull) modes.push("FULL");
  if (input.allowDp) modes.push("DP");
  if (input.allowPayAtVenue) modes.push("PAY_AT_VENUE");
  return modes;
}
