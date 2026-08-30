import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../http/asyncHandler.js";
import { publicIdSchema } from "../http/schemas/publicId.js";
import { requestAuditContext } from "../http/requestAuditContext.js";
import { bookingReferenceSchema } from "../http/schemas/publicReference.js";
import { requireSession } from "../identity/auth/sessionMiddleware.js";
import type { TenantAuthorizationService } from "../tenant/authorization/TenantAuthorizationService.js";
import type { SupportService } from "./SupportService.js";

export function createSupportRouter(
  service: SupportService,
  authorization: TenantAuthorizationService,
): Router {
  const router = Router();
  router.post(
    "/support/tickets",
    requireSession,
    asyncHandler(async (request, response) => {
      const input = z
        .object({
          bookingReference: bookingReferenceSchema.optional(),
          paymentAttemptId: publicIdSchema.optional(),
          refundId: publicIdSchema.optional(),
          category: z.enum(["BOOKING", "PAYMENT", "REFUND", "VENUE", "OTHER"]),
          subject: z.string().trim().min(3).max(120),
          message: z.string().trim().min(3).max(4_000),
          transactionDispute: z.boolean().default(false),
        })
        .parse(request.body);
      response.status(201).json(
        await service.createCustomerTicket({
          ...input,
          userId: request.auth!.userId,
        }),
      );
    }),
  );
  router.get(
    "/support/tickets",
    requireSession,
    asyncHandler(async (request, response) => {
      response.json({ items: await service.listCustomer(request.auth!.userId) });
    }),
  );
  router.get(
    "/support/tickets/:ticketCode/messages",
    requireSession,
    asyncHandler(async (request, response) => {
      response.json({
        items: await service.listMessagesForCustomer(
          String(request.params.ticketCode),
          request.auth!.userId,
        ),
      });
    }),
  );
  router.post(
    "/support/tickets/:ticketCode/messages",
    requireSession,
    asyncHandler(async (request, response) => {
      const { body } = z
        .object({ body: z.string().trim().min(1).max(4_000) })
        .parse(request.body);
      await service.addCustomerMessage(
        String(request.params.ticketCode),
        request.auth!.userId,
        body,
      );
      response.status(201).end();
    }),
  );
  router.get(
    "/business/support",
    requireSession,
    asyncHandler(async (request, response) => {
      const tenantId = publicIdSchema.parse(request.query.tenantId);
      const access = await authorization.requirePermission(
        request.auth!.userId,
        tenantId,
        "support.manage",
      );
      response.json({
        items: await service.listTenant(
          tenantId,
          access.role === "STAFF" ? access.assignedVenueIds : undefined,
        ),
      });
    }),
  );
  router.get(
    "/business/support/:ticketId/messages",
    requireSession,
    asyncHandler(async (request, response) => {
      const tenantId = publicIdSchema.parse(request.query.tenantId);
      const access = await authorization.requirePermission(
        request.auth!.userId,
        tenantId,
        "support.manage",
      );
      response.json({
        items: await service.listMessagesForTenant(
          publicIdSchema.parse(request.params.ticketId),
          tenantId,
          access.role === "STAFF" ? access.assignedVenueIds : undefined,
        ),
      });
    }),
  );
  router.post(
    "/business/support/:ticketId/messages",
    requireSession,
    asyncHandler(async (request, response) => {
      const input = z
        .object({ tenantId: publicIdSchema, body: z.string().trim().min(1).max(4_000) })
        .parse(request.body);
      const access = await authorization.requirePermission(
        request.auth!.userId,
        input.tenantId,
        "support.manage",
      );
      await service.addTenantMessage(
        publicIdSchema.parse(request.params.ticketId),
        input.tenantId,
        access.role === "STAFF" ? access.assignedVenueIds : undefined,
        request.auth!.userId,
        input.body,
      );
      response.status(201).end();
    }),
  );
  router.get(
    "/admin/support",
    requireSession,
    asyncHandler(async (request, response) => {
      await authorization.requirePlatformAdmin(request.auth!.userId);
      response.json({ items: await service.listAdmin() });
    }),
  );
  router.patch(
    "/admin/support/:ticketId",
    requireSession,
    asyncHandler(async (request, response) => {
      await authorization.requirePlatformAdmin(request.auth!.userId);
      const input = z
        .object({
          status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
          resolution: z.string().trim().min(3).max(2_000).optional(),
          assigneeUserId: publicIdSchema.optional(),
          reverseEarning: z.boolean().optional(),
        })
        .parse(request.body);
      await service.updateByAdmin({
        ...input,
        ticketId: publicIdSchema.parse(request.params.ticketId),
        actorUserId: request.auth!.userId,
        auditContext: requestAuditContext(request),
      });
      response.status(204).end();
    }),
  );
  router.get(
    "/admin/support/:ticketId/messages",
    requireSession,
    asyncHandler(async (request, response) => {
      await authorization.requirePlatformAdmin(request.auth!.userId);
      response.json({
        items: await service.listMessagesForAdmin(
          publicIdSchema.parse(request.params.ticketId),
        ),
      });
    }),
  );
  router.post(
    "/admin/support/:ticketId/messages",
    requireSession,
    asyncHandler(async (request, response) => {
      await authorization.requirePlatformAdmin(request.auth!.userId);
      const { body } = z
        .object({ body: z.string().trim().min(1).max(4_000) })
        .parse(request.body);
      await service.addAdminMessage(
        publicIdSchema.parse(request.params.ticketId),
        request.auth!.userId,
        body,
      );
      response.status(201).end();
    }),
  );
  return router;
}
