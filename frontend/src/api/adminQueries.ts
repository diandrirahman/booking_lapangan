import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient, serverStateEnabled } from "./apiClient";

export function useAdminDashboard() {
  return useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => apiClient.getAdminDashboard(),
    enabled: serverStateEnabled,
  });
}

export interface AdminAuditFilters {
  action?: string;
  resourceType?: string;
  from?: string;
  to?: string;
}

export function useAdminAudit(filters: AdminAuditFilters) {
  return useInfiniteQuery({
    queryKey: ["admin", "audit", filters],
    queryFn: ({ pageParam }) =>
      apiClient.listAdminAudit({ ...filters, cursor: pageParam, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: serverStateEnabled,
  });
}

export function useAdminTenants() {
  return useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: () => apiClient.listAdminTenants(),
    enabled: serverStateEnabled,
  });
}

export function useAdminVenues() {
  return useQuery({
    queryKey: ["admin", "venues"],
    queryFn: () => apiClient.listAdminVenues(),
    enabled: serverStateEnabled,
  });
}

export function useAdminVerifications() {
  return useQuery({
    queryKey: ["admin", "verifications"],
    queryFn: () => apiClient.listAdminVerifications(),
    enabled: serverStateEnabled,
  });
}

type PlatformResourceStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "SUSPENDED";

export function useUpdateAdminTenantStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      tenantId: string;
      status: PlatformResourceStatus;
      reason: string;
    }) => apiClient.updateAdminTenantStatus(input.tenantId, input.status, input.reason),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["venues"] }),
      ]);
    },
  });
}

export function useUpdateAdminVenueStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      venueId: string;
      status: PlatformResourceStatus;
      reason: string;
    }) => apiClient.updateAdminVenueStatus(input.venueId, input.status, input.reason),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "venues"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["venues"] }),
      ]);
    },
  });
}

export function useAdminMasters() {
  return useQuery({
    queryKey: ["admin", "masters"],
    queryFn: () => apiClient.getAdminMasters(),
    enabled: serverStateEnabled,
  });
}

export function useCreateAdminMaster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { kind: "sport" | "facility"; name: string }) =>
      apiClient.createAdminNamedMaster(input.kind, input.name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "masters"] }),
  });
}

export function useToggleAdminMaster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { kind: "sport" | "facility"; id: string; active: boolean }) =>
      apiClient.updateAdminNamedMaster(input.kind, input.id, input.active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "masters"] }),
  });
}

export function useCreateAdminDuration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { kind: "interval" | "buffer"; minutes: number }) =>
      apiClient.createAdminDurationOption(input.kind, input.minutes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "masters"] }),
  });
}

export function useCreateAdminPaymentOption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { code: string; label: string }) =>
      apiClient.createAdminPaymentOption(input.code, input.label),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "masters"] }),
  });
}

export function useToggleAdminPaymentOption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; active: boolean }) =>
      apiClient.updateAdminPaymentOption(input.id, input.active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "masters"] }),
  });
}

export function useDecideAdminVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      requestId: string;
      decision: "APPROVED" | "REJECTED" | "REVISION_REQUIRED";
      reason: string;
    }) =>
      apiClient.decideAdminVerification(input.requestId, input.decision, input.reason),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin"] }),
        queryClient.invalidateQueries({ queryKey: ["business"] }),
        queryClient.invalidateQueries({ queryKey: ["venues"] }),
      ]);
    },
  });
}
