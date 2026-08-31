import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationDirectory = fileURLToPath(new URL("../../drizzle-v2/", import.meta.url));
const legacyMigrationDirectory = fileURLToPath(
  new URL("../../drizzle/", import.meta.url),
);
const migrationRunner = fileURLToPath(
  new URL("../../src/database/migrate.ts", import.meta.url),
);
const maintenanceRunner = fileURLToPath(
  new URL("../../src/platform/jobs/MaintenanceJobs.ts", import.meta.url),
);

describe("B1 migration verification", () => {
  it("menyimpan migration versioned dan active reservation primary key", async () => {
    const migrationFiles = (await readdir(migrationDirectory))
      .filter((fileName) => fileName.endsWith(".sql"))
      .sort();
    expect(migrationFiles.length).toBeGreaterThanOrEqual(1);
    const initialMigration = await readFile(
      `${migrationDirectory}${migrationFiles[0]}`,
      "utf8",
    );
    expect(initialMigration).toContain("CREATE TABLE `booking_slot_reservations`");
    expect(initialMigration).toContain("PRIMARY KEY(`court_slot_id`)");
    expect(initialMigration).toContain("CREATE TABLE `outbox_events`");
    expect(initialMigration).toMatch(
      /CREATE TABLE `users`[\s\S]*`id` bigint unsigned AUTO_INCREMENT/,
    );
    expect(initialMigration).toMatch(
      /CREATE TABLE `tenants`[\s\S]*`id` int unsigned AUTO_INCREMENT/,
    );
    expect(initialMigration).not.toContain("char(26)");
    expect(initialMigration).not.toContain("datetime(6)");
    expect(initialMigration).toContain("tenants_primary_owner_membership_fk");
    expect(initialMigration).toContain("member_venue_assignments_venue_fk");
    expect(initialMigration).toContain("verification_documents_media_fk");
    expect(initialMigration).toContain("audit_logs_venue_fk");

    const constraintNames = [...initialMigration.matchAll(/CONSTRAINT `([^`]+)`/g)].map(
      (match) => match[1]!,
    );
    expect(constraintNames.every((name) => name.length <= 64)).toBe(true);
  });

  it("memindahkan password hash ke users sebelum menghapus kolom lama", async () => {
    const migrationFiles = (await readdir(legacyMigrationDirectory))
      .filter((fileName) => fileName.endsWith(".sql"))
      .sort();
    const latestMigration = await readFile(
      `${legacyMigrationDirectory}${migrationFiles.at(-1)}`,
      "utf8",
    );

    const addPasswordColumn = latestMigration.indexOf(
      "ALTER TABLE `users` ADD `password_hash`",
    );
    const copyPasswordHashes = latestMigration.indexOf("UPDATE `users` AS `user`");
    const removePasswordIdentities = latestMigration.indexOf(
      "DELETE FROM `auth_identities` WHERE `provider` = 'PASSWORD'",
    );
    const dropLegacyColumn = latestMigration.indexOf(
      "ALTER TABLE `auth_identities` DROP COLUMN `password_hash`",
    );

    expect(addPasswordColumn).toBeGreaterThanOrEqual(0);
    expect(copyPasswordHashes).toBeGreaterThan(addPasswordColumn);
    expect(removePasswordIdentities).toBeGreaterThan(copyPasswordHashes);
    expect(dropLegacyColumn).toBeGreaterThan(removePasswordIdentities);
  });

  it("memigrasikan referensi publik booking dan payment tanpa membuka ID internal", async () => {
    const migrationFiles = (await readdir(migrationDirectory))
      .filter((fileName) => fileName.endsWith(".sql"))
      .sort();
    const migrations = (
      await Promise.all(
        migrationFiles.map((fileName) =>
          readFile(`${migrationDirectory}${fileName}`, "utf8"),
        ),
      )
    ).join("\n");

    expect(migrations).toContain(
      "ALTER TABLE `payment_attempts` ADD `payment_code` varchar(20)",
    );
    expect(migrations).toContain("UPDATE `payment_attempts`");
    expect(migrations).toContain("UPDATE `bookings`");
    expect(migrations).toContain("payment_attempt_code_unique");
    expect(migrations).toContain("CREATE TABLE `user_notifications`");
    expect(migrations).toContain("user_notifications_feed_idx");
  });

  it("mengizinkan earning payout dibatch ulang dan merekonsiliasi legacy saat deploy", async () => {
    const migrationFiles = (await readdir(migrationDirectory))
      .filter((fileName) => fileName.endsWith(".sql"))
      .sort();
    const latestMigration = await readFile(
      `${migrationDirectory}${migrationFiles.at(-1)}`,
      "utf8",
    );
    const runner = await readFile(migrationRunner, "utf8");
    const maintenance = await readFile(maintenanceRunner, "utf8");

    expect(latestMigration).toContain("`payout_batches`.`status` = 'FAILED'");
    expect(latestMigration).toContain("'RESERVED_FOR_PAYOUT'");
    expect(latestMigration).toContain("DROP INDEX `payout_item_earning_unique`");
    expect(latestMigration).toContain("payout_item_batch_earning_unique");
    expect(runner).toContain("reconcileLegacyRefundLedgers");
    expect(maintenance).toContain("ROLLING_DEPLOY_RECONCILIATION_WINDOW_MS");
    expect(maintenance).toContain("reconcileLegacyRefundLedgers(");
    expect(maintenance).toContain("rollingDeploymentCutoff");
  });
});
