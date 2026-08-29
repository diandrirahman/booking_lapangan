import { Router, type Response } from "express";
import { z } from "zod";
import type { Environment } from "../../config/environment.js";
import { ApiError } from "../../http/ApiError.js";
import { asyncHandler } from "../../http/asyncHandler.js";
import type { AuthService } from "./AuthService.js";
import type { SessionStore } from "./domain.js";
import type { GoogleOidcService } from "./GoogleOidcService.js";
import { requireSession } from "./sessionMiddleware.js";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(50),
  email: z.email(),
  phone: z.string().trim().min(8).max(16),
  password: z.string().min(10).max(128),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(128),
});

export interface AuthRouterDependencies {
  service: AuthService;
  sessions: SessionStore;
  environment: Environment;
  googleOidc?: GoogleOidcService;
}

export function createAuthRouter(dependencies: AuthRouterDependencies): Router {
  const router = Router();

  router.post(
    "/auth/register",
    asyncHandler(async (request, response) => {
      const result = await dependencies.service.register(
        registerSchema.parse(request.body),
      );
      setSessionCookie(response, result.token, dependencies.environment);
      response.status(201).json(result.view);
    }),
  );

  router.post(
    "/auth/login",
    asyncHandler(async (request, response) => {
      const result = await dependencies.service.login(loginSchema.parse(request.body));
      setSessionCookie(response, result.token, dependencies.environment);
      response.json(result.view);
    }),
  );

  router.post(
    "/auth/logout",
    asyncHandler(async (request, response) => {
      const token = request.cookies[dependencies.environment.SESSION_COOKIE_NAME] as
        string | undefined;
      if (token) await dependencies.sessions.revoke(token);
      response.clearCookie(dependencies.environment.SESSION_COOKIE_NAME, {
        httpOnly: true,
        sameSite: "lax",
        secure: dependencies.environment.NODE_ENV === "production",
        path: "/",
      });
      response.status(204).send();
    }),
  );

  router.get(
    "/me",
    requireSession,
    asyncHandler(async (request, response) => {
      if (!request.auth) {
        throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Session diperlukan.");
      }
      response.json(await dependencies.service.getSessionView(request.auth.userId));
    }),
  );

  router.get(
    "/auth/google/start",
    asyncHandler(async (_request, response) => {
      if (!dependencies.googleOidc)
        throw new ApiError(
          503,
          "GOOGLE_OIDC_NOT_CONFIGURED",
          "Google login belum dikonfigurasi.",
        );
      response.redirect(await dependencies.googleOidc.createAuthorizationUrl(null));
    }),
  );

  router.post(
    "/auth/google/link/start",
    requireSession,
    asyncHandler(async (request, response) => {
      if (!dependencies.googleOidc)
        throw new ApiError(
          503,
          "GOOGLE_OIDC_NOT_CONFIGURED",
          "Google login belum dikonfigurasi.",
        );
      const { password } = z
        .object({ password: z.string().min(1).max(128) })
        .parse(request.body);
      await dependencies.service.reauthenticatePassword(request.auth!.userId, password);
      response.json({
        authorizationUrl: await dependencies.googleOidc.createAuthorizationUrl(
          request.auth!.userId,
        ),
      });
    }),
  );

  router.get(
    "/auth/google/callback",
    asyncHandler(async (request, response) => {
      if (!dependencies.googleOidc)
        throw new ApiError(
          503,
          "GOOGLE_OIDC_NOT_CONFIGURED",
          "Google login belum dikonfigurasi.",
        );
      const query = z
        .object({ code: z.string().min(1), state: z.string().min(1) })
        .parse(request.query);
      const result = await dependencies.googleOidc.callback(query.code, query.state);
      setSessionCookie(response, result.token, dependencies.environment);
      response.redirect(`${dependencies.environment.APP_ORIGIN}/?auth=google-success`);
    }),
  );

  return router;
}

function setSessionCookie(
  response: Response,
  token: string,
  environment: Environment,
): void {
  response.cookie(environment.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: environment.NODE_ENV === "production",
    maxAge: environment.SESSION_TTL_SECONDS * 1000,
    path: "/",
  });
}
