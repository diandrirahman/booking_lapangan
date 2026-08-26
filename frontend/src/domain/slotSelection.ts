import type { Slot } from "./types";

const MAX_BOOKING_SLOTS = 3;

function toMinutes(time: string) {
  const [hours, minutes] = time.split(".").map(Number);
  return hours * 60 + minutes;
}

export function sortSlotsByTime(slots: Slot[]) {
  return [...slots].sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
}

export function selectedSlotEntities(slots: Slot[], selectedIds: string[]) {
  const ids = new Set(selectedIds);
  return sortSlotsByTime(slots.filter((slot) => ids.has(slot.id)));
}

export function canToggleSlot(
  slots: Slot[],
  selectedIds: string[],
  candidateId: string,
) {
  const candidate = slots.find((slot) => slot.id === candidateId);
  if (!candidate || candidate.status !== "available") return false;

  const selected = selectedSlotEntities(slots, selectedIds);
  const selectedIndex = selected.findIndex((slot) => slot.id === candidateId);

  if (selectedIndex >= 0) {
    return (
      selected.length === 1 ||
      selectedIndex === 0 ||
      selectedIndex === selected.length - 1
    );
  }

  if (selected.length === 0) return true;
  if (selected.length >= MAX_BOOKING_SLOTS) return false;
  if (selected.some((slot) => slot.courtId !== candidate.courtId)) return false;

  const candidateMinutes = toMinutes(candidate.time);
  const firstMinutes = toMinutes(selected[0].time);
  const lastMinutes = toMinutes(selected[selected.length - 1].time);
  return (
    candidateMinutes === firstMinutes - 60 ||
    candidateMinutes === lastMinutes + 60
  );
}

export function contiguousSelectionLabel(slots: Slot[], selectedIds: string[]) {
  const selected = selectedSlotEntities(slots, selectedIds);
  if (!selected.length) return "";
  const start = selected[0].time;
  const endMinutes = toMinutes(selected[selected.length - 1].time) + 60;
  const end = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}.${String(endMinutes % 60).padStart(2, "0")}`;
  return `${start}–${end}`;
}
