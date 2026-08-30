import { and, eq } from "drizzle-orm";
import type { DatabaseConnection } from "../../database/client.js";
import { formatPublicId, parsePublicId } from "../../database/ids.js";
import {
  memberVenueAssignments,
  rolePermissions,
  platformAdmins,
  tenantMemberships,
  venues,
} from "../../database/schema/index.js";
import { ApiError } from "../../http/ApiError.js";
import type { BusinessRole } from "../../identity/auth/domain.js";
import { PERMISSION_CODES, type PermissionCode } from "./permissions.js";

export interface TenantAccess {
  membershipId: string;
  tenantId: string;
  role: BusinessRole;
  assignedVenueIds: string[];
  permissions: PermissionCode[];
}

export class TenantAuthorizationService {
  constructor(private readonly database: DatabaseConnection) {}

  async requireTenantAccess(userId: string, tenantId: string): Promise<TenantAccess> {
    const [membership] = await this.database.db
      .select({
        id: tenantMemberships.id,
        role: tenantMemberships.role,
        tenantRoleId: tenantMemberships.tenantRoleId,
      })
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.userId, parsePublicId(userId)),
          eq(tenantMemberships.tenantId, parsePublicId(tenantId)),
          eq(tenantMemberships.status, "ACTIVE"),
        ),
      )
      .limit(1);

    if (!membership || !isBusinessRole(membership.role)) {
      throw new ApiError(
        403,
        "TENANT_ACCESS_DENIED",
        "Anda tidak memiliki akses ke workspace ini.",
      );
    }

    const assignments = await this.database.db
      .select({ venueId: memberVenueAssignments.venueId })
      .from(memberVenueAssignments)
      .where(eq(memberVenueAssignments.membershipId, membership.id));
    const permissionRows =
      membership.role !== "STAFF" || membership.tenantRoleId === null
        ? []
        : await this.database.db
            .select({ code: rolePermissions.permissionCode })
            .from(rolePermissions)
            .where(eq(rolePermissions.roleId, membership.tenantRoleId));

    return {
      membershipId: formatPublicId(membership.id),
      tenantId,
      role: membership.role,
      assignedVenueIds: assignments.map((assignment) =>
        formatPublicId(assignment.venueId),
      ),
      permissions:
        membership.role === "STAFF"
          ? permissionRows.map((row) => row.code).filter(isPermissionCode)
          : [...PERMISSION_CODES],
    };
  }

  async requireVenueAccess(
    userId: string,
    tenantId: string,
    venueId: string,
  ): Promise<TenantAccess> {
    const access = await this.requireTenantAccess(userId, tenantId);
    const [venue] = await this.database.db
      .select({ id: venues.id })
      .from(venues)
      .where(
        and(
          eq(venues.id, parsePublicId(venueId)),
          eq(venues.tenantId, parsePublicId(tenantId)),
        ),
      )
      .limit(1);

    if (!venue) {
      throw new ApiError(
        404,
        "VENUE_NOT_FOUND",
        "Venue tidak ditemukan pada workspace ini.",
      );
    }

    if (access.role === "STAFF" && !access.assignedVenueIds.includes(venueId)) {
      throw new ApiError(
        403,
        "VENUE_ACCESS_DENIED",
        "Staff tidak ditugaskan pada venue ini.",
      );
    }
    return access;
  }

  async requireOwner(userId: string, tenantId: string): Promise<TenantAccess> {
    const access = await this.requireTenantAccess(userId, tenantId);
    if (access.role === "STAFF") {
      throw new ApiError(
        403,
        "OWNER_ACCESS_REQUIRED",
        "Aksi ini hanya tersedia untuk Owner.",
      );
    }
    return access;
  }

  async requirePrimaryOwner(userId: string, tenantId: string): Promise<TenantAccess> {
    const access = await this.requireTenantAccess(userId, tenantId);
    if (access.role !== "PRIMARY_OWNER") {
      throw new ApiError(
        403,
        "PRIMARY_OWNER_REQUIRED",
        "Aksi ini hanya tersedia untuk Primary Owner.",
      );
    }
    return access;
  }

  async requirePermission(
    userId: string,
    tenantId: string,
    permission: PermissionCode,
    venueId?: string,
  ): Promise<TenantAccess> {
    const access = venueId
      ? await this.requireVenueAccess(userId, tenantId, venueId)
      : await this.requireTenantAccess(userId, tenantId);
    if (!access.permissions.includes(permission)) {
      throw new ApiError(
        403,
        "PERMISSION_REQUIRED",
        "Role Anda tidak memiliki permission untuk aksi ini.",
      );
    }
    return access;
  }

  async requirePlatformAdmin(userId: string): Promise<void> {
    const [admin] = await this.database.db
      .select({ id: platformAdmins.id })
      .from(platformAdmins)
      .where(
        and(
          eq(platformAdmins.userId, parsePublicId(userId)),
          eq(platformAdmins.active, true),
        ),
      )
      .limit(1);
    if (!admin) {
      throw new ApiError(
        403,
        "ADMIN_ACCESS_REQUIRED",
        "Akses Admin platform diperlukan.",
      );
    }
  }
}

function isPermissionCode(value: string): value is PermissionCode {
  return (PERMISSION_CODES as readonly string[]).includes(value);
}

function isBusinessRole(value: string): value is BusinessRole {
  return value === "PRIMARY_OWNER" || value === "OWNER" || value === "STAFF";
}
