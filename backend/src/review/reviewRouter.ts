import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../http/asyncHandler.js";
import { publicIdSchema } from "../http/schemas/publicId.js";
import { requestAuditContext } from "../http/requestAuditContext.js";
import { bookingReferenceSchema } from "../http/schemas/publicReference.js";
import { requireSession } from "../identity/auth/sessionMiddleware.js";
import type { TenantAuthorizationService } from "../tenant/authorization/TenantAuthorizationService.js";
import type { ReviewService } from "./ReviewService.js";

const reviewInput = z.object({
  rating: z.number().int().min(1).max(5),
  cleanliness: z.number().int().min(1).max(5),
  courtQuality: z.number().int().min(1).max(5),
  facility: z.number().int().min(1).max(5),
  service: z.number().int().min(1).max(5),
  value: z.number().int().min(1).max(5),
  comment: z.string().trim().min(3).max(2_000),
});

export function createReviewRouter(
  service: ReviewService,
  authorization: TenantAuthorizationService,
): Router {
  const router = Router();
  router.get(
    "/venues/:venueId/reviews",
    asyncHandler(async (request, response) => {
      response.json({
        items: await service.listVenue(publicIdSchema.parse(request.params.venueId)),
      });
    }),
  );
  router.post(
    "/bookings/:bookingId/review",
    requireSession,
    asyncHandler(async (request, response) => {
      response
        .status(201)
        .json(
          await service.create(
            bookingReferenceSchema.parse(request.params.bookingId),
            request.auth!.userId,
            reviewInput.parse(request.body),
          ),
        );
    }),
  );
  router.patch(
    "/reviews/:reviewId",
    requireSession,
    asyncHandler(async (request, response) => {
      await service.update(
        publicIdSchema.parse(request.params.reviewId),
        request.auth!.userId,
        reviewInput.parse(request.body),
      );
      response.status(204).end();
    }),
  );
  router.post(
    "/reviews/:reviewId/report",
    requireSession,
    asyncHandler(async (request, response) => {
      const input = z
        .object({ reason: z.string().trim().min(3).max(500) })
        .parse(request.body);
      await service.report(
        publicIdSchema.parse(request.params.reviewId),
        request.auth!.userId,
        input.reason,
      );
      response.status(204).end();
    }),
  );
  router.get(
    "/business/reviews",
    requireSession,
    asyncHandler(async (request, response) => {
      const tenantId = publicIdSchema.parse(request.query.tenantId);
      const access = await authorization.requirePermission(
        request.auth!.userId,
        tenantId,
        "reviews.manage",
      );
      response.json({
        items: await service.listBusiness(
          tenantId,
          access.role === "STAFF" ? access.assignedVenueIds : undefined,
        ),
      });
    }),
  );
  router.post(
    "/business/reviews/:reviewId/reply",
    requireSession,
    asyncHandler(async (request, response) => {
      const input = z
        .object({ tenantId: publicIdSchema, body: z.string().trim().min(2).max(1_000) })
        .parse(request.body);
      const access = await authorization.requirePermission(
        request.auth!.userId,
        input.tenantId,
        "reviews.manage",
      );
      await service.reply(
        publicIdSchema.parse(request.params.reviewId),
        input.tenantId,
        access.role === "STAFF" ? access.assignedVenueIds : undefined,
        request.auth!.userId,
        input.body,
        requestAuditContext(request),
      );
      response.status(201).end();
    }),
  );
  router.post(
    "/admin/reviews/:reviewId/moderate",
    requireSession,
    asyncHandler(async (request, response) => {
      await authorization.requirePlatformAdmin(request.auth!.userId);
      const input = z
        .object({
          status: z.enum(["VISIBLE", "HIDDEN"]),
          reason: z.string().trim().min(3).max(500),
        })
        .parse(request.body);
      await service.moderate(
        publicIdSchema.parse(request.params.reviewId),
        request.auth!.userId,
        input.status,
        input.reason,
        requestAuditContext(request),
      );
      response.status(204).end();
    }),
  );
  router.get(
    "/admin/reviews",
    requireSession,
    asyncHandler(async (request, response) => {
      await authorization.requirePlatformAdmin(request.auth!.userId);
      response.json({ items: await service.listAdmin() });
    }),
  );
  return router;
}
