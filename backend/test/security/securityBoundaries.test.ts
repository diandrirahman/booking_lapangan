import { Router } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { loadEnvironment } from "../../src/config/environment.js";
import { formatPublicId } from "../../src/database/ids.js";
import { ApiError } from "../../src/http/ApiError.js";
import type { FinanceService } from "../../src/finance/FinanceService.js";
import { createFinanceRouter } from "../../src/finance/financeRouter.js";
import { SessionStoreUnavailableError } from "../../src/identity/auth/domain.js";
import { requireSession } from "../../src/identity/auth/sessionMiddleware.js";
import { PaymentService } from "../../src/payment/application/PaymentService.js";
import { createPaymentRouter } from "../../src/payment/http/paymentRouter.js";
import type { AdminOperationsService } from "../../src/platform/admin/AdminOperationsService.js";
import { createAdminOperationsRouter } from "../../src/platform/admin/adminOperationsRouter.js";
import type { TenantAuthorizationService } from "../../src/tenant/authorization/TenantAuthorizationService.js";
import type { TenantService } from "../../src/tenant/application/TenantService.js";
import { createTenantRouter } from "../../src/tenant/http/tenantRouter.js";
import type { MediaService } from "../../src/venue/media/MediaService.js";
import {
  hasExpectedImageSignature,
  ObjectStorageService,
} from "../../src/venue/media/ObjectStorageService.js";
import { createMediaRouter } from "../../src/venue/media/mediaRouter.js";

const environment = loadEnvironment({
  NODE_ENV: "test",
  APP_ORIGIN: "http://trusted.local",
  MIDTRANS_SERVER_KEY: "sandbox-server-key",
});

describe("security boundaries", () => {
  it("mengembalikan 413 untuk JSON di atas batas satu megabyte", async () => {
    const router = Router();
    router.post("/json-boundary", (_request, response) => response.status(204).end());
    const app = createApp({
      environment,
      readinessCheck: () => Promise.resolve(),
      routers: [router],
    });

    const response = await request(app)
      .post("/api/v1/json-boundary")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ value: "x".repeat(1024 * 1024) }));

    expect(response.status).toBe(413);
    expect(response.body).toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
    expect(response.body.requestId).toEqual(expect.any(String));
  });

  it("tetap memproses JSON yang berada di bawah batas", async () => {
    const router = Router();
    router.post("/json-boundary", (_request, response) => response.status(204).end());
    const app = createApp({
      environment,
      readinessCheck: () => Promise.resolve(),
      routers: [router],
    });

    const response = await request(app)
      .post("/api/v1/json-boundary")
      .set("Content-Type", "application/json")
      .send({ value: "small" });

    expect(response.status).toBe(204);
  });

  it("menolak write dari origin yang tidak dipercaya", async () => {
    const router = Router();
    router.post("/protected-write", (_request, response) => response.status(204).end());
    const app = createApp({
      environment: { ...environment, NODE_ENV: "development" },
      readinessCheck: () => Promise.resolve(),
      routers: [router],
    });
    const response = await request(app)
      .post("/api/v1/protected-write")
      .set("Origin", "http://attacker.local");
    expect(response.status).toBe(403);
    expect(response.body.code).toBe("ORIGIN_NOT_ALLOWED");
  });

  it("menolak webhook dengan signature salah sebelum menyentuh database", async () => {
    const service = new PaymentService({} as never, {} as never, environment);
    await expect(
      service.processWebhook({
        eventId: "event-1",
        attemptId: "attempt-1",
        transactionStatus: "settlement",
        statusCode: "200",
        grossAmount: "100000",
        signatureKey: "invalid",
      }),
    ).rejects.toMatchObject({ statusCode: 401, code: "INVALID_WEBHOOK_SIGNATURE" });
  });

  it("melewatkan webhook Midtrans tanpa Origin ke verifikasi signature", async () => {
    const processWebhook = vi
      .fn()
      .mockRejectedValue(
        new ApiError(401, "INVALID_WEBHOOK_SIGNATURE", "Signature tidak valid."),
      );
    const app = createApp({
      environment: { ...environment, NODE_ENV: "development" },
      readinessCheck: () => Promise.resolve(),
      routers: [createPaymentRouter({ processWebhook } as unknown as PaymentService)],
    });
    const response = await request(app)
      .post("/api/v1/payments/webhooks/midtrans")
      .send({
        transaction_id: "event-security-1",
        order_id: "PAY-1234567890123456",
        transaction_status: "settlement",
        status_code: "200",
        gross_amount: "100000",
        signature_key: "invalid",
      });
    expect(response.status).toBe(401);
    expect(response.body.code).toBe("INVALID_WEBHOOK_SIGNATURE");
    expect(processWebhook).toHaveBeenCalledOnce();
  });

  it("menolak signed upload dengan MIME type di luar allowlist", async () => {
    const storage = new ObjectStorageService(environment);
    await expect(
      storage.createSignedUpload(
        "user-1",
        "tenant-1",
        "venue-1",
        "payload.exe",
        "application/octet-stream",
        100,
      ),
    ).rejects.toMatchObject({ statusCode: 422, code: "UNSUPPORTED_MEDIA_TYPE" });
  });

  it("menolak ekstensi executable yang mengaku sebagai WebP", async () => {
    const storage = new ObjectStorageService(environment);
    await expect(
      storage.createSignedUpload(
        "user-1",
        "tenant-1",
        "venue-1",
        "payload.exe",
        "image/webp",
        100,
      ),
    ).rejects.toMatchObject({ statusCode: 422, code: "UPLOAD_EXTENSION_MISMATCH" });
  });

  it("memeriksa magic bytes untuk WebP, JPEG, dan PNG", () => {
    expect(
      hasExpectedImageSignature(
        Buffer.from("524946460000000057454250", "hex"),
        "image/webp",
      ),
    ).toBe(true);
    expect(
      hasExpectedImageSignature(Buffer.from("ffd8ff00", "hex"), "image/jpeg"),
    ).toBe(true);
    expect(
      hasExpectedImageSignature(Buffer.from("89504e470d0a1a0a", "hex"), "image/png"),
    ).toBe(true);
    expect(
      hasExpectedImageSignature(Buffer.from("4d5a9000", "hex"), "image/webp"),
    ).toBe(false);
  });

  it("menolak Customer sebelum membuat signed URL venue", async () => {
    const requirePermission = vi
      .fn()
      .mockRejectedValue(new ApiError(403, "OWNER_REQUIRED", "Owner diperlukan."));
    const createVenueUpload = vi.fn();
    const app = createApp({
      environment,
      readinessCheck: () => Promise.resolve(),
      sessionStore: {
        create: vi.fn(),
        revoke: vi.fn(),
        findByToken: vi.fn().mockResolvedValue({
          id: "session-security",
          userId: formatPublicId(1),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      },
      routers: [
        createMediaRouter(
          { createVenueUpload } as unknown as MediaService,
          { requirePermission } as unknown as TenantAuthorizationService,
        ),
      ],
    });
    const response = await request(app)
      .post(`/api/v1/business/venues/${formatPublicId(2)}/media/signed-upload`)
      .set("Origin", environment.APP_ORIGIN)
      .set("Cookie", `${environment.SESSION_COOKIE_NAME}=customer-token`)
      .send({
        tenantId: formatPublicId(3),
        fileName: "venue.webp",
        mimeType: "image/webp",
        byteSize: 100,
      });
    expect(response.status).toBe(403);
    expect(createVenueUpload).not.toHaveBeenCalled();
  });

  it("mengalihkan media publik ke URL download bertanda tangan", async () => {
    const createPublicDownloadUrl = vi
      .fn()
      .mockResolvedValue("https://storage.example.test/signed-media");
    const app = createApp({
      environment,
      readinessCheck: () => Promise.resolve(),
      routers: [
        createMediaRouter(
          { createPublicDownloadUrl } as unknown as MediaService,
          {} as TenantAuthorizationService,
        ),
      ],
    });
    const response = await request(app)
      .get("/api/v1/media")
      .query({ key: "uploads/tenant/venue/user/media.webp" });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("https://storage.example.test/signed-media");
    expect(response.headers["cache-control"]).toBe("public, max-age=300");
    expect(createPublicDownloadUrl).toHaveBeenCalledWith(
      "uploads/tenant/venue/user/media.webp",
    );
  });

  it("menjaga public REST hidup dan protected REST 503 saat session Redis gagal", async () => {
    const router = Router();
    router.get("/public", (_request, response) => response.json({ ok: true }));
    router.get("/protected", requireSession, (_request, response) =>
      response.json({ ok: true }),
    );
    const app = createApp({
      environment,
      readinessCheck: () => Promise.resolve(),
      sessionStore: {
        create: vi.fn(),
        revoke: vi.fn(),
        findByToken: vi.fn().mockRejectedValue(new SessionStoreUnavailableError()),
      },
      routers: [router],
    });
    const cookie = `${environment.SESSION_COOKIE_NAME}=stale-token`;
    const publicResponse = await request(app)
      .get("/api/v1/public")
      .set("Cookie", cookie);
    const protectedResponse = await request(app)
      .get("/api/v1/protected")
      .set("Cookie", cookie);
    expect(publicResponse.status).toBe(200);
    expect(protectedResponse.status).toBe(503);
    expect(protectedResponse.body.code).toBe("SESSION_STORE_UNAVAILABLE");
  });

  it("menolak audit platform untuk akun non-Admin", async () => {
    const listAudit = vi.fn();
    const requirePlatformAdmin = vi
      .fn()
      .mockRejectedValue(
        new ApiError(403, "PLATFORM_ADMIN_REQUIRED", "Admin diperlukan."),
      );
    const app = createApp({
      environment,
      readinessCheck: () => Promise.resolve(),
      sessionStore: {
        create: vi.fn(),
        revoke: vi.fn(),
        findByToken: vi.fn().mockResolvedValue({
          id: "customer-session",
          userId: formatPublicId(1),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      },
      routers: [
        createAdminOperationsRouter(
          { listAudit } as unknown as AdminOperationsService,
          { requirePlatformAdmin } as unknown as TenantAuthorizationService,
        ),
      ],
    });
    const response = await request(app)
      .get("/api/v1/admin/audit")
      .set("Cookie", `${environment.SESSION_COOKIE_NAME}=customer-token`);
    expect(response.status).toBe(403);
    expect(listAudit).not.toHaveBeenCalled();
  });

  it("menolak funding PLATFORM pada endpoint promo bisnis", async () => {
    const createPromotion = vi.fn();
    const requirePermission = vi.fn();
    const app = createApp({
      environment,
      readinessCheck: () => Promise.resolve(),
      sessionStore: {
        create: vi.fn(),
        revoke: vi.fn(),
        findByToken: vi.fn().mockResolvedValue({
          id: "owner-session",
          userId: formatPublicId(1),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      },
      routers: [
        createFinanceRouter(
          { createPromotion } as unknown as FinanceService,
          { requirePermission } as unknown as TenantAuthorizationService,
        ),
      ],
    });

    const response = await request(app)
      .post("/api/v1/business/promotions")
      .set("Origin", environment.APP_ORIGIN)
      .set("Cookie", `${environment.SESSION_COOKIE_NAME}=owner-token`)
      .set("Idempotency-Key", "forged-platform-promotion")
      .send({
        tenantId: formatPublicId(1),
        code: "FORGEDPLATFORM",
        name: "Forged platform promotion",
        discountType: "PERCENT",
        discountValue: 1_000,
        startsAt: "2026-08-30T00:00:00.000Z",
        endsAt: "2026-09-30T00:00:00.000Z",
        fundingSource: "PLATFORM",
      });

    expect(response.status).toBe(422);
    expect(createPromotion).not.toHaveBeenCalled();
    expect(requirePermission).not.toHaveBeenCalled();
  });

  it("meneruskan assignment Staff saat membaca promo bisnis", async () => {
    const assignedVenueIds = [formatPublicId(1)];
    const listPromotions = vi.fn().mockResolvedValue([]);
    const requirePermission = vi.fn().mockResolvedValue({
      role: "STAFF",
      assignedVenueIds,
    });
    const app = createApp({
      environment,
      readinessCheck: () => Promise.resolve(),
      sessionStore: {
        create: vi.fn(),
        revoke: vi.fn(),
        findByToken: vi.fn().mockResolvedValue({
          id: "staff-session",
          userId: formatPublicId(200),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      },
      routers: [
        createFinanceRouter(
          { listPromotions } as unknown as FinanceService,
          { requirePermission } as unknown as TenantAuthorizationService,
        ),
      ],
    });

    const response = await request(app)
      .get("/api/v1/business/promotions")
      .query({ tenantId: formatPublicId(1) })
      .set("Cookie", `${environment.SESSION_COOKIE_NAME}=staff-token`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [] });
    expect(listPromotions).toHaveBeenCalledWith(formatPublicId(1), assignedVenueIds);
  });

  it("menolak direct API daftar anggota tanpa permission team.manage", async () => {
    const listMembers = vi.fn();
    const requirePermission = vi
      .fn()
      .mockRejectedValue(
        new ApiError(403, "PERMISSION_REQUIRED", "Permission diperlukan."),
      );
    const app = createApp({
      environment,
      readinessCheck: () => Promise.resolve(),
      sessionStore: {
        create: vi.fn(),
        revoke: vi.fn(),
        findByToken: vi.fn().mockResolvedValue({
          id: "staff-session",
          userId: formatPublicId(200),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      },
      routers: [
        createTenantRouter(
          { listMembers } as unknown as TenantService,
          { requirePermission } as unknown as TenantAuthorizationService,
        ),
      ],
    });

    const response = await request(app)
      .get(`/api/v1/business/tenants/${formatPublicId(1)}/members`)
      .set("Cookie", `${environment.SESSION_COOKIE_NAME}=staff-token`);

    expect(response.status).toBe(403);
    expect(requirePermission).toHaveBeenCalledWith(
      formatPublicId(200),
      formatPublicId(1),
      "team.manage",
    );
    expect(listMembers).not.toHaveBeenCalled();
  });

  it("menolak daftar anggota tenant lain sebelum read model dipanggil", async () => {
    const listMembers = vi.fn();
    const requirePermission = vi
      .fn()
      .mockRejectedValue(
        new ApiError(403, "TENANT_ACCESS_DENIED", "Tenant tidak dapat diakses."),
      );
    const app = createApp({
      environment,
      readinessCheck: () => Promise.resolve(),
      sessionStore: {
        create: vi.fn(),
        revoke: vi.fn(),
        findByToken: vi.fn().mockResolvedValue({
          id: "staff-session",
          userId: formatPublicId(200),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      },
      routers: [
        createTenantRouter(
          { listMembers } as unknown as TenantService,
          { requirePermission } as unknown as TenantAuthorizationService,
        ),
      ],
    });

    const foreignTenantId = formatPublicId(2);
    const response = await request(app)
      .get(`/api/v1/business/tenants/${foreignTenantId}/members`)
      .set("Cookie", `${environment.SESSION_COOKIE_NAME}=staff-token`);

    expect(response.status).toBe(403);
    expect(requirePermission).toHaveBeenCalledWith(
      formatPublicId(200),
      foreignTenantId,
      "team.manage",
    );
    expect(listMembers).not.toHaveBeenCalled();
  });

  it("mengizinkan daftar anggota setelah permission team.manage lulus", async () => {
    const listMembers = vi.fn().mockResolvedValue([{ id: "member-1" }]);
    const requirePermission = vi.fn().mockResolvedValue({ role: "OWNER" });
    const app = createApp({
      environment,
      readinessCheck: () => Promise.resolve(),
      sessionStore: {
        create: vi.fn(),
        revoke: vi.fn(),
        findByToken: vi.fn().mockResolvedValue({
          id: "owner-session",
          userId: formatPublicId(1),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      },
      routers: [
        createTenantRouter(
          { listMembers } as unknown as TenantService,
          { requirePermission } as unknown as TenantAuthorizationService,
        ),
      ],
    });

    const response = await request(app)
      .get(`/api/v1/business/tenants/${formatPublicId(1)}/members`)
      .set("Cookie", `${environment.SESSION_COOKIE_NAME}=owner-token`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [{ id: "member-1" }] });
    expect(listMembers).toHaveBeenCalledWith(formatPublicId(1), undefined);
  });

  it("meneruskan venue assignment Staff ke query daftar anggota", async () => {
    const listMembers = vi.fn().mockResolvedValue([]);
    const assignedVenueIds = [formatPublicId(1)];
    const requirePermission = vi.fn().mockResolvedValue({
      role: "STAFF",
      assignedVenueIds,
    });
    const app = createApp({
      environment,
      readinessCheck: () => Promise.resolve(),
      sessionStore: {
        create: vi.fn(),
        revoke: vi.fn(),
        findByToken: vi.fn().mockResolvedValue({
          id: "staff-session",
          userId: formatPublicId(200),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      },
      routers: [
        createTenantRouter(
          { listMembers } as unknown as TenantService,
          { requirePermission } as unknown as TenantAuthorizationService,
        ),
      ],
    });

    const response = await request(app)
      .get(`/api/v1/business/tenants/${formatPublicId(1)}/members`)
      .set("Cookie", `${environment.SESSION_COOKIE_NAME}=staff-token`);

    expect(response.status).toBe(200);
    expect(listMembers).toHaveBeenCalledWith(formatPublicId(1), assignedVenueIds);
  });
});
