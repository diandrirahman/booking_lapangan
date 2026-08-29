import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql, { type Pool } from "mysql2/promise";
import type { Environment } from "../config/environment.js";
import * as schema from "./schema/index.js";

export interface DatabaseConnection {
  pool: Pool;
  db: MySql2Database<typeof schema>;
  ping(): Promise<void>;
  close(): Promise<void>;
}

export function createDatabaseConnection(environment: Environment): DatabaseConnection {
  const pool = mysql.createPool({
    uri: environment.DATABASE_URL,
    connectionLimit: environment.DATABASE_CONNECTION_LIMIT,
    enableKeepAlive: true,
    timezone: "Z",
    ...(environment.DATABASE_SSL_MODE === "required"
      ? { ssl: { minVersion: "TLSv1.2" as const, rejectUnauthorized: true } }
      : {}),
  });
  const db = drizzle({ client: pool, schema, mode: "default" });

  return {
    pool,
    db,
    async ping() {
      await pool.query("SELECT 1");
    },
    async close() {
      await pool.end();
    },
  };
}
