import { createApp } from "./app.js";
import { BookingService } from "./booking/application/BookingService.js";
import { createBookingRouter } from "./booking/http/bookingRouter.js";
import { OperationsService } from "./booking/application/OperationsService.js";
import { createOperationsRouter } from "./booking/http/operationsRouter.js";
import { loadEnvironment } from "./config/environment.js";
import { createDatabaseConnection } from "./database/client.js";
import { AuthService } from "./identity/auth/AuthService.js";
import { DrizzleAuthRepository } from "./identity/auth/DrizzleAuthRepository.js";
import { RedisSessionStore } from "./identity/auth/RedisSessionStore.js";
import { createAuthRouter } from "./identity/auth/authRouter.js";
import { GoogleOidcService } from "./identity/auth/GoogleOidcService.js";
import { NotificationService } from "./identity/notifications/NotificationService.js";
import { createNotificationRouter } from "./identity/notifications/notificationRouter.js";
import { PaymentService } from "./payment/application/PaymentService.js";
import { RefundService } from "./payment/application/RefundService.js";
import { createPaymentProvider } from "./payment/application/PaymentProvider.js";
import { createPaymentRouter } from "./payment/http/paymentRouter.js";
import { createRefundRouter } from "./payment/http/refundRouter.js";
import { PricingService } from "./pricing/application/PricingService.js";
import { createPricingRouter } from "./pricing/http/pricingRouter.js";
import { MaintenanceJobs } from "./platform/jobs/MaintenanceJobs.js";
import { createJobsRouter } from "./platform/jobs/jobsRouter.js";
import { createRedisConnection } from "./platform/redis/redisConnection.js";
import { AdminMasterService } from "./platform/admin/AdminMasterService.js";
import { createAdminMasterRouter } from "./platform/admin/adminMasterRouter.js";
import { AdminOperationsService } from "./platform/admin/AdminOperationsService.js";
import { createAdminOperationsRouter } from "./platform/admin/adminOperationsRouter.js";
import { OutboxPublisher } from "./realtime/OutboxPublisher.js";
import { OutboxPoller } from "./realtime/OutboxPoller.js";
import { createRealtimeRouter } from "./realtime/realtimeRouter.js";
import { AvailabilityService } from "./schedule/availability/AvailabilityService.js";
import { createAvailabilityRouter } from "./schedule/availability/availabilityRouter.js";
import { TenantService } from "./tenant/application/TenantService.js";
import { TenantAuthorizationService } from "./tenant/authorization/TenantAuthorizationService.js";
import { createTenantRouter } from "./tenant/http/tenantRouter.js";
import { CatalogService } from "./venue/catalog/CatalogService.js";
import { createCatalogRouter } from "./venue/catalog/catalogRouter.js";
import { VenueSetupService } from "./venue/setup/VenueSetupService.js";
import { createVenueSetupRouter } from "./venue/setup/venueSetupRouter.js";
import { ObjectStorageService } from "./venue/media/ObjectStorageService.js";
import { createMediaRouter } from "./venue/media/mediaRouter.js";
import { MediaService } from "./venue/media/MediaService.js";
import { FinanceService } from "./finance/FinanceService.js";
import { createFinanceRouter } from "./finance/financeRouter.js";
import { ReviewService } from "./review/ReviewService.js";
import { createReviewRouter } from "./review/reviewRouter.js";
import { SupportService } from "./support/SupportService.js";
import { createSupportRouter } from "./support/supportRouter.js";

const environment = loadEnvironment();
const database = createDatabaseConnection(environment);
const redis = createRedisConnection(environment);
try {
  await redis.ping();
} catch (error) {
  console.warn("Redis belum tersedia saat startup; readiness akan degraded.", error);
}
const sessions = new RedisSessionStore(redis.client, environment.SESSION_TTL_SECONDS);
const authService = new AuthService(new DrizzleAuthRepository(database.db), sessions);
const googleOidc = new GoogleOidcService(
  database,
  redis.client,
  authService,
  environment,
);
const authorization = new TenantAuthorizationService(database);
const tenantService = new TenantService(database);
const outboxPublisher = new OutboxPublisher(database, redis.client);
const financeService = new FinanceService(database);
const notificationService = new NotificationService(database);
const bookingService = new BookingService(
  database,
  async () => {
    await outboxPublisher.publishPending();
  },
  financeService,
);
const refundService = new RefundService(database, financeService, notificationService);
const paymentService = new PaymentService(
  database,
  createPaymentProvider(environment),
  environment,
  async () => {
    await outboxPublisher.publishPending();
  },
  financeService,
  refundService,
  notificationService,
);
const outboxPoller = new OutboxPoller(
  outboxPublisher,
  environment.OUTBOX_POLL_INTERVAL_MS,
  (error) => console.error("Outbox publisher gagal; batch akan dicoba ulang.", error),
);
const objectStorage = new ObjectStorageService(environment);
await objectStorage.ensureBucket();
const maintenanceJobs = new MaintenanceJobs(
  database,
  redis.client,
  bookingService,
  paymentService,
  refundService,
  outboxPublisher,
  new MediaService(database, objectStorage),
  financeService,
  notificationService,
);
const app = createApp({
  environment,
  readinessCheck: async () => {
    await Promise.all([database.ping(), redis.ping(), objectStorage.ping()]);
  },
  routers: [
    createAuthRouter({ environment, service: authService, sessions, googleOidc }),
    createNotificationRouter(notificationService, authorization),
    createTenantRouter(tenantService, authorization),
    createCatalogRouter(new CatalogService(database, environment.S3_PUBLIC_BASE_URL)),
    createAvailabilityRouter(new AvailabilityService(database)),
    createBookingRouter(bookingService, authorization, paymentService),
    createOperationsRouter(
      new OperationsService(
        database,
        bookingService,
        async () => {
          await outboxPublisher.publishPending();
        },
        refundService,
        financeService,
      ),
      authorization,
    ),
    createPaymentRouter(paymentService),
    createRefundRouter(refundService, authorization),
    createPricingRouter(new PricingService(database), authorization),
    createVenueSetupRouter(
      new VenueSetupService(database, async () => {
        await outboxPublisher.publishPending();
      }),
      tenantService,
      authorization,
    ),
    createMediaRouter(new MediaService(database, objectStorage), authorization),
    createRealtimeRouter(redis.client, authorization),
    createJobsRouter(maintenanceJobs, environment),
    createAdminMasterRouter(new AdminMasterService(database), authorization),
    createAdminOperationsRouter(new AdminOperationsService(database), authorization),
    createFinanceRouter(financeService, authorization),
    createReviewRouter(new ReviewService(database), authorization),
    createSupportRouter(
      new SupportService(database, notificationService),
      authorization,
    ),
  ],
  sessionStore: sessions,
});

const isVercelRuntime = process.env.VERCEL === "1";
const server = isVercelRuntime
  ? undefined
  : app.listen(environment.PORT, () => {
      console.info(`LapanganGo API aktif di http://localhost:${environment.PORT}`);
      outboxPoller.start();
    });

function shutdown(signal: string): void {
  if (!server) return;
  console.info(`${signal} diterima; menutup API.`);
  outboxPoller.stop();
  server.close(async () => {
    await database.close();
    redis.close();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export default app;
