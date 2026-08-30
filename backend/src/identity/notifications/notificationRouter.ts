import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../http/asyncHandler.js";
import { publicIdSchema } from "../../http/schemas/publicId.js";
import { requireSession } from "../auth/sessionMiddleware.js";
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_PREFERENCE_EVENTS,
  type NotificationService,
} from "./NotificationService.js";
import type { TenantAuthorizationService } from "../../tenant/authorization/TenantAuthorizationService.js";

export function createNotificationRouter(
  service: NotificationService,
  authorization: TenantAuthorizationService,
): Router {
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

  router.get(
    "/notifications/preferences",
    requireSession,
    asyncHandler(async (request, response) => {
      response.json({ items: await service.listPreferences(request.auth!.userId) });
    }),
  );
  router.put(
    "/notifications/preferences",
    requireSession,
    asyncHandler(async (request, response) => {
      const input = z
        .object({
          eventType: z.enum(NOTIFICATION_PREFERENCE_EVENTS),
          channel: z.enum(NOTIFICATION_CHANNELS),
          enabled: z.boolean(),
        })
        .parse(request.body);
      await service.setPreference(
        request.auth!.userId,
        input.eventType,
        input.channel,
        input.enabled,
      );
      response.status(204).end();
    }),
  );
  router.get(
    "/notifications/reminder-options",
    requireSession,
    asyncHandler(async (_request, response) => {
      response.json({ items: await service.listReminderOptions() });
    }),
  );
  router.post(
    "/admin/notification-reminder-options",
    requireSession,
    asyncHandler(async (request, response) => {
      await authorization.requirePlatformAdmin(request.auth!.userId);
      const { minutesBefore } = z
        .object({ minutesBefore: z.number().int().positive().max(43_200) })
        .parse(request.body);
      response.status(201).json(await service.createReminderOption(minutesBefore));
    }),
  );
  router.put(
    "/business/venues/:venueId/reminders",
    requireSession,
    asyncHandler(async (request, response) => {
      const input = z
        .object({
          tenantId: publicIdSchema,
          optionIds: z.array(publicIdSchema).max(10),
        })
        .parse(request.body);
      const venueId = publicIdSchema.parse(request.params.venueId);
      await authorization.requirePermission(
        request.auth!.userId,
        input.tenantId,
        "venues.manage",
        venueId,
      );
      await service.setVenueReminders(venueId, input.optionIds);
      response.status(204).end();
    }),
  );

  return router;
}
