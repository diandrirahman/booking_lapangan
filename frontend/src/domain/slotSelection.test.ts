import { describe, expect, it } from "vitest";
import { slots } from "../data/fixtures";
import { canToggleSlot, contiguousSelectionLabel } from "./slotSelection";

describe("contiguous slot selection", () => {
  const courtSlots = slots.filter((slot) => slot.courtId === "c1");

  it("mengizinkan slot pertama dan perpanjangan yang bersebelahan", () => {
    expect(canToggleSlot(courtSlots, [], "c1-17.00")).toBe(true);
    expect(canToggleSlot(courtSlots, ["c1-17.00"], "c1-18.00")).toBe(true);
  });

  it("menolak lompatan waktu dan slot setelah gap terisi", () => {
    expect(canToggleSlot(courtSlots, ["c1-17.00"], "c1-20.00")).toBe(false);
    expect(
      canToggleSlot(courtSlots, ["c1-17.00", "c1-18.00"], "c1-20.00"),
    ).toBe(false);
  });

  it("hanya dapat menghapus pilihan dari ujung rangkaian", () => {
    const customSlots = courtSlots.map((slot) =>
      slot.id === "c1-19.00" ? { ...slot, status: "available" as const } : slot,
    );
    const selection = ["c1-17.00", "c1-18.00", "c1-19.00"];
    expect(canToggleSlot(customSlots, selection, "c1-18.00")).toBe(false);
    expect(canToggleSlot(customSlots, selection, "c1-19.00")).toBe(true);
    expect(contiguousSelectionLabel(customSlots, selection)).toBe(
      "17.00–20.00",
    );
  });
});
