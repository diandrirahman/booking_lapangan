import { describe, expect, it } from "vitest";
import { initialState } from "../data/fixtures";
import { prototypeReducer } from "./PrototypeStore";

describe("prototypeReducer", () => {
  it("reset mengembalikan baseline", () => {
    const changed = prototypeReducer(initialState, {
      type: "SWITCH_ROLE",
      role: "admin",
    });
    expect(prototypeReducer(changed, { type: "RESET" }).role).toBe("customer");
  });

  it("tidak melampaui kapasitas Mabar dan memakai waitlist FIFO", () => {
    const full = {
      ...initialState,
      mabars: [
        {
          ...initialState.mabars[0],
          capacity: 3,
          requireApproval: false,
          participantIds: ["u1", "u2", "u3"],
          waitlistIds: [],
        },
      ],
    };
    const next = prototypeReducer(full, {
      type: "JOIN_MABAR",
      mabarId: full.mabars[0].id,
      customerId: "u9",
    });
    expect(next.mabars[0].participantIds).toHaveLength(3);
    expect(next.mabars[0].waitlistIds).toEqual(["u9"]);
  });

  it("memproses approval dan mempromosikan waitlist secara FIFO", () => {
    const pendingState = {
      ...initialState,
      mabars: [
        {
          ...initialState.mabars[0],
          capacity: 3,
          participantIds: ["u1", "u2", "u3"],
          pendingApprovalIds: ["u8"],
          waitlistIds: ["u7"],
        },
      ],
    };
    const approved = prototypeReducer(pendingState, {
      type: "APPROVE_MABAR_PARTICIPANT",
      mabarId: pendingState.mabars[0].id,
      customerId: "u8",
    });
    expect(approved.mabars[0].waitlistIds).toEqual(["u7", "u8"]);

    const promoted = prototypeReducer(approved, {
      type: "REMOVE_MABAR_PARTICIPANT",
      mabarId: approved.mabars[0].id,
      customerId: "u2",
    });
    expect(promoted.mabars[0].participantIds).toContain("u7");
    expect(promoted.mabars[0].waitlistIds).toEqual(["u8"]);
  });

  it("menyimpan lifecycle booking operasional pada entity yang sama", () => {
    const pendingBooking = initialState.bookings.find(
      (booking) => booking.status === "pending",
    )!;
    const confirmed = prototypeReducer(initialState, {
      type: "CONFIRM_BOOKING",
      bookingId: pendingBooking.id,
      decision: "accept",
    });
    const checkedIn = prototypeReducer(confirmed, {
      type: "CHECK_IN_BOOKING",
      bookingId: pendingBooking.id,
    });
    const updatedBooking = checkedIn.bookings.find(
      (booking) => booking.id === pendingBooking.id,
    );
    expect(updatedBooking?.status).toBe("confirmed");
    expect(updatedBooking?.checkedInAt).toBeTruthy();
  });

  it("membedakan hasil pembayaran penuh, DP, dan expired", () => {
    const bookingId = initialState.bookings[0].id;
    const dp = prototypeReducer(initialState, {
      type: "PAYMENT_RESULT",
      bookingId,
      result: "success",
      method: "dp",
    });
    expect(dp.bookings[0].paymentStatus).toBe("dp");
    const expired = prototypeReducer(dp, {
      type: "PAYMENT_RESULT",
      bookingId,
      result: "expired",
      method: "full",
    });
    expect(expired.bookings[0].paymentStatus).toBe("dp");
  });

  it("keputusan admin terbaca pada entity venue yang sama", () => {
    const next = prototypeReducer(initialState, {
      type: "DECIDE_VENUE",
      venueId: "v6",
      decision: "approve",
    });
    expect(next.venues.find((venue) => venue.id === "v6")?.status).toBe(
      "published",
    );
    expect(next.tenants.find((tenant) => tenant.id === "t3")?.status).toBe(
      "verified",
    );
  });

  it("menambah dan menghapus favorit tanpa duplikasi", () => {
    const removed = prototypeReducer(initialState, {
      type: "TOGGLE_FAVORITE",
      resource: "venue",
      resourceId: "v1",
    });
    expect(removed.favoriteVenueIds).not.toContain("v1");

    const restored = prototypeReducer(removed, {
      type: "TOGGLE_FAVORITE",
      resource: "venue",
      resourceId: "v1",
    });
    expect(restored.favoriteVenueIds.filter((id) => id === "v1")).toHaveLength(
      1,
    );
  });

  it("menandai seluruh notifikasi sebagai sudah dibaca", () => {
    const next = prototypeReducer(initialState, {
      type: "MARK_ALL_NOTIFICATIONS_READ",
    });
    expect(next.notifications.every((notification) => notification.read)).toBe(
      true,
    );
  });
});
