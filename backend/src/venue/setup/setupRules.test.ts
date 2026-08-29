import { describe, expect, it } from "vitest";
import {
  validateAvailabilitySettings,
  validatePaymentSettings,
  validateScheduleException,
} from "./setupRules.js";

describe("venue setup rules", () => {
  it("menolak durasi dan jadwal mingguan yang tidak konsisten", () => {
    expect(() =>
      validateAvailabilitySettings({
        intervalMinutes: 60,
        minimumDurationMinutes: 120,
        maximumDurationMinutes: 60,
        weeklySchedule: [],
      }),
    ).toThrow("Durasi minimum");
    expect(() =>
      validateAvailabilitySettings({
        intervalMinutes: 60,
        minimumDurationMinutes: 60,
        maximumDurationMinutes: 180,
        weeklySchedule: [
          { dayOfWeek: 1, opensAt: "20:00:00", closesAt: "08:00:00", active: true },
        ],
      }),
    ).toThrow("Jam buka");
  });

  it("memerlukan rentang waktu untuk custom hours", () => {
    expect(() => validateScheduleException({ kind: "CUSTOM_HOURS" })).toThrow(
      "Custom hours",
    );
  });

  it("memvalidasi kombinasi metode pembayaran venue", () => {
    expect(() =>
      validatePaymentSettings({
        allowFull: false,
        allowDp: false,
        dpPercentage: null,
        allowPayAtVenue: false,
        reservationAmount: null,
      }),
    ).toThrow("minimal satu");
    expect(() =>
      validatePaymentSettings({
        allowFull: true,
        allowDp: true,
        dpPercentage: null,
        allowPayAtVenue: false,
        reservationAmount: null,
      }),
    ).toThrow("Persentase DP");
  });
});
