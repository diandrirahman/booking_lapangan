import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray, isNull, type SQL } from "drizzle-orm";
import type { DatabaseConnection } from "../../database/client.js";
import { formatPublicId, parsePublicId } from "../../database/ids.js";
import {
  auditLogs,
  memberVenueAssignments,
  permissions,
  rolePermissions,
  tenantMemberships,
  tenantRoles,
  tenants,
  users,
  venues,
} from "../../database/schema/index.js";
import { ApiError } from "../../http/ApiError.js";
import type { RequestAuditContext } from "../../http/requestAuditContext.js";
import { PERMISSION_CODES, type PermissionCode } from "../authorization/permissions.js";

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
  tenantRoleId: string | null;
  tenantRoleName: string | null;
  permissions: PermissionCode[];
}

export interface TenantRoleView {
  id: string;
  name: string;
  templateCode: string | null;
  immutable: boolean;
  permissions: PermissionCode[];
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
        tenantRoleId: tenantMemberships.tenantRoleId,
        tenantRoleName: tenantRoles.name,
      })
      .from(tenantMemberships)
      .innerJoin(tenants, eq(tenants.id, tenantMemberships.tenantId))
      .leftJoin(tenantRoles, eq(tenantRoles.id, tenantMemberships.tenantRoleId))
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

  async listMembers(
    tenantId: string,
    allowedVenueIds?: string[],
  ): Promise<WorkspaceMember[]> {
    if (allowedVenueIds?.length === 0) return [];
    const tenantDatabaseId = parsePublicId(tenantId);
    const memberships = await this.database.db
      .select({
        membershipId: tenantMemberships.id,
        userId: users.id,
        name: users.name,
        email: users.email,
        role: tenantMemberships.role,
        status: tenantMemberships.status,
        tenantRoleId: tenantMemberships.tenantRoleId,
        tenantRoleName: tenantRoles.name,
      })
      .from(tenantMemberships)
      .innerJoin(users, eq(users.id, tenantMemberships.userId))
      .leftJoin(tenantRoles, eq(tenantRoles.id, tenantMemberships.tenantRoleId))
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
    const allowedVenueDatabaseIds = allowedVenueIds?.map(parsePublicId);
    const visibleAssignments = allowedVenueDatabaseIds
      ? assignments.filter((assignment) =>
          allowedVenueDatabaseIds.includes(assignment.venueId),
        )
      : assignments;
    const visibleMemberships = allowedVenueDatabaseIds
      ? memberships.filter((membership) =>
          visibleAssignments.some(
            (assignment) => assignment.membershipId === membership.membershipId,
          ),
        )
      : memberships;
    const tenantRoleIds = visibleMemberships.flatMap((membership) =>
      membership.tenantRoleId === null ? [] : [membership.tenantRoleId],
    );
    const assignedPermissions =
      tenantRoleIds.length === 0
        ? []
        : await this.database.db
            .select()
            .from(rolePermissions)
            .where(inArray(rolePermissions.roleId, tenantRoleIds));

    return visibleMemberships.filter(hasBusinessRole).map((membership) => ({
      membershipId: formatPublicId(membership.membershipId),
      userId: formatPublicId(membership.userId),
      name: membership.name,
      email: membership.email,
      role: membership.role,
      status: membership.status,
      assignedVenueIds: visibleAssignments
        .filter((assignment) => assignment.membershipId === membership.membershipId)
        .map((assignment) => formatPublicId(assignment.venueId)),
      tenantRoleId:
        membership.tenantRoleId === null
          ? null
          : formatPublicId(membership.tenantRoleId),
      tenantRoleName: membership.tenantRoleName,
      permissions: assignedPermissions
        .filter((permission) => permission.roleId === membership.tenantRoleId)
        .map((permission) => permission.permissionCode)
        .filter(isPermissionCode),
    }));
  }

  async listRoleTemplates(): Promise<TenantRoleView[]> {
    return this.listRolesWhere(isNull(tenantRoles.tenantId));
  }

  async listTenantRoles(tenantId: string): Promise<TenantRoleView[]> {
    return this.listRolesWhere(eq(tenantRoles.tenantId, parsePublicId(tenantId)));
  }

  private async listRolesWhere(condition: SQL): Promise<TenantRoleView[]> {
    const roles = await this.database.db
      .select()
      .from(tenantRoles)
      .where(condition)
      .orderBy(asc(tenantRoles.name));
    const roleIds = roles.map((role) => role.id);
    const permissionRows =
      roleIds.length === 0
        ? []
        : await this.database.db
            .select()
            .from(rolePermissions)
            .where(inArray(rolePermissions.roleId, roleIds));
    return roles.map((role) => ({
      id: formatPublicId(role.id),
      name: role.name,
      templateCode: role.templateCode,
      immutable: role.immutable,
      permissions: permissionRows
        .filter((permission) => permission.roleId === role.id)
        .map((permission) => permission.permissionCode)
        .filter(isPermissionCode),
    }));
  }

  async copyRoleTemplate(
    tenantId: string,
    templateId: string,
    name: string,
    actorUserId: string,
    reason: string,
    audit: RequestAuditContext,
  ): Promise<{ id: string }> {
    const tenantDatabaseId = parsePublicId(tenantId);
    return this.database.db.transaction(async (transaction) => {
      const [template] = await transaction
        .select()
        .from(tenantRoles)
        .where(
          and(
            eq(tenantRoles.id, parsePublicId(templateId)),
            isNull(tenantRoles.tenantId),
            eq(tenantRoles.immutable, true),
          ),
        )
        .limit(1);
      if (!template) {
        throw new ApiError(
          404,
          "ROLE_TEMPLATE_NOT_FOUND",
          "Template role tidak ditemukan.",
        );
      }
      const [created] = await transaction
        .insert(tenantRoles)
        .values({ tenantId: tenantDatabaseId, name, immutable: false })
        .$returningId();
      if (!created) throw new Error("MySQL tidak mengembalikan ID role.");
      const templatePermissions = await transaction
        .select()
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, template.id));
      if (templatePermissions.length > 0) {
        await transaction.insert(rolePermissions).values(
          templatePermissions.map((permission) => ({
            roleId: created.id,
            permissionCode: permission.permissionCode,
          })),
        );
      }
      await transaction.insert(auditLogs).values({
        tenantId: tenantDatabaseId,
        actorUserId: parsePublicId(actorUserId),
        action: "tenant.role_created",
        resourceType: "tenant_role",
        resourceId: created.id,
        reason,
        afterState: { name, templateCode: template.templateCode },
        ...audit,
      });
      return { id: formatPublicId(created.id) };
    });
  }

  async updateRolePermissions(
    tenantId: string,
    roleId: string,
    permissionCodes: PermissionCode[],
    actorUserId: string,
    reason: string,
    audit: RequestAuditContext,
  ): Promise<void> {
    const tenantDatabaseId = parsePublicId(tenantId);
    const roleDatabaseId = parsePublicId(roleId);
    await this.database.db.transaction(async (transaction) => {
      const [role] = await transaction
        .select()
        .from(tenantRoles)
        .where(
          and(
            eq(tenantRoles.id, roleDatabaseId),
            eq(tenantRoles.tenantId, tenantDatabaseId),
            eq(tenantRoles.immutable, false),
          ),
        )
        .limit(1)
        .for("update");
      if (!role)
        throw new ApiError(
          404,
          "TENANT_ROLE_NOT_FOUND",
          "Role tenant tidak ditemukan.",
        );
      const before = await transaction
        .select({ code: rolePermissions.permissionCode })
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, roleDatabaseId));
      const valid = await transaction
        .select({ code: permissions.code })
        .from(permissions)
        .where(inArray(permissions.code, permissionCodes));
      if (valid.length !== new Set(permissionCodes).size) {
        throw new ApiError(422, "PERMISSION_INVALID", "Permission tidak dikenali.");
      }
      await transaction
        .delete(rolePermissions)
        .where(eq(rolePermissions.roleId, roleDatabaseId));
      if (permissionCodes.length > 0) {
        await transaction.insert(rolePermissions).values(
          permissionCodes.map((permissionCode) => ({
            roleId: roleDatabaseId,
            permissionCode,
          })),
        );
      }
      await transaction.insert(auditLogs).values({
        tenantId: tenantDatabaseId,
        actorUserId: parsePublicId(actorUserId),
        action: "tenant.role_permissions_updated",
        resourceType: "tenant_role",
        resourceId: roleDatabaseId,
        reason,
        beforeState: { permissions: before.map((item) => item.code) },
        afterState: { permissions: permissionCodes },
        ...audit,
      });
    });
  }

  async assignTenantRole(
    tenantId: string,
    membershipId: string,
    roleId: string,
    actorUserId: string,
    reason: string,
    audit: RequestAuditContext,
  ): Promise<void> {
    const tenantDatabaseId = parsePublicId(tenantId);
    const membershipDatabaseId = parsePublicId(membershipId);
    const roleDatabaseId = parsePublicId(roleId);
    await this.database.db.transaction(async (transaction) => {
      const [role] = await transaction
        .select({ id: tenantRoles.id })
        .from(tenantRoles)
        .where(
          and(
            eq(tenantRoles.id, roleDatabaseId),
            eq(tenantRoles.tenantId, tenantDatabaseId),
          ),
        )
        .limit(1);
      if (!role)
        throw new ApiError(
          404,
          "TENANT_ROLE_NOT_FOUND",
          "Role tenant tidak ditemukan.",
        );
      const [membership] = await transaction
        .select({ roleId: tenantMemberships.tenantRoleId })
        .from(tenantMemberships)
        .where(
          and(
            eq(tenantMemberships.id, membershipDatabaseId),
            eq(tenantMemberships.tenantId, tenantDatabaseId),
            eq(tenantMemberships.role, "STAFF"),
          ),
        )
        .limit(1)
        .for("update");
      if (!membership)
        throw new ApiError(404, "STAFF_MEMBERSHIP_NOT_FOUND", "Staff tidak ditemukan.");
      await transaction
        .update(tenantMemberships)
        .set({ tenantRoleId: roleDatabaseId, updatedAt: new Date() })
        .where(eq(tenantMemberships.id, membershipDatabaseId));
      await transaction.insert(auditLogs).values({
        tenantId: tenantDatabaseId,
        actorUserId: parsePublicId(actorUserId),
        action: "tenant.member_role_assigned",
        resourceType: "tenant_membership",
        resourceId: membershipDatabaseId,
        reason,
        beforeState: { tenantRoleId: membership.roleId },
        afterState: { tenantRoleId: roleDatabaseId },
        ...audit,
      });
    });
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
    actorUserId: string,
    reason: string,
    audit: RequestAuditContext,
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

      const previousAssignments = await transaction
        .select({ venueId: memberVenueAssignments.venueId })
        .from(memberVenueAssignments)
        .where(eq(memberVenueAssignments.membershipId, membershipDatabaseId));

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
      await transaction.insert(auditLogs).values({
        tenantId: tenantDatabaseId,
        actorUserId: parsePublicId(actorUserId),
        action: "tenant.member_venues_assigned",
        resourceType: "tenant_membership",
        resourceId: membershipDatabaseId,
        reason,
        beforeState: { venueIds: previousAssignments.map((item) => item.venueId) },
        afterState: { venueIds: venueDatabaseIds },
        ...audit,
      });
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

function isPermissionCode(value: string): value is PermissionCode {
  return (PERMISSION_CODES as readonly string[]).includes(value);
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
