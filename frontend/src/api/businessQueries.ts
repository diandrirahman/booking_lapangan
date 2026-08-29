import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BusinessBookingScope,
  CourtAvailabilityInput,
  CreateOfflineBookingInput,
  CreatePriceRuleInput,
  CreateCourtInput,
  ScheduleExceptionInput,
  VenuePaymentSettingsInput,
  VenueProfileInput,
} from "@lapangango/api-client";
import { apiClient, serverStateEnabled } from "./apiClient";
import { sessionQueryKey } from "./session";

export const workspaceQueryKey = ["business", "workspaces"] as const;

export function useWorkspaces() {
  return useQuery({
    queryKey: workspaceQueryKey,
    queryFn: () => apiClient.listWorkspaces(),
    enabled: serverStateEnabled,
  });
}

export function useCreateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => apiClient.createTenant(name),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: workspaceQueryKey }),
        queryClient.invalidateQueries({ queryKey: sessionQueryKey }),
      ]);
    },
  });
}

export function useWorkspaceMembers(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["business", tenantId, "members"],
    queryFn: () => apiClient.listWorkspaceMembers(tenantId!),
    enabled: serverStateEnabled && Boolean(tenantId),
  });
}

export function useAddWorkspaceMember(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; role: "OWNER" | "STAFF" }) =>
      apiClient.addWorkspaceMember(tenantId, input.email, input.role),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["business", tenantId, "members"],
      }),
  });
}

export function useUpdateStaffAssignments(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { membershipId: string; venueIds: string[] }) =>
      apiClient.updateStaffAssignments(tenantId, input.membershipId, input.venueIds),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["business", tenantId, "members"],
      }),
  });
}

export function useTransferPrimaryOwner(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { targetMembershipId: string; reason: string }) =>
      apiClient.transferPrimaryOwner(tenantId, input.targetMembershipId, input.reason),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["business", tenantId, "members"],
        }),
        queryClient.invalidateQueries({ queryKey: workspaceQueryKey }),
        queryClient.invalidateQueries({ queryKey: sessionQueryKey }),
      ]);
    },
  });
}

export function useBusinessSetupMasters() {
  return useQuery({
    queryKey: ["business", "setup-masters"],
    queryFn: () => apiClient.getBusinessSetupMasters(),
    enabled: serverStateEnabled,
    staleTime: 5 * 60_000,
  });
}

export function useBusinessVenues(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["business", tenantId, "venues"],
    queryFn: () => apiClient.listBusinessVenues(tenantId!),
    enabled: serverStateEnabled && Boolean(tenantId),
  });
}

export function useBusinessVenue(
  tenantId: string | undefined,
  venueId: string | undefined,
) {
  return useQuery({
    queryKey: ["business", tenantId, "venue", venueId],
    queryFn: () => apiClient.getBusinessVenue(tenantId!, venueId!),
    enabled: serverStateEnabled && Boolean(tenantId && venueId),
  });
}

export function useCreateBusinessVenue(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => apiClient.createBusinessVenue(tenantId, name),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["business", tenantId, "venues"] }),
  });
}

export function useUpdateBusinessVenueProfile(tenantId: string, venueId: string) {
  return useVenueMutation(tenantId, venueId, (input: VenueProfileInput) =>
    apiClient.updateBusinessVenueProfile(venueId, input),
  );
}

export function useUpdateBusinessVenueCatalog(tenantId: string, venueId: string) {
  return useVenueMutation(
    tenantId,
    venueId,
    (input: { sportIds: string[]; facilityIds: string[] }) =>
      apiClient.updateBusinessVenueCatalog(venueId, { tenantId, ...input }),
  );
}

export function useCreateBusinessCourt(tenantId: string, venueId: string) {
  return useVenueMutation(
    tenantId,
    venueId,
    (input: Omit<CreateCourtInput, "tenantId">) =>
      apiClient.createBusinessCourt(venueId, { tenantId, ...input }),
  );
}

export function useUpdateCourtAvailability(tenantId: string, venueId: string) {
  return useVenueMutation(
    tenantId,
    venueId,
    ({
      courtId,
      input,
    }: {
      courtId: string;
      input: Omit<CourtAvailabilityInput, "tenantId">;
    }) => apiClient.updateCourtAvailability(venueId, courtId, { tenantId, ...input }),
  );
}

export function useCreateScheduleException(tenantId: string, venueId: string) {
  return useVenueMutation(
    tenantId,
    venueId,
    (input: Omit<ScheduleExceptionInput, "tenantId">) =>
      apiClient.createScheduleException(venueId, { tenantId, ...input }),
  );
}

export function useUpdateVenuePaymentSettings(tenantId: string, venueId: string) {
  return useVenueMutation(
    tenantId,
    venueId,
    (input: Omit<VenuePaymentSettingsInput, "tenantId">) =>
      apiClient.updateVenuePaymentSettings(venueId, { tenantId, ...input }),
  );
}

export function useSubmitBusinessVenue(tenantId: string, venueId: string) {
  return useVenueMutation(tenantId, venueId, () =>
    apiClient.submitBusinessVenue(tenantId, venueId),
  );
}

export function useUploadVenueMedia(tenantId: string, venueId: string) {
  return useVenueMutation(
    tenantId,
    venueId,
    async (input: { file: File; altText: string; purpose: "COVER" | "GALLERY" }) => {
      const signedUpload = await apiClient.createSignedUpload(
        tenantId,
        venueId,
        input.file,
      );
      await apiClient.uploadSignedFile(signedUpload.uploadUrl, input.file);
      return apiClient.completeVenueMedia(venueId, {
        tenantId,
        storageKey: signedUpload.storageKey,
        mimeType: input.file.type as "image/webp" | "image/jpeg" | "image/png",
        byteSize: input.file.size,
        altText: input.altText,
        purpose: input.purpose,
      });
    },
  );
}

export function useCreateVenueAddon(tenantId: string, venueId: string) {
  return useVenueMutation(tenantId, venueId, (input: { name: string; price: number }) =>
    apiClient.createVenueAddon(venueId, { tenantId, ...input }),
  );
}

export function useBusinessDashboard(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["business", tenantId, "dashboard"],
    queryFn: () => apiClient.getBusinessDashboard(tenantId!),
    enabled: serverStateEnabled && Boolean(tenantId),
  });
}

export function useBusinessBookings(
  tenantId: string | undefined,
  filters: { venueId?: string; status?: string; outstandingOnly?: boolean } = {},
) {
  return useQuery({
    queryKey: ["business", tenantId, "bookings", filters],
    queryFn: () => apiClient.listBusinessBookings({ tenantId: tenantId!, ...filters }),
    enabled: serverStateEnabled && Boolean(tenantId),
  });
}

export function useBusinessCalendar(
  tenantId: string | undefined,
  range: { startsAfter: string; startsBefore: string },
) {
  return useQuery({
    queryKey: ["business", tenantId, "calendar", range],
    queryFn: () => apiClient.getBusinessCalendar({ tenantId: tenantId!, ...range }),
    enabled: serverStateEnabled && Boolean(tenantId),
  });
}

export function useCourtAvailability(courtId: string | undefined, date: string) {
  return useQuery({
    queryKey: ["availability", courtId, date],
    queryFn: () => apiClient.getAvailability(courtId!, date),
    enabled: serverStateEnabled && Boolean(courtId && date),
  });
}

export function useCreateOfflineBooking(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOfflineBookingInput) =>
      apiClient.createOfflineBooking(input, crypto.randomUUID()),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["business", tenantId] }),
  });
}

export function useBusinessBookingAction(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      bookingId: string;
      scope: BusinessBookingScope;
      action:
        | { kind: "transition"; status: string; reason: string }
        | { kind: "attendance"; attendance: "CHECKED_IN" | "NO_SHOW"; reason?: string }
        | { kind: "settle" };
    }) => {
      if (input.action.kind === "transition") {
        await apiClient.transitionBusinessBooking(
          input.bookingId,
          input.scope,
          input.action.status,
          input.action.reason,
        );
        return;
      }
      if (input.action.kind === "attendance") {
        await apiClient.recordBusinessAttendance(
          input.bookingId,
          input.scope,
          input.action.attendance,
          input.action.reason,
        );
        return;
      }
      await apiClient.settleBusinessOutstanding(
        input.bookingId,
        input.scope,
        crypto.randomUUID(),
      );
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["business", tenantId] }),
  });
}

export function useCreatePriceRule(tenantId: string, venueId: string) {
  return useVenueMutation(tenantId, venueId, (input: CreatePriceRuleInput) =>
    apiClient.createPriceRule(input),
  );
}

export function usePricingPreview(tenantId: string, venueId: string) {
  return useMutation({
    mutationFn: (input: {
      courtId: string;
      samples: Array<{ localDate: string; localTime: string }>;
      candidate?: CreatePriceRuleInput;
    }) => apiClient.previewPricing({ tenantId, venueId, ...input }),
  });
}

export function useCreateBusinessClosure(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      venueId: string;
      courtId?: string;
      startsAt: string;
      endsAt: string;
      kind: "CLOSURE" | "MAINTENANCE" | "BLOCK";
      reason: string;
    }) => apiClient.createBusinessClosure({ tenantId, ...input }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["business", tenantId] }),
  });
}

export function useClosureBookingAction(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      input:
        | {
            kind: "cancel";
            bookingId: string;
            venueId: string;
            reason: string;
          }
        | {
            kind: "reschedule";
            bookingId: string;
            venueId: string;
            newSlotIds: string[];
            reason: string;
          },
    ) =>
      input.kind === "cancel"
        ? apiClient.cancelBookingForClosure(
            input.bookingId,
            { tenantId, venueId: input.venueId },
            input.reason,
          )
        : apiClient.rescheduleBusinessBooking(
            input.bookingId,
            { tenantId, venueId: input.venueId },
            input.newSlotIds,
            input.reason,
          ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["business", tenantId] }),
  });
}

function useVenueMutation<Input, Output>(
  tenantId: string,
  venueId: string,
  mutationFn: (input: Input) => Promise<Output>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["business", tenantId, "venue", venueId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["business", tenantId, "venues"],
        }),
      ]);
    },
  });
}
