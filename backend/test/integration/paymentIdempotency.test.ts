import { and, count, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BookingService } from "../../src/booking/application/BookingService.js";
import { loadEnvironment } from "../../src/config/environment.js";
import { formatPublicId } from "../../src/database/ids.js";
import {
  bookingPaymentSummaries,
  bookings,
  paymentAttempts,
  paymentProviderEvents,
} from "../../src/database/schema/index.js";
import { PaymentService } from "../../src/payment/application/PaymentService.js";
import { SandboxMidtransProvider } from "../../src/payment/application/PaymentProvider.js";
import {
  removeBooking,
  removeBookingsForSlot,
  testDatabase,
} from "../support/databaseTestHarness.js";

const DATABASE_SLOT_ID = "10100";
const TEST_NOW = new Date("2026-08-27T00:00:00Z");
const CUSTOMER_USER_ID = formatPublicId(100);

let bookingReference = "";
let attemptReference = "";
let attemptDatabaseId = 0;
let attemptAmount = 0;
let paidBefore = 0;

const paymentService = new PaymentService(
  testDatabase,
  new SandboxMidtransProvider("http://localhost:5173"),
  loadEnvironment({ NODE_ENV: "test" }),
);

describe("payment webhook idempotency", () => {
  beforeAll(async () => {
    await removeBookingsForSlot(DATABASE_SLOT_ID);
    const booking = await new BookingService(testDatabase).create(
      {
        venueId: formatPublicId(1),
        courtId: formatPublicId(1),
        slotIds: [formatPublicId(Number(DATABASE_SLOT_ID))],
        paymentMode: "FULL",
      },
      CUSTOMER_USER_ID,
      `payment-idempotency-${Date.now()}`,
      TEST_NOW,
    );
    bookingReference = booking.id;
    const attempt = await paymentService.createAttempt(
      booking.id,
      CUSTOMER_USER_ID,
      "FULL",
      `payment-attempt-${Date.now()}`,
      TEST_NOW,
    );
    attemptReference = attempt.id;
    attemptAmount = attempt.amount;

    const [attemptRow] = await testDatabase.db
      .select({ id: paymentAttempts.id, bookingId: paymentAttempts.bookingId })
      .from(paymentAttempts)
      .where(eq(paymentAttempts.paymentCode, attempt.id))
      .limit(1);
    const [summary] = await testDatabase.db
      .select({ totalPaid: bookingPaymentSummaries.totalPaid })
      .from(bookingPaymentSummaries)
      .where(eq(bookingPaymentSummaries.bookingId, attemptRow!.bookingId))
      .limit(1);
    attemptDatabaseId = attemptRow!.id;
    paidBefore = summary?.totalPaid ?? 0;
  });

  it("tidak menggandakan pembayaran dari settlement berulang", async () => {
    const baseWebhook = {
      attemptId: attemptReference,
      transactionStatus: "settlement" as const,
      statusCode: "200",
      grossAmount: String(attemptAmount),
      signatureKey: "sandbox-local",
    };

    await paymentService.processWebhook({
      ...baseWebhook,
      eventId: "qa-settlement-1",
    });
    await paymentService.processWebhook({
      ...baseWebhook,
      eventId: "qa-settlement-2",
    });

    const [attempt] = await testDatabase.db
      .select({ bookingId: paymentAttempts.bookingId })
      .from(paymentAttempts)
      .where(eq(paymentAttempts.id, attemptDatabaseId))
      .limit(1);
    const [summary] = await testDatabase.db
      .select({ totalPaid: bookingPaymentSummaries.totalPaid })
      .from(bookingPaymentSummaries)
      .where(eq(bookingPaymentSummaries.bookingId, attempt!.bookingId))
      .limit(1);
    const [inbox] = await testDatabase.db
      .select({ total: count() })
      .from(paymentProviderEvents)
      .where(
        and(
          eq(paymentProviderEvents.paymentAttemptId, attemptDatabaseId),
          eq(paymentProviderEvents.signatureVerified, true),
        ),
      );

    expect(summary?.totalPaid).toBe(paidBefore + attemptAmount);
    expect(inbox?.total).toBe(2);
  });

  it("menolak nominal webhook yang berbeda dari attempt lokal", async () => {
    await expect(
      paymentService.processWebhook({
        eventId: "qa-wrong-amount",
        attemptId: attemptReference,
        transactionStatus: "settlement",
        statusCode: "200",
        grossAmount: String(attemptAmount + 1),
        signatureKey: "sandbox-local",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "PAYMENT_AMOUNT_MISMATCH",
    });
  });
});

afterAll(async () => {
  if (bookingReference) await removeBookingByReference(bookingReference);
  await testDatabase.close();
});

async function removeBookingByReference(reference: string): Promise<void> {
  const [booking] = await testDatabase.db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.bookingCode, reference))
    .limit(1);
  if (booking) await removeBooking(String(booking.id));
}
