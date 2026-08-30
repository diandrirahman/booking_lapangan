import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../../http/ApiError.js";
import { asyncHandler } from "../../http/asyncHandler.js";
import { publicIdSchema } from "../../http/schemas/publicId.js";
import { bookingReferenceSchema } from "../../http/schemas/publicReference.js";
import { requestAuditContext } from "../../http/requestAuditContext.js";
import { requireSession } from "../../identity/auth/sessionMiddleware.js";
import type { TenantAuthorizationService } from "../../tenant/authorization/TenantAuthorizationService.js";
import type { RefundService } from "../application/RefundService.js";

export function createRefundRouter(
  service: RefundService,
  authorization: TenantAuthorizationService,
): Router {
  const router = Router();
  router.post(
    "/bookings/:bookingId/cancel",
    requireSession,
    asyncHandler(async (request, response) => {
      const { reason } = z
        .object({ reason: z.string().trim().min(3).max(500) })
        .parse(request.body);
      response.json(
        await service.cancelByCustomer(
          bookingReferenceSchema.parse(request.params.bookingId),
          request.auth!.userId,
          reason,
          requireIdempotencyKey(request.header("Idempotency-Key")),
        ),
      );
    }),
  );
  router.get(
    "/business/refunds",
    requireSession,
    asyncHandler(async (request, response) => {
      const tenantId = publicIdSchema.parse(request.query.tenantId);
      const access = await authorization.requirePermission(
        request.auth!.userId,
        tenantId,
        "refunds.manage",
      );
      response.json({
        items: await service.listRefunds(
          tenantId,
          access.role === "STAFF" ? access.assignedVenueIds : undefined,
        ),
      });
    }),
  );
  router.post(
    "/business/bookings/:bookingId/refunds",
    requireSession,
    asyncHandler(async (request, response) => {
      const input = z
        .object({
          tenantId: publicIdSchema,
          venueId: publicIdSchema,
          amount: z.number().int().positive(),
          reason: z.string().trim().min(3).max(500),
        })
        .parse(request.body);
      await authorization.requirePermission(
        request.auth!.userId,
        input.tenantId,
        "refunds.manage",
        input.venueId,
      );
      response.status(201).json(
        await service.requestBusinessRefund(
          {
            bookingReference: bookingReferenceSchema.parse(request.params.bookingId),
            tenantId: input.tenantId,
            venueId: input.venueId,
            amount: input.amount,
            reason: input.reason,
            actorUserId: request.auth!.userId,
            idempotencyKey: requireIdempotencyKey(request.header("Idempotency-Key")),
            manualRequired: false,
          },
          requestAuditContext(request),
        ),
      );
    }),
  );
  router.get(
    "/admin/refunds",
    requireSession,
    asyncHandler(async (request, response) => {
      await authorization.requirePlatformAdmin(request.auth!.userId);
      response.json({ items: await service.listRefunds() });
    }),
  );
  router.post(
    "/admin/refunds/:refundId/decision",
    requireSession,
    asyncHandler(async (request, response) => {
      await authorization.requirePlatformAdmin(request.auth!.userId);
      const input = z
        .object({ approved: z.boolean(), reason: z.string().trim().min(3).max(500) })
        .parse(request.body);
      await service.decideManualRefund(
        publicIdSchema.parse(request.params.refundId),
        request.auth!.userId,
        input.approved,
        input.reason,
        requireIdempotencyKey(request.header("Idempotency-Key")),
        requestAuditContext(request),
      );
      response.status(204).end();
    }),
  );
  router.post(
    "/admin/refunds/:refundId/retry",
    requireSession,
    asyncHandler(async (request, response) => {
      await authorization.requirePlatformAdmin(request.auth!.userId);
      await service.retryFailedRefund(
        publicIdSchema.parse(request.params.refundId),
        request.auth!.userId,
        requireIdempotencyKey(request.header("Idempotency-Key")),
        requestAuditContext(request),
      );
      response.status(204).end();
    }),
  );
  router.get(
    "/cancellation-policies",
    requireSession,
    asyncHandler(async (_request, response) => {
      response.json({ items: await service.listPolicyTemplates() });
    }),
  );
  router.post(
    "/admin/cancellation-policies",
    requireSession,
    asyncHandler(async (request, response) => {
      await authorization.requirePlatformAdmin(request.auth!.userId);
      const input = z
        .object({
          name: z.string().trim().min(3).max(80),
          tiers: z
            .array(
              z.object({
                minimumHoursBefore: z.number().int().nonnegative(),
                maximumHoursBefore: z.number().int().positive().optional(),
                refundBasisPoints: z.number().int().min(0).max(10_000),
              }),
            )
            .min(1)
            .max(20),
        })
        .parse(request.body);
      response
        .status(201)
        .json(
          await service.createPolicyTemplate(
            input.name,
            input.tiers,
            request.auth!.userId,
            requestAuditContext(request),
          ),
        );
    }),
  );
  router.put(
    "/business/venues/:venueId/cancellation-policy",
    requireSession,
    asyncHandler(async (request, response) => {
      const input = z
        .object({
          tenantId: publicIdSchema,
          templateId: publicIdSchema,
          reason: z.string().trim().min(3).max(500),
        })
        .parse(request.body);
      const venueId = publicIdSchema.parse(request.params.venueId);
      await authorization.requirePermission(
        request.auth!.userId,
        input.tenantId,
        "venues.manage",
        venueId,
      );
      await service.assignPolicy(
        venueId,
        input.templateId,
        input.tenantId,
        request.auth!.userId,
        input.reason,
        requestAuditContext(request),
      );
      response.status(204).end();
    }),
  );
  return router;
}

function requireIdempotencyKey(value: string | undefined): string {
  if (!value || value.length > 100)
    throw new ApiError(
      400,
      "IDEMPOTENCY_KEY_REQUIRED",
      "Header Idempotency-Key wajib diisi.",
    );
  return value;
}
