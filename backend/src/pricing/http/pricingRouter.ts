import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../http/asyncHandler.js";
import { ApiError } from "../../http/ApiError.js";
import { publicIdSchema } from "../../http/schemas/publicId.js";
import { requireSession } from "../../identity/auth/sessionMiddleware.js";
import type { TenantAuthorizationService } from "../../tenant/authorization/TenantAuthorizationService.js";
import type { PricingService } from "../application/PricingService.js";

const nullableTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/)
  .nullable()
  .default(null);
const createRuleSchema = z
  .object({
    tenantId: publicIdSchema,
    venueId: publicIdSchema,
    courtId: publicIdSchema.nullable().default(null),
    kind: z.enum(["BASE", "WEEKDAY_WEEKEND", "DAY_TIME", "SPECIAL_DATE"]),
    amount: z.number().int().positive(),
    dayOfWeek: z.number().int().min(0).max(6).nullable().default(null),
    specialDate: z.iso.date().nullable().default(null),
    startsAtLocal: nullableTime,
    endsAtLocal: nullableTime,
  })
  .superRefine((input, context) => {
    if (
      input.kind === "BASE" &&
      (input.dayOfWeek !== null ||
        input.specialDate !== null ||
        input.startsAtLocal !== null ||
        input.endsAtLocal !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Harga dasar tidak memakai hari, tanggal, atau rentang jam.",
      });
    }
    if (
      (input.kind === "WEEKDAY_WEEKEND" || input.kind === "DAY_TIME") &&
      input.dayOfWeek === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["dayOfWeek"],
        message: "Hari wajib dipilih untuk jenis aturan ini.",
      });
    }
    if (input.kind === "SPECIAL_DATE" && input.specialDate === null) {
      context.addIssue({
        code: "custom",
        path: ["specialDate"],
        message: "Tanggal khusus wajib dipilih.",
      });
    }
    const hasStart = input.startsAtLocal !== null;
    const hasEnd = input.endsAtLocal !== null;
    if (hasStart !== hasEnd || (input.kind === "DAY_TIME" && !hasStart)) {
      context.addIssue({
        code: "custom",
        path: ["startsAtLocal"],
        message: "Jam mulai dan selesai wajib diisi bersama.",
      });
    }
    if (
      input.startsAtLocal &&
      input.endsAtLocal &&
      input.startsAtLocal >= input.endsAtLocal
    ) {
      context.addIssue({
        code: "custom",
        path: ["endsAtLocal"],
        message: "Jam selesai harus setelah jam mulai.",
      });
    }
  });

const previewSchema = z.object({
  tenantId: publicIdSchema,
  venueId: publicIdSchema,
  courtId: publicIdSchema,
  samples: z
    .array(
      z.object({
        localDate: z.iso.date(),
        localTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/),
      }),
    )
    .min(1)
    .max(20),
  candidate: createRuleSchema.optional(),
});

export function createPricingRouter(
  service: PricingService,
  authorization: TenantAuthorizationService,
): Router {
  const router = Router();
  router.post(
    "/business/pricing-rules",
    requireSession,
    asyncHandler(async (request, response) => {
      const input = createRuleSchema.parse(request.body);
      await authorization.requirePermission(
        request.auth!.userId,
        input.tenantId,
        "pricing.manage",
        input.venueId,
      );
      response.status(201).json(await service.createRule(input));
    }),
  );
  router.post(
    "/business/pricing-preview",
    requireSession,
    asyncHandler(async (request, response) => {
      const input = previewSchema.parse(request.body);
      await authorization.requirePermission(
        request.auth!.userId,
        input.tenantId,
        "pricing.manage",
        input.venueId,
      );
      if (
        input.candidate &&
        (input.candidate.tenantId !== input.tenantId ||
          input.candidate.venueId !== input.venueId)
      ) {
        throw new ApiError(
          422,
          "PRICE_PREVIEW_SCOPE_MISMATCH",
          "Scope kandidat harga harus sama dengan scope preview.",
        );
      }
      response.json(await service.preview(input));
    }),
  );
  return router;
}
