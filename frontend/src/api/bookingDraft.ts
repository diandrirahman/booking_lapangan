import type { AvailabilitySlot } from "@lapangango/api-client";

const STORAGE_KEY = "lapangango:b1:checkout-draft";

export interface CheckoutDraft {
  id: string;
  idempotencyKey: string;
  venueId: string;
  venueName: string;
  venueSlug: string;
  venueImage?: string;
  courtId: string;
  courtName: string;
  date: string;
  slots: AvailabilitySlot[];
}

export function saveCheckoutDraft(draft: CheckoutDraft): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function readCheckoutDraft(id: string | undefined): CheckoutDraft | null {
  if (!id) return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw) as CheckoutDraft;
    return draft.id === id ? draft : null;
  } catch {
    return null;
  }
}

export function clearCheckoutDraft(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
