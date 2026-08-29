import { and, count, desc, eq, gte, isNull, lt, lte, sql } from "drizzle-orm";
import type { DatabaseConnection } from "../../database/client.js";
import { formatPublicId, parsePublicId } from "../../database/ids.js";
import { ApiError } from "../../http/ApiError.js";
import {
  auditLogs,
  bookings,
  outboxEvents,
  paymentAttempts,
  tenantMemberships,
  tenants,
  users,
  venuePublicationRequests,
  venues,
} from "../../database/schema/index.js";

export class AdminOperationsService {
  constructor(private readonly database: DatabaseConnection) {}

  async dashboard(): Promise<{
    users: number;
    tenants: number;
    activeVenues: number;
    pendingVerifications: number;
    bookings: number;
    sandboxVolume: number;
    pendingOutbox: number;
  }> {
    const [
      userCount,
      tenantCount,
      venueCount,
      verificationCount,
      bookingCount,
      paymentVolume,
      outboxCount,
    ] = await Promise.all([
      this.countRows(users),
      this.countRows(tenants),
      this.database.db
        .select({ total: count() })
        .from(venues)
        .where(eq(venues.status, "ACTIVE")),
      this.database.db
        .select({ total: count() })
        .from(venuePublicationRequests)
        .where(eq(venuePublicationRequests.status, "SUBMITTED")),
      this.countRows(bookings),
      this.database.db
        .select({ total: sql<number>`coalesce(sum(${paymentAttempts.amount}), 0)` })
        .from(paymentAttempts)
        .where(eq(paymentAttempts.status, "PAID")),
      this.database.db
        .select({ total: count() })
        .from(outboxEvents)
        .where(isNull(outboxEvents.processedAt)),
    ]);
    return {
      users: userCount,
      tenants: tenantCount,
      activeVenues: venueCount[0]?.total ?? 0,
      pendingVerifications: verificationCount[0]?.total ?? 0,
      bookings: bookingCount,
      sandboxVolume: Number(paymentVolume[0]?.total ?? 0),
      pendingOutbox: outboxCount[0]?.total ?? 0,
    };
  }

  async listTenants(): Promise<
    Array<{
      id: string;
      name: string;
      slug: string;
      status: string;
      primaryOwner: string | null;
      primaryOwnerEmail: string | null;
      venueCount: number;
    }>
  > {
    const [tenantRows, venueRows] = await Promise.all([
      this.database.db
        .select({
          tenant: tenants,
          ownerName: users.name,
          ownerEmail: users.email,
        })
        .from(tenants)
        .leftJoin(
          tenantMemberships,
          eq(tenantMemberships.id, tenants.primaryOwnerMembershipId),
        )
        .leftJoin(users, eq(users.id, tenantMemberships.userId))
        .orderBy(desc(tenants.updatedAt)),
      this.database.db.select({ tenantId: venues.tenantId }).from(venues),
    ]);
    return tenantRows.map((row) => ({
      id: formatPublicId(row.tenant.id),
      name: row.tenant.name,
      slug: row.tenant.slug,
      status: row.tenant.status,
      primaryOwner: row.ownerName,
      primaryOwnerEmail: row.ownerEmail,
      venueCount: venueRows.filter((venue) => venue.tenantId === row.tenant.id).length,
    }));
  }

  async listVenues(): Promise<
    Array<{
      id: string;
      tenantId: string;
      tenantName: string;
      name: string;
      slug: string;
      addressLine: string;
      status: string;
      publicationStatus: string;
    }>
  > {
    const rows = await this.database.db
      .select({ venue: venues, tenantName: tenants.name })
      .from(venues)
      .innerJoin(tenants, eq(tenants.id, venues.tenantId))
      .orderBy(desc(venues.updatedAt));
    return rows.map((row) => ({
      id: formatPublicId(row.venue.id),
      tenantId: formatPublicId(row.venue.tenantId),
      tenantName: row.tenantName,
      name: row.venue.name,
      slug: row.venue.slug,
      addressLine: row.venue.addressLine,
      status: row.venue.status,
      publicationStatus: row.venue.publicationStatus,
    }));
  }

  async listVerifications(): Promise<
    Array<{
      requestId: string;
      venueId: string;
      venueName: string;
      tenantId: string;
      tenantName: string;
      status: string;
      venueVersion: number;
      reason: string | null;
      snapshot: unknown;
      submittedAt: string;
      decidedAt: string | null;
    }>
  > {
    const rows = await this.database.db
      .select({
        request: venuePublicationRequests,
        venueName: venues.name,
        tenantId: tenants.id,
        tenantName: tenants.name,
      })
      .from(venuePublicationRequests)
      .innerJoin(venues, eq(venues.id, venuePublicationRequests.venueId))
      .innerJoin(tenants, eq(tenants.id, venues.tenantId))
      .orderBy(desc(venuePublicationRequests.createdAt));
    return rows.map((row) => ({
      requestId: formatPublicId(row.request.id),
      venueId: formatPublicId(row.request.venueId),
      venueName: row.venueName,
      tenantId: formatPublicId(row.tenantId),
      tenantName: row.tenantName,
      status: row.request.status,
      venueVersion: row.request.venueVersion,
      reason: row.request.reason,
      snapshot: parseSnapshot(row.request.submittedSnapshot),
      submittedAt: row.request.createdAt.toISOString(),
      decidedAt: row.request.decidedAt?.toISOString() ?? null,
    }));
  }

  async listAudit(parameters: {
    cursor?: string | undefined;
    limit: number;
    action?: string | undefined;
    resourceType?: string | undefined;
    tenantId?: string | undefined;
    venueId?: string | undefined;
    actorUserId?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
  }): Promise<{
    items: Array<{
      id: string;
      action: string;
      resourceType: string;
      resourceId: string | null;
      actor: { id: string; name: string; email: string } | null;
      tenant: { id: string; name: string } | null;
      venue: { id: string; name: string } | null;
      reason: string | null;
      beforeState: unknown;
      afterState: unknown;
      requestId: string | null;
      createdAt: string;
    }>;
    nextCursor: string | null;
  }> {
    const conditions = [
      parameters.cursor
        ? lt(auditLogs.id, parsePublicId(parameters.cursor))
        : undefined,
      parameters.action ? eq(auditLogs.action, parameters.action) : undefined,
      parameters.resourceType
        ? eq(auditLogs.resourceType, parameters.resourceType)
        : undefined,
      parameters.tenantId
        ? eq(auditLogs.tenantId, parsePublicId(parameters.tenantId))
        : undefined,
      parameters.venueId
        ? eq(auditLogs.venueId, parsePublicId(parameters.venueId))
        : undefined,
      parameters.actorUserId
        ? eq(auditLogs.actorUserId, parsePublicId(parameters.actorUserId))
        : undefined,
      parameters.from ? gte(auditLogs.createdAt, new Date(parameters.from)) : undefined,
      parameters.to ? lte(auditLogs.createdAt, new Date(parameters.to)) : undefined,
    ].filter((condition) => condition !== undefined);
    const rows = await this.database.db
      .select({
        audit: auditLogs,
        actorName: users.name,
        actorEmail: users.email,
        tenantName: tenants.name,
        venueName: venues.name,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorUserId))
      .leftJoin(tenants, eq(tenants.id, auditLogs.tenantId))
      .leftJoin(venues, eq(venues.id, auditLogs.venueId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.id))
      .limit(parameters.limit + 1);
    const page = rows.slice(0, parameters.limit);
    const items = page.map((row) => ({
      id: formatPublicId(row.audit.id),
      action: row.audit.action,
      resourceType: row.audit.resourceType,
      resourceId:
        row.audit.resourceId === null ? null : formatPublicId(row.audit.resourceId),
      actor:
        row.audit.actorUserId === null || !row.actorName || !row.actorEmail
          ? null
          : {
              id: formatPublicId(row.audit.actorUserId),
              name: row.actorName,
              email: row.actorEmail,
            },
      tenant:
        row.audit.tenantId === null || !row.tenantName
          ? null
          : { id: formatPublicId(row.audit.tenantId), name: row.tenantName },
      venue:
        row.audit.venueId === null || !row.venueName
          ? null
          : { id: formatPublicId(row.audit.venueId), name: row.venueName },
      reason: row.audit.reason,
      beforeState: row.audit.beforeState,
      afterState: row.audit.afterState,
      requestId: row.audit.requestId,
      createdAt: row.audit.createdAt.toISOString(),
    }));
    return {
      items,
      nextCursor: rows.length > parameters.limit ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async updateTenantStatus(
    tenantId: string,
    status: "DRAFT" | "ACTIVE" | "INACTIVE" | "SUSPENDED",
    actorUserId: string,
    reason: string,
  ): Promise<void> {
    const tenantDatabaseId = parsePublicId(tenantId);
    await this.database.db.transaction(async (transaction) => {
      const [tenant] = await transaction
        .select({ status: tenants.status })
        .from(tenants)
        .where(eq(tenants.id, tenantDatabaseId))
        .limit(1)
        .for("update");
      if (!tenant) {
        throw new ApiError(404, "TENANT_NOT_FOUND", "Tenant tidak ditemukan.");
      }
      await transaction
        .update(tenants)
        .set({
          status,
          suspendedAt: status === "SUSPENDED" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, tenantDatabaseId));
      await transaction.insert(auditLogs).values({
        tenantId: tenantDatabaseId,
        actorUserId: parsePublicId(actorUserId),
        action: "tenant.status_changed",
        resourceType: "tenant",
        resourceId: tenantDatabaseId,
        reason,
        beforeState: { status: tenant.status },
        afterState: { status },
      });
    });
  }

  async updateVenueStatus(
    venueId: string,
    status: "DRAFT" | "ACTIVE" | "INACTIVE" | "SUSPENDED",
    actorUserId: string,
    reason: string,
  ): Promise<void> {
    const venueDatabaseId = parsePublicId(venueId);
    await this.database.db.transaction(async (transaction) => {
      const [venue] = await transaction
        .select({ tenantId: venues.tenantId, status: venues.status })
        .from(venues)
        .where(eq(venues.id, venueDatabaseId))
        .limit(1)
        .for("update");
      if (!venue) {
        throw new ApiError(404, "VENUE_NOT_FOUND", "Venue tidak ditemukan.");
      }
      await transaction
        .update(venues)
        .set({
          status,
          suspendedAt: status === "SUSPENDED" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(venues.id, venueDatabaseId));
      await transaction.insert(auditLogs).values({
        tenantId: venue.tenantId,
        venueId: venueDatabaseId,
        actorUserId: parsePublicId(actorUserId),
        action: "venue.status_changed",
        resourceType: "venue",
        resourceId: venueDatabaseId,
        reason,
        beforeState: { status: venue.status },
        afterState: { status },
      });
    });
  }

  private async countRows(table: typeof users | typeof tenants | typeof bookings) {
    const rows = await this.database.db.select({ total: count() }).from(table);
    return rows[0]?.total ?? 0;
  }
}

function parseSnapshot(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
