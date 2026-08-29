import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  datetime,
  decimal,
  index,
  int,
  mysqlTable,
  primaryKey,
  smallint,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import {
  bigReference,
  entityId,
  entityReference,
  masterId,
  masterReference,
} from "./columns.js";
import { tenants, users } from "./identity.js";

export const sports = mysqlTable(
  "sports",
  {
    id: masterId(),
    slug: varchar("slug", { length: 40 }).notNull(),
    name: varchar("name", { length: 40 }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: datetime("created_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("sports_slug_unique").on(table.slug)],
);

export const facilities = mysqlTable(
  "facilities",
  {
    id: masterId(),
    slug: varchar("slug", { length: 50 }).notNull(),
    name: varchar("name", { length: 50 }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: datetime("created_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("facilities_slug_unique").on(table.slug)],
);

export const mediaAssets = mysqlTable(
  "media_assets",
  {
    id: entityId(),
    ownerUserId: bigReference("owner_user_id").references(() => users.id),
    storageKey: varchar("storage_key", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    byteSize: bigint("byte_size", { mode: "number", unsigned: true }).notNull(),
    visibility: varchar("visibility", { length: 16 }).notNull(),
    altText: varchar("alt_text", { length: 150 }),
    createdAt: datetime("created_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("media_assets_storage_key_unique").on(table.storageKey)],
);

export const venues = mysqlTable(
  "venues",
  {
    id: entityId(),
    tenantId: entityReference("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: varchar("name", { length: 80 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 20 }).notNull().default("DRAFT"),
    publicationStatus: varchar("publication_status", { length: 20 })
      .notNull()
      .default("PRIVATE"),
    phoneE164: varchar("phone_e164", { length: 16 }),
    email: varchar("email", { length: 254 }),
    addressLine: varchar("address_line", { length: 255 }).notNull(),
    provinceCode: varchar("province_code", { length: 10 }),
    cityCode: varchar("city_code", { length: 10 }),
    districtCode: varchar("district_code", { length: 10 }),
    postalCode: varchar("postal_code", { length: 5 }),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    timezone: varchar("timezone", { length: 40 }).notNull().default("Asia/Jakarta"),
    indoorOutdoorType: varchar("indoor_outdoor_type", { length: 16 }).notNull(),
    parkingInfo: varchar("parking_info", { length: 255 }),
    houseRules: text("house_rules"),
    emergencyContact: varchar("emergency_contact", { length: 50 }),
    version: int("version", { unsigned: true }).notNull().default(1),
    publishedAt: datetime("published_at", { mode: "date" }),
    suspendedAt: datetime("suspended_at", { mode: "date" }),
    deletedAt: datetime("deleted_at", { mode: "date" }),
    createdAt: datetime("created_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime("updated_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("venues_slug_unique").on(table.slug),
    index("venues_tenant_status_idx").on(table.tenantId, table.status),
    index("venues_city_publication_idx").on(table.cityCode, table.publicationStatus),
  ],
);

export const venueSports = mysqlTable(
  "venue_sports",
  {
    venueId: entityReference("venue_id")
      .notNull()
      .references(() => venues.id),
    sportId: masterReference("sport_id")
      .notNull()
      .references(() => sports.id),
  },
  (table) => [primaryKey({ columns: [table.venueId, table.sportId] })],
);

export const venueFacilities = mysqlTable(
  "venue_facilities",
  {
    venueId: entityReference("venue_id")
      .notNull()
      .references(() => venues.id),
    facilityId: masterReference("facility_id")
      .notNull()
      .references(() => facilities.id),
  },
  (table) => [primaryKey({ columns: [table.venueId, table.facilityId] })],
);

export const venueMedia = mysqlTable(
  "venue_media",
  {
    venueId: entityReference("venue_id")
      .notNull()
      .references(() => venues.id),
    mediaAssetId: entityReference("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id),
    purpose: varchar("purpose", { length: 20 }).notNull(),
    sortOrder: smallint("sort_order", { unsigned: true }).notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.venueId, table.mediaAssetId] })],
);

export const courts = mysqlTable(
  "courts",
  {
    id: entityId(),
    venueId: entityReference("venue_id")
      .notNull()
      .references(() => venues.id),
    sportId: masterReference("sport_id")
      .notNull()
      .references(() => sports.id),
    name: varchar("name", { length: 50 }).notNull(),
    surface: varchar("surface", { length: 50 }),
    capacity: smallint("capacity", { unsigned: true }),
    status: varchar("status", { length: 16 }).notNull().default("ACTIVE"),
    createdAt: datetime("created_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime("updated_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("courts_venue_status_idx").on(table.venueId, table.status)],
);

export const addons = mysqlTable("addons", {
  id: entityId(),
  venueId: entityReference("venue_id")
    .notNull()
    .references(() => venues.id),
  name: varchar("name", { length: 60 }).notNull(),
  price: bigint("price", { mode: "number", unsigned: true }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: datetime("created_at", { mode: "date" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const addonCourts = mysqlTable(
  "addon_courts",
  {
    addonId: entityReference("addon_id")
      .notNull()
      .references(() => addons.id),
    courtId: entityReference("court_id")
      .notNull()
      .references(() => courts.id),
  },
  (table) => [primaryKey({ columns: [table.addonId, table.courtId] })],
);

export const venuePublicationRequests = mysqlTable(
  "venue_publication_requests",
  {
    id: entityId(),
    venueId: entityReference("venue_id")
      .notNull()
      .references(() => venues.id),
    venueVersion: int("venue_version", { unsigned: true }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("SUBMITTED"),
    submittedSnapshot: text("submitted_snapshot").notNull(),
    reason: text("reason"),
    submittedByUserId: bigReference("submitted_by_user_id")
      .notNull()
      .references(() => users.id),
    decidedByUserId: bigReference("decided_by_user_id").references(() => users.id),
    createdAt: datetime("created_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    decidedAt: datetime("decided_at", { mode: "date" }),
  },
  (table) => [index("publication_status_idx").on(table.status)],
);

export const venueSearchMetrics = mysqlTable("venue_search_metrics", {
  venueId: entityReference("venue_id")
    .primaryKey()
    .references(() => venues.id),
  ratingAverage: decimal("rating_average", { precision: 3, scale: 2 })
    .notNull()
    .default("0"),
  reviewCount: int("review_count", { unsigned: true }).notNull().default(0),
  popularityScore: int("popularity_score", { unsigned: true }).notNull().default(0),
  nearestSlotStartsAt: datetime("nearest_slot_starts_at", { mode: "date" }),
  minimumPrice: bigint("minimum_price", { mode: "number", unsigned: true })
    .notNull()
    .default(0),
  updatedAt: datetime("updated_at", { mode: "date" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const promotions = mysqlTable(
  "promotions",
  {
    id: entityId(),
    tenantId: entityReference("tenant_id").references(() => tenants.id),
    name: varchar("name", { length: 80 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 20 }).notNull().default("DRAFT"),
    startsAt: datetime("starts_at", { mode: "date" }).notNull(),
    endsAt: datetime("ends_at", { mode: "date" }).notNull(),
    discoveryOnly: boolean("discovery_only").notNull().default(true),
    createdAt: datetime("created_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("promotions_discovery_idx").on(table.status, table.startsAt)],
);

export const promotionScopes = mysqlTable(
  "promotion_scopes",
  {
    id: entityId(),
    promotionId: entityReference("promotion_id")
      .notNull()
      .references(() => promotions.id),
    scopeType: varchar("scope_type", { length: 20 }).notNull(),
    scopeReferenceId: bigReference("scope_reference_id"),
    includeExclude: varchar("include_exclude", { length: 8 })
      .notNull()
      .default("INCLUDE"),
  },
  (table) => [
    uniqueIndex("promotion_scope_unique").on(
      table.promotionId,
      table.scopeType,
      table.scopeReferenceId,
    ),
  ],
);
