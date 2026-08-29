import type { components } from "./generated.js";

export type ApiErrorBody = components["schemas"]["ApiError"];
export type Venue = components["schemas"]["Venue"];
export type VenuePage = components["schemas"]["VenuePage"];
export type Booking = components["schemas"]["Booking"];
export type CustomerBookingSummary = components["schemas"]["CustomerBookingSummary"];
export type CreateBookingInput = components["schemas"]["CreateBookingInput"];
export type SessionResponse = components["schemas"]["SessionResponse"];
export type RegisterInput = components["schemas"]["RegisterInput"];
export type AvailabilitySlot = components["schemas"]["AvailabilitySlot"];
export type PaymentAttempt = components["schemas"]["PaymentAttempt"];
export type Workspace = components["schemas"]["Workspace"];
export type WorkspaceMember = components["schemas"]["WorkspaceMember"];
export type SetupMasters = components["schemas"]["SetupMasters"];
export type VenueSetupSummary = components["schemas"]["VenueSetupSummary"];
export type VenueSetupDetail = components["schemas"]["VenueSetupDetail"];
export type VenueProfileInput = components["schemas"]["VenueProfileInput"];
export type CreateCourtInput = components["schemas"]["CreateCourtInput"];
export type CourtAvailabilityInput = components["schemas"]["CourtAvailabilityInput"];
export type ScheduleExceptionInput = components["schemas"]["ScheduleExceptionInput"];
export type VenuePaymentSettingsInput =
  components["schemas"]["VenuePaymentSettingsInput"];
export type BusinessBooking = components["schemas"]["BusinessBooking"];
export type BusinessDashboard = components["schemas"]["BusinessDashboard"];
export type BusinessCalendar = components["schemas"]["BusinessCalendar"];
export type AdminDashboard = components["schemas"]["AdminDashboard"];
export type AdminTenant = components["schemas"]["AdminTenant"];
export type AdminVenue = components["schemas"]["AdminVenue"];
export type AdminVerification = components["schemas"]["AdminVerification"];
export type AdminAuditEntry = components["schemas"]["AdminAuditEntry"];
export type AdminAuditPage = components["schemas"]["AdminAuditPage"];
export type AccountNotification = components["schemas"]["AccountNotification"];

export interface CreateOfflineBookingInput {
  tenantId: string;
  venueId: string;
  courtId: string;
  slotIds: string[];
  paymentMode: "FULL" | "DP" | "PAY_AT_VENUE";
  customer: {
    name: string;
    phone?: string;
    channel: string;
    adjustedAmount?: number;
    adjustmentReason?: string;
  };
}

export interface BusinessBookingScope {
  tenantId: string;
  venueId: string;
}

export interface CreatePriceRuleInput extends BusinessBookingScope {
  courtId: string | null;
  kind: "BASE" | "WEEKDAY_WEEKEND" | "DAY_TIME" | "SPECIAL_DATE";
  amount: number;
  dayOfWeek: number | null;
  specialDate: string | null;
  startsAtLocal: string | null;
  endsAtLocal: string | null;
}

export interface AdminMasters {
  sports: Array<{ id: string; slug: string; name: string; active: boolean }>;
  facilities: Array<{ id: string; slug: string; name: string; active: boolean }>;
  bookingIntervals: Array<{ id: string; minutes: number; active: boolean }>;
  buffers: Array<{ id: string; minutes: number; active: boolean }>;
  paymentOptions: Array<{ id: string; code: string; label: string; active: boolean }>;
}

export interface SignedUpload {
  storageKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiClientError";
    this.status = status;
    this.body = body;
  }
}

export interface ApiClientOptions {
  baseUrl?: string;
  fetchImplementation?: typeof fetch;
}

export class LapanganGoApiClient {
  private readonly baseUrl: string;
  private readonly fetchImplementation: typeof fetch;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "/api/v1").replace(/\/$/, "");
    this.fetchImplementation =
      options.fetchImplementation ?? globalThis.fetch.bind(globalThis);
  }

  getCurrentUser(): Promise<SessionResponse> {
    return this.request("/me");
  }

  async searchVenues(parameters: {
    query?: string;
    area?: string;
    cityCode?: string;
    sport?: string;
    facilities?: string;
    date?: string;
    time?: string;
    minimumPrice?: number;
    maximumPrice?: number;
    indoorOutdoorType?: "INDOOR" | "OUTDOOR" | "MIXED";
    paymentMode?: "FULL" | "DP" | "PAY_AT_VENUE";
    hasPromo?: boolean;
    minimumRating?: number;
    latitude?: number;
    longitude?: number;
    maximumDistanceKm?: number;
    sort?:
      "RELEVANT" | "NEAREST" | "PRICE_LOWEST" | "RATING_HIGHEST" | "POPULAR" | "NEWEST";
    cursor?: string;
    limit?: number;
  }): Promise<VenuePage> {
    const search = new URLSearchParams();
    Object.entries(parameters).forEach(([key, value]) => {
      if (value !== undefined) search.set(key, String(value));
    });
    const query = search.size > 0 ? `?${search.toString()}` : "";
    return this.request(`/venues${query}`);
  }

  getVenue(slug: string): Promise<Venue> {
    return this.request(`/venues/${encodeURIComponent(slug)}`);
  }

  getAvailability(
    courtId: string,
    date: string,
  ): Promise<{ items: AvailabilitySlot[]; version: number }> {
    const search = new URLSearchParams({ courtId, date });
    return this.request(`/availability?${search.toString()}`);
  }

  login(email: string, password: string): Promise<SessionResponse> {
    return this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  register(input: RegisterInput): Promise<SessionResponse> {
    return this.request("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  logout(): Promise<void> {
    return this.request("/auth/logout", { method: "POST" });
  }

  startGoogleAccountLink(password: string): Promise<{ authorizationUrl: string }> {
    return this.request("/auth/google/link/start", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  }

  listNotifications(unreadOnly = false): Promise<{ items: AccountNotification[] }> {
    return this.request(`/notifications?${queryString({ unreadOnly })}`);
  }

  markNotificationRead(notificationId: string): Promise<void> {
    return this.request(`/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: "PATCH",
    });
  }

  markAllNotificationsRead(): Promise<void> {
    return this.request("/notifications/read-all", { method: "POST" });
  }

  listWorkspaces(): Promise<{ items: Workspace[] }> {
    return this.request("/business/workspaces");
  }

  createTenant(name: string): Promise<Workspace> {
    return this.request("/business/tenants", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  listWorkspaceMembers(tenantId: string): Promise<{ items: WorkspaceMember[] }> {
    return this.request(`/business/tenants/${encodeURIComponent(tenantId)}/members`);
  }

  addWorkspaceMember(
    tenantId: string,
    email: string,
    role: "OWNER" | "STAFF",
  ): Promise<{ membershipId: string }> {
    return this.request(`/business/tenants/${encodeURIComponent(tenantId)}/members`, {
      method: "POST",
      body: JSON.stringify({ email, role }),
    });
  }

  updateStaffAssignments(
    tenantId: string,
    membershipId: string,
    venueIds: string[],
  ): Promise<void> {
    return this.request(
      `/business/tenants/${encodeURIComponent(tenantId)}/staff/${encodeURIComponent(membershipId)}/assignments`,
      { method: "PUT", body: JSON.stringify({ venueIds }) },
    );
  }

  transferPrimaryOwner(
    tenantId: string,
    targetMembershipId: string,
    reason: string,
  ): Promise<void> {
    return this.request("/business/tenants/transfer-primary-owner", {
      method: "POST",
      body: JSON.stringify({ tenantId, targetMembershipId, reason }),
    });
  }

  getBusinessSetupMasters(): Promise<SetupMasters> {
    return this.request("/business/setup-masters");
  }

  listBusinessVenues(tenantId: string): Promise<{ items: VenueSetupSummary[] }> {
    return this.request(`/business/venues?${queryString({ tenantId })}`);
  }

  createBusinessVenue(
    tenantId: string,
    name: string,
  ): Promise<{ id: string; slug: string }> {
    return this.request("/business/venues", {
      method: "POST",
      body: JSON.stringify({ tenantId, name }),
    });
  }

  getBusinessVenue(tenantId: string, venueId: string): Promise<VenueSetupDetail> {
    return this.request(
      `/business/venues/${encodeURIComponent(venueId)}?${queryString({ tenantId })}`,
    );
  }

  updateBusinessVenueProfile(venueId: string, input: VenueProfileInput): Promise<void> {
    return this.request(`/business/venues/${encodeURIComponent(venueId)}/profile`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  }

  updateBusinessVenueCatalog(
    venueId: string,
    input: { tenantId: string; sportIds: string[]; facilityIds: string[] },
  ): Promise<void> {
    return this.request(`/business/venues/${encodeURIComponent(venueId)}/catalog`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  }

  createBusinessCourt(
    venueId: string,
    input: CreateCourtInput,
  ): Promise<{ id: string }> {
    return this.request(`/business/venues/${encodeURIComponent(venueId)}/courts`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateCourtAvailability(
    venueId: string,
    courtId: string,
    input: CourtAvailabilityInput,
  ): Promise<void> {
    return this.request(
      `/business/venues/${encodeURIComponent(venueId)}/courts/${encodeURIComponent(courtId)}/availability`,
      { method: "PUT", body: JSON.stringify(input) },
    );
  }

  createScheduleException(
    venueId: string,
    input: ScheduleExceptionInput,
  ): Promise<{ id: string }> {
    return this.request(`/business/venues/${encodeURIComponent(venueId)}/exceptions`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateVenuePaymentSettings(
    venueId: string,
    input: VenuePaymentSettingsInput,
  ): Promise<void> {
    return this.request(
      `/business/venues/${encodeURIComponent(venueId)}/payment-settings`,
      { method: "PUT", body: JSON.stringify(input) },
    );
  }

  submitBusinessVenue(
    tenantId: string,
    venueId: string,
  ): Promise<{ requestId: string }> {
    return this.request(`/business/venues/${encodeURIComponent(venueId)}/submit`, {
      method: "POST",
      body: JSON.stringify({ tenantId }),
    });
  }

  createSignedUpload(
    tenantId: string,
    venueId: string,
    file: { name: string; type: string; size: number },
  ): Promise<SignedUpload> {
    return this.request(
      `/business/venues/${encodeURIComponent(venueId)}/media/signed-upload`,
      {
        method: "POST",
        body: JSON.stringify({
          tenantId,
          fileName: file.name,
          mimeType: file.type,
          byteSize: file.size,
        }),
      },
    );
  }

  async uploadSignedFile(uploadUrl: string, file: Blob): Promise<void> {
    const response = await this.fetchImplementation(uploadUrl, {
      method: "PUT",
      headers: { "content-type": file.type },
      body: file,
    });
    if (!response.ok) {
      throw new Error("File tidak dapat diunggah ke object storage.");
    }
  }

  completeVenueMedia(
    venueId: string,
    input: {
      tenantId: string;
      storageKey: string;
      mimeType: "image/webp" | "image/jpeg" | "image/png";
      byteSize: number;
      altText: string;
      purpose: "COVER" | "GALLERY";
    },
  ): Promise<{ id: string }> {
    return this.request(`/business/venues/${encodeURIComponent(venueId)}/media`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  createVenueAddon(
    venueId: string,
    input: { tenantId: string; name: string; price: number },
  ): Promise<{ id: string }> {
    return this.request(`/business/venues/${encodeURIComponent(venueId)}/addons`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  getBusinessDashboard(tenantId: string, venueId?: string): Promise<BusinessDashboard> {
    return this.request(`/business/dashboard?${queryString({ tenantId, venueId })}`);
  }

  listBusinessBookings(input: {
    tenantId: string;
    venueId?: string;
    startsAfter?: string;
    startsBefore?: string;
    status?: string;
    outstandingOnly?: boolean;
  }): Promise<{ items: BusinessBooking[] }> {
    return this.request(`/business/bookings?${queryString(input)}`);
  }

  getBusinessCalendar(input: {
    tenantId: string;
    venueId?: string;
    startsAfter: string;
    startsBefore: string;
  }): Promise<BusinessCalendar> {
    return this.request(`/business/calendar?${queryString(input)}`);
  }

  createOfflineBooking(
    input: CreateOfflineBookingInput,
    idempotencyKey: string,
  ): Promise<Booking> {
    return this.request("/business/bookings/offline", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(input),
    });
  }

  transitionBusinessBooking(
    bookingId: string,
    scope: BusinessBookingScope,
    status: string,
    reason: string,
  ): Promise<void> {
    return this.request(
      `/business/bookings/${encodeURIComponent(bookingId)}/transition`,
      { method: "POST", body: JSON.stringify({ ...scope, status, reason }) },
    );
  }

  recordBusinessAttendance(
    bookingId: string,
    scope: BusinessBookingScope,
    attendance: "CHECKED_IN" | "NO_SHOW",
    reason?: string,
  ): Promise<void> {
    return this.request(
      `/business/bookings/${encodeURIComponent(bookingId)}/attendance`,
      { method: "POST", body: JSON.stringify({ ...scope, attendance, reason }) },
    );
  }

  settleBusinessOutstanding(
    bookingId: string,
    scope: BusinessBookingScope,
    idempotencyKey: string,
  ): Promise<{ attemptId: string; amount: number }> {
    return this.request(`/business/bookings/${encodeURIComponent(bookingId)}/settle`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(scope),
    });
  }

  createBusinessClosure(
    input: BusinessBookingScope & {
      courtId?: string;
      startsAt: string;
      endsAt: string;
      kind: "CLOSURE" | "MAINTENANCE" | "BLOCK";
      reason: string;
    },
  ): Promise<{ blockId: string; impactedBookingIds: string[] }> {
    return this.request("/business/closures", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  cancelBookingForClosure(
    bookingId: string,
    scope: BusinessBookingScope,
    reason: string,
  ): Promise<void> {
    return this.request(
      `/business/bookings/${encodeURIComponent(bookingId)}/cancel-for-closure`,
      { method: "POST", body: JSON.stringify({ ...scope, reason }) },
    );
  }

  rescheduleBusinessBooking(
    bookingId: string,
    scope: BusinessBookingScope,
    newSlotIds: string[],
    reason: string,
  ): Promise<void> {
    return this.request(
      `/business/bookings/${encodeURIComponent(bookingId)}/reschedule`,
      { method: "POST", body: JSON.stringify({ ...scope, newSlotIds, reason }) },
    );
  }

  createPriceRule(input: CreatePriceRuleInput): Promise<{ id: string }> {
    return this.request("/business/pricing-rules", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  previewPricing(input: {
    tenantId: string;
    venueId: string;
    courtId: string;
    samples: Array<{ localDate: string; localTime: string }>;
    candidate?: CreatePriceRuleInput;
  }): Promise<{
    items: Array<{
      localDate: string;
      localTime: string;
      amount: number;
      selectedRuleId: string;
      selectedKind: "BASE" | "WEEKDAY_WEEKEND" | "DAY_TIME" | "SPECIAL_DATE";
      scope: "COURT" | "VENUE";
    }>;
  }> {
    return this.request("/business/pricing-preview", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  getAdminDashboard(): Promise<AdminDashboard> {
    return this.request("/admin/dashboard");
  }

  listAdminAudit(
    parameters: {
      cursor?: string;
      limit?: number;
      action?: string;
      resourceType?: string;
      tenantId?: string;
      venueId?: string;
      actorUserId?: string;
      from?: string;
      to?: string;
    } = {},
  ): Promise<AdminAuditPage> {
    const search = queryString(parameters);
    return this.request(`/admin/audit${search ? `?${search}` : ""}`);
  }

  listAdminTenants(): Promise<{ items: AdminTenant[] }> {
    return this.request("/admin/tenants");
  }

  listAdminVenues(): Promise<{ items: AdminVenue[] }> {
    return this.request("/admin/venues");
  }

  updateAdminTenantStatus(
    tenantId: string,
    status: "DRAFT" | "ACTIVE" | "INACTIVE" | "SUSPENDED",
    reason: string,
  ): Promise<void> {
    return this.request(`/admin/tenants/${encodeURIComponent(tenantId)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason }),
    });
  }

  updateAdminVenueStatus(
    venueId: string,
    status: "DRAFT" | "ACTIVE" | "INACTIVE" | "SUSPENDED",
    reason: string,
  ): Promise<void> {
    return this.request(`/admin/venues/${encodeURIComponent(venueId)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason }),
    });
  }

  listAdminVerifications(): Promise<{ items: AdminVerification[] }> {
    return this.request("/admin/verifications");
  }

  getAdminMasters(): Promise<AdminMasters> {
    return this.request("/admin/masters");
  }

  createAdminNamedMaster(
    kind: "sport" | "facility",
    name: string,
  ): Promise<{ id: string; slug: string }> {
    return this.request(`/admin/masters/${kind}`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  updateAdminNamedMaster(
    kind: "sport" | "facility",
    id: string,
    active: boolean,
  ): Promise<void> {
    return this.request(`/admin/masters/${kind}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ active }),
    });
  }

  createAdminDurationOption(
    kind: "interval" | "buffer",
    minutes: number,
  ): Promise<{ id: string }> {
    return this.request(`/admin/masters/durations/${kind}`, {
      method: "POST",
      body: JSON.stringify({ minutes }),
    });
  }

  createAdminPaymentOption(code: string, label: string): Promise<{ id: string }> {
    return this.request("/admin/masters/payment-options", {
      method: "POST",
      body: JSON.stringify({ code, label }),
    });
  }

  updateAdminPaymentOption(id: string, active: boolean): Promise<void> {
    return this.request(`/admin/masters/payment-options/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ active }),
    });
  }

  decideAdminVerification(
    requestId: string,
    decision: "APPROVED" | "REJECTED" | "REVISION_REQUIRED",
    reason: string,
  ): Promise<void> {
    return this.request(
      `/admin/verifications/${encodeURIComponent(requestId)}/decision`,
      { method: "POST", body: JSON.stringify({ decision, reason }) },
    );
  }

  createPaymentAttempt(
    bookingId: string,
    kind: "FULL" | "DP" | "RESERVATION" | "BALANCE" | "RETRY",
    idempotencyKey: string,
  ): Promise<PaymentAttempt> {
    return this.request("/payment-attempts", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ bookingId, kind }),
    });
  }

  getBooking(bookingId: string): Promise<Booking> {
    return this.request(`/bookings/${encodeURIComponent(bookingId)}`);
  }

  listCustomerBookings(): Promise<{ items: CustomerBookingSummary[] }> {
    return this.request("/bookings");
  }

  getPaymentAttempt(attemptId: string): Promise<PaymentAttempt> {
    return this.request(`/payment-attempts/${encodeURIComponent(attemptId)}`);
  }

  simulatePaymentAttempt(
    attemptId: string,
    result: "success" | "pending" | "failed" | "expired",
  ): Promise<void> {
    return this.request(`/payment-attempts/${encodeURIComponent(attemptId)}/simulate`, {
      method: "POST",
      body: JSON.stringify({ result }),
    });
  }

  createBooking(input: CreateBookingInput, idempotencyKey: string): Promise<Booking> {
    return this.request("/bookings", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(input),
    });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body !== undefined) headers.set("content-type", "application/json");

    const response = await this.fetchImplementation(`${this.baseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers,
    });
    if (response.ok) {
      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    }

    const body = (await response.json()) as ApiErrorBody;
    throw new ApiClientError(response.status, body);
  }
}

function queryString(
  values: Record<string, string | number | boolean | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) search.set(key, String(value));
  }
  return search.toString();
}
