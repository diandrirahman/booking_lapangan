import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../http/asyncHandler.js";
import { requireSession } from "../../identity/auth/sessionMiddleware.js";
import { publicIdSchema } from "../../http/schemas/publicId.js";
import type { TenantAuthorizationService } from "../../tenant/authorization/TenantAuthorizationService.js";
import type { MediaService } from "./MediaService.js";

const uploadSchema = z.object({
  tenantId: publicIdSchema,
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  byteSize: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024),
});

export function createMediaRouter(
  mediaService: MediaService,
  authorization: TenantAuthorizationService,
): Router {
  const router = Router();
  router.get(
    "/media",
    asyncHandler(async (request, response) => {
      const storageKey = z.string().trim().min(10).max(255).parse(request.query.key);
      const downloadUrl = await mediaService.createPublicDownloadUrl(storageKey);
      response.setHeader("Cache-Control", "public, max-age=300");
      response.redirect(302, downloadUrl);
    }),
  );
  router.post(
    "/business/venues/:venueId/media/signed-upload",
    requireSession,
    asyncHandler(async (request, response) => {
      const venueId = publicIdSchema.parse(request.params.venueId);
      const input = uploadSchema.parse(request.body);
      await authorization.requirePermission(
        request.auth!.userId,
        input.tenantId,
        "venues.manage",
        venueId,
      );
      response.status(201).json(
        await mediaService.createVenueUpload(request.auth!.userId, {
          ...input,
          venueId,
        }),
      );
    }),
  );
  router.post(
    "/business/venues/:venueId/media",
    requireSession,
    asyncHandler(async (request, response) => {
      const venueId = publicIdSchema.parse(request.params.venueId);
      const input = z
        .object({
          tenantId: publicIdSchema,
          storageKey: z.string().trim().min(10).max(255),
          mimeType: z.enum(["image/webp", "image/jpeg", "image/png"]),
          byteSize: z
            .number()
            .int()
            .positive()
            .max(10 * 1024 * 1024),
          altText: z.string().trim().min(3).max(150),
          purpose: z.enum(["COVER", "GALLERY"]),
        })
        .parse(request.body);
      await authorization.requirePermission(
        request.auth!.userId,
        input.tenantId,
        "venues.manage",
        venueId,
      );
      response.status(201).json(
        await mediaService.completeVenueUpload(request.auth!.userId, {
          ...input,
          venueId,
        }),
      );
    }),
  );
  return router;
}
