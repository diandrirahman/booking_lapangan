import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Redis } from "ioredis";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Environment } from "../../config/environment.js";
import type { DatabaseConnection } from "../../database/client.js";
import { formatPublicId, parsePublicId } from "../../database/ids.js";
import { authIdentities, users } from "../../database/schema/index.js";
import { ApiError } from "../../http/ApiError.js";
import type { AuthService, AuthResult } from "./AuthService.js";

interface OidcState {
  nonce: string;
  linkingUserId: string | null;
}

interface GoogleClaims {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  nonce?: string;
}

export class GoogleOidcService {
  constructor(
    private readonly database: DatabaseConnection,
    private readonly redis: Redis,
    private readonly authService: AuthService,
    private readonly environment: Environment,
  ) {}

  async createAuthorizationUrl(linkingUserId: string | null): Promise<string> {
    this.assertConfigured();
    const state = randomBytes(24).toString("base64url");
    const nonce = randomBytes(24).toString("base64url");
    const storedState: OidcState = { nonce, linkingUserId };
    await this.redis.set(
      `oidc:google:${state}`,
      JSON.stringify(storedState),
      "EX",
      600,
      "NX",
    );

    const parameters = new URLSearchParams({
      client_id: this.environment.GOOGLE_CLIENT_ID,
      redirect_uri: this.environment.GOOGLE_REDIRECT_URI,
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      prompt: "select_account",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${parameters.toString()}`;
  }

  async callback(code: string, state: string): Promise<AuthResult> {
    this.assertConfigured();
    const stateKey = `oidc:google:${state}`;
    const rawState = await this.redis.getdel(stateKey);
    if (!rawState)
      throw new ApiError(
        401,
        "OIDC_STATE_INVALID",
        "State OIDC tidak valid atau kedaluwarsa.",
      );
    const storedState = JSON.parse(rawState) as OidcState;
    const tokenResponse = await this.exchangeCode(code);
    const claims = await this.verifyIdToken(tokenResponse.id_token, storedState.nonce);
    const userId = await this.resolveUser(claims, storedState.linkingUserId);
    return this.authService.authenticateUser(userId);
  }

  private async exchangeCode(code: string): Promise<{ id_token: string }> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.environment.GOOGLE_CLIENT_ID,
        client_secret: this.environment.GOOGLE_CLIENT_SECRET,
        redirect_uri: this.environment.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    if (!response.ok)
      throw new ApiError(
        502,
        "OIDC_TOKEN_EXCHANGE_FAILED",
        "Google tidak dapat memverifikasi authorization code.",
      );
    return (await response.json()) as { id_token: string };
  }

  private async verifyIdToken(
    idToken: string,
    expectedNonce: string,
  ): Promise<GoogleClaims> {
    const jwks = createRemoteJWKSet(
      new URL("https://www.googleapis.com/oauth2/v3/certs"),
    );
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: this.environment.GOOGLE_CLIENT_ID,
    });
    const claims = payload as unknown as GoogleClaims;
    if (
      !claims.sub ||
      !claims.email ||
      claims.email_verified !== true ||
      claims.nonce !== expectedNonce
    ) {
      throw new ApiError(
        401,
        "OIDC_CLAIMS_INVALID",
        "Google identity tidak memenuhi persyaratan keamanan.",
      );
    }
    return claims;
  }

  private async resolveUser(
    claims: GoogleClaims,
    linkingUserId: string | null,
  ): Promise<string> {
    const [googleIdentity] = await this.database.db
      .select({ userId: authIdentities.userId })
      .from(authIdentities)
      .where(
        and(
          eq(authIdentities.provider, "GOOGLE"),
          eq(authIdentities.providerSubject, claims.sub),
        ),
      )
      .limit(1);
    if (googleIdentity) return formatPublicId(googleIdentity.userId);

    const normalizedEmail = claims.email.trim().toLowerCase();
    const [existingUser] = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);
    const linkingDatabaseId = linkingUserId ? parsePublicId(linkingUserId) : null;
    if (existingUser && existingUser.id !== linkingDatabaseId) {
      throw new ApiError(
        409,
        "ACCOUNT_LINK_REAUTH_REQUIRED",
        "Email sudah terdaftar. Masuk dengan password lalu tautkan Google melalui pengaturan akun.",
      );
    }

    return this.database.db.transaction(async (transaction) => {
      let userId = existingUser?.id;
      if (!existingUser) {
        const [createdUser] = await transaction
          .insert(users)
          .values({
            name: claims.name?.trim() || "Pengguna LapanganGo",
            email: normalizedEmail,
            emailVerifiedAt: new Date(),
          })
          .$returningId();
        if (!createdUser)
          throw new Error("MySQL tidak mengembalikan ID pengguna Google.");
        userId = createdUser.id;
      }
      if (!userId) throw new Error("ID pengguna Google tidak tersedia.");
      await transaction.insert(authIdentities).values({
        userId,
        provider: "GOOGLE",
        providerSubject: claims.sub,
      });
      return formatPublicId(userId);
    });
  }

  private assertConfigured(): void {
    if (!this.environment.GOOGLE_CLIENT_ID || !this.environment.GOOGLE_CLIENT_SECRET) {
      throw new ApiError(
        503,
        "GOOGLE_OIDC_NOT_CONFIGURED",
        "Google login belum dikonfigurasi pada environment ini.",
      );
    }
  }
}
