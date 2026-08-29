import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../http/asyncHandler.js";
import { publicIdSchema } from "../../http/schemas/publicId.js";
import { requireSession } from "../../identity/auth/sessionMiddleware.js";
import type { TenantService } from "../application/TenantService.js";
import type { TenantAuthorizationService } from "../authorization/TenantAuthorizationService.js";

const createTenantSchema = z.object({
  name: z.string().trim().min(3).max(80),
});

const assignmentSchema = z.object({
  venueIds: z.array(publicIdSchema).max(50),
});

export function createTenantRouter(
  service: TenantService,
  authorization: TenantAuthorizationService,
): Router {
  const router = Router();

  router.get(
    "/business/workspaces",
    requireSession,
    asyncHandler(async (request, response) => {
      response.json({ items: await service.listWorkspaces(request.auth!.userId) });
    }),
  );

  router.post(
    "/business/tenants/:tenantId/members",
    requireSession,
    asyncHandler(async (request, response) => {
      const tenantId = publicIdSchema.parse(request.params.tenantId);
      const input = z
        .object({
          email: z.email(),
          role: z.enum(["OWNER", "STAFF"]),
        })
        .parse(request.body);
      await authorization.requireOwner(request.auth!.userId, tenantId);
      response
        .status(201)
        .json(await service.addMember(tenantId, input.email, input.role));
    }),
  );

  router.post(
    "/business/tenants",
    requireSession,
    asyncHandler(async (request, response) => {
      const input = createTenantSchema.parse(request.body);
      response
        .status(201)
        .json(await service.createDraft(request.auth!.userId, input.name));
    }),
  );

  router.get(
    "/business/tenants/:tenantId/members",
    requireSession,
    asyncHandler(async (request, response) => {
      const tenantId = publicIdSchema.parse(request.params.tenantId);
      await authorization.requireTenantAccess(request.auth!.userId, tenantId);
      response.json({ items: await service.listMembers(tenantId) });
    }),
  );

  router.put(
    "/business/tenants/:tenantId/staff/:membershipId/assignments",
    requireSession,
    asyncHandler(async (request, response) => {
      const tenantId = publicIdSchema.parse(request.params.tenantId);
      const membershipId = publicIdSchema.parse(request.params.membershipId);
      const input = assignmentSchema.parse(request.body);
      await authorization.requireOwner(request.auth!.userId, tenantId);
      await service.assignStaff(tenantId, membershipId, input.venueIds);
      response.status(204).end();
    }),
  );

  return router;
}
