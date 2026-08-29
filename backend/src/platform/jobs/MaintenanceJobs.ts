import { and, eq, lte, or } from "drizzle-orm";
import type { Redis } from "ioredis";
import type { BookingService } from "../../booking/application/BookingService.js";
import type { DatabaseConnection } from "../../database/client.js";
import { formatPublicId } from "../../database/ids.js";
import { bookings } from "../../database/schema/index.js";
import type { OutboxPublisher } from "../../realtime/OutboxPublisher.js";
import type { PaymentService } from "../../payment/application/PaymentService.js";
import type { RefundService } from "../../payment/application/RefundService.js";
import { ApiError } from "../../http/ApiError.js";
import type { MediaService } from "../../venue/media/MediaService.js";

const JOB_LOCK_SECONDS = 55;

export class MaintenanceJobs {
  constructor(
    private readonly database: DatabaseConnection,
    private readonly redis: Redis,
    private readonly bookingsService: BookingService,
    private readonly paymentService: PaymentService,
    private readonly refundService: RefundService,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly mediaService: MediaService,
  ) {}

  async run(): Promise<{
    skipped: boolean;
    expired: number;
    published: number;
    failed: number;
    refunded: number;
    balanceCancelled: number;
    orphanUploadsDeleted: number;
  }> {
    const lockToken = `${process.pid}:${Date.now()}`;
    let acquired: unknown;
    try {
      acquired = await this.redis.set(
        "lapangango:jobs:maintenance",
        lockToken,
        "EX",
        JOB_LOCK_SECONDS,
        "NX",
      );
    } catch (error) {
      throw new ApiError(
        503,
        "COORDINATION_UNAVAILABLE",
        "Koordinasi maintenance sedang tidak tersedia.",
        { cause: error instanceof Error ? error.message : "Redis unavailable" },
      );
    }
    if (!acquired)
      return {
        skipped: true,
        expired: 0,
        refunded: 0,
        balanceCancelled: 0,
        published: 0,
        failed: 0,
        orphanUploadsDeleted: 0,
      };

    try {
      const expired = await this.expireHolds();
      const balanceCancelled = await this.paymentService.cancelOverdueBalances();
      const refunded = await this.refundService.completePendingBatch();
      const publishResult = await this.outboxPublisher.publishPending();
      const orphanUploadsDeleted = await this.mediaService.cleanupOrphanUploads();
      return {
        skipped: false,
        expired,
        refunded,
        balanceCancelled,
        orphanUploadsDeleted,
        ...publishResult,
      };
    } finally {
      try {
        const currentToken = await this.redis.get("lapangango:jobs:maintenance");
        if (currentToken === lockToken)
          await this.redis.del("lapangango:jobs:maintenance");
      } catch {
        // The lock expires automatically; a Redis outage must not mask completed work.
      }
    }
  }

  private async expireHolds(now = new Date()): Promise<number> {
    const expiredBookings = await this.database.db
      .select({
        bookingReference: bookings.bookingCode,
        actorUserId: bookings.createdByUserId,
      })
      .from(bookings)
      .where(
        or(
          and(eq(bookings.status, "HOLD"), lte(bookings.holdExpiresAt, now)),
          and(
            eq(bookings.status, "PENDING_CONFIRMATION"),
            lte(bookings.confirmationExpiresAt, now),
          ),
        ),
      )
      .limit(100);
    for (const booking of expiredBookings) {
      const confirmationCancelled =
        await this.paymentService.cancelTimedOutConfirmation(
          booking.bookingReference,
          now,
        );
      if (!confirmationCancelled) {
        await this.bookingsService.transition(
          booking.bookingReference,
          "EXPIRED",
          formatPublicId(booking.actorUserId),
          "Cleanup hold kedaluwarsa",
        );
      }
    }
    return expiredBookings.length;
  }
}
