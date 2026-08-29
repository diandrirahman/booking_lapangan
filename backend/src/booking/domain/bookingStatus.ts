export const BOOKING_STATUSES = [
  "HOLD",
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

const allowedTransitions: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  HOLD: ["PENDING_CONFIRMATION", "CONFIRMED", "CANCELLED", "EXPIRED"],
  PENDING_CONFIRMATION: ["CONFIRMED", "CANCELLED", "EXPIRED"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export function canTransitionBooking(
  currentStatus: BookingStatus,
  nextStatus: BookingStatus,
): boolean {
  return allowedTransitions[currentStatus].includes(nextStatus);
}

export function assertBookingTransition(
  currentStatus: BookingStatus,
  nextStatus: BookingStatus,
): void {
  if (!canTransitionBooking(currentStatus, nextStatus)) {
    throw new Error(`Transisi booking ${currentStatus} ke ${nextStatus} tidak valid.`);
  }
}
