import { describe, expect, it } from "vitest";
import {
  BOOKING_REFERENCE_PREFIX,
  createPublicReference,
  isPublicReference,
  PAYMENT_REFERENCE_PREFIX,
} from "./publicReference.js";

describe("publicReference", () => {
  it("membuat referensi booking acak yang tidak mengandung ID database", () => {
    const first = createPublicReference(BOOKING_REFERENCE_PREFIX);
    const second = createPublicReference(BOOKING_REFERENCE_PREFIX);

    expect(first).toMatch(/^LG-[A-Za-z0-9_-]{16}$/);
    expect(second).not.toBe(first);
    expect(isPublicReference(first, BOOKING_REFERENCE_PREFIX)).toBe(true);
  });

  it("membedakan prefix setiap jenis resource", () => {
    const paymentReference = createPublicReference(PAYMENT_REFERENCE_PREFIX);

    expect(paymentReference).toMatch(/^PAY-[A-Za-z0-9_-]{16}$/);
    expect(isPublicReference(paymentReference, PAYMENT_REFERENCE_PREFIX)).toBe(true);
    expect(isPublicReference(paymentReference, BOOKING_REFERENCE_PREFIX)).toBe(false);
  });
});
