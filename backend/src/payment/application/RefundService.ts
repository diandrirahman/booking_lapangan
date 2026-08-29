import { eq } from "drizzle-orm";
import type { DatabaseConnection } from "../../database/client.js";
import {
  bookingPaymentSummaries,
  bookings,
  outboxEvents,
  refunds,
  refundStateTransitions,
} from "../../database/schema/index.js";

export class RefundService {
  constructor(private readonly database: DatabaseConnection) {}

  async completePendingBatch(limit = 100, now = new Date()): Promise<number> {
    const pendingRefunds = await this.database.db
      .select({ id: refunds.id })
      .from(refunds)
      .where(eq(refunds.status, "PENDING"))
      .limit(limit);
    let completed = 0;
    for (const refund of pendingRefunds) {
      if (await this.completeSandboxRefund(refund.id, now)) completed += 1;
    }
    return completed;
  }

  async completeSandboxRefund(refundId: number, now = new Date()): Promise<boolean> {
    return this.database.db.transaction(async (transaction) => {
      const [refund] = await transaction
        .select()
        .from(refunds)
        .where(eq(refunds.id, refundId))
        .limit(1)
        .for("update");
      if (!refund || refund.status !== "PENDING") return false;

      const [summary] = await transaction
        .select()
        .from(bookingPaymentSummaries)
        .where(eq(bookingPaymentSummaries.bookingId, refund.bookingId))
        .limit(1)
        .for("update");
      if (!summary) throw new Error("Ringkasan pembayaran refund tidak ditemukan.");

      const refundableAmount = summary.totalPaid - summary.totalRefunded;
      if (refund.amount > refundableAmount) {
        await transaction
          .update(refunds)
          .set({ status: "FAILED", updatedAt: now })
          .where(eq(refunds.id, refund.id));
        await transaction.insert(refundStateTransitions).values({
          refundId: refund.id,
          fromStatus: "PENDING",
          toStatus: "FAILED",
          payload: {
            sandbox: true,
            reason: "REFUND_EXCEEDS_SUCCESSFUL_PAID_AMOUNT",
          },
        });
        return false;
      }

      const totalRefunded = summary.totalRefunded + refund.amount;
      const summaryStatus =
        totalRefunded === summary.totalPaid ? "REFUNDED" : "PARTIALLY_REFUNDED";
      await transaction
        .update(refunds)
        .set({
          status: "SUCCEEDED",
          providerReference: `SANDBOX-REFUND-${refund.id}`,
          updatedAt: now,
        })
        .where(eq(refunds.id, refund.id));
      await transaction.insert(refundStateTransitions).values({
        refundId: refund.id,
        fromStatus: "PENDING",
        toStatus: "SUCCEEDED",
        payload: { sandbox: true, occurredAt: now.toISOString() },
      });
      await transaction
        .update(bookingPaymentSummaries)
        .set({ status: summaryStatus, totalRefunded, updatedAt: now })
        .where(eq(bookingPaymentSummaries.bookingId, refund.bookingId));

      const [booking] = await transaction
        .select({ tenantId: bookings.tenantId, version: bookings.version })
        .from(bookings)
        .where(eq(bookings.id, refund.bookingId))
        .limit(1);
      if (booking) {
        await transaction.insert(outboxEvents).values({
          tenantId: booking.tenantId,
          eventType: "refund.status_changed",
          resourceType: "refund",
          resourceId: refund.id,
          resourceVersion: 1,
          payload: { status: "SUCCEEDED", hint: "refetch-booking" },
          occurredAt: now,
        });
      }
      return true;
    });
  }
}
