import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../http/asyncHandler.js";
import { publicIdSchema } from "../../http/schemas/publicId.js";
import { requireSession } from "../../identity/auth/sessionMiddleware.js";
import type { TenantService } from "../../tenant/application/TenantService.js";
import type { TenantAuthorizationService } from "../../tenant/authorization/TenantAuthorizationService.js";
import type { VenueSetupService } from "./VenueSetupService.js";

const tenantSchema = z.object({ tenantId: publicIdSchema });
const createSchema = tenantSchema.extend({ name: z.string().trim().min(3).max(80) });
const profileSchema = tenantSchema.extend({
  name: z.string().trim().min(3).max(80),
  description: z.string().trim().min(20).max(5_000),
  phoneE164: z.string().regex(/^\+[1-9]\d{7,14}$/),
  email: z.email().optional(),
  addressLine: z.string().trim().min(10).max(255),
  provinceCode: z.string().trim().max(10).optional(),
  cityCode: z.string().trim().max(10).optional(),
  districtCode: z.string().trim().max(10).optional(),
  postalCode: z
    .string()
    .regex(/^\d{5}$/)
    .optional(),
  latitude: z.string().regex(/^-?\d{1,2}(\.\d{1,7})?$/),
  longitude: z.string().regex(/^-?\d{1,3}(\.\d{1,7})?$/),
  timezone: z.string().min(3).max(40),
  indoorOutdoorType: z.enum(["INDOOR", "OUTDOOR", "MIXED"]),
  parkingInfo: z.string().max(255).optional(),
  houseRules: z.string().min(10).max(10_000),
  emergencyContact: z.string().trim().max(50).optional(),
});
const decisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED", "REVISION_REQUIRED"]),
  reason: z.string().trim().min(5).max(2_000),
});
const transferSchema = tenantSchema.extend({
  targetMembershipId: publicIdSchema,
  reason: z.string().trim().min(5).max(500),
});
const catalogSchema = tenantSchema.extend({
  sportIds: z.array(publicIdSchema).min(1).max(20),
  facilityIds: z.array(publicIdSchema).max(50),
});
const courtSchema = tenantSchema.extend({
  sportId: publicIdSchema,
  name: z.string().trim().min(2).max(50),
  surface: z.string().trim().max(50).optional(),
  capacity: z.number().int().min(1).max(500).optional(),
});
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/);
const availabilitySchema = tenantSchema.extend({
  intervalMinutes: z.number().int().min(15).max(240),
  bufferMinutes: z.number().int().min(0).max(240),
  minimumDurationMinutes: z.number().int().min(15).max(720),
  maximumDurationMinutes: z.number().int().min(15).max(720),
  bookingWindowDays: z.number().int().min(1).max(365),
  minimumLeadMinutes: z.number().int().min(0).max(43_200),
  weeklySchedule: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        opensAt: timeSchema,
        closesAt: timeSchema,
        active: z.boolean(),
      }),
    )
    .max(14),
});
const exceptionSchema = tenantSchema.extend({
  courtId: publicIdSchema.optional(),
  localDate: z.iso.date(),
  kind: z.enum(["OPEN", "CLOSED", "CUSTOM_HOURS"]),
  opensAt: timeSchema.optional(),
  closesAt: timeSchema.optional(),
  reason: z.string().trim().max(255).optional(),
});
const paymentSettingsSchema = tenantSchema.extend({
  allowFull: z.boolean(),
  allowDp: z.boolean(),
  dpPercentage: z.number().int().min(1).max(100).nullable(),
  allowPayAtVenue: z.boolean(),
  reservationAmount: z.number().int().nonnegative().nullable(),
  manualConfirmationMinutes: z.number().int().min(5).max(1_440),
  balanceDeadlineMinutes: z.number().int().min(0).max(43_200).nullable(),
});
const addonSchema = tenantSchema.extend({
  name: z.string().trim().min(2).max(60),
  price: z.number().int().nonnegative().max(100_000_000),
});

export function createVenueSetupRouter(
  service: VenueSetupService,
  tenantService: TenantService,
  authorization: TenantAuthorizationService,
): Router {
  const router = Router();
  router.get(
    "/business/setup-masters",
    requireSession,
    asyncHandler(async (_request, response) => {
      response.json(await service.masters());
    }),
  );
  router.get(
    "/business/venues",
    requireSession,
    asyncHandler(async (request, response) => {
      const { tenantId } = tenantSchema.parse(request.query);
      const access = await authorization.requireTenantAccess(
        request.auth!.userId,
        tenantId,
      );
      response.json({
        items: await service.listForTenant(
          tenantId,
          access.role === "STAFF" ? access.assignedVenueIds : null,
        ),
      });
    }),
  );
  router.get(
    "/business/venues/:venueId",
    requireSession,
    asyncHandler(async (request, response) => {
      const { tenantId } = tenantSchema.parse(request.query);
      const venueId = publicIdSchema.parse(request.params.venueId);
      await authorization.requireVenueAccess(request.auth!.userId, tenantId, venueId);
      response.json(await service.detail(venueId, tenantId));
    }),
  );
  router.post(
    "/business/venues",
    requireSession,
    asyncHandler(async (request, response) => {
      const input = createSchema.parse(request.body);
      await authorization.requireOwner(request.auth!.userId, input.tenantId);
      response.status(201).json(await service.createDraft(input.tenantId, input.name));
    }),
  );
  router.put(
    "/business/venues/:venueId/profile",
    requireSession,
    asyncHandler(async (request, response) => {
      const { tenantId, ...profile } = profileSchema.parse(request.body);
      const venueId = publicIdSchema.parse(request.params.venueId);
      await authorization.requireOwner(request.auth!.userId, tenantId);
      await service.updateProfile(venueId, tenantId, profile);
      response.status(204).end();
    }),
  );
  router.put(
    "/business/venues/:venueId/catalog",
    requireSession,
    asyncHandler(async (request, response) => {
      const { tenantId, sportIds, facilityIds } = catalogSchema.parse(request.body);
      const venueId = publicIdSchema.parse(request.params.venueId);
      await authorization.requireOwner(request.auth!.userId, tenantId);
      await service.replaceCatalog(venueId, tenantId, sportIds, facilityIds);
      response.status(204).end();
    }),
  );
  router.post(
    "/business/venues/:venueId/courts",
    requireSession,
    asyncHandler(async (request, response) => {
      const { tenantId, ...input } = courtSchema.parse(request.body);
      const venueId = publicIdSchema.parse(request.params.venueId);
      await authorization.requireOwner(request.auth!.userId, tenantId);
      response.status(201).json(await service.createCourt(venueId, tenantId, input));
    }),
  );
  router.put(
    "/business/venues/:venueId/courts/:courtId/availability",
    requireSession,
    asyncHandler(async (request, response) => {
      const { tenantId, ...input } = availabilitySchema.parse(request.body);
      const venueId = publicIdSchema.parse(request.params.venueId);
      const courtId = publicIdSchema.parse(request.params.courtId);
      await authorization.requireOwner(request.auth!.userId, tenantId);
      await service.saveCourtAvailability(venueId, courtId, tenantId, input);
      response.status(204).end();
    }),
  );
  router.post(
    "/business/venues/:venueId/exceptions",
    requireSession,
    asyncHandler(async (request, response) => {
      const { tenantId, ...input } = exceptionSchema.parse(request.body);
      const venueId = publicIdSchema.parse(request.params.venueId);
      await authorization.requireOwner(request.auth!.userId, tenantId);
      response
        .status(201)
        .json(await service.createException(venueId, tenantId, input));
    }),
  );
  router.put(
    "/business/venues/:venueId/payment-settings",
    requireSession,
    asyncHandler(async (request, response) => {
      const { tenantId, ...input } = paymentSettingsSchema.parse(request.body);
      const venueId = publicIdSchema.parse(request.params.venueId);
      await authorization.requireOwner(request.auth!.userId, tenantId);
      await service.savePaymentSettings(venueId, tenantId, input);
      response.status(204).end();
    }),
  );
  router.post(
    "/business/venues/:venueId/addons",
    requireSession,
    asyncHandler(async (request, response) => {
      const { tenantId, ...input } = addonSchema.parse(request.body);
      const venueId = publicIdSchema.parse(request.params.venueId);
      await authorization.requireOwner(request.auth!.userId, tenantId);
      response.status(201).json(await service.createAddon(venueId, tenantId, input));
    }),
  );
  router.get(
    "/business/venues/:venueId/progress",
    requireSession,
    asyncHandler(async (request, response) => {
      const { tenantId } = tenantSchema.parse(request.query);
      const venueId = publicIdSchema.parse(request.params.venueId);
      await authorization.requireOwner(request.auth!.userId, tenantId);
      response.json(await service.progress(venueId, tenantId));
    }),
  );
  router.post(
    "/business/venues/:venueId/submit",
    requireSession,
    asyncHandler(async (request, response) => {
      const { tenantId } = tenantSchema.parse(request.body);
      const venueId = publicIdSchema.parse(request.params.venueId);
      await authorization.requireOwner(request.auth!.userId, tenantId);
      response
        .status(201)
        .json(
          await service.submit(venueId, tenantId, request.auth!.userId, request.id),
        );
    }),
  );
  router.post(
    "/business/tenants/transfer-primary-owner",
    requireSession,
    asyncHandler(async (request, response) => {
      const input = transferSchema.parse(request.body);
      await authorization.requireOwner(request.auth!.userId, input.tenantId);
      await tenantService.transferPrimaryOwner(
        input.tenantId,
        request.auth!.userId,
        input.targetMembershipId,
        input.reason,
        request.id,
      );
      response.status(204).end();
    }),
  );
  router.post(
    "/admin/verifications/:requestId/decision",
    requireSession,
    asyncHandler(async (request, response) => {
      await authorization.requirePlatformAdmin(request.auth!.userId);
      const input = decisionSchema.parse(request.body);
      await service.decide(
        publicIdSchema.parse(request.params.requestId),
        request.auth!.userId,
        input.decision,
        input.reason,
        request.id,
      );
      response.status(204).end();
    }),
  );
  return router;
}
