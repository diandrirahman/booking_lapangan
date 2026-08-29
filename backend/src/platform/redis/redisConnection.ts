import { Redis } from "ioredis";
import type { Environment } from "../../config/environment.js";

export interface RedisConnection {
  client: Redis;
  ping(): Promise<void>;
  close(): void;
}

export function createRedisConnection(environment: Environment): RedisConnection {
  const client = new Redis(environment.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
  });
  client.on("error", (error) => {
    console.warn(
      "Redis tidak tersedia; API tetap berjalan dalam mode degraded.",
      error,
    );
  });

  return {
    client,
    async ping() {
      if (client.status === "wait") await client.connect();
      await client.ping();
    },
    close() {
      client.disconnect();
    },
  };
}
