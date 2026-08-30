import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiClient, serverStateEnabled } from "./apiClient";

const EVENT_TYPES = [
  "booking.created",
  "booking.status_changed",
  "payment.status_changed",
  "refund.status_changed",
  "transaction.dispute",
  "earning.status_changed",
  "payout.status_changed",
  "support.status_changed",
  "venue.publication_changed",
];

interface RealtimeEvent {
  id: string;
  resource: { type: string; id: string };
  version: number;
}

export function RealtimeSync() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [connectionState, setConnectionState] = useState<
    "idle" | "connected" | "reconnecting"
  >("idle");

  useEffect(() => {
    if (!serverStateEnabled) return;
    let active = true;
    let reconnectAttempt = 0;
    let eventSource: EventSource | null = null;
    let reconnectTimer: number | undefined;
    const latestVersions = new Map<string, number>();

    async function connectIfAuthenticated() {
      try {
        await apiClient.getCurrentUser();
        if (active) connect();
      } catch {
        // Anonymous browsing remains REST-only until login succeeds.
      }
    }

    function connect() {
      eventSource?.close();
      const eventUrl = realtimeUrl(location.pathname);
      eventSource = new EventSource(eventUrl, { withCredentials: true });
      eventSource.addEventListener("ready", () => {
        reconnectAttempt = 0;
        setConnectionState("connected");
        void queryClient.invalidateQueries();
      });
      eventSource.addEventListener("degraded", () => {
        setConnectionState("reconnecting");
      });
      for (const eventType of EVENT_TYPES) {
        eventSource.addEventListener(eventType, (rawEvent) => {
          const event = parseEvent(rawEvent as MessageEvent<string>);
          if (!event) return;
          const resourceKey = `${event.resource.type}:${event.resource.id}`;
          if ((latestVersions.get(resourceKey) ?? -1) >= event.version) return;
          latestVersions.set(resourceKey, event.version);
          void queryClient.invalidateQueries({
            queryKey: [event.resource.type, event.resource.id],
          });
          void queryClient.invalidateQueries({ queryKey: [`${event.resource.type}s`] });
          void queryClient.invalidateQueries({ queryKey: ["business"] });
          void queryClient.invalidateQueries({ queryKey: ["admin"] });
          void queryClient.invalidateQueries({ queryKey: ["availability"] });
          void queryClient.invalidateQueries({ queryKey: ["notifications"] });
        });
      }
      eventSource.onerror = () => {
        eventSource?.close();
        if (!active) return;
        setConnectionState("reconnecting");
        const delay = Math.min(30_000, 1_000 * 2 ** reconnectAttempt);
        reconnectAttempt += 1;
        reconnectTimer = window.setTimeout(connect, delay);
      };
    }

    const sessionListener = () => void connectIfAuthenticated();
    window.addEventListener("lapangango:session-changed", sessionListener);
    void connectIfAuthenticated();
    return () => {
      active = false;
      eventSource?.close();
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      window.removeEventListener("lapangango:session-changed", sessionListener);
      setConnectionState("idle");
    };
  }, [location.pathname, queryClient]);

  return connectionState === "reconnecting" ? (
    <div className="realtime-status" role="status">
      Koneksi realtime terputus. Menyambungkan ulang; data tetap tersedia melalui REST.
    </div>
  ) : null;
}

function realtimeUrl(pathname: string): string {
  if (pathname.startsWith("/admin")) return "/api/v1/events?scope=platform";
  if (pathname.startsWith("/business/")) {
    const tenantId = pathname.split("/")[2];
    return `/api/v1/events?tenantId=${encodeURIComponent(tenantId)}`;
  }
  return "/api/v1/events";
}

function parseEvent(event: MessageEvent<string>): RealtimeEvent | null {
  try {
    return JSON.parse(event.data) as RealtimeEvent;
  } catch {
    return null;
  }
}
