export type PrototypeRole = "customer" | "owner" | "staff" | "admin";
export type Scenario =
  | "baseline"
  | "loading"
  | "empty"
  | "validation-error"
  | "server-error"
  | "expired"
  | "stale"
  | "reconnecting"
  | "success"
  | "unauthorized";
export type VenueStatus =
  "draft" | "in_review" | "revision" | "published" | "rejected";

export interface Venue {
  id: string;
  slug: string;
  tenantId: string;
  name: string;
  location: string;
  distance: string;
  sport: string;
  rating: number;
  reviewCount: number;
  priceFrom: number;
  nextSlot: string;
  image: string;
  status: VenueStatus;
  facilities: string[];
  lat: number;
  lng: number;
}
export interface Court {
  id: string;
  venueId: string;
  name: string;
  sport: string;
  surface: string;
  active: boolean;
}
export interface Slot {
  id: string;
  courtId: string;
  time: string;
  price: number;
  status: "available" | "held" | "booked";
}
export interface Booking {
  id: string;
  customerId: string;
  venueId: string;
  courtId: string;
  date: string;
  slots: string[];
  amount: number;
  paymentStatus: "unpaid" | "dp" | "paid" | "refunded";
  status: "draft" | "pending" | "confirmed" | "completed" | "cancelled";
  source: "online" | "offline";
  checkedInAt?: string;
  refundStatus?: "requested" | "approved";
  rescheduledFrom?: string;
}

export interface VenueDraft {
  venueId: string;
  contact: string;
  mediaReady: boolean;
  schedule: Record<
    string,
    { enabled: boolean; opensAt: string; closesAt: string }
  >;
  exceptions: string[];
  bufferMinutes: number;
  basePrice: number;
  peakPrice: number;
  policies: string[];
  revisionReason?: string;
}
export interface Tenant {
  id: string;
  name: string;
  owner: string;
  status: "verified" | "pending" | "revision";
}
export interface PaymentAttempt {
  id: string;
  bookingId: string;
  method: "full" | "dp" | "venue";
  amount: number;
  status: "pending" | "success" | "failed" | "expired";
  simulated: true;
}
export interface Membership {
  id: string;
  tenantId: string;
  userId: string;
  role: "owner" | "manager" | "staff";
  active: boolean;
}
export interface StaffMember {
  id: string;
  tenantId: string;
  name: string;
  venueIds: string[];
  permissions: Array<"booking" | "check-in" | "outstanding" | "review">;
}
export interface VerificationRequest {
  id: string;
  tenantId: string;
  venueId: string;
  status: "pending" | "approved" | "rejected" | "revision";
  documents: Array<{ id: string; name: string; simulated: true }>;
  reason?: string;
}
export interface Mabar {
  id: string;
  bookingId: string;
  host: string;
  title: string;
  sport: string;
  venueId: string;
  startsAt: string;
  capacity: number;
  participantIds: string[];
  pendingApprovalIds: string[];
  waitlistIds: string[];
  status: "draft" | "published" | "cancelled";
  image: string;
  level: string;
  price: number;
  requireApproval: boolean;
  announcements: Array<{ id: string; message: string; createdAt: string }>;
}
export interface FinanceSummary {
  tenantId: string;
  gross: number;
  net: number;
  outstanding: number;
  payout: number;
  simulated: true;
}
export interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  kind: "booking" | "payment" | "verification" | "system";
  time: string;
  actionHref: string;
}
export interface Review {
  id: string;
  bookingId: string;
  customerId: string;
  venueId: string;
  rating: number;
  body: string;
  status: "published" | "reported" | "hidden";
}

export interface PrototypeState {
  role: PrototypeRole;
  scenario: Scenario;
  activeTenantId: string;
  venues: Venue[];
  courts: Court[];
  slots: Slot[];
  bookings: Booking[];
  venueDrafts: Record<string, VenueDraft>;
  tenants: Tenant[];
  mabars: Mabar[];
  favoriteVenueIds: string[];
  favoriteMabarIds: string[];
  notifications: Notification[];
  selectedVenueId?: string;
  selectedSlots: string[];
  toast?: string;
}

export type PrototypeAction =
  | { type: "SWITCH_ROLE"; role: PrototypeRole }
  | { type: "SET_SCENARIO"; scenario: Scenario }
  | { type: "RESET" }
  | { type: "SELECT_VENUE"; venueId: string }
  | { type: "TOGGLE_SLOT"; slotId: string }
  | { type: "CLEAR_SLOTS" }
  | { type: "CREATE_BOOKING"; booking: Booking }
  | {
      type: "PAYMENT_RESULT";
      bookingId: string;
      result: "success" | "failed" | "pending" | "expired";
      method?: PaymentAttempt["method"];
    }
  | { type: "ADD_VENUE"; venue: Venue; draft: VenueDraft }
  | {
      type: "UPDATE_VENUE_PROFILE";
      venueId: string;
      name: string;
      location: string;
      contact: string;
      mediaReady: boolean;
    }
  | { type: "ADD_COURT"; court: Court }
  | {
      type: "UPDATE_AVAILABILITY";
      venueId: string;
      schedule: VenueDraft["schedule"];
      bufferMinutes: number;
    }
  | { type: "ADD_VENUE_EXCEPTION"; venueId: string; exception: string }
  | {
      type: "UPDATE_PRICING";
      venueId: string;
      basePrice: number;
      peakPrice: number;
    }
  | { type: "UPDATE_POLICIES"; venueId: string; policies: string[] }
  | { type: "SUBMIT_VENUE"; venueId: string }
  | {
      type: "DECIDE_VENUE";
      venueId: string;
      decision: "approve" | "reject" | "revision";
      reason?: string;
    }
  | {
      type: "CONFIRM_BOOKING";
      bookingId: string;
      decision: "accept" | "reject";
    }
  | { type: "CHECK_IN_BOOKING"; bookingId: string }
  | { type: "SETTLE_BOOKING"; bookingId: string }
  | { type: "CANCEL_BOOKING"; bookingId: string }
  | { type: "RESCHEDULE_BOOKING"; bookingId: string; date: string }
  | { type: "REQUEST_REFUND"; bookingId: string }
  | { type: "CREATE_MABAR"; mabar: Mabar }
  | { type: "JOIN_MABAR"; mabarId: string; customerId: string }
  | { type: "PUBLISH_MABAR"; mabarId: string }
  | { type: "APPROVE_MABAR_PARTICIPANT"; mabarId: string; customerId: string }
  | { type: "REMOVE_MABAR_PARTICIPANT"; mabarId: string; customerId: string }
  | { type: "ANNOUNCE_MABAR"; mabarId: string; message: string }
  | { type: "CANCEL_MABAR"; mabarId: string }
  | {
      type: "TOGGLE_FAVORITE";
      resource: "venue" | "mabar";
      resourceId: string;
    }
  | { type: "MARK_NOTIFICATION_READ"; notificationId: string }
  | { type: "MARK_ALL_NOTIFICATIONS_READ" }
  | { type: "DISMISS_TOAST" };
