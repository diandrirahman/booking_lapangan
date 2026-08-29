import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../http/asyncHandler.js";
import { publicIdSchema } from "../../http/schemas/publicId.js";
import { requireSession } from "../../identity/auth/sessionMiddleware.js";
import type { TenantAuthorizationService } from "../../tenant/authorization/TenantAuthorizationService.js";
import type { AdminMasterService } from "./AdminMasterService.js";

export function createAdminMasterRouter(
  service: AdminMasterService,
  authorization: TenantAuthorizationService,
): Router {
  const router = Router();
  router.use(
    "/admin/masters",
    requireSession,
    asyncHandler(async (request, _response, next) => {
      await authorization.requirePlatformAdmin(request.auth!.userId);
      next();
    }),
  );
  router.get(
    "/admin/masters",
    asyncHandler(async (_request, response) => {
      response.json(await service.list());
    }),
  );
  router.post(
    "/admin/masters/payment-options",
    asyncHandler(async (request, response) => {
      const input = z
        .object({
          code: z
            .string()
            .trim()
            .min(2)
            .max(24)
            .regex(/^[A-Z0-9_]+$/),
          label: z.string().trim().min(2).max(50),
        })
        .parse(request.body);
      response
        .status(201)
        .json(await service.createPaymentOption(input.code, input.label));
    }),
  );
  router.patch(
    "/admin/masters/payment-options/:id",
    asyncHandler(async (request, response) => {
      const id = publicIdSchema.parse(request.params.id);
      const { active } = z.object({ active: z.boolean() }).parse(request.body);
      await service.setPaymentOptionActive(id, active);
      response.status(204).end();
    }),
  );
  router.post(
    "/admin/masters/durations/:kind",
    asyncHandler(async (request, response) => {
      const kind = z.enum(["interval", "buffer"]).parse(request.params.kind);
      const { minutes } = z
        .object({ minutes: z.number().int().min(0).max(360) })
        .parse(request.body);
      response.status(201).json(await service.createDurationOption(kind, minutes));
    }),
  );
  router.post(
    "/admin/masters/:kind",
    asyncHandler(async (request, response) => {
      const kind = z.enum(["sport", "facility"]).parse(request.params.kind);
      const { name } = z
        .object({ name: z.string().trim().min(2).max(50) })
        .parse(request.body);
      response.status(201).json(await service.createNamedMaster(kind, name));
    }),
  );
  router.patch(
    "/admin/masters/:kind/:id",
    asyncHandler(async (request, response) => {
      const kind = z.enum(["sport", "facility"]).parse(request.params.kind);
      const id = publicIdSchema.parse(request.params.id);
      const { active } = z.object({ active: z.boolean() }).parse(request.body);
      await service.setNamedMasterActive(kind, id, active);
      response.status(204).end();
    }),
  );
  return router;
}
