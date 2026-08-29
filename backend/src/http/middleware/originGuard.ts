import type { RequestHandler } from "express";
import type { Environment } from "../../config/environment.js";
import { ApiError } from "../ApiError.js";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const originExemptPaths = new Set([
  "/api/v1/payments/webhooks/midtrans",
  "/api/v1/jobs/outbox",
  "/api/v1/jobs/holds",
]);

export function createOriginGuard(environment: Environment): RequestHandler {
  return (request, _response, next) => {
    if (safeMethods.has(request.method) || originExemptPaths.has(request.path)) {
      next();
      return;
    }

    const origin = request.get("origin");
    if (environment.NODE_ENV === "test" || origin === environment.APP_ORIGIN) {
      next();
      return;
    }

    next(new ApiError(403, "ORIGIN_NOT_ALLOWED", "Origin request tidak diizinkan."));
  };
}
