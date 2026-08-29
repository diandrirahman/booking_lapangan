import { z } from "zod";
import {
  BOOKING_REFERENCE_PREFIX,
  isPublicReference,
  PAYMENT_REFERENCE_PREFIX,
} from "../../security/publicReference.js";

export const bookingReferenceSchema = z
  .string()
  .refine(
    (value) => isPublicReference(value, BOOKING_REFERENCE_PREFIX),
    "Referensi booking tidak valid.",
  );

export const paymentReferenceSchema = z
  .string()
  .refine(
    (value) => isPublicReference(value, PAYMENT_REFERENCE_PREFIX),
    "Referensi pembayaran tidak valid.",
  );
