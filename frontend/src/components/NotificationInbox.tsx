import * as Popover from "@radix-ui/react-popover";
import {
  Bell,
  CalendarCheck2,
  CheckCheck,
  CreditCard,
  Megaphone,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "../api/notificationQueries";
import { serverStateEnabled } from "../api/apiClient";
import { useSession } from "../api/session";
import type { Notification } from "../domain/types";
import { toNotificationPresentation } from "../domain/notificationPresentation";
import { usePrototype } from "../store/PrototypeStore";

export function NotificationIcon({ kind }: { kind: Notification["kind"] }) {
  const Icon = {
    booking: CalendarCheck2,
    payment: CreditCard,
    verification: UsersRound,
    system: Megaphone,
  }[kind];

  return <Icon aria-hidden="true" />;
}

// Composition adapted from Ruixen UI's Notification Inbox Popover on 21st.dev.
export function NotificationInbox() {
  const { state, dispatch } = usePrototype();
  const session = useSession();
  const serverNotifications = useNotifications(false, Boolean(session.data));
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const usesServerNotifications = serverStateEnabled;
  const notifications = usesServerNotifications
    ? (serverNotifications.data?.items.map(toNotificationPresentation) ?? [])
    : state.notifications;
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const visibleNotifications = notifications
    .filter((notification) => filter === "all" || !notification.read)
    .slice(0, 4);

  return (
    <Popover.Root>
      <Popover.Trigger
        className="icon-button notification-trigger"
        aria-label={
          unreadCount > 0 ? `Notifikasi, ${unreadCount} belum dibaca` : "Notifikasi"
        }
      >
        <Bell />
        {unreadCount > 0 && (
          <span className="notification-count" aria-hidden="true">
            {unreadCount}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="notification-popover"
          align="end"
          sideOffset={8}
          collisionPadding={12}
        >
          <div className="notification-popover-header">
            <div>
              <strong>Notifikasi</strong>
              <span>{unreadCount} belum dibaca</span>
            </div>
            <button
              type="button"
              disabled={unreadCount === 0}
              onClick={() => {
                if (usesServerNotifications) {
                  markAllRead.mutate();
                } else {
                  dispatch({ type: "MARK_ALL_NOTIFICATIONS_READ" });
                }
              }}
            >
              <CheckCheck />
              Tandai semua
            </button>
          </div>
          <div className="notification-filter" aria-label="Filter notifikasi">
            <button
              className={filter === "all" ? "active" : ""}
              type="button"
              onClick={() => setFilter("all")}
            >
              Semua
            </button>
            <button
              className={filter === "unread" ? "active" : ""}
              type="button"
              onClick={() => setFilter("unread")}
            >
              Belum dibaca
            </button>
          </div>
          <div className="notification-popover-list">
            {visibleNotifications.length > 0 ? (
              visibleNotifications.map((notification) => (
                <Link
                  className={`notification-compact-row ${notification.read ? "" : "unread"}`}
                  key={notification.id}
                  to={notification.actionHref}
                  onClick={() => {
                    if (usesServerNotifications) {
                      markRead.mutate(notification.id);
                    } else {
                      dispatch({
                        type: "MARK_NOTIFICATION_READ",
                        notificationId: notification.id,
                      });
                    }
                  }}
                >
                  <span className={`notification-kind ${notification.kind}`}>
                    <NotificationIcon kind={notification.kind} />
                  </span>
                  <span>
                    <strong>{notification.title}</strong>
                    <small>{notification.body}</small>
                    <time>{notification.time}</time>
                  </span>
                  {!notification.read && <i aria-label="Belum dibaca" />}
                </Link>
              ))
            ) : (
              <p className="notification-popover-empty">
                Semua notifikasi sudah dibaca.
              </p>
            )}
          </div>
          <Link className="notification-popover-footer" to="/notifications">
            Lihat semua notifikasi
          </Link>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
