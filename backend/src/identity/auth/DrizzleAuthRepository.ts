import { and, eq, inArray } from "drizzle-orm";
import type { DatabaseConnection } from "../../database/client.js";
import { formatPublicId, parsePublicId } from "../../database/ids.js";
import {
  platformAdmins,
  rolePermissions,
  tenantMemberships,
  tenantRoles,
  users,
} from "../../database/schema/index.js";
import type {
  AuthRepository,
  AuthenticatedUser,
  CreateUserWithPasswordInput,
  MembershipSummary,
  UserWithPassword,
} from "./domain.js";

export class DrizzleAuthRepository implements AuthRepository {
  constructor(private readonly database: DatabaseConnection["db"]) {}

  async findUserWithPassword(email: string): Promise<UserWithPassword | null> {
    const [result] = await this.database
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(and(eq(users.email, email), eq(users.status, "ACTIVE")))
      .limit(1);
    if (!result?.passwordHash) return null;
    return {
      ...result,
      id: formatPublicId(result.id),
      passwordHash: result.passwordHash,
    };
  }

  async findUserById(userId: string): Promise<AuthenticatedUser | null> {
    const [result] = await this.database
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(and(eq(users.id, parsePublicId(userId)), eq(users.status, "ACTIVE")))
      .limit(1);
    return result ? { ...result, id: formatPublicId(result.id) } : null;
  }

  async createUserWithPassword(
    input: CreateUserWithPasswordInput,
  ): Promise<AuthenticatedUser> {
    const [created] = await this.database
      .insert(users)
      .values({
        name: input.name,
        email: input.email,
        phoneE164: input.phone,
        passwordHash: input.passwordHash,
      })
      .$returningId();
    if (!created) throw new Error("MySQL tidak mengembalikan ID pengguna baru.");
    return {
      id: formatPublicId(created.id),
      name: input.name,
      email: input.email,
    };
  }

  async listMemberships(userId: string): Promise<MembershipSummary[]> {
    const results = await this.database
      .select({
        tenantId: tenantMemberships.tenantId,
        role: tenantMemberships.role,
        tenantRoleId: tenantMemberships.tenantRoleId,
        tenantRoleName: tenantRoles.name,
      })
      .from(tenantMemberships)
      .leftJoin(tenantRoles, eq(tenantRoles.id, tenantMemberships.tenantRoleId))
      .where(
        and(
          eq(tenantMemberships.userId, parsePublicId(userId)),
          eq(tenantMemberships.status, "ACTIVE"),
        ),
      );
    const roleIds = results.flatMap((membership) =>
      membership.tenantRoleId === null ? [] : [membership.tenantRoleId],
    );
    const assignedPermissions =
      roleIds.length === 0
        ? []
        : await this.database
            .select()
            .from(rolePermissions)
            .where(inArray(rolePermissions.roleId, roleIds));
    return results.map((membership) => ({
      tenantId: formatPublicId(membership.tenantId),
      role: toBusinessRole(membership.role),
      tenantRoleId:
        membership.tenantRoleId === null
          ? null
          : formatPublicId(membership.tenantRoleId),
      tenantRoleName: membership.tenantRoleName,
      permissions: assignedPermissions
        .filter((permission) => permission.roleId === membership.tenantRoleId)
        .map((permission) => permission.permissionCode),
    }));
  }

  async isPlatformAdmin(userId: string): Promise<boolean> {
    const [admin] = await this.database
      .select({ id: platformAdmins.id })
      .from(platformAdmins)
      .where(
        and(
          eq(platformAdmins.userId, parsePublicId(userId)),
          eq(platformAdmins.active, true),
        ),
      )
      .limit(1);
    return Boolean(admin);
  }
}

function toBusinessRole(role: string): MembershipSummary["role"] {
  if (role === "PRIMARY_OWNER" || role === "OWNER" || role === "STAFF") {
    return role;
  }
  throw new Error(`Role membership tidak dikenali: ${role}`);
}
