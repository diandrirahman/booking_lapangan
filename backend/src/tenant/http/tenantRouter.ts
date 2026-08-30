import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../http/asyncHandler.js";
import { publicIdSchema } from "../../http/schemas/publicId.js";
import { requestAuditContext } from "../../http/requestAuditContext.js";
import { requireSession } from "../../identity/auth/sessionMiddleware.js";
import type { TenantService } from "../application/TenantService.js";
import type { TenantAuthorizationService } from "../authorization/TenantAuthorizationService.js";
import { PERMISSION_CODES } from "../authorization/permissions.js";

const createTenantSchema = z.object({
  name: z.string().trim().min(3).max(80),
});

const assignmentSchema = z.object({
  venueIds: z.array(publicIdSchema).max(50),
  reason: z.string().trim().min(3).max(500),
});

export function createTenantRouter(
  service: TenantService,
  authorization: TenantAuthorizationService,
): Router {
  const router = Router();

  router.get(
    "/business/role-templates",
    requireSession,
    asyncHandler(async (_request, response) => {
      response.json({ items: await service.listRoleTemplates() });
    }),
  );

  router.get(
    "/business/tenants/:tenantId/roles",
    requireSession,
    asyncHandler(async (request, response) => {
      const tenantId = publicIdSchema.parse(request.params.tenantId);
      await authorization.requireTenantAccess(request.auth!.userId, tenantId);
      response.json({ items: await service.listTenantRoles(tenantId) });
    }),
  );

  router.post(
    "/business/tenants/:tenantId/roles",
    requireSession,
    asyncHandler(async (request, response) => {
      const tenantId = publicIdSchema.parse(request.params.tenantId);
      const input = z
        .object({
          templateId: publicIdSchema,
          name: z.string().trim().min(2).max(50),
          reason: z.string().trim().min(3).max(500),
        })
        .parse(request.body);
      await authorization.requireOwner(request.auth!.userId, tenantId);
      response
        .status(201)
        .json(
          await service.copyRoleTemplate(
            tenantId,
            input.templateId,
            input.name,
            request.auth!.userId,
            input.reason,
            requestAuditContext(request),
          ),
        );
    }),
  );

  router.put(
    "/business/tenants/:tenantId/roles/:roleId/permissions",
    requireSession,
    asyncHandler(async (request, response) => {
      const tenantId = publicIdSchema.parse(request.params.tenantId);
      const roleId = publicIdSchema.parse(request.params.roleId);
      const input = z
        .object({
          permissions: z.array(z.enum(PERMISSION_CODES)).max(PERMISSION_CODES.length),
          reason: z.string().trim().min(5).max(500),
        })
        .parse(request.body);
      await authorization.requireOwner(request.auth!.userId, tenantId);
      await service.updateRolePermissions(
        tenantId,
        roleId,
        [...new Set(input.permissions)],
        request.auth!.userId,
        input.reason,
        requestAuditContext(request),
      );
      response.status(204).end();
    }),
  );

  router.put(
    "/business/tenants/:tenantId/staff/:membershipId/role",
    requireSession,
    asyncHandler(async (request, response) => {
      const tenantId = publicIdSchema.parse(request.params.tenantId);
      const membershipId = publicIdSchema.parse(request.params.membershipId);
      const { roleId, reason } = z
        .object({
          roleId: publicIdSchema,
          reason: z.string().trim().min(3).max(500),
        })
        .parse(request.body);
      await authorization.requireOwner(request.auth!.userId, tenantId);
      await service.assignTenantRole(
        tenantId,
        membershipId,
        roleId,
        request.auth!.userId,
        reason,
        requestAuditContext(request),
      );
      response.status(204).end();
    }),
  );

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
      await service.assignStaff(
        tenantId,
        membershipId,
        input.venueIds,
        request.auth!.userId,
        input.reason,
        requestAuditContext(request),
      );
      response.status(204).end();
    }),
  );

  return router;
}
