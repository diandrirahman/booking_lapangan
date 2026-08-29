export interface ReservableSlot {
  startsAt: Date;
  endsAt: Date;
  status: string;
}

export interface SlotSelectionPolicy {
  intervalMinutes: number;
  minimumDurationMinutes: number;
  maximumDurationMinutes: number;
}

export function validateSlotSelection(
  slots: readonly ReservableSlot[],
  policy: SlotSelectionPolicy,
): void {
  if (slots.length === 0) {
    throw new Error("Pilih minimal satu slot.");
  }

  const orderedSlots = [...slots].sort(
    (left, right) => left.startsAt.getTime() - right.startsAt.getTime(),
  );
  const selectedDurationMinutes = orderedSlots.reduce(
    (total, slot) => total + durationInMinutes(slot.startsAt, slot.endsAt),
    0,
  );

  if (orderedSlots.some((slot) => slot.status !== "OPEN")) {
    throw new Error("Pilihan memuat slot yang tidak tersedia.");
  }
  if (selectedDurationMinutes < policy.minimumDurationMinutes) {
    throw new Error("Durasi booking belum memenuhi durasi minimum.");
  }
  if (selectedDurationMinutes > policy.maximumDurationMinutes) {
    throw new Error("Durasi booking melewati durasi maksimum.");
  }

  for (let index = 1; index < orderedSlots.length; index += 1) {
    const previousSlot = orderedSlots[index - 1]!;
    const currentSlot = orderedSlots[index]!;
    if (previousSlot.endsAt.getTime() !== currentSlot.startsAt.getTime()) {
      throw new Error("Slot booking harus berurutan tanpa jeda.");
    }
  }

  const expectedIntervalMilliseconds = policy.intervalMinutes * 60_000;
  if (
    orderedSlots.some(
      (slot) =>
        slot.endsAt.getTime() - slot.startsAt.getTime() !==
        expectedIntervalMilliseconds,
    )
  ) {
    throw new Error("Interval slot tidak sesuai pengaturan lapangan.");
  }
}

function durationInMinutes(startsAt: Date, endsAt: Date): number {
  return (endsAt.getTime() - startsAt.getTime()) / 60_000;
}
