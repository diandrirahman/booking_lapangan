import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { DatabaseConnection } from "../../database/client.js";
import { formatPublicId, parsePublicId } from "../../database/ids.js";
import {
  auditLogs,
  memberVenueAssignments,
  tenantMemberships,
  tenants,
  users,
  venues,
} from "../../database/schema/index.js";
import { ApiError } from "../../http/ApiError.js";

export interface WorkspaceSummary {
  tenantId: string;
  name: string;
  slug: string;
  status: string;
  role: "PRIMARY_OWNER" | "OWNER" | "STAFF";
  membershipId: string;
  assignedVenueIds: string[];
}

export interface WorkspaceMember {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: "PRIMARY_OWNER" | "OWNER" | "STAFF";
  status: string;
  assignedVenueIds: string[];
}

export class TenantService {
  constructor(private readonly database: DatabaseConnection) {}

  async listWorkspaces(userId: string): Promise<WorkspaceSummary[]> {
    const memberships = await this.database.db
      .select({
        membershipId: tenantMemberships.id,
        tenantId: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        status: tenants.status,
        role: tenantMemberships.role,
      })
      .from(tenantMemberships)
      .innerJoin(tenants, eq(tenants.id, tenantMemberships.tenantId))
      .where(
        and(
          eq(tenantMemberships.userId, parsePublicId(userId)),
          eq(tenantMemberships.status, "ACTIVE"),
        ),
      )
      .orderBy(asc(tenants.name));

    const membershipIds = memberships.map((membership) => membership.membershipId);
    const assignments =
      membershipIds.length === 0
        ? []
        : await this.database.db
            .select()
            .from(memberVenueAssignments)
            .where(inArray(memberVenueAssignments.membershipId, membershipIds));

    return memberships.filter(hasBusinessRole).map((membership) => ({
      tenantId: formatPublicId(membership.tenantId),
      name: membership.name,
      slug: membership.slug,
      status: membership.status,
      role: membership.role,
      membershipId: formatPublicId(membership.membershipId),
      assignedVenueIds: assignments
        .filter((assignment) => assignment.membershipId === membership.membershipId)
        .map((assignment) => formatPublicId(assignment.venueId)),
    }));
  }

  async createDraft(userId: string, name: string): Promise<WorkspaceSummary> {
    const userDatabaseId = parsePublicId(userId);
    const slug = `${slugify(name)}-${randomBytes(3).toString("hex")}`;

    const tenantId = await this.database.db.transaction(async (transaction) => {
      const [createdTenant] = await transaction
        .insert(tenants)
        .values({ name, slug, status: "DRAFT" })
        .$returningId();
      if (!createdTenant) {
        throw new Error("MySQL tidak mengembalikan ID tenant baru.");
      }

      const [createdMembership] = await transaction
        .insert(tenantMemberships)
        .values({
          tenantId: createdTenant.id,
          userId: userDatabaseId,
          role: "PRIMARY_OWNER",
          status: "ACTIVE",
        })
        .$returningId();
      if (!createdMembership) {
        throw new Error("MySQL tidak mengembalikan ID membership baru.");
      }

      await transaction
        .update(tenants)
        .set({ primaryOwnerMembershipId: createdMembership.id })
        .where(eq(tenants.id, createdTenant.id));
      await transaction.insert(auditLogs).values({
        tenantId: createdTenant.id,
        actorUserId: userDatabaseId,
        action: "tenant.created",
        resourceType: "tenant",
        resourceId: createdTenant.id,
        afterState: { name, status: "DRAFT" },
      });
      return createdTenant.id;
    });

    const workspaces = await this.listWorkspaces(userId);
    return workspaces.find(
      (workspace) => workspace.tenantId === formatPublicId(tenantId),
    )!;
  }

  async listMembers(tenantId: string): Promise<WorkspaceMember[]> {
    const tenantDatabaseId = parsePublicId(tenantId);
    const memberships = await this.database.db
      .select({
        membershipId: tenantMemberships.id,
        userId: users.id,
        name: users.name,
        email: users.email,
        role: tenantMemberships.role,
        status: tenantMemberships.status,
      })
      .from(tenantMemberships)
      .innerJoin(users, eq(users.id, tenantMemberships.userId))
      .where(eq(tenantMemberships.tenantId, tenantDatabaseId))
      .orderBy(asc(users.name));
    const membershipIds = memberships.map((membership) => membership.membershipId);
    const assignments =
      membershipIds.length === 0
        ? []
        : await this.database.db
            .select()
            .from(memberVenueAssignments)
            .where(inArray(memberVenueAssignments.membershipId, membershipIds));

    return memberships.filter(hasBusinessRole).map((membership) => ({
      membershipId: formatPublicId(membership.membershipId),
      userId: formatPublicId(membership.userId),
      name: membership.name,
      email: membership.email,
      role: membership.role,
      status: membership.status,
      assignedVenueIds: assignments
        .filter((assignment) => assignment.membershipId === membership.membershipId)
        .map((assignment) => formatPublicId(assignment.venueId)),
    }));
  }

  async addMember(
    tenantId: string,
    email: string,
    role: "OWNER" | "STAFF",
  ): Promise<{ membershipId: string }> {
    const tenantDatabaseId = parsePublicId(tenantId);
    const [user] = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1);
    if (!user) {
      throw new ApiError(
        404,
        "USER_NOT_FOUND",
        "Pengguna harus mendaftar sebelum ditambahkan ke workspace.",
      );
    }
    const [existing] = await this.database.db
      .select({ id: tenantMemberships.id })
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.tenantId, tenantDatabaseId),
          eq(tenantMemberships.userId, user.id),
        ),
      )
      .limit(1);
    if (existing) {
      throw new ApiError(
        409,
        "MEMBERSHIP_ALREADY_EXISTS",
        "Pengguna sudah menjadi anggota workspace.",
      );
    }
    const [membership] = await this.database.db
      .insert(tenantMemberships)
      .values({
        tenantId: tenantDatabaseId,
        userId: user.id,
        role,
        status: "ACTIVE",
      })
      .$returningId();
    if (!membership) throw new Error("MySQL tidak mengembalikan ID membership.");
    return { membershipId: formatPublicId(membership.id) };
  }

  async assignStaff(
    tenantId: string,
    membershipId: string,
    venueIds: string[],
  ): Promise<void> {
    const tenantDatabaseId = parsePublicId(tenantId);
    const membershipDatabaseId = parsePublicId(membershipId);
    const venueDatabaseIds = venueIds.map(parsePublicId);

    await this.database.db.transaction(async (transaction) => {
      const [membership] = await transaction
        .select()
        .from(tenantMemberships)
        .where(
          and(
            eq(tenantMemberships.id, membershipDatabaseId),
            eq(tenantMemberships.tenantId, tenantDatabaseId),
            eq(tenantMemberships.role, "STAFF"),
            eq(tenantMemberships.status, "ACTIVE"),
          ),
        )
        .limit(1)
        .for("update");
      if (!membership) {
        throw new ApiError(
          404,
          "STAFF_MEMBERSHIP_NOT_FOUND",
          "Membership Staff aktif tidak ditemukan.",
        );
      }

      const validVenues =
        venueDatabaseIds.length === 0
          ? []
          : await transaction
              .select({ id: venues.id })
              .from(venues)
              .where(
                and(
                  eq(venues.tenantId, tenantDatabaseId),
                  inArray(venues.id, venueDatabaseIds),
                ),
              );
      if (validVenues.length !== new Set(venueDatabaseIds).size) {
        throw new ApiError(
          422,
          "VENUE_ASSIGNMENT_INVALID",
          "Sebagian venue tidak berada pada tenant aktif.",
        );
      }

      await transaction
        .delete(memberVenueAssignments)
        .where(eq(memberVenueAssignments.membershipId, membershipDatabaseId));
      if (venueDatabaseIds.length > 0) {
        await transaction.insert(memberVenueAssignments).values(
          venueDatabaseIds.map((venueId) => ({
            membershipId: membershipDatabaseId,
            venueId,
          })),
        );
      }
    });
  }

  async transferPrimaryOwner(
    tenantId: string,
    currentOwnerUserId: string,
    targetMembershipId: string,
    reason: string,
    requestId: string,
  ): Promise<void> {
    const tenantDatabaseId = parsePublicId(tenantId);
    const currentOwnerDatabaseId = parsePublicId(currentOwnerUserId);
    const targetMembershipDatabaseId = parsePublicId(targetMembershipId);

    await this.database.db.transaction(async (transaction) => {
      const [tenant] = await transaction
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantDatabaseId))
        .limit(1)
        .for("update");
      if (!tenant?.primaryOwnerMembershipId) {
        throw new ApiError(
          409,
          "PRIMARY_OWNER_MISSING",
          "Tenant tidak memiliki Primary Owner aktif.",
        );
      }
      const memberships = await transaction
        .select()
        .from(tenantMemberships)
        .where(
          and(
            eq(tenantMemberships.tenantId, tenantDatabaseId),
            eq(tenantMemberships.status, "ACTIVE"),
          ),
        )
        .for("update");
      const currentMembership = memberships.find(
        (membership) => membership.id === tenant.primaryOwnerMembershipId,
      );
      const targetMembership = memberships.find(
        (membership) => membership.id === targetMembershipDatabaseId,
      );
      if (!currentMembership || currentMembership.userId !== currentOwnerDatabaseId) {
        throw new ApiError(
          403,
          "PRIMARY_OWNER_REQUIRED",
          "Hanya Primary Owner aktif yang dapat mentransfer kepemilikan.",
        );
      }
      if (!targetMembership || targetMembership.role === "STAFF") {
        throw new ApiError(
          422,
          "INVALID_OWNER_TARGET",
          "Penerima harus merupakan Owner aktif pada tenant yang sama.",
        );
      }
      if (targetMembership.id === currentMembership.id) return;

      await transaction
        .update(tenantMemberships)
        .set({ role: "OWNER", updatedAt: new Date() })
        .where(eq(tenantMemberships.id, currentMembership.id));
      await transaction
        .update(tenantMemberships)
        .set({ role: "PRIMARY_OWNER", updatedAt: new Date() })
        .where(eq(tenantMemberships.id, targetMembership.id));
      await transaction
        .update(tenants)
        .set({ primaryOwnerMembershipId: targetMembership.id, updatedAt: new Date() })
        .where(eq(tenants.id, tenantDatabaseId));
      await transaction.insert(auditLogs).values({
        tenantId: tenantDatabaseId,
        actorUserId: currentOwnerDatabaseId,
        action: "tenant.primary_owner_transferred",
        resourceType: "tenant",
        resourceId: tenantDatabaseId,
        reason,
        beforeState: { membershipId: currentMembership.id },
        afterState: { membershipId: targetMembership.id },
        requestId,
      });
    });
  }
}

function hasBusinessRole<T extends { role: string }>(
  value: T,
): value is T & { role: WorkspaceSummary["role"] } {
  return (
    value.role === "PRIMARY_OWNER" || value.role === "OWNER" || value.role === "STAFF"
  );
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
