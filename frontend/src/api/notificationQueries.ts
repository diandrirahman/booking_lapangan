import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, serverStateEnabled } from "./apiClient";

export const notificationQueryKey = ["notifications"] as const;

export function useNotifications(unreadOnly = false, enabled = true) {
  return useQuery({
    queryKey: [...notificationQueryKey, { unreadOnly }],
    queryFn: () => apiClient.listNotifications(unreadOnly),
    enabled: serverStateEnabled && enabled,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) =>
      apiClient.markNotificationRead(notificationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationQueryKey }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationQueryKey }),
  });
}
