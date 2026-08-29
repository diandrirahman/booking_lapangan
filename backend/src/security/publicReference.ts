import { randomBytes } from "node:crypto";

const RANDOM_REFERENCE_BYTES = 12;
const ENCODED_REFERENCE_LENGTH = 16;

export const BOOKING_REFERENCE_PREFIX = "LG";
export const PAYMENT_REFERENCE_PREFIX = "PAY";

export function createPublicReference(prefix: string): string {
  const randomPart = randomBytes(RANDOM_REFERENCE_BYTES).toString("base64url");
  return `${prefix}-${randomPart}`;
}

export function isPublicReference(value: string, prefix: string): boolean {
  const expectedLength = prefix.length + 1 + ENCODED_REFERENCE_LENGTH;
  if (value.length !== expectedLength || !value.startsWith(`${prefix}-`)) {
    return false;
  }

  const randomPart = value.slice(prefix.length + 1);
  return /^[A-Za-z0-9_-]+$/.test(randomPart);
}
