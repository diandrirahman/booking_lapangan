import { and, eq } from "drizzle-orm";
import type { DatabaseConnection } from "../../database/client.js";
import { formatPublicId, parsePublicId } from "../../database/ids.js";
import {
  memberVenueAssignments,
  platformAdmins,
  tenantMemberships,
  venues,
} from "../../database/schema/index.js";
import { ApiError } from "../../http/ApiError.js";
import type { BusinessRole } from "../../identity/auth/domain.js";

export interface TenantAccess {
  membershipId: string;
  tenantId: string;
  role: BusinessRole;
  assignedVenueIds: string[];
}

export class TenantAuthorizationService {
  constructor(private readonly database: DatabaseConnection) {}

  async requireTenantAccess(userId: string, tenantId: string): Promise<TenantAccess> {
    const [membership] = await this.database.db
      .select({
        id: tenantMemberships.id,
        role: tenantMemberships.role,
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

    return {
      membershipId: formatPublicId(membership.id),
      tenantId,
      role: membership.role,
      assignedVenueIds: assignments.map((assignment) =>
        formatPublicId(assignment.venueId),
      ),
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

function isBusinessRole(value: string): value is BusinessRole {
  return value === "PRIMARY_OWNER" || value === "OWNER" || value === "STAFF";
}
