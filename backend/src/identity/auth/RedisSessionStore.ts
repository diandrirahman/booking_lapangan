import { createHash, randomBytes } from "node:crypto";
import { ulid } from "ulid";
import { z } from "zod";
import { parsePublicId } from "../../database/ids.js";
import {
  SessionStoreUnavailableError,
  type SessionStore,
  type StoredSession,
} from "./domain.js";

interface SessionRedisClient {
  set(
    key: string,
    value: string,
    expirationMode: "EX",
    ttlSeconds: number,
  ): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
}

const storedSessionSchema = z.object({
  id: z.string().min(1).max(26),
  userId: z.string().min(1),
  expiresAt: z.iso.datetime(),
});

export class RedisSessionStore implements SessionStore {
  constructor(
    private readonly redis: SessionRedisClient,
    private readonly ttlSeconds: number,
  ) {}

  async create(userId: string): Promise<{ token: string; session: StoredSession }> {
    const token = randomBytes(32).toString("base64url");
    const session: StoredSession = {
      id: ulid(),
      userId,
      expiresAt: new Date(Date.now() + this.ttlSeconds * 1000).toISOString(),
    };
    try {
      await this.redis.set(
        sessionKey(token),
        JSON.stringify(session),
        "EX",
        this.ttlSeconds,
      );
    } catch (error) {
      throw new SessionStoreUnavailableError({ cause: error });
    }
    return { token, session };
  }

  async findByToken(token: string): Promise<StoredSession | null> {
    if (!token) return null;
    let serialized: string | null;
    try {
      serialized = await this.redis.get(sessionKey(token));
    } catch (error) {
      throw new SessionStoreUnavailableError({ cause: error });
    }
    if (!serialized) return null;
    const session = parseStoredSession(serialized);
    if (!session || !hasCurrentPublicId(session)) {
      await this.revoke(token);
      return null;
    }
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      await this.revoke(token);
      return null;
    }
    return session;
  }

  async revoke(token: string): Promise<void> {
    if (!token) return;
    try {
      await this.redis.del(sessionKey(token));
    } catch (error) {
      throw new SessionStoreUnavailableError({ cause: error });
    }
  }
}

function sessionKey(token: string): string {
  const digest = createHash("sha256").update(token).digest("hex");
  return `session:${digest}`;
}

function parseStoredSession(serialized: string): StoredSession | null {
  try {
    return storedSessionSchema.parse(JSON.parse(serialized));
  } catch {
    return null;
  }
}

function hasCurrentPublicId(session: StoredSession): boolean {
  try {
    parsePublicId(session.userId);
    return true;
  } catch {
    // Sessions from an older ID format or encryption key must never reach a service.
    return false;
  }
}
