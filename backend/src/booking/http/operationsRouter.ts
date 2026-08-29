import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../http/asyncHandler.js";
import { ApiError } from "../../http/ApiError.js";
import { publicIdSchema } from "../../http/schemas/publicId.js";
import { bookingReferenceSchema } from "../../http/schemas/publicReference.js";
import { requireSession } from "../../identity/auth/sessionMiddleware.js";
import type { TenantAuthorizationService } from "../../tenant/authorization/TenantAuthorizationService.js";
import type { OperationsService } from "../application/OperationsService.js";

const scopeSchema = z.object({
  tenantId: publicIdSchema,
  venueId: publicIdSchema,
});
const optionalVenueQuerySchema = z.object({
  tenantId: publicIdSchema,
  venueId: publicIdSchema.optional(),
});
const bookingListQuerySchema = optionalVenueQuerySchema.extend({
  startsAfter: z.iso
    .datetime()
    .transform((value) => new Date(value))
    .optional(),
  startsBefore: z.iso
    .datetime()
    .transform((value) => new Date(value))
    .optional(),
  status: z.string().trim().min(1).max(24).optional(),
  outstandingOnly: z.stringbool().default(false),
});
const calendarQuerySchema = optionalVenueQuerySchema.extend({
  startsAfter: z.iso.datetime().transform((value) => new Date(value)),
  startsBefore: z.iso.datetime().transform((value) => new Date(value)),
});

export function createOperationsRouter(
  service: OperationsService,
  authorization: TenantAuthorizationService,
): Router {
  const router = Router();
  router.get(
    "/business/dashboard",
    requireSession,
    asyncHandler(async (request, response) => {
      const input = optionalVenueQuerySchema.parse(request.query);
      const access = input.venueId
        ? await authorization.requireVenueAccess(
            request.auth!.userId,
            input.tenantId,
            input.venueId,
          )
        : await authorization.requireTenantAccess(request.auth!.userId, input.tenantId);
      response.json(
        await service.dashboard(
          input.tenantId,
          access.role === "STAFF" ? access.assignedVenueIds : null,
        ),
      );
    }),
  );
  router.get(
    "/business/bookings",
    requireSession,
    asyncHandler(async (request, response) => {
      const input = bookingListQuerySchema.parse(request.query);
      const access = input.venueId
        ? await authorization.requireVenueAccess(
            request.auth!.userId,
            input.tenantId,
            input.venueId,
          )
        : await authorization.requireTenantAccess(request.auth!.userId, input.tenantId);
      response.json({
        items: await service.listBookings({
          ...input,
          allowedVenueIds: access.role === "STAFF" ? access.assignedVenueIds : null,
        }),
      });
    }),
  );
  router.get(
    "/business/calendar",
    requireSession,
    asyncHandler(async (request, response) => {
      const input = calendarQuerySchema.parse(request.query);
      const access = input.venueId
        ? await authorization.requireVenueAccess(
            request.auth!.userId,
            input.tenantId,
            input.venueId,
          )
        : await authorization.requireTenantAccess(request.auth!.userId, input.tenantId);
      response.json(
        await service.listCalendar({
          ...input,
          allowedVenueIds: access.role === "STAFF" ? access.assignedVenueIds : null,
        }),
      );
    }),
  );
  router.post(
    "/business/closures",
    requireSession,
    asyncHandler(async (request, response) => {
      const input = scopeSchema
        .extend({
          courtId: publicIdSchema.optional(),
          startsAt: z.iso.datetime().transform((value) => new Date(value)),
          endsAt: z.iso.datetime().transform((value) => new Date(value)),
          kind: z.enum(["CLOSURE", "MAINTENANCE", "BLOCK"]),
          reason: z.string().trim().min(5).max(500),
        })
        .parse(request.body);
      await authorization.requireOwner(request.auth!.userId, input.tenantId);
      await authorization.requireVenueAccess(
        request.auth!.userId,
        input.tenantId,
        input.venueId,
      );
      response.status(201).json(await service.createClosure(input));
    }),
  );
  router.post(
    "/business/bookings/:bookingId/cancel-for-closure",
    requireSession,
    asyncHandler(async (request, response) => {
      const input = scopeSchema
        .extend({ reason: z.string().trim().min(5).max(500) })
        .parse(request.body);
      await authorization.requireVenueAccess(
        request.auth!.userId,
        input.tenantId,
        input.venueId,
      );
      const bookingReference = bookingReferenceSchema.parse(request.params.bookingId);
      await service.requireBookingScope(
        bookingReference,
        input.tenantId,
        input.venueId,
      );
      await service.cancelForClosure(
        bookingReference,
        request.auth!.userId,
        input.reason,
      );
      response.status(204).end();
    }),
  );
  router.post(
    "/business/bookings/:bookingId/reschedule",
    requireSession,
    asyncHandler(async (request, response) => {
      const input = scopeSchema
        .extend({
          newSlotIds: z.array(publicIdSchema).min(1).max(6),
          reason: z.string().trim().min(5).max(500),
        })
        .parse(request.body);
      await authorization.requireVenueAccess(
        request.auth!.userId,
        input.tenantId,
        input.venueId,
      );
      const bookingReference = bookingReferenceSchema.parse(request.params.bookingId);
      await service.requireBookingScope(
        bookingReference,
        input.tenantId,
        input.venueId,
      );
      await service.reschedule(
        bookingReference,
        input.newSlotIds,
        request.auth!.userId,
        input.reason,
      );
      response.status(204).end();
    }),
  );
  router.post(
    "/business/bookings/:bookingId/attendance",
    requireSession,
    asyncHandler(async (request, response) => {
      const input = scopeSchema
        .extend({
          attendance: z.enum(["CHECKED_IN", "NO_SHOW"]),
          reason: z.string().trim().max(500).optional(),
        })
        .parse(request.body);
      await authorization.requireVenueAccess(
        request.auth!.userId,
        input.tenantId,
        input.venueId,
      );
      const bookingReference = bookingReferenceSchema.parse(request.params.bookingId);
      await service.requireBookingScope(
        bookingReference,
        input.tenantId,
        input.venueId,
      );
      await service.recordAttendance(
        bookingReference,
        request.auth!.userId,
        input.attendance,
        input.reason,
      );
      response.status(204).end();
    }),
  );
  router.post(
    "/business/bookings/:bookingId/settle",
    requireSession,
    asyncHandler(async (request, response) => {
      const input = scopeSchema.parse(request.body);
      const idempotencyKey = request.header("Idempotency-Key");
      if (!idempotencyKey || idempotencyKey.length > 100) {
        throw new ApiError(
          400,
          "IDEMPOTENCY_KEY_REQUIRED",
          "Header Idempotency-Key wajib diisi.",
        );
      }
      await authorization.requireVenueAccess(
        request.auth!.userId,
        input.tenantId,
        input.venueId,
      );
      const bookingReference = bookingReferenceSchema.parse(request.params.bookingId);
      await service.requireBookingScope(
        bookingReference,
        input.tenantId,
        input.venueId,
      );
      response
        .status(201)
        .json(
          await service.settleOutstanding(
            bookingReference,
            request.auth!.userId,
            idempotencyKey,
          ),
        );
    }),
  );
  return router;
}
