export type BusinessRole = "PRIMARY_OWNER" | "OWNER" | "STAFF";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
}

export interface MembershipSummary {
  tenantId: string;
  role: BusinessRole;
  tenantRoleId: string | null;
  tenantRoleName: string | null;
  permissions: string[];
}

export interface AuthSessionView {
  user: AuthenticatedUser;
  memberships: MembershipSummary[];
  platformAdmin: boolean;
}

export interface UserWithPassword extends AuthenticatedUser {
  passwordHash: string;
}

export interface CreateUserWithPasswordInput {
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
}

export interface AuthRepository {
  findUserWithPassword(email: string): Promise<UserWithPassword | null>;
  findUserById(userId: string): Promise<AuthenticatedUser | null>;
  createUserWithPassword(
    input: CreateUserWithPasswordInput,
  ): Promise<AuthenticatedUser>;
  listMemberships(userId: string): Promise<MembershipSummary[]>;
  isPlatformAdmin(userId: string): Promise<boolean>;
}

export interface StoredSession {
  id: string;
  userId: string;
  expiresAt: string;
}

export interface SessionStore {
  create(userId: string): Promise<{ token: string; session: StoredSession }>;
  findByToken(token: string): Promise<StoredSession | null>;
  revoke(token: string): Promise<void>;
}

export class SessionStoreUnavailableError extends Error {
  constructor(options?: ErrorOptions) {
    super("Session store tidak tersedia.", options);
    this.name = "SessionStoreUnavailableError";
  }
}
