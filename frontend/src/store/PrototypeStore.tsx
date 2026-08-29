import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { initialState } from "../data/fixtures";
import type { PrototypeAction, PrototypeState } from "../domain/types";
import { canToggleSlot } from "../domain/slotSelection";

const STORAGE_KEY = "lapangango-phase-a";

function updateBooking(
  state: PrototypeState,
  bookingId: string,
  update: (
    booking: PrototypeState["bookings"][number],
  ) => PrototypeState["bookings"][number],
) {
  return state.bookings.map((booking) =>
    booking.id === bookingId ? update(booking) : booking,
  );
}

function updateMabar(
  state: PrototypeState,
  mabarId: string,
  update: (mabar: PrototypeState["mabars"][number]) => PrototypeState["mabars"][number],
) {
  return state.mabars.map((mabar) => (mabar.id === mabarId ? update(mabar) : mabar));
}

export function prototypeReducer(
  state: PrototypeState,
  action: PrototypeAction,
): PrototypeState {
  switch (action.type) {
    case "SWITCH_ROLE":
      return {
        ...state,
        role: action.role,
        toast: `Mode ${action.role} aktif.`,
      };
    case "SET_SCENARIO":
      return {
        ...state,
        scenario: action.scenario,
        toast: `Skenario ${action.scenario} diterapkan.`,
      };
    case "RESET":
      return structuredClone(initialState);
    case "SELECT_VENUE":
      return { ...state, selectedVenueId: action.venueId };
    case "TOGGLE_SLOT": {
      const slot = state.slots.find((item) => item.id === action.slotId);
      if (!slot || slot.status !== "available") return state;
      if (!canToggleSlot(state.slots, state.selectedSlots, action.slotId)) {
        return {
          ...state,
          toast: state.selectedSlots.includes(action.slotId)
            ? "Hapus slot dari ujung pilihan agar jadwal tetap berurutan."
            : "Perpanjangan harus memilih slot yang tepat bersebelahan.",
        };
      }
      const selectedSlots = state.selectedSlots.includes(action.slotId)
        ? state.selectedSlots.filter((id) => id !== action.slotId)
        : [...state.selectedSlots, action.slotId];
      return { ...state, selectedSlots };
    }
    case "CLEAR_SLOTS":
      return { ...state, selectedSlots: [] };
    case "CREATE_BOOKING":
      return {
        ...state,
        bookings: [action.booking, ...state.bookings],
        selectedSlots: [],
        toast: "Booking simulasi dibuat.",
      };
    case "PAYMENT_RESULT":
      return {
        ...state,
        bookings: updateBooking(state, action.bookingId, (booking) => ({
          ...booking,
          paymentStatus:
            action.result === "success"
              ? action.method === "dp"
                ? "dp"
                : action.method === "venue"
                  ? "unpaid"
                  : "paid"
              : booking.paymentStatus,
          status:
            action.result === "success"
              ? "confirmed"
              : action.result === "pending"
                ? "pending"
                : booking.status,
        })),
        toast: `Pembayaran simulasi: ${action.result}.`,
      };
    case "ADD_VENUE":
      return {
        ...state,
        venues: [action.venue, ...state.venues],
        venueDrafts: {
          ...state.venueDrafts,
          [action.venue.id]: action.draft,
        },
        toast: "Draft venue baru dibuat.",
      };
    case "UPDATE_VENUE_PROFILE":
      return {
        ...state,
        venues: state.venues.map((venue) =>
          venue.id === action.venueId
            ? { ...venue, name: action.name, location: action.location }
            : venue,
        ),
        venueDrafts: {
          ...state.venueDrafts,
          [action.venueId]: {
            ...state.venueDrafts[action.venueId],
            contact: action.contact,
            mediaReady: action.mediaReady,
          },
        },
        toast: "Profil venue tersimpan otomatis.",
      };
    case "ADD_COURT":
      return {
        ...state,
        courts: [...state.courts, action.court],
        toast: "Lapangan ditambahkan.",
      };
    case "UPDATE_AVAILABILITY":
      return {
        ...state,
        venueDrafts: {
          ...state.venueDrafts,
          [action.venueId]: {
            ...state.venueDrafts[action.venueId],
            schedule: action.schedule,
            bufferMinutes: action.bufferMinutes,
          },
        },
        toast: "Jadwal venue tersimpan otomatis.",
      };
    case "ADD_VENUE_EXCEPTION":
      return {
        ...state,
        venueDrafts: {
          ...state.venueDrafts,
          [action.venueId]: {
            ...state.venueDrafts[action.venueId],
            exceptions: [
              ...state.venueDrafts[action.venueId].exceptions,
              action.exception,
            ],
          },
        },
        toast: "Pengecualian jadwal ditambahkan.",
      };
    case "UPDATE_PRICING":
      return {
        ...state,
        venues: state.venues.map((venue) =>
          venue.id === action.venueId
            ? { ...venue, priceFrom: action.basePrice }
            : venue,
        ),
        venueDrafts: {
          ...state.venueDrafts,
          [action.venueId]: {
            ...state.venueDrafts[action.venueId],
            basePrice: action.basePrice,
            peakPrice: action.peakPrice,
          },
        },
        toast: "Aturan harga tersimpan otomatis.",
      };
    case "UPDATE_POLICIES":
      return {
        ...state,
        venueDrafts: {
          ...state.venueDrafts,
          [action.venueId]: {
            ...state.venueDrafts[action.venueId],
            policies: action.policies,
          },
        },
        toast: "Kebijakan venue tersimpan otomatis.",
      };
    case "SUBMIT_VENUE":
      return {
        ...state,
        venues: state.venues.map((venue) =>
          venue.id === action.venueId ? { ...venue, status: "in_review" } : venue,
        ),
        toast: "Venue dikirim ke antrian verifikasi.",
      };
    case "DECIDE_VENUE": {
      const decidedVenue = state.venues.find((venue) => venue.id === action.venueId);
      const status =
        action.decision === "approve"
          ? "published"
          : action.decision === "revision"
            ? "revision"
            : "rejected";
      return {
        ...state,
        activeTenantId: decidedVenue?.tenantId ?? state.activeTenantId,
        venues: state.venues.map((venue) =>
          venue.id === action.venueId ? { ...venue, status } : venue,
        ),
        tenants: state.tenants.map((tenant) =>
          tenant.id === decidedVenue?.tenantId
            ? {
                ...tenant,
                status:
                  action.decision === "approve"
                    ? "verified"
                    : action.decision === "revision"
                      ? "revision"
                      : tenant.status,
              }
            : tenant,
        ),
        venueDrafts: {
          ...state.venueDrafts,
          [action.venueId]: {
            ...state.venueDrafts[action.venueId],
            revisionReason:
              action.decision === "revision" || action.decision === "reject"
                ? action.reason
                : undefined,
          },
        },
        toast: `Keputusan ${action.decision} tersimpan lintas workspace.`,
      };
    }
    case "CONFIRM_BOOKING":
      return {
        ...state,
        bookings: updateBooking(state, action.bookingId, (booking) => ({
          ...booking,
          status: action.decision === "accept" ? "confirmed" : "cancelled",
        })),
        toast:
          action.decision === "accept" ? "Booking dikonfirmasi." : "Booking ditolak.",
      };
    case "CHECK_IN_BOOKING":
      return {
        ...state,
        bookings: updateBooking(state, action.bookingId, (booking) => ({
          ...booking,
          checkedInAt: new Date().toISOString(),
        })),
        toast: "Check-in berhasil dicatat.",
      };
    case "SETTLE_BOOKING":
      return {
        ...state,
        bookings: updateBooking(state, action.bookingId, (booking) => ({
          ...booking,
          paymentStatus: "paid",
        })),
        toast: "Pelunasan simulasi berhasil dicatat.",
      };
    case "CANCEL_BOOKING":
      return {
        ...state,
        bookings: updateBooking(state, action.bookingId, (booking) => ({
          ...booking,
          status: "cancelled",
        })),
        toast: "Booking dibatalkan.",
      };
    case "RESCHEDULE_BOOKING":
      return {
        ...state,
        bookings: updateBooking(state, action.bookingId, (booking) => ({
          ...booking,
          rescheduledFrom: booking.date,
          date: action.date,
        })),
        toast: "Booking berhasil dijadwalkan ulang.",
      };
    case "REQUEST_REFUND":
      return {
        ...state,
        bookings: updateBooking(state, action.bookingId, (booking) => ({
          ...booking,
          paymentStatus: "refunded",
          refundStatus: "approved",
        })),
        toast: "Refund simulasi disetujui.",
      };
    case "CREATE_MABAR":
      return {
        ...state,
        mabars: [action.mabar, ...state.mabars],
        toast: "Mabar draft dibuat.",
      };
    case "PUBLISH_MABAR":
      return {
        ...state,
        mabars: state.mabars.map((mabar) =>
          mabar.id === action.mabarId ? { ...mabar, status: "published" } : mabar,
        ),
        toast: "Mabar dipublikasikan.",
      };
    case "JOIN_MABAR":
      return {
        ...state,
        mabars: state.mabars.map((mabar) => {
          if (
            mabar.id !== action.mabarId ||
            mabar.participantIds.includes(action.customerId) ||
            mabar.pendingApprovalIds.includes(action.customerId) ||
            mabar.waitlistIds.includes(action.customerId)
          )
            return mabar;
          if (mabar.status !== "published") return mabar;
          if (mabar.requireApproval)
            return {
              ...mabar,
              pendingApprovalIds: [...mabar.pendingApprovalIds, action.customerId],
            };
          return mabar.participantIds.length < mabar.capacity
            ? {
                ...mabar,
                participantIds: [...mabar.participantIds, action.customerId],
              }
            : {
                ...mabar,
                waitlistIds: [...mabar.waitlistIds, action.customerId],
              };
        }),
        toast: "Status peserta Mabar diperbarui.",
      };
    case "APPROVE_MABAR_PARTICIPANT":
      return {
        ...state,
        mabars: updateMabar(state, action.mabarId, (mabar) => {
          if (!mabar.pendingApprovalIds.includes(action.customerId)) return mabar;
          const pendingApprovalIds = mabar.pendingApprovalIds.filter(
            (id) => id !== action.customerId,
          );
          return mabar.participantIds.length < mabar.capacity
            ? {
                ...mabar,
                pendingApprovalIds,
                participantIds: [...mabar.participantIds, action.customerId],
              }
            : {
                ...mabar,
                pendingApprovalIds,
                waitlistIds: [...mabar.waitlistIds, action.customerId],
              };
        }),
        toast: "Permintaan peserta diproses.",
      };
    case "REMOVE_MABAR_PARTICIPANT":
      return {
        ...state,
        mabars: updateMabar(state, action.mabarId, (mabar) => {
          const wasParticipant = mabar.participantIds.includes(action.customerId);
          const [promotedId, ...remainingWaitlist] = mabar.waitlistIds;
          return {
            ...mabar,
            participantIds: [
              ...mabar.participantIds.filter((id) => id !== action.customerId),
              ...(wasParticipant && promotedId ? [promotedId] : []),
            ],
            waitlistIds:
              wasParticipant && promotedId
                ? remainingWaitlist
                : mabar.waitlistIds.filter((id) => id !== action.customerId),
            pendingApprovalIds: mabar.pendingApprovalIds.filter(
              (id) => id !== action.customerId,
            ),
          };
        }),
        toast: "Peserta diperbarui dan waitlist diproses FIFO.",
      };
    case "ANNOUNCE_MABAR":
      return {
        ...state,
        mabars: updateMabar(state, action.mabarId, (mabar) => ({
          ...mabar,
          announcements: [
            {
              id: `ANN-${mabar.announcements.length + 1}`,
              message: action.message,
              createdAt: "Baru saja",
            },
            ...mabar.announcements,
          ],
        })),
        toast: "Pengumuman dikirim ke peserta.",
      };
    case "CANCEL_MABAR":
      return {
        ...state,
        mabars: updateMabar(state, action.mabarId, (mabar) => ({
          ...mabar,
          status: "cancelled",
          pendingApprovalIds: [],
          waitlistIds: [],
        })),
        toast: "Mabar dibatalkan dan seluruh kursi ditutup.",
      };
    case "TOGGLE_FAVORITE": {
      const key = action.resource === "venue" ? "favoriteVenueIds" : "favoriteMabarIds";
      const currentIds = state[key];
      const removing = currentIds.includes(action.resourceId);
      return {
        ...state,
        [key]: removing
          ? currentIds.filter((id) => id !== action.resourceId)
          : [...currentIds, action.resourceId],
        toast: removing ? "Dihapus dari favorit." : "Disimpan ke favorit.",
      };
    }
    case "MARK_NOTIFICATION_READ":
      return {
        ...state,
        notifications: state.notifications.map((notification) =>
          notification.id === action.notificationId
            ? { ...notification, read: true }
            : notification,
        ),
      };
    case "MARK_ALL_NOTIFICATIONS_READ":
      return {
        ...state,
        notifications: state.notifications.map((notification) => ({
          ...notification,
          read: true,
        })),
        toast: "Semua notifikasi ditandai sudah dibaca.",
      };
    case "DISMISS_TOAST":
      return { ...state, toast: undefined };
  }
}

interface StoreValue {
  state: PrototypeState;
  dispatch: React.Dispatch<PrototypeAction>;
}
const PrototypeContext = createContext<StoreValue | null>(null);

function loadState() {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return structuredClone(initialState);

    const parsedState = JSON.parse(saved) as Partial<PrototypeState>;
    return {
      ...structuredClone(initialState),
      ...parsedState,
      favoriteVenueIds: parsedState.favoriteVenueIds ?? initialState.favoriteVenueIds,
      favoriteMabarIds: parsedState.favoriteMabarIds ?? initialState.favoriteMabarIds,
      notifications: parsedState.notifications ?? initialState.notifications,
      venueDrafts: parsedState.venueDrafts ?? initialState.venueDrafts,
      mabars: (parsedState.mabars ?? initialState.mabars).map((mabar) => ({
        ...mabar,
        pendingApprovalIds: mabar.pendingApprovalIds ?? [],
        requireApproval: mabar.requireApproval ?? false,
        announcements: mabar.announcements ?? [],
      })),
    };
  } catch {
    return structuredClone(initialState);
  }
}

export function PrototypeProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(prototypeReducer, undefined, loadState);
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);
  useEffect(() => {
    if (!state.toast) return;
    const timer = window.setTimeout(() => dispatch({ type: "DISMISS_TOAST" }), 2800);
    return () => window.clearTimeout(timer);
  }, [state.toast]);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return (
    <PrototypeContext.Provider value={value}>{children}</PrototypeContext.Provider>
  );
}

export function usePrototype() {
  const context = useContext(PrototypeContext);
  if (!context) throw new Error("usePrototype harus berada di dalam PrototypeProvider");
  return context;
}
