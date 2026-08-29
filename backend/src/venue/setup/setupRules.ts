export interface WeeklyScheduleInput {
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
  active: boolean;
}

export interface PaymentSettingsInput {
  allowFull: boolean;
  allowDp: boolean;
  dpPercentage: number | null;
  allowPayAtVenue: boolean;
  reservationAmount: number | null;
}

export function validateAvailabilitySettings(input: {
  intervalMinutes: number;
  minimumDurationMinutes: number;
  maximumDurationMinutes: number;
  weeklySchedule: WeeklyScheduleInput[];
}): void {
  if (input.minimumDurationMinutes > input.maximumDurationMinutes) {
    throw new Error("Durasi minimum tidak boleh melebihi durasi maksimum.");
  }
  if (
    input.minimumDurationMinutes % input.intervalMinutes !== 0 ||
    input.maximumDurationMinutes % input.intervalMinutes !== 0
  ) {
    throw new Error("Durasi booking harus merupakan kelipatan interval slot.");
  }
  const days = input.weeklySchedule.map((schedule) => schedule.dayOfWeek);
  if (new Set(days).size !== days.length) {
    throw new Error("Setiap hari hanya boleh memiliki satu jadwal mingguan.");
  }
  for (const schedule of input.weeklySchedule) {
    if (schedule.active && schedule.opensAt >= schedule.closesAt) {
      throw new Error("Jam buka harus lebih awal daripada jam tutup.");
    }
  }
}

export function validateScheduleException(input: {
  kind: "OPEN" | "CLOSED" | "CUSTOM_HOURS";
  opensAt?: string | undefined;
  closesAt?: string | undefined;
}): void {
  if (input.kind === "CUSTOM_HOURS") {
    if (!input.opensAt || !input.closesAt || input.opensAt >= input.closesAt) {
      throw new Error("Custom hours memerlukan rentang waktu yang valid.");
    }
  }
}

export function validatePaymentSettings(input: PaymentSettingsInput): void {
  if (!input.allowFull && !input.allowDp && !input.allowPayAtVenue) {
    throw new Error("Aktifkan minimal satu opsi pembayaran.");
  }
  if (input.allowDp && input.dpPercentage === null) {
    throw new Error("Persentase DP wajib diisi.");
  }
  if (input.allowPayAtVenue && input.reservationAmount === null) {
    throw new Error("Reservation amount wajib diisi.");
  }
}
