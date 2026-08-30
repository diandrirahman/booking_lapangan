import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, serverStateEnabled } from "./apiClient";

export function useTenantRoles(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["business", tenantId, "roles"],
    queryFn: () => apiClient.listTenantRoles(tenantId!),
    enabled: serverStateEnabled && Boolean(tenantId),
  });
}

export function useRoleTemplates() {
  return useQuery({
    queryKey: ["business", "role-templates"],
    queryFn: () => apiClient.listRoleTemplates(),
    enabled: serverStateEnabled,
  });
}

export function useAssignTenantRole(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { membershipId: string; roleId: string }) =>
      apiClient.assignTenantRole(tenantId, input.membershipId, input.roleId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["business", tenantId, "roles"] }),
        queryClient.invalidateQueries({ queryKey: ["business", tenantId, "members"] }),
      ]);
    },
  });
}

export function useFinanceSummary(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["business", tenantId, "finance-summary"],
    queryFn: () => apiClient.getFinanceSummary(tenantId!),
    enabled: serverStateEnabled && Boolean(tenantId),
  });
}

export function useB2BusinessList(tenantId: string | undefined, resource: string) {
  return useQuery({
    queryKey: ["business", tenantId, "b2", resource],
    queryFn: () => {
      if (resource === "ledger") return apiClient.listFinanceLedger(tenantId!);
      if (resource === "payouts") return apiClient.listPayouts(tenantId!);
      if (resource === "promotions") return apiClient.listBusinessPromotions(tenantId!);
      if (resource === "refunds") return apiClient.listBusinessRefunds(tenantId!);
      if (resource === "reviews") return apiClient.listBusinessReviews(tenantId!);
      if (resource === "payments") return apiClient.listBusinessPayments(tenantId!);
      return apiClient.listBusinessSupport(tenantId!);
    },
    enabled: serverStateEnabled && Boolean(tenantId),
  });
}

export function useCreatePayout(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.createPayout(tenantId, crypto.randomUUID()),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["business", tenantId, "b2", "payouts"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["business", tenantId, "finance-summary"],
        }),
      ]);
    },
  });
}

export function useCustomerSupport() {
  return useQuery({
    queryKey: ["customer", "support"],
    queryFn: () => apiClient.listCustomerSupport(),
    enabled: serverStateEnabled,
  });
}

export function useCreateSupportTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: apiClient.createSupportTicket.bind(apiClient),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["customer", "support"] });
    },
  });
}

export function useCustomerBookingsForReview() {
  return useQuery({
    queryKey: ["customer", "bookings", "reviews"],
    queryFn: () => apiClient.listCustomerBookings(),
    enabled: serverStateEnabled,
  });
}

export function useCreateReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      bookingId: string;
      rating: number;
      cleanliness: number;
      courtQuality: number;
      facility: number;
      service: number;
      value: number;
      comment: string;
    }) => apiClient.createReview(input.bookingId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["customer", "bookings", "reviews"],
      });
    },
  });
}

export function useAdminB2List(
  resource:
    | "commission-configs"
    | "refunds"
    | "support"
    | "promotions"
    | "payouts"
    | "reviews"
    | "finance/ledger",
) {
  return useQuery({
    queryKey: ["admin", "b2", resource],
    queryFn: () => apiClient.listAdminB2(resource),
    enabled: serverStateEnabled,
  });
}
