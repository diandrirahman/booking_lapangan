import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import type { DatabaseConnection } from "../../database/client.js";
import { formatPublicId, parsePublicId } from "../../database/ids.js";
import {
  bookingItems,
  bookings,
  notificationDeliveries,
  notificationPreferences,
  notificationReminderOptions,
  userNotifications,
  venueReminderSettings,
} from "../../database/schema/index.js";
import { ApiError } from "../../http/ApiError.js";

export class NotificationService {
  constructor(private readonly database: DatabaseConnection) {}

  async list(userId: string, unreadOnly: boolean) {
    const userDatabaseId = parsePublicId(userId);
    const rows = await this.database.db
      .select()
      .from(userNotifications)
      .where(
        and(
          eq(userNotifications.userId, userDatabaseId),
          unreadOnly ? isNull(userNotifications.readAt) : undefined,
        ),
      )
      .orderBy(desc(userNotifications.createdAt))
      .limit(50);

    return {
      items: rows.map((notification) => ({
        id: formatPublicId(notification.id),
        kind: notification.kind,
        title: notification.title,
        body: notification.body,
        actionPath: notification.actionPath,
        read: notification.readAt !== null,
        createdAt: notification.createdAt.toISOString(),
      })),
    };
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    const result = await this.database.db
      .update(userNotifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(userNotifications.id, parsePublicId(notificationId)),
          eq(userNotifications.userId, parsePublicId(userId)),
        ),
      );
    if (result[0].affectedRows === 0) {
      throw new ApiError(
        404,
        "NOTIFICATION_NOT_FOUND",
        "Notifikasi tidak ditemukan pada akun aktif.",
      );
    }
  }

  async markAllRead(userId: string): Promise<void> {
    await this.database.db
      .update(userNotifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(userNotifications.userId, parsePublicId(userId)),
          isNull(userNotifications.readAt),
        ),
      );
  }

  async listPreferences(userId: string) {
    return this.database.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, parsePublicId(userId)));
  }

  async setPreference(
    userId: string,
    eventType: string,
    channel: "IN_APP" | "EMAIL",
    enabled: boolean,
  ): Promise<void> {
    if (CRITICAL_EVENTS.has(eventType) && !enabled) {
      throw new ApiError(
        409,
        "CRITICAL_NOTIFICATION_REQUIRED",
        "Notifikasi kritis tidak dapat dimatikan.",
      );
    }
    await this.database.db
      .insert(notificationPreferences)
      .values({
        userId: parsePublicId(userId),
        eventType,
        channel,
        enabled: enabled ? 1 : 0,
      })
      .onDuplicateKeyUpdate({ set: { enabled: enabled ? 1 : 0 } });
  }

  async listReminderOptions() {
    return this.database.db
      .select()
      .from(notificationReminderOptions)
      .orderBy(notificationReminderOptions.minutesBefore);
  }

  async createReminderOption(minutesBefore: number) {
    const rows = await this.database.db
      .insert(notificationReminderOptions)
      .values({ minutesBefore })
      .$returningId();
    const created = rows[0];
    if (!created) throw new Error("MySQL tidak mengembalikan ID reminder.");
    return { id: formatPublicId(created.id), minutesBefore };
  }

  async setVenueReminders(venueId: string, optionIds: string[]): Promise<void> {
    const venueDatabaseId = parsePublicId(venueId);
    await this.database.db.transaction(async (transaction) => {
      await transaction
        .delete(venueReminderSettings)
        .where(eq(venueReminderSettings.venueId, venueDatabaseId));
      if (optionIds.length > 0) {
        await transaction.insert(venueReminderSettings).values(
          optionIds.map((id) => ({
            venueId: venueDatabaseId,
            reminderOptionId: parsePublicId(id),
          })),
        );
      }
    });
  }

  async captureDueReminders(now = new Date()): Promise<number> {
    const rows = await this.database.db
      .select({
        bookingId: bookings.id,
        bookingCode: bookings.bookingCode,
        customerUserId: bookings.customerUserId,
        startsAt: bookingItems.startsAt,
        optionId: notificationReminderOptions.id,
        minutesBefore: notificationReminderOptions.minutesBefore,
      })
      .from(bookings)
      .innerJoin(bookingItems, eq(bookingItems.bookingId, bookings.id))
      .innerJoin(
        venueReminderSettings,
        eq(venueReminderSettings.venueId, bookings.venueId),
      )
      .innerJoin(
        notificationReminderOptions,
        eq(notificationReminderOptions.id, venueReminderSettings.reminderOptionId),
      )
      .where(
        and(
          eq(bookings.status, "CONFIRMED"),
          gte(bookingItems.startsAt, now),
          lte(
            bookingItems.startsAt,
            new Date(now.getTime() + 24 * 60 * 60_000 + 2 * 60_000),
          ),
          eq(notificationReminderOptions.active, 1),
        ),
      );
    let captured = 0;
    for (const row of rows) {
      if (!row.customerUserId) continue;
      const target = row.startsAt.getTime() - row.minutesBefore * 60_000;
      if (target > now.getTime() || target < now.getTime() - 2 * 60_000) continue;
      captured += await this.deliver({
        eventId: `booking-reminder:${row.bookingId}:${row.optionId}`,
        userId: row.customerUserId,
        eventType: "booking.reminder",
        title: "Pengingat jadwal bermain",
        body: `Booking ${row.bookingCode} dimulai ${row.startsAt.toISOString()}.`,
        actionPath: `/bookings/${row.bookingCode}`,
        critical: false,
      });
    }
    return captured;
  }

  async deliver(input: NotificationInput): Promise<number> {
    return this.database.db.transaction((transaction) =>
      this.deliverInTransaction(transaction, input),
    );
  }

  async deliverInTransaction(
    transaction: Transaction,
    input: NotificationInput,
  ): Promise<number> {
    const preferences = await transaction
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.userId, input.userId),
          eq(notificationPreferences.eventType, input.eventType),
        ),
      );
    let created = 0;
    for (const channel of ["IN_APP", "EMAIL"] as const) {
      const enabled =
        input.critical ||
        preferences.find((row) => row.channel === channel)?.enabled !== 0;
      if (!enabled) continue;
      const result = await transaction
        .insert(notificationDeliveries)
        .values({
          eventId: input.eventId,
          userId: input.userId,
          channel,
          status: channel === "EMAIL" ? "CAPTURED" : "DELIVERED",
          subject: input.title,
          body: input.body,
          actionPath: input.actionPath,
        })
        .onDuplicateKeyUpdate({ set: { eventId: input.eventId } });
      if (result[0].affectedRows === 1) created += 1;
      if (channel === "IN_APP") {
        await transaction
          .insert(userNotifications)
          .values({
            eventId: input.eventId,
            userId: input.userId,
            kind: input.userNotificationKind ?? input.eventType,
            critical: input.critical ? 1 : 0,
            title: input.title,
            body: input.body,
            actionPath: input.actionPath,
          })
          .onDuplicateKeyUpdate({ set: { eventId: input.eventId } });
      }
    }
    return created;
  }
}

type Transaction = Parameters<
  Parameters<DatabaseConnection["db"]["transaction"]>[0]
>[0];

interface NotificationInput {
  eventId: string;
  userId: number;
  eventType: string;
  userNotificationKind?: string;
  title: string;
  body: string;
  actionPath: string;
  critical: boolean;
}

const CRITICAL_EVENTS = new Set([
  "booking.status_changed",
  "payment.verified",
  "refund.result",
  "transaction.dispute",
]);
