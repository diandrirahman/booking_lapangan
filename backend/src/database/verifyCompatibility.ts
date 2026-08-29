import type { RowDataPacket } from "mysql2";
import { loadEnvironment } from "../config/environment.js";
import { createDatabaseConnection } from "./client.js";

const tidbDatabaseUrl = process.env.TIDB_DATABASE_URL;
if (!tidbDatabaseUrl) {
  if (process.env.REQUIRE_TIDB_GATE === "true") {
    throw new Error("TIDB_DATABASE_URL wajib tersedia untuk release gate demo.");
  }
  console.info(
    "TiDB compatibility gate dilewati: TIDB_DATABASE_URL belum tersedia di environment ini.",
  );
  process.exit(0);
}

const environment = loadEnvironment({
  ...process.env,
  DATABASE_URL: tidbDatabaseUrl,
  DATABASE_SSL_MODE: "required",
  DATABASE_CONNECTION_LIMIT: "2",
});
const database = createDatabaseConnection(environment);

try {
  const [versionRows] = await database.pool.query<
    Array<RowDataPacket & { databaseVersion: string }>
  >("SELECT VERSION() AS databaseVersion");
  const databaseVersion = versionRows[0]?.databaseVersion ?? "unknown";

  const [reservationKeyRows] = await database.pool.query<
    Array<RowDataPacket & { columnName: string }>
  >(`
    SELECT COLUMN_NAME AS columnName
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'booking_slot_reservations'
      AND CONSTRAINT_NAME = 'PRIMARY'
    ORDER BY ORDINAL_POSITION
  `);
  if (reservationKeyRows.map((row) => row.columnName).join(",") !== "court_slot_id") {
    throw new Error(
      "Invariant reservation tidak tersedia: court_slot_id harus menjadi primary key.",
    );
  }

  const connection = await database.pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query("SELECT id FROM venues ORDER BY id LIMIT 1 FOR UPDATE");
    await connection.rollback();
  } finally {
    connection.release();
  }

  const [collationRows] = await database.pool.query<
    Array<RowDataPacket & { equalValue: number }>
  >("SELECT _utf8mb4'A' = _utf8mb4'a' COLLATE utf8mb4_unicode_ci AS equalValue");
  if (collationRows[0]?.equalValue !== 1) {
    throw new Error("Perilaku collation demo tidak sesuai dengan baseline MySQL 8.");
  }

  console.info(`TiDB compatibility checks lulus pada ${databaseVersion}.`);
} finally {
  await database.close();
}
