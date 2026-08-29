import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../../http/ApiError.js";
import { asyncHandler } from "../../http/asyncHandler.js";
import { publicIdSchema } from "../../http/schemas/publicId.js";
import { bookingReferenceSchema } from "../../http/schemas/publicReference.js";
import { requireSession } from "../../identity/auth/sessionMiddleware.js";
import type { TenantAuthorizationService } from "../../tenant/authorization/TenantAuthorizationService.js";
import type { BookingService } from "../application/BookingService.js";
import type { PaymentService } from "../../payment/application/PaymentService.js";
import { BOOKING_STATUSES } from "../domain/bookingStatus.js";

const paymentModeSchema = z.enum(["FULL", "DP", "PAY_AT_VENUE"]);
const createSchema = z.object({
  venueId: publicIdSchema,
  courtId: publicIdSchema,
  slotIds: z.array(publicIdSchema).min(1).max(6),
  addonIds: z.array(publicIdSchema).max(10).default([]),
  paymentMode: paymentModeSchema,
});
const offlineSchema = createSchema.extend({
  tenantId: publicIdSchema,
  customer: z.object({
    name: z.string().trim().min(2).max(50),
    phone: z.string().trim().max(16).optional(),
    channel: z.string().trim().min(2).max(20),
    adjustedAmount: z.number().int().nonnegative().optional(),
    adjustmentReason: z.string().trim().max(2_000).optional(),
  }),
});
const transitionSchema = z.object({
  status: z.enum(BOOKING_STATUSES),
  reason: z.string().trim().min(3).max(500),
  tenantId: publicIdSchema,
  venueId: publicIdSchema,
});

export function createBookingRouter(
  service: BookingService,
  authorization: TenantAuthorizationService,
  paymentService: PaymentService,
): Router {
  const router = Router();
  router.get(
    "/bookings",
    requireSession,
    asyncHandler(async (request, response) => {
      response.json({ items: await service.listForUser(request.auth!.userId) });
    }),
  );
  router.post(
    "/bookings",
    requireSession,
    asyncHandler(async (request, response) => {
      const idempotencyKey = requireIdempotencyKey(request.header("Idempotency-Key"));
      const input = createSchema.parse(request.body);
      const booking = await service.create(input, request.auth!.userId, idempotencyKey);
      response.status(201).json(booking);
    }),
  );
  router.get(
    "/bookings/:bookingId",
    requireSession,
    asyncHandler(async (request, response) => {
      response.json(
        await service.getForUser(
          bookingReferenceSchema.parse(request.params.bookingId),
          request.auth!.userId,
        ),
      );
    }),
  );
  router.post(
    "/business/bookings/offline",
    requireSession,
    asyncHandler(async (request, response) => {
      const idempotencyKey = requireIdempotencyKey(request.header("Idempotency-Key"));
      const input = offlineSchema.parse(request.body);
      await authorization.requireVenueAccess(
        request.auth!.userId,
        input.tenantId,
        input.venueId,
      );
      if (input.customer.adjustedAmount !== undefined) {
        await authorization.requireOwner(request.auth!.userId, input.tenantId);
      }
      const booking = await service.create(
        {
          venueId: input.venueId,
          courtId: input.courtId,
          slotIds: input.slotIds,
          paymentMode: input.paymentMode,
          source: "OFFLINE",
          offlineCustomer: input.customer,
        },
        request.auth!.userId,
        idempotencyKey,
      );
      response.status(201).json(booking);
    }),
  );
  router.post(
    "/business/bookings/:bookingId/transition",
    requireSession,
    asyncHandler(async (request, response) => {
      const input = transitionSchema.parse(request.body);
      await authorization.requireVenueAccess(
        request.auth!.userId,
        input.tenantId,
        input.venueId,
      );
      const bookingReference = bookingReferenceSchema.parse(request.params.bookingId);
      await service.requireBusinessScope(
        bookingReference,
        input.tenantId,
        input.venueId,
      );
      if (input.status === "CANCELLED") {
        await paymentService.rejectPendingConfirmation(
          bookingReference,
          request.auth!.userId,
          input.reason,
        );
      } else {
        await service.transition(
          bookingReference,
          input.status,
          request.auth!.userId,
          input.reason,
        );
      }
      response.status(204).end();
    }),
  );
  return router;
}

function requireIdempotencyKey(value: string | undefined): string {
  if (!value || value.length > 100) {
    throw new ApiError(
      400,
      "IDEMPOTENCY_KEY_REQUIRED",
      "Header Idempotency-Key wajib diisi.",
    );
  }
  return value;
}
