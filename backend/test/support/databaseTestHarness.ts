import { loadEnvironment } from "../../src/config/environment.js";
import { createDatabaseConnection } from "../../src/database/client.js";
import type { RowDataPacket } from "mysql2";

export const testDatabase = createDatabaseConnection(
  loadEnvironment({ ...process.env, NODE_ENV: "test" }),
);

export async function removeBookingsForSlot(courtSlotId: string): Promise<void> {
  const [rows] = await testDatabase.pool.execute<
    Array<{ booking_id: number } & RowDataPacket>
  >("SELECT booking_id FROM booking_slot_reservations WHERE court_slot_id = ?", [
    courtSlotId,
  ]);
  for (const row of rows) {
    await removeBooking(String(row.booking_id));
  }
}

export async function removeBooking(bookingId: string): Promise<void> {
  await testDatabase.pool.query("SET FOREIGN_KEY_CHECKS = 0");
  try {
    await testDatabase.pool.execute(
      "DELETE FROM refund_state_transitions WHERE refund_id IN (SELECT id FROM refunds WHERE booking_id = ?)",
      [bookingId],
    );
    await testDatabase.pool.execute("DELETE FROM refunds WHERE booking_id = ?", [
      bookingId,
    ]);
    await testDatabase.pool.execute(
      "DELETE FROM payment_provider_events WHERE payment_attempt_id IN (SELECT id FROM payment_attempts WHERE booking_id = ?)",
      [bookingId],
    );
    await testDatabase.pool.execute(
      "DELETE FROM payment_attempts WHERE booking_id = ?",
      [bookingId],
    );
    const tables = [
      "command_idempotency",
      "outbox_events",
      "booking_payment_summaries",
      "booking_qr_tokens",
      "booking_state_transitions",
      "booking_slot_history",
      "booking_slot_reservations",
      "booking_price_lines",
      "booking_addon_items",
      "offline_booking_details",
      "attendance_records",
      "booking_cancellations",
      "booking_reschedules",
      "booking_items",
    ];
    for (const table of tables) {
      const referenceColumn =
        table === "command_idempotency" || table === "outbox_events"
          ? "resource_id"
          : "booking_id";
      await testDatabase.pool.execute(
        `DELETE FROM \`${table}\` WHERE \`${referenceColumn}\` = ?`,
        [bookingId],
      );
    }
    await testDatabase.pool.execute("DELETE FROM bookings WHERE id = ?", [bookingId]);
  } finally {
    await testDatabase.pool.query("SET FOREIGN_KEY_CHECKS = 1");
  }
}
