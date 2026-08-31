import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/mysql2/migrator";
import type { RowDataPacket } from "mysql2";
import { loadEnvironment } from "../config/environment.js";
import { FinanceService } from "../finance/FinanceService.js";
import { createDatabaseConnection } from "./client.js";

const environment = loadEnvironment();
const database = createDatabaseConnection(environment);
const migrationsFolder = fileURLToPath(new URL("../../drizzle-v2", import.meta.url));

try {
  const [legacySchema] = await database.pool.query<
    Array<RowDataPacket & { dataType: string }>
  >(`
    SELECT DATA_TYPE AS dataType
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'id'
    LIMIT 1
  `);
  const usersIdType = legacySchema[0]?.dataType;
  if (usersIdType === "char" || usersIdType === "varchar") {
    throw new Error(
      "LEGACY_SCHEMA_RESET_REQUIRED: database masih memakai ID string. " +
        "Buat backup lalu recreate database development sebelum menjalankan migration v2.",
    );
  }
  await migrate(database.db, { migrationsFolder });
  const financeService = new FinanceService(database);
  await financeService.reconcileLegacyRefundLedgers();
  console.info("Migration schema numerik selesai.");
} finally {
  await database.close();
}
