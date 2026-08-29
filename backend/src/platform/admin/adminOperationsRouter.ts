import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../http/asyncHandler.js";
import { publicIdSchema } from "../../http/schemas/publicId.js";
import { requireSession } from "../../identity/auth/sessionMiddleware.js";
import type { TenantAuthorizationService } from "../../tenant/authorization/TenantAuthorizationService.js";
import type { AdminOperationsService } from "./AdminOperationsService.js";

export function createAdminOperationsRouter(
  service: AdminOperationsService,
  authorization: TenantAuthorizationService,
): Router {
  const router = Router();
  const statusSchema = z.object({
    status: z.enum(["DRAFT", "ACTIVE", "INACTIVE", "SUSPENDED"]),
    reason: z.string().trim().min(5).max(2_000),
  });
  router.use(
    "/admin",
    requireSession,
    asyncHandler(async (request, _response, next) => {
      await authorization.requirePlatformAdmin(request.auth!.userId);
      next();
    }),
  );
  router.get(
    "/admin/dashboard",
    asyncHandler(async (_request, response) => {
      response.json(await service.dashboard());
    }),
  );
  router.patch(
    "/admin/tenants/:tenantId/status",
    asyncHandler(async (request, response) => {
      const input = statusSchema.parse(request.body);
      await service.updateTenantStatus(
        publicIdSchema.parse(request.params.tenantId),
        input.status,
        request.auth!.userId,
        input.reason,
      );
      response.status(204).end();
    }),
  );
  router.get(
    "/admin/tenants",
    asyncHandler(async (_request, response) => {
      response.json({ items: await service.listTenants() });
    }),
  );
  router.patch(
    "/admin/venues/:venueId/status",
    asyncHandler(async (request, response) => {
      const input = statusSchema.parse(request.body);
      await service.updateVenueStatus(
        publicIdSchema.parse(request.params.venueId),
        input.status,
        request.auth!.userId,
        input.reason,
      );
      response.status(204).end();
    }),
  );
  router.get(
    "/admin/venues",
    asyncHandler(async (_request, response) => {
      response.json({ items: await service.listVenues() });
    }),
  );
  router.get(
    "/admin/verifications",
    asyncHandler(async (_request, response) => {
      response.json({ items: await service.listVerifications() });
    }),
  );
  router.get(
    "/admin/audit",
    asyncHandler(async (request, response) => {
      const input = z
        .object({
          cursor: publicIdSchema.optional(),
          limit: z.coerce.number().int().min(1).max(50).default(20),
          action: z.string().trim().min(1).max(64).optional(),
          resourceType: z.string().trim().min(1).max(32).optional(),
          tenantId: publicIdSchema.optional(),
          venueId: publicIdSchema.optional(),
          actorUserId: publicIdSchema.optional(),
          from: z.iso.datetime().optional(),
          to: z.iso.datetime().optional(),
        })
        .refine(
          (value) => !value.from || !value.to || value.from <= value.to,
          "Rentang waktu audit tidak valid.",
        )
        .parse(request.query);
      response.json(await service.listAudit(input));
    }),
  );
  return router;
}
