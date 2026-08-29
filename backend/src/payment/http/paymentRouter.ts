import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../../http/ApiError.js";
import { asyncHandler } from "../../http/asyncHandler.js";
import {
  bookingReferenceSchema,
  paymentReferenceSchema,
} from "../../http/schemas/publicReference.js";
import { requireSession } from "../../identity/auth/sessionMiddleware.js";
import type { PaymentService } from "../application/PaymentService.js";

const createAttemptSchema = z.object({
  bookingId: bookingReferenceSchema,
  kind: z.enum(["FULL", "DP", "RESERVATION", "BALANCE", "RETRY"]),
});
const internalWebhookSchema = z.object({
  eventId: z.string().min(1).max(200),
  attemptId: paymentReferenceSchema,
  transactionStatus: z.enum([
    "settlement",
    "capture",
    "pending",
    "deny",
    "cancel",
    "expire",
  ]),
  statusCode: z.string().min(1).max(8),
  grossAmount: z.string().min(1).max(32),
  signatureKey: z.string().min(1).max(256),
});
const midtransWebhookSchema = z
  .object({
    transaction_id: z.string().min(1).max(200),
    order_id: paymentReferenceSchema,
    transaction_status: z.enum([
      "settlement",
      "capture",
      "pending",
      "deny",
      "cancel",
      "expire",
    ]),
    status_code: z.string().min(1).max(8),
    gross_amount: z.string().min(1).max(32),
    signature_key: z.string().min(1).max(256),
  })
  .transform((input) => ({
    eventId: input.transaction_id,
    attemptId: input.order_id,
    transactionStatus: input.transaction_status,
    statusCode: input.status_code,
    grossAmount: input.gross_amount,
    signatureKey: input.signature_key,
  }));
const webhookSchema = z.union([internalWebhookSchema, midtransWebhookSchema]);

export function createPaymentRouter(service: PaymentService): Router {
  const router = Router();
  router.post(
    "/payment-attempts",
    requireSession,
    asyncHandler(async (request, response) => {
      const input = createAttemptSchema.parse(request.body);
      const idempotencyKey = request.header("Idempotency-Key");
      if (!idempotencyKey)
        throw new ApiError(
          400,
          "IDEMPOTENCY_KEY_REQUIRED",
          "Header Idempotency-Key wajib diisi.",
        );
      response
        .status(201)
        .json(
          await service.createAttempt(
            input.bookingId,
            request.auth!.userId,
            input.kind,
            idempotencyKey,
          ),
        );
    }),
  );
  router.get(
    "/payment-attempts/:attemptId",
    requireSession,
    asyncHandler(async (request, response) => {
      response.json(
        await service.getAttempt(
          paymentReferenceSchema.parse(request.params.attemptId),
          request.auth!.userId,
        ),
      );
    }),
  );
  router.post(
    "/payment-attempts/:attemptId/simulate",
    requireSession,
    asyncHandler(async (request, response) => {
      const { result } = z
        .object({ result: z.enum(["success", "pending", "failed", "expired"]) })
        .parse(request.body);
      await service.simulateSandboxResult(
        paymentReferenceSchema.parse(request.params.attemptId),
        request.auth!.userId,
        result,
      );
      response.status(204).end();
    }),
  );
  router.post(
    "/payments/webhooks/midtrans",
    asyncHandler(async (request, response) => {
      await service.processWebhook(webhookSchema.parse(request.body));
      response.status(204).end();
    }),
  );
  return router;
}
