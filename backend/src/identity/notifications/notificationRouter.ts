import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../http/asyncHandler.js";
import { publicIdSchema } from "../../http/schemas/publicId.js";
import { requireSession } from "../auth/sessionMiddleware.js";
import type { NotificationService } from "./NotificationService.js";

export function createNotificationRouter(service: NotificationService): Router {
  const router = Router();

  router.get(
    "/notifications",
    requireSession,
    asyncHandler(async (request, response) => {
      const query = z
        .object({ unreadOnly: z.coerce.boolean().default(false) })
        .parse(request.query);
      response.json(await service.list(request.auth!.userId, query.unreadOnly));
    }),
  );

  router.patch(
    "/notifications/:notificationId/read",
    requireSession,
    asyncHandler(async (request, response) => {
      const notificationId = publicIdSchema.parse(request.params.notificationId);
      await service.markRead(request.auth!.userId, notificationId);
      response.status(204).end();
    }),
  );

  router.post(
    "/notifications/read-all",
    requireSession,
    asyncHandler(async (request, response) => {
      await service.markAllRead(request.auth!.userId);
      response.status(204).end();
    }),
  );

  return router;
}
