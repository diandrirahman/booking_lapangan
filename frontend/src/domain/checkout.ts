import type { PaymentAttempt } from "./types";

export interface CheckoutTotals {
  subtotal: number;
  addOn: number;
  discount: number;
  total: number;
  dueNow: number;
}

export type ServerPaymentMode = "FULL" | "DP" | "PAY_AT_VENUE";

export function calculateCheckoutTotals({
  amount,
  paymentMethod,
  addOnSelected,
  promoApplied,
}: {
  amount: number;
  paymentMethod: PaymentAttempt["method"];
  addOnSelected: boolean;
  promoApplied: boolean;
}): CheckoutTotals {
  const addOn = addOnSelected ? 25_000 : 0;
  const subtotal = amount + addOn;
  const discount = promoApplied && subtotal >= 100_000 ? 20_000 : 0;
  const total = Math.max(0, subtotal - discount);
  const dueNow =
    paymentMethod === "dp"
      ? Math.ceil(total * 0.3)
      : paymentMethod === "venue"
        ? 0
        : total;
  return { subtotal, addOn, discount, total, dueNow };
}

export function calculateServerCheckoutPreview(
  amount: number,
  paymentMode: ServerPaymentMode,
): CheckoutTotals {
  const dueNow =
    paymentMode === "DP"
      ? Math.ceil(amount * 0.5)
      : paymentMode === "PAY_AT_VENUE"
        ? 0
        : amount;
  return {
    subtotal: amount,
    addOn: 0,
    discount: 0,
    total: amount,
    dueNow,
  };
}
