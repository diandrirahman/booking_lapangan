import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { BookingService } from "../../src/booking/application/BookingService.js";
import { loadEnvironment } from "../../src/config/environment.js";
import { formatPublicId } from "../../src/database/ids.js";
import {
  bookingPaymentSummaries,
  bookings,
  refunds,
} from "../../src/database/schema/index.js";
import { PaymentService } from "../../src/payment/application/PaymentService.js";
import { SandboxMidtransProvider } from "../../src/payment/application/PaymentProvider.js";
import { RefundService } from "../../src/payment/application/RefundService.js";
import {
  removeBooking,
  removeBookingsForSlot,
  testDatabase,
} from "../support/databaseTestHarness.js";

const CUSTOMER_USER_ID = formatPublicId(100);
const TEST_NOW = new Date("2026-08-27T00:00:00Z");

const bookingService = new BookingService(testDatabase);
const paymentService = new PaymentService(
  testDatabase,
  new SandboxMidtransProvider("http://localhost:5173"),
  loadEnvironment({ NODE_ENV: "test" }),
);

describe("payment lifecycle integration", () => {
  it("mencatat DP lalu pelunasan sebagai attempt terpisah", async () => {
    const booking = await createBooking("10105", "DP");
    const downPayment = await paymentService.createAttempt(
      booking.id,
      CUSTOMER_USER_ID,
      "DP",
      `dp-${Date.now()}`,
      TEST_NOW,
    );

    expect(downPayment.amount).toBe(42_500);
    await settleAttempt(downPayment.id, downPayment.amount, "dp");

    const afterDownPayment = await getBookingState(booking.id);
    expect(afterDownPayment).toMatchObject({
      status: "CONFIRMED",
      balanceDue: 42_500,
      paymentStatus: "PARTIALLY_PAID",
    });

    const balancePayment = await paymentService.createAttempt(
      booking.id,
      CUSTOMER_USER_ID,
      "BALANCE",
      `balance-${Date.now()}`,
      TEST_NOW,
    );
    expect(balancePayment.amount).toBe(42_500);
    await settleAttempt(balancePayment.id, balancePayment.amount, "balance");

    expect(await getBookingState(booking.id)).toMatchObject({
      status: "CONFIRMED",
      balanceDue: 0,
      paymentStatus: "PAID",
    });
    await removeBookingByReference(booking.id);
  });

  it("menahan pay-at-venue sampai Owner mengonfirmasi", async () => {
    const booking = await createBooking("10106", "PAY_AT_VENUE");
    const reservationPayment = await paymentService.createAttempt(
      booking.id,
      CUSTOMER_USER_ID,
      "RESERVATION",
      `reservation-${Date.now()}`,
      TEST_NOW,
    );

    expect(booking.status).toBe("HOLD");
    expect(reservationPayment.amount).toBe(50_000);
    await settleAttempt(
      reservationPayment.id,
      reservationPayment.amount,
      "reservation",
    );
    expect(await getBookingState(booking.id)).toMatchObject({
      status: "PENDING_CONFIRMATION",
      balanceDue: 35_000,
      paymentStatus: "PARTIALLY_PAID",
    });

    await paymentService.rejectPendingConfirmation(
      booking.id,
      formatPublicId(1),
      "Lapangan ditutup untuk pemeliharaan.",
      TEST_NOW,
    );
    const [refund] = await testDatabase.db
      .select({
        id: refunds.id,
        amount: refunds.amount,
        kind: refunds.kind,
        status: refunds.status,
      })
      .from(refunds)
      .innerJoin(bookings, eq(bookings.id, refunds.bookingId))
      .where(eq(bookings.bookingCode, booking.id))
      .limit(1);

    expect(await getBookingState(booking.id)).toMatchObject({ status: "CANCELLED" });
    expect(refund).toMatchObject({
      amount: 50_000,
      kind: "CONFIRMATION_REJECTED",
      status: "PENDING",
    });
    if (!refund) throw new Error("Refund reservation tidak tersimpan.");
    await new RefundService(testDatabase).completeSandboxRefund(refund.id, TEST_NOW);
    expect(await getBookingState(booking.id)).toMatchObject({
      paymentStatus: "REFUNDED",
      totalRefunded: 50_000,
    });
    await removeBookingByReference(booking.id);
  });

  it("menolak pelunasan lewat deadline lalu membatalkan setelah grace period", async () => {
    const booking = await createBookingForCourt("10205", 2, "DP");
    const downPayment = await paymentService.createAttempt(
      booking.id,
      CUSTOMER_USER_ID,
      "DP",
      `deadline-dp-${Date.now()}`,
      TEST_NOW,
    );
    await settleAttempt(downPayment.id, downPayment.amount, "deadline-dp");
    const afterDeadline = new Date("2026-08-29T00:00:00Z");

    await expect(
      paymentService.createAttempt(
        booking.id,
        CUSTOMER_USER_ID,
        "BALANCE",
        `late-balance-${Date.now()}`,
        afterDeadline,
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "BALANCE_PAYMENT_DEADLINE_PASSED",
    });
    await expect(
      paymentService.cancelOverdueBalance(booking.id, afterDeadline),
    ).resolves.toBe(true);
    expect(await getBookingState(booking.id)).toMatchObject({ status: "CANCELLED" });
    const [refund] = await testDatabase.db
      .select({ amount: refunds.amount, kind: refunds.kind })
      .from(refunds)
      .innerJoin(bookings, eq(bookings.id, refunds.bookingId))
      .where(eq(bookings.bookingCode, booking.id))
      .limit(1);
    expect(refund).toEqual({ amount: downPayment.amount, kind: "BALANCE_TIMEOUT" });
    await removeBookingByReference(booking.id);
  });

  it("tidak menghidupkan booking expired ketika payment terlambat", async () => {
    const booking = await createBookingForCourt("10206", 2, "DP");
    const attempt = await paymentService.createAttempt(
      booking.id,
      CUSTOMER_USER_ID,
      "DP",
      `late-payment-attempt-${Date.now()}`,
      TEST_NOW,
    );
    await bookingService.transition(
      booking.id,
      "EXPIRED",
      CUSTOMER_USER_ID,
      "Hold melewati batas server",
    );
    await settleAttempt(attempt.id, attempt.amount, "late-payment");

    expect(await getBookingState(booking.id)).toMatchObject({ status: "EXPIRED" });
    const [refund] = await testDatabase.db
      .select({ amount: refunds.amount, kind: refunds.kind, status: refunds.status })
      .from(refunds)
      .innerJoin(bookings, eq(bookings.id, refunds.bookingId))
      .where(eq(bookings.bookingCode, booking.id))
      .limit(1);
    expect(refund).toEqual({
      amount: attempt.amount,
      kind: "AUTOMATIC_LATE_PAYMENT",
      status: "PENDING",
    });
    await removeBookingByReference(booking.id);
  });
});

async function createBooking(
  slotDatabaseId: string,
  paymentMode: "DP" | "PAY_AT_VENUE",
) {
  await removeBookingsForSlot(slotDatabaseId);
  return bookingService.create(
    {
      venueId: formatPublicId(1),
      courtId: formatPublicId(1),
      slotIds: [formatPublicId(Number(slotDatabaseId))],
      paymentMode,
    },
    CUSTOMER_USER_ID,
    `${paymentMode.toLowerCase()}-${Date.now()}-${slotDatabaseId}`,
    TEST_NOW,
  );
}

async function createBookingForCourt(
  slotDatabaseId: string,
  courtDatabaseId: number,
  paymentMode: "DP" | "PAY_AT_VENUE",
) {
  await removeBookingsForSlot(slotDatabaseId);
  return bookingService.create(
    {
      venueId: formatPublicId(1),
      courtId: formatPublicId(courtDatabaseId),
      slotIds: [formatPublicId(Number(slotDatabaseId))],
      paymentMode,
    },
    CUSTOMER_USER_ID,
    `${paymentMode.toLowerCase()}-${Date.now()}-${slotDatabaseId}`,
    TEST_NOW,
  );
}

async function settleAttempt(
  attemptId: string,
  amount: number,
  eventSuffix: string,
): Promise<void> {
  await paymentService.processWebhook({
    eventId: `payment-lifecycle-${eventSuffix}-${Date.now()}`,
    attemptId,
    transactionStatus: "settlement",
    statusCode: "200",
    grossAmount: String(amount),
    signatureKey: "sandbox-local",
  });
}

async function getBookingState(reference: string): Promise<{
  status: string;
  balanceDue: number;
  paymentStatus: string;
  totalRefunded: number;
}> {
  const [result] = await testDatabase.db
    .select({
      status: bookings.status,
      balanceDue: bookings.balanceDue,
      paymentStatus: bookingPaymentSummaries.status,
      totalRefunded: bookingPaymentSummaries.totalRefunded,
    })
    .from(bookings)
    .innerJoin(
      bookingPaymentSummaries,
      eq(bookingPaymentSummaries.bookingId, bookings.id),
    )
    .where(eq(bookings.bookingCode, reference))
    .limit(1);
  if (!result) throw new Error("Booking integration tidak ditemukan.");
  return result;
}

async function removeBookingByReference(reference: string): Promise<void> {
  const [booking] = await testDatabase.db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.bookingCode, reference))
    .limit(1);
  if (booking) await removeBooking(String(booking.id));
}

afterAll(async () => testDatabase.close());
