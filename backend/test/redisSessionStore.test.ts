import { describe, expect, it } from "vitest";
import { formatPublicId } from "../src/database/ids.js";
import { RedisSessionStore } from "../src/identity/auth/RedisSessionStore.js";
import { SessionStoreUnavailableError } from "../src/identity/auth/domain.js";

class InMemoryRedisClient {
  readonly values = new Map<string, string>();

  set(
    key: string,
    value: string,
    expirationMode: "EX",
    ttlSeconds: number,
  ): Promise<unknown> {
    void expirationMode;
    void ttlSeconds;
    this.values.set(key, value);
    return Promise.resolve("OK");
  }

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.values.get(key) ?? null);
  }

  del(key: string): Promise<number> {
    return Promise.resolve(this.values.delete(key) ? 1 : 0);
  }
}

describe("RedisSessionStore", () => {
  it("returns sessions that use the current opaque user ID", async () => {
    const redis = new InMemoryRedisClient();
    const store = new RedisSessionStore(redis, 60);
    const { token } = await store.create(formatPublicId(1));

    await expect(store.findByToken(token)).resolves.toMatchObject({
      userId: formatPublicId(1),
    });
  });

  it("revokes a session left by the legacy ID format", async () => {
    const redis = new InMemoryRedisClient();
    const store = new RedisSessionStore(redis, 60);
    const { token } = await store.create("01J00000000000000000000100");

    await expect(store.findByToken(token)).resolves.toBeNull();
    expect(redis.values.size).toBe(0);
  });

  it("menerjemahkan kegagalan Redis menjadi session unavailable", async () => {
    const redis = new InMemoryRedisClient();
    redis.get = () => Promise.reject(new Error("Redis down"));
    const store = new RedisSessionStore(redis, 60);
    await expect(store.findByToken("token")).rejects.toBeInstanceOf(
      SessionStoreUnavailableError,
    );
  });
});
