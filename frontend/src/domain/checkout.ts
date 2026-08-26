import type { PaymentAttempt } from "./types";

export interface CheckoutTotals {
  subtotal: number;
  addOn: number;
  discount: number;
  total: number;
  dueNow: number;
}

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
