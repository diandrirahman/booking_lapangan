import { hash, verify } from "argon2";
import { ApiError } from "../../http/ApiError.js";
import type {
  AuthRepository,
  AuthSessionView,
  SessionStore,
  StoredSession,
} from "./domain.js";

export interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  token: string;
  session: StoredSession;
  view: AuthSessionView;
}

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly sessions: SessionStore,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const email = normalizeEmail(input.email);
    if (await this.repository.findUserWithPassword(email)) {
      throw new ApiError(409, "EMAIL_ALREADY_REGISTERED", "Email sudah terdaftar.");
    }

    const passwordHash = await hash(input.password, { type: 2 });
    const user = await this.repository.createUserWithPassword({
      name: input.name.trim(),
      email,
      phone: input.phone.trim(),
      passwordHash,
    });
    return this.createAuthResult(user.id);
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.repository.findUserWithPassword(
      normalizeEmail(input.email),
    );
    if (!user || !(await verify(user.passwordHash, input.password))) {
      throw new ApiError(
        401,
        "INVALID_CREDENTIALS",
        "Email atau password tidak sesuai.",
      );
    }
    return this.createAuthResult(user.id);
  }

  async getSessionView(userId: string): Promise<AuthSessionView> {
    const user = await this.repository.findUserById(userId);
    if (!user) {
      throw new ApiError(401, "SESSION_USER_NOT_FOUND", "Session tidak lagi valid.");
    }
    return {
      user,
      memberships: await this.repository.listMemberships(userId),
      platformAdmin: await this.repository.isPlatformAdmin(userId),
    };
  }

  async reauthenticatePassword(userId: string, password: string): Promise<void> {
    const user = await this.repository.findUserById(userId);
    if (!user) {
      throw new ApiError(401, "SESSION_USER_NOT_FOUND", "Session tidak lagi valid.");
    }
    const userWithPassword = await this.repository.findUserWithPassword(user.email);
    if (!userWithPassword || !(await verify(userWithPassword.passwordHash, password))) {
      throw new ApiError(401, "REAUTHENTICATION_FAILED", "Password tidak sesuai.");
    }
  }

  async authenticateUser(userId: string): Promise<AuthResult> {
    return this.createAuthResult(userId);
  }

  private async createAuthResult(userId: string): Promise<AuthResult> {
    const { token, session } = await this.sessions.create(userId);
    return {
      token,
      session,
      view: await this.getSessionView(userId),
    };
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
