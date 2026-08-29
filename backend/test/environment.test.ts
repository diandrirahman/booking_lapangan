import { describe, expect, it } from "vitest";
import { loadEnvironment } from "../src/config/environment.js";

const productionEnvironment = {
  NODE_ENV: "production",
  APP_ORIGIN: "https://lapangango.example",
  DATABASE_URL: "mysql://user:secret@database.example/lapangango",
  DATABASE_SSL_MODE: "required",
  REDIS_URL: "rediss://redis.example",
  SESSION_SECRET: "session-secret-with-at-least-32-characters",
  RESOURCE_ID_SECRET: "resource-secret-with-at-least-32-characters",
  CRON_SECRET: "cron-secret-with-at-least-16-characters",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  GOOGLE_REDIRECT_URI: "https://lapangango.example/api/v1/auth/google/callback",
  MIDTRANS_SERVER_KEY: "midtrans-server-key",
  MIDTRANS_CLIENT_KEY: "midtrans-client-key",
  S3_ENDPOINT: "https://t3.storage.dev",
  S3_REGION: "auto",
  S3_BUCKET: "lapangango-demo",
  S3_ACCESS_KEY: "tigris-access-key",
  S3_SECRET_KEY: "tigris-secret-key",
  S3_MANAGE_BUCKET: "false",
} satisfies NodeJS.ProcessEnv;

describe("production environment", () => {
  it("menolak dependency production yang tidak dikonfigurasi", () => {
    expect(() => loadEnvironment({ NODE_ENV: "production" })).toThrow(/DATABASE_URL/);
  });

  it("mewajibkan TLS database dan melarang pembuatan bucket saat runtime", () => {
    expect(() =>
      loadEnvironment({ ...productionEnvironment, DATABASE_SSL_MODE: "disabled" }),
    ).toThrow(/DATABASE_SSL_MODE/);
    expect(() =>
      loadEnvironment({ ...productionEnvironment, S3_MANAGE_BUCKET: "true" }),
    ).toThrow(/S3_MANAGE_BUCKET/);
  });

  it("menerima konfigurasi demo yang lengkap", () => {
    expect(loadEnvironment(productionEnvironment).NODE_ENV).toBe("production");
  });

  it("menerima nama environment bawaan integrasi Tigris Vercel", () => {
    const {
      S3_BUCKET,
      S3_ACCESS_KEY,
      S3_SECRET_KEY,
      ...environmentWithoutS3Credentials
    } = productionEnvironment;
    const environment = loadEnvironment({
      ...environmentWithoutS3Credentials,
      TIGRIS_STORAGE_BUCKET: S3_BUCKET,
      TIGRIS_STORAGE_ACCESS_KEY_ID: S3_ACCESS_KEY,
      TIGRIS_STORAGE_SECRET_ACCESS_KEY: S3_SECRET_KEY,
    });

    expect(environment.S3_BUCKET).toBe(S3_BUCKET);
    expect(environment.S3_ACCESS_KEY).toBe(S3_ACCESS_KEY);
    expect(environment.S3_SECRET_KEY).toBe(S3_SECRET_KEY);
  });
});
