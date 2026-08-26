import type { PrototypeState } from "../domain/types";

export const selectVenueBySlug = (state: PrototypeState, slug?: string) =>
  state.venues.find((venue) => venue.slug === slug) ?? state.venues[0];
export const selectVenueCourts = (state: PrototypeState, venueId: string) =>
  state.courts.filter((court) => court.venueId === venueId);
export const selectCourtSlots = (state: PrototypeState, courtId: string) =>
  state.slots.filter((slot) => slot.courtId === courtId);

export function selectVenueSetup(state: PrototypeState, venueId: string) {
  const venue = state.venues.find((item) => item.id === venueId);
  const draft = state.venueDrafts[venueId];
  const steps = {
    profile: Boolean(
      venue?.name.trim() &&
      venue.location.trim() &&
      draft?.contact.trim() &&
      draft.mediaReady,
    ),
    courts: state.courts.some(
      (court) => court.venueId === venueId && court.active,
    ),
    availability: Boolean(
      draft && Object.values(draft.schedule).some((day) => day.enabled),
    ),
    pricing: Boolean(draft?.basePrice && draft.peakPrice >= draft.basePrice),
    policies: Boolean(draft?.policies.length),
  };
  return {
    steps,
    completed: Object.values(steps).filter(Boolean).length,
    canSubmit: Object.values(steps).every(Boolean),
  };
}
export const formatRupiah = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
export const statusLabel = (status: string) =>
  ({
    published: "Tayang",
    in_review: "Dalam verifikasi",
    revision: "Perlu revisi",
    rejected: "Ditolak",
    confirmed: "Terkonfirmasi",
    pending: "Menunggu",
    completed: "Selesai",
    paid: "Lunas",
    dp: "DP",
    unpaid: "Belum lunas",
  })[status] ?? status;
