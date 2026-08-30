import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../http/asyncHandler.js";
import { ApiError } from "../http/ApiError.js";
import { publicIdSchema } from "../http/schemas/publicId.js";
import { requestAuditContext } from "../http/requestAuditContext.js";
import { requireSession } from "../identity/auth/sessionMiddleware.js";
import type { TenantAuthorizationService } from "../tenant/authorization/TenantAuthorizationService.js";
import type { FinanceService } from "./FinanceService.js";

const promotionSchema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  discountType: z.enum(["PERCENT", "FIXED"]),
  discountValue: z.number().int().positive(),
  minimumAmount: z.number().int().nonnegative().optional(),
  maximumDiscount: z.number().int().positive().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  startsAtTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/)
    .optional(),
  endsAtTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/)
    .optional(),
  quota: z.number().int().positive().optional(),
  perUserLimit: z.number().int().positive().max(100).optional(),
  firstBookingOnly: z.boolean().optional(),
  paymentMethod: z.enum(["FULL", "DP", "PAY_AT_VENUE"]).optional(),
  fundingSource: z.enum(["OWNER", "PLATFORM"]),
  budgetAmount: z.number().int().positive().optional(),
  scopes: z
    .array(
      z.object({
        type: z.enum(["VENUE", "SPORT", "COURT"]),
        referenceId: publicIdSchema,
      }),
    )
    .max(50)
    .optional(),
});

const commissionSchema = z
  .object({
    tenantId: publicIdSchema.nullable(),
    rateBasisPoints: z.number().int().min(0).max(10_000),
    effectiveFrom: z.coerce.date(),
    effectiveTo: z.coerce.date().optional(),
    trialDays: z.number().int().positive().optional(),
    trialCompletedBookingLimit: z.number().int().positive().optional(),
    gatewayFeeFunding: z.enum(["OWNER", "PLATFORM"]),
    gatewayFeeBasisPoints: z.number().int().min(0).max(10_000).default(250),
    subsidyBudget: z.number().int().positive().optional(),
    reason: z.string().trim().min(3).max(500),
  })
  .superRefine((input, context) => {
    if (input.gatewayFeeFunding === "PLATFORM" && !input.subsidyBudget) {
      context.addIssue({
        code: "custom",
        path: ["subsidyBudget"],
        message: "Budget subsidi wajib untuk gateway fee yang didanai platform.",
      });
    }
  });

export function createFinanceRouter(
  service: FinanceService,
  authorization: TenantAuthorizationService,
): Router {
  const router = Router();

  router.get(
    "/business/finance",
    requireSession,
    asyncHandler(async (request, response) => {
      const tenantId = publicIdSchema.parse(request.query.tenantId);
      const access = await authorization.requirePermission(
        request.auth!.userId,
        tenantId,
        "finance.view",
      );
      response.json(
        await service.financeSummary(
          tenantId,
          access.role === "STAFF" ? access.assignedVenueIds : undefined,
        ),
      );
    }),
  );
  router.get(
    "/business/finance/ledger",
    requireSession,
    asyncHandler(async (request, response) => {
      const tenantId = publicIdSchema.parse(request.query.tenantId);
      const access = await authorization.requirePermission(
        request.auth!.userId,
        tenantId,
        "finance.view",
      );
      response.json({
        items: await service.listLedger(
          tenantId,
          50,
          access.role === "STAFF" ? access.assignedVenueIds : undefined,
        ),
      });
    }),
  );
  router.get(
    "/business/finance/payments",
    requireSession,
    asyncHandler(async (request, response) => {
      const tenantId = publicIdSchema.parse(request.query.tenantId);
      const access = await authorization.requirePermission(
        request.auth!.userId,
        tenantId,
        "payments.manage",
      );
      response.json({
        items: await service.listPayments(
          tenantId,
          access.role === "STAFF" ? access.assignedVenueIds : undefined,
        ),
      });
    }),
  );
  router.get(
    "/business/finance/payouts",
    requireSession,
    asyncHandler(async (request, response) => {
      const tenantId = publicIdSchema.parse(request.query.tenantId);
      const access = await authorization.requirePermission(
        request.auth!.userId,
        tenantId,
        "payouts.view",
      );
      response.json({
        items: await service.listPayouts(
          tenantId,
          access.role === "STAFF" ? access.assignedVenueIds : undefined,
        ),
      });
    }),
  );
  router.post(
    "/business/finance/payouts",
    requireSession,
    asyncHandler(async (request, response) => {
      const input = z.object({ tenantId: publicIdSchema }).parse(request.body);
      await authorization.requirePrimaryOwner(request.auth!.userId, input.tenantId);
      response
        .status(201)
        .json(
          await service.createPayout(
            input.tenantId,
            request.auth!.userId,
            requireIdempotencyKey(request.header("Idempotency-Key")),
            "MANUAL",
            new Date(),
            requestAuditContext(request),
          ),
        );
    }),
  );
  router.get(
    "/business/finance/settings",
    requireSession,
    asyncHandler(async (request, response) => {
      const tenantId = publicIdSchema.parse(request.query.tenantId);
      await authorization.requirePrimaryOwner(request.auth!.userId, tenantId);
      response.json(await service.getFinanceSettings(tenantId));
    }),
  );
  router.put(
    "/business/finance/settings",
    requireSession,
    asyncHandler(async (request, response) => {
      const input = z
        .object({
          tenantId: publicIdSchema,
          manualPayoutEnabled: z.boolean(),
          payoutAccountLabel: z.string().trim().max(80).nullable().optional(),
          payoutAccountLast4: z
            .string()
            .regex(/^\d{4}$/)
            .nullable()
            .optional(),
          reason: z.string().trim().min(3).max(500),
        })
        .parse(request.body);
      await authorization.requirePrimaryOwner(request.auth!.userId, input.tenantId);
      const current = await service.getFinanceSettings(input.tenantId);
      await service.updateFinanceSettings(
        input.tenantId,
        { ...input, minimumPayoutAmount: current.minimumPayoutAmount },
        request.auth!.userId,
        input.reason,
        requestAuditContext(request),
      );
      response.status(204).end();
    }),
  );
  router.post(
    "/business/promotions",
    requireSession,
    asyncHandler(async (request, response) => {
      const input = promotionSchema
        .extend({ tenantId: publicIdSchema })
        .parse(request.body);
      await authorization.requirePermission(
        request.auth!.userId,
        input.tenantId,
        "promotions.manage",
      );
      response.status(201).json(
        await service.createPromotion(
          {
            ...input,
            actorUserId: request.auth!.userId,
            reason: input.description ?? "Promo tenant dibuat",
            idempotencyKey: requireIdempotencyKey(request.header("Idempotency-Key")),
          },
          requestAuditContext(request),
        ),
      );
    }),
  );
  router.get(
    "/business/promotions",
    requireSession,
    asyncHandler(async (request, response) => {
      const tenantId = publicIdSchema.parse(request.query.tenantId);
      await authorization.requirePermission(
        request.auth!.userId,
        tenantId,
        "promotions.manage",
      );
      response.json({ items: await service.listPromotions(tenantId) });
    }),
  );
  router.get(
    "/business/finance/export",
    requireSession,
    asyncHandler(async (request, response) => {
      const query = z
        .object({
          tenantId: publicIdSchema,
          dataset: z.enum([
            "bookings",
            "payments",
            "refunds",
            "payouts",
            "promotions",
            "staff-activity",
            "offline-bookings",
          ]),
          format: z.enum(["csv", "xlsx"]),
        })
        .parse(request.query);
      const access = await authorization.requirePermission(
        request.auth!.userId,
        query.tenantId,
        "exports.run",
      );
      const exported = await service.exportFinance(
        query.tenantId,
        query.dataset,
        query.format,
        access.role === "STAFF" ? access.assignedVenueIds : undefined,
      );
      response.setHeader("Content-Type", exported.contentType);
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="${exported.filename}"`,
      );
      response.send(exported.body);
    }),
  );

  router.get(
    "/admin/commission-configs",
    requireSession,
    asyncHandler(async (request, response) => {
      await authorization.requirePlatformAdmin(request.auth!.userId);
      response.json({ items: await service.listCommissionConfigs() });
    }),
  );
  router.post(
    "/admin/commission-configs",
    requireSession,
    asyncHandler(async (request, response) => {
      await authorization.requirePlatformAdmin(request.auth!.userId);
      const input = commissionSchema.parse(request.body);
      response.status(201).json(
        await service.createCommissionConfig(
          {
            ...input,
            actorUserId: request.auth!.userId,
            idempotencyKey: requireIdempotencyKey(request.header("Idempotency-Key")),
          },
          requestAuditContext(request),
        ),
      );
    }),
  );
  router.post(
    "/admin/promotions",
    requireSession,
    asyncHandler(async (request, response) => {
      await authorization.requirePlatformAdmin(request.auth!.userId);
      const input = promotionSchema
        .extend({ tenantId: publicIdSchema.nullable().default(null) })
        .parse(request.body);
      if (
        input.fundingSource !== "PLATFORM" ||
        !input.budgetAmount ||
        !input.quota ||
        !input.maximumDiscount
      ) {
        throw new ApiError(
          422,
          "PLATFORM_PROMOTION_LIMITS_REQUIRED",
          "Promo platform wajib memiliki budget, quota, dan maksimum subsidi.",
        );
      }
      response.status(201).json(
        await service.createPromotion(
          {
            ...input,
            actorUserId: request.auth!.userId,
            reason: input.description ?? "Promo platform dibuat",
            idempotencyKey: requireIdempotencyKey(request.header("Idempotency-Key")),
          },
          requestAuditContext(request),
        ),
      );
    }),
  );
  router.get(
    "/admin/promotions",
    requireSession,
    asyncHandler(async (request, response) => {
      await authorization.requirePlatformAdmin(request.auth!.userId);
      response.json({ items: await service.listPromotions() });
    }),
  );
  router.get(
    "/admin/finance/ledger",
    requireSession,
    asyncHandler(async (request, response) => {
      await authorization.requirePlatformAdmin(request.auth!.userId);
      response.json({ items: await service.listLedger() });
    }),
  );
  router.get(
    "/admin/payouts",
    requireSession,
    asyncHandler(async (request, response) => {
      await authorization.requirePlatformAdmin(request.auth!.userId);
      response.json({ items: await service.listPayouts() });
    }),
  );
  router.patch(
    "/admin/payouts/:payoutId",
    requireSession,
    asyncHandler(async (request, response) => {
      await authorization.requirePlatformAdmin(request.auth!.userId);
      const idempotencyKey = requireIdempotencyKey(request.header("Idempotency-Key"));
      const input = z
        .object({
          status: z.enum(["PROCESSING", "SUCCEEDED", "FAILED", "CANCELLED"]),
          reason: z.string().trim().min(3).max(500),
        })
        .parse(request.body);
      await service.updatePayoutStatus(
        publicIdSchema.parse(request.params.payoutId),
        input.status,
        request.auth!.userId,
        idempotencyKey,
        input.reason,
      );
      response.status(204).end();
    }),
  );
  router.put(
    "/admin/tenants/:tenantId/finance-settings",
    requireSession,
    asyncHandler(async (request, response) => {
      await authorization.requirePlatformAdmin(request.auth!.userId);
      const tenantId = publicIdSchema.parse(request.params.tenantId);
      const input = z
        .object({
          minimumPayoutAmount: z.number().int().positive(),
          reason: z.string().trim().min(3).max(500),
        })
        .parse(request.body);
      const current = await service.getFinanceSettings(tenantId);
      await service.updateFinanceSettings(
        tenantId,
        {
          minimumPayoutAmount: input.minimumPayoutAmount,
          manualPayoutEnabled: current.manualPayoutEnabled,
          payoutAccountLabel: current.payoutAccountLabel,
          payoutAccountLast4: current.payoutAccountLast4,
        },
        request.auth!.userId,
        input.reason,
        requestAuditContext(request),
      );
      response.status(204).end();
    }),
  );

  return router;
}

function requireIdempotencyKey(value: string | undefined): string {
  if (!value || value.length > 100) {
    throw new ApiError(
      400,
      "IDEMPOTENCY_KEY_REQUIRED",
      "Header Idempotency-Key wajib diisi.",
    );
  }
  return value;
}
