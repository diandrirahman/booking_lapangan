import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_ORIGIN: z.url().default("http://localhost:5173"),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("mysql://lapangango:lapangango_local@127.0.0.1:3307/lapangango"),
  DATABASE_SSL_MODE: z.enum(["disabled", "required"]).default("disabled"),
  DATABASE_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(20).default(10),
  REDIS_URL: z.url().default("redis://127.0.0.1:6380"),
  SESSION_COOKIE_NAME: z.string().min(1).default("lapangango_session"),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(43_200),
  SESSION_SECRET: z
    .string()
    .min(32)
    .default("local-session-secret-change-before-production"),
  RESOURCE_ID_SECRET: z
    .string()
    .min(32)
    .default("local-resource-id-secret-change-before-production"),
  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
  GOOGLE_REDIRECT_URI: z
    .url()
    .default("http://localhost:3000/api/v1/auth/google/callback"),
  MIDTRANS_SERVER_KEY: z.string().default(""),
  MIDTRANS_CLIENT_KEY: z.string().default(""),
  MIDTRANS_IS_PRODUCTION: z.stringbool().default(false),
  S3_ENDPOINT: z.url().default("http://127.0.0.1:9000"),
  S3_REGION: z.string().min(1).default("ap-southeast-3"),
  S3_BUCKET: z.string().min(1).default("lapangango-local"),
  S3_ACCESS_KEY: z.string().min(1).default("lapangango"),
  S3_SECRET_KEY: z.string().min(1).default("lapangango_local_secret"),
  S3_PUBLIC_BASE_URL: z.union([z.literal(""), z.url()]).default(""),
  S3_FORCE_PATH_STYLE: z.stringbool().default(true),
  S3_MANAGE_BUCKET: z.stringbool().default(true),
  CRON_SECRET: z.string().min(16).default("local-cron-secret"),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().min(100).max(60_000).default(500),
  SEED_DEMO_PASSWORD: z.string().min(10).max(128).optional(),
});

const productionRequiredVariables = [
  "APP_ORIGIN",
  "DATABASE_URL",
  "REDIS_URL",
  "SESSION_SECRET",
  "RESOURCE_ID_SECRET",
  "CRON_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
  "MIDTRANS_SERVER_KEY",
  "MIDTRANS_CLIENT_KEY",
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",
] as const;

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  const normalizedSource = {
    ...source,
    S3_BUCKET: source.S3_BUCKET || source.TIGRIS_STORAGE_BUCKET,
    S3_ACCESS_KEY: source.S3_ACCESS_KEY || source.TIGRIS_STORAGE_ACCESS_KEY_ID,
    S3_SECRET_KEY: source.S3_SECRET_KEY || source.TIGRIS_STORAGE_SECRET_ACCESS_KEY,
  };
  const result = environmentSchema.safeParse(normalizedSource);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Konfigurasi environment tidak valid: ${problems}`);
  }

  if (result.data.NODE_ENV === "production") {
    assertProductionEnvironment(normalizedSource, result.data);
  }

  return result.data;
}

function assertProductionEnvironment(
  source: NodeJS.ProcessEnv,
  environment: Environment,
): void {
  const missingVariables = productionRequiredVariables.filter(
    (variableName) => !source[variableName]?.trim(),
  );
  if (missingVariables.length > 0) {
    throw new Error(
      `Konfigurasi production belum lengkap: ${missingVariables.join(", ")}`,
    );
  }
  if (environment.DATABASE_SSL_MODE !== "required") {
    throw new Error("DATABASE_SSL_MODE harus 'required' pada production.");
  }
  if (environment.S3_MANAGE_BUCKET) {
    throw new Error("S3_MANAGE_BUCKET harus 'false' pada production.");
  }
}
