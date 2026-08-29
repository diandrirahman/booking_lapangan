import type { AccountNotification } from "@lapangango/api-client";
import type { Notification } from "./types";

export function toNotificationPresentation(
  notification: AccountNotification,
): Notification {
  return {
    id: notification.id,
    kind: notification.kind,
    title: notification.title,
    body: notification.body,
    actionHref: notification.actionPath,
    read: notification.read,
    time: new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(notification.createdAt)),
  };
}
