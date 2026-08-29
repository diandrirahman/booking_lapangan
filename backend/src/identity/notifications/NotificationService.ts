import { and, desc, eq, isNull } from "drizzle-orm";
import type { DatabaseConnection } from "../../database/client.js";
import { formatPublicId, parsePublicId } from "../../database/ids.js";
import { userNotifications } from "../../database/schema/index.js";
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
}
