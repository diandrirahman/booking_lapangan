import type { RequestHandler } from "express";
import type { Environment } from "../../config/environment.js";
import { ApiError } from "../../http/ApiError.js";
import type { SessionStore } from "./domain.js";
import { SessionStoreUnavailableError } from "./domain.js";

export function createSessionMiddleware(
  environment: Environment,
  sessions: SessionStore,
): RequestHandler {
  return async (request, _response, next) => {
    try {
      const cookieValue = (request.cookies as Record<string, unknown>)[
        environment.SESSION_COOKIE_NAME
      ];
      const token = typeof cookieValue === "string" ? cookieValue : undefined;
      if (!token) {
        next();
        return;
      }
      const session = await sessions.findByToken(token);
      if (session) {
        request.auth = { sessionId: session.id, userId: session.userId };
      }
      next();
    } catch (error) {
      if (error instanceof SessionStoreUnavailableError) {
        request.sessionStoreUnavailable = true;
        next();
        return;
      }
      next(error);
    }
  };
}

export const requireSession: RequestHandler = (request, _response, next) => {
  if (request.sessionStoreUnavailable) {
    next(
      new ApiError(
        503,
        "SESSION_STORE_UNAVAILABLE",
        "Layanan sesi sedang tidak tersedia. Silakan coba kembali.",
      ),
    );
    return;
  }
  if (!request.auth) {
    next(
      new ApiError(401, "AUTHENTICATION_REQUIRED", "Silakan masuk terlebih dahulu."),
    );
    return;
  }
  next();
};
