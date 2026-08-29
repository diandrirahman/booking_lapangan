import { randomBytes } from "node:crypto";
import { ulid } from "ulid";
import type {
  AuthRepository,
  AuthenticatedUser,
  CreateUserWithPasswordInput,
  MembershipSummary,
  SessionStore,
  StoredSession,
  UserWithPassword,
} from "../../src/identity/auth/domain.js";

export class InMemoryAuthRepository implements AuthRepository {
  readonly users = new Map<string, UserWithPassword>();
  readonly memberships = new Map<string, MembershipSummary[]>();
  readonly platformAdmins = new Set<string>();

  findUserWithPassword(email: string): Promise<UserWithPassword | null> {
    return Promise.resolve(this.users.get(email) ?? null);
  }

  findUserById(userId: string): Promise<AuthenticatedUser | null> {
    const user = [...this.users.values()].find((item) => item.id === userId);
    if (!user) return Promise.resolve(null);
    return Promise.resolve(toAuthenticatedUser(user));
  }

  createUserWithPassword(
    input: CreateUserWithPasswordInput,
  ): Promise<AuthenticatedUser> {
    const user: UserWithPassword = {
      id: ulid(),
      name: input.name,
      email: input.email,
      passwordHash: input.passwordHash,
    };
    this.users.set(input.email, user);
    return Promise.resolve(toAuthenticatedUser(user));
  }

  listMemberships(userId: string): Promise<MembershipSummary[]> {
    return Promise.resolve(this.memberships.get(userId) ?? []);
  }

  isPlatformAdmin(userId: string): Promise<boolean> {
    return Promise.resolve(this.platformAdmins.has(userId));
  }
}

function toAuthenticatedUser(user: UserWithPassword): AuthenticatedUser {
  return { id: user.id, name: user.name, email: user.email };
}

export class InMemorySessionStore implements SessionStore {
  readonly sessions = new Map<string, StoredSession>();

  create(userId: string): Promise<{ token: string; session: StoredSession }> {
    const token = randomBytes(24).toString("base64url");
    const session = {
      id: ulid(),
      userId,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    this.sessions.set(token, session);
    return Promise.resolve({ token, session });
  }

  findByToken(token: string): Promise<StoredSession | null> {
    return Promise.resolve(this.sessions.get(token) ?? null);
  }

  revoke(token: string): Promise<void> {
    this.sessions.delete(token);
    return Promise.resolve();
  }
}
