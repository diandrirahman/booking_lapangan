import express, { type Express, type RequestHandler } from "express";
import cookieParser from "cookie-parser";
import type { Router } from "express";
import helmetModule, { type HelmetOptions } from "helmet";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import pino from "pino";
import { pinoHttp } from "pino-http";
import type { Environment } from "./config/environment.js";
import { errorHandler } from "./http/middleware/errorHandler.js";
import { notFound } from "./http/middleware/notFound.js";
import { createOriginGuard } from "./http/middleware/originGuard.js";
import { requestId } from "./http/middleware/requestId.js";
import type { SessionStore } from "./identity/auth/domain.js";
import { createSessionMiddleware } from "./identity/auth/sessionMiddleware.js";
import {
  createHealthRouter,
  type HealthDependencies,
} from "./platform/health/healthRouter.js";

const helmet = helmetModule as unknown as (options?: HelmetOptions) => RequestHandler;

export interface AppDependencies extends HealthDependencies {
  environment: Environment;
  routers?: Router[];
  sessionStore?: SessionStore;
}

export function createApp(dependencies: AppDependencies): Express {
  const app = express();
  const logger = pino({
    level: dependencies.environment.NODE_ENV === "test" ? "silent" : "info",
    redact: {
      paths: ["req.headers.authorization", "req.headers.cookie", "password", "token"],
      censor: "[REDACTED]",
    },
  });

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (request) => request.id,
      customProps: (request) => ({ requestId: request.id }),
    }),
  );
  app.use(helmet());
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: dependencies.environment.NODE_ENV === "test" ? 10_000 : 120,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      keyGenerator: (request) =>
        ipKeyGenerator(request.ip ?? request.socket.remoteAddress ?? "unknown"),
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(createOriginGuard(dependencies.environment));

  if (dependencies.sessionStore) {
    app.use(
      createSessionMiddleware(dependencies.environment, dependencies.sessionStore),
    );
  }

  app.use("/api/v1/health", createHealthRouter(dependencies));
  for (const router of dependencies.routers ?? []) {
    app.use("/api/v1", router);
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
