import { sql } from "drizzle-orm";
import {
  boolean,
  datetime,
  index,
  int,
  json,
  mysqlTable,
  primaryKey,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { bigId, bigReference, entityId, entityReference } from "./columns.js";

export const users = mysqlTable(
  "users",
  {
    id: bigId(),
    name: varchar("name", { length: 50 }).notNull(),
    email: varchar("email", { length: 254 }).notNull(),
    phoneE164: varchar("phone_e164", { length: 16 }),
    passwordHash: varchar("password_hash", { length: 255 }),
    status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
    emailVerifiedAt: datetime("email_verified_at", { mode: "date" }),
    deletedAt: datetime("deleted_at", { mode: "date" }),
    createdAt: datetime("created_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime("updated_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const authIdentities = mysqlTable(
  "auth_identities",
  {
    id: bigId(),
    userId: bigReference("user_id")
      .notNull()
      .references(() => users.id),
    provider: varchar("provider", { length: 20 }).notNull(),
    providerSubject: varchar("provider_subject", { length: 191 }).notNull(),
    createdAt: datetime("created_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime("updated_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("auth_provider_subject_unique").on(
      table.provider,
      table.providerSubject,
    ),
    uniqueIndex("auth_user_provider_unique").on(table.userId, table.provider),
  ],
);

export const tenants = mysqlTable(
  "tenants",
  {
    id: entityId(),
    name: varchar("name", { length: 80 }).notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("DRAFT"),
    primaryOwnerMembershipId: bigReference("primary_owner_membership_id"),
    suspendedAt: datetime("suspended_at", { mode: "date" }),
    deletedAt: datetime("deleted_at", { mode: "date" }),
    createdAt: datetime("created_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime("updated_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("tenants_slug_unique").on(table.slug)],
);

export const tenantMemberships = mysqlTable(
  "tenant_memberships",
  {
    id: bigId(),
    tenantId: entityReference("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: bigReference("user_id")
      .notNull()
      .references(() => users.id),
    role: varchar("role", { length: 20 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
    createdAt: datetime("created_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime("updated_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("memberships_tenant_user_unique").on(table.tenantId, table.userId),
    index("memberships_user_status_idx").on(table.userId, table.status),
  ],
);

export const platformAdmins = mysqlTable(
  "platform_admins",
  {
    id: entityId(),
    userId: bigReference("user_id")
      .notNull()
      .references(() => users.id),
    active: boolean("active").notNull().default(true),
    createdAt: datetime("created_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("platform_admin_user_unique").on(table.userId)],
);

export const memberVenueAssignments = mysqlTable(
  "member_venue_assignments",
  {
    membershipId: bigReference("membership_id")
      .notNull()
      .references(() => tenantMemberships.id),
    venueId: entityReference("venue_id").notNull(),
    createdAt: datetime("created_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [primaryKey({ columns: [table.membershipId, table.venueId] })],
);

export const ownerVerificationCases = mysqlTable(
  "owner_verification_cases",
  {
    id: entityId(),
    tenantId: entityReference("tenant_id")
      .notNull()
      .references(() => tenants.id),
    status: varchar("status", { length: 20 }).notNull().default("DRAFT"),
    submittedSnapshot: json("submitted_snapshot"),
    reason: text("reason"),
    version: int("version", { unsigned: true }).notNull(),
    submittedAt: datetime("submitted_at", { mode: "date" }),
    decidedAt: datetime("decided_at", { mode: "date" }),
    decidedByUserId: bigReference("decided_by_user_id").references(() => users.id),
    createdAt: datetime("created_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime("updated_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("owner_verification_status_idx").on(table.status)],
);

export const verificationDocuments = mysqlTable("verification_documents", {
  id: bigId(),
  caseId: entityReference("case_id")
    .notNull()
    .references(() => ownerVerificationCases.id),
  mediaAssetId: entityReference("media_asset_id").notNull(),
  documentType: varchar("document_type", { length: 32 }).notNull(),
  simulated: boolean("simulated").notNull().default(true),
  createdAt: datetime("created_at", { mode: "date" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: bigId(),
    tenantId: entityReference("tenant_id").references(() => tenants.id),
    venueId: entityReference("venue_id"),
    actorUserId: bigReference("actor_user_id").references(() => users.id),
    action: varchar("action", { length: 64 }).notNull(),
    resourceType: varchar("resource_type", { length: 32 }).notNull(),
    resourceId: bigReference("resource_id"),
    reason: text("reason"),
    beforeState: json("before_state"),
    afterState: json("after_state"),
    requestId: varchar("request_id", { length: 40 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: varchar("user_agent", { length: 255 }),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    index("audit_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("audit_resource_idx").on(table.resourceType, table.resourceId),
  ],
);
