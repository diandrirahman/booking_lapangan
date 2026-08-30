import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gte, inArray, lt, lte } from "drizzle-orm";
import type { DatabaseConnection } from "../../database/client.js";
import { formatPublicId, parsePublicId } from "../../database/ids.js";
import {
  addonCourts,
  addons,
  auditLogs,
  bookingAddonItems,
  bookingItems,
  bookingPaymentSummaries,
  bookingPriceLines,
  bookingQrTokens,
  bookings,
  bookingSlotHistory,
  bookingSlotReservations,
  bookingStateTransitions,
  commandIdempotency,
  cancellationPolicyTemplates,
  cancellationPolicyTiers,
  courtBookingSettings,
  courtSlots,
  courts,
  offlineBookingDetails,
  outboxEvents,
  priceRules,
  reviews,
  venuePaymentSettings,
  venuePolicyAssignments,
  venues,
} from "../../database/schema/index.js";
import { ApiError } from "../../http/ApiError.js";
import { FinanceService } from "../../finance/FinanceService.js";
import { NotificationService } from "../../identity/notifications/NotificationService.js";
import {
  BOOKING_REFERENCE_PREFIX,
  createPublicReference,
} from "../../security/publicReference.js";
import { datePartsInTimeZone } from "../../schedule/availability/timeZone.js";
import {
  resolvePrice,
  type PriceRuleCandidate,
  type PriceRuleKind,
} from "../../pricing/domain/priceResolver.js";
import {
  assertBookingTransition,
  type BookingStatus,
} from "../domain/bookingStatus.js";
import { validateSlotSelection } from "../domain/slotSelection.js";

const HOLD_DURATION_MILLISECONDS = 10 * 60_000;
const MAX_TRANSACTION_ATTEMPTS = 3;
const noEventPublisher = (): Promise<void> => Promise.resolve();

export type PaymentMode = "FULL" | "DP" | "PAY_AT_VENUE";

export interface CreateBookingInput {
  venueId: string;
  courtId: string;
  slotIds: string[];
  paymentMode: PaymentMode;
  addonIds?: string[] | undefined;
  promotionCode?: string | undefined;
  source?: "ONLINE" | "OFFLINE";
  offlineCustomer?: {
    name: string;
    phone?: string | undefined;
    channel: string;
    adjustedAmount?: number | undefined;
    adjustmentReason?: string | undefined;
  };
}

export interface BookingView {
  id: string;
  venueId: string;
  paymentMode: PaymentMode;
  status: BookingStatus;
  paymentStatus:
    "UNPAID" | "PARTIALLY_PAID" | "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED";
  totalAmount: number;
  balanceDue: number;
  holdExpiresAt: string | null;
  version: number;
}

export interface CustomerBookingSummary extends BookingView {
  courtId: string;
  venueName: string;
  courtName: string;
  startsAt: string;
  endsAt: string;
  reviewId: string | null;
}

export class BookingService {
  constructor(
    private readonly database: DatabaseConnection,
    private readonly publishPendingEvents: () => Promise<void> = noEventPublisher,
    private readonly financeService = new FinanceService(database),
    private readonly notificationService = new NotificationService(database),
  ) {}

  async create(
    input: CreateBookingInput,
    actorUserId: string,
    idempotencyKey: string,
    now = new Date(),
  ): Promise<BookingView> {
    const priorResponse = await this.findIdempotentResponse(
      actorUserId,
      idempotencyKey,
    );
    if (priorResponse) return priorResponse;

    await this.expireStaleReservations(input.slotIds, now);

    const venueDatabaseId = parsePublicId(input.venueId);
    const courtDatabaseId = parsePublicId(input.courtId);
    const slotDatabaseIds = input.slotIds.map(parsePublicId);
    const addonDatabaseIds = [...new Set(input.addonIds ?? [])].map(parsePublicId);
    const actorDatabaseId = parsePublicId(actorUserId);

    let booking: BookingView;
    try {
      booking = await this.withDeadlockRetry(() =>
        this.database.db.transaction(async (transaction) => {
          const [court] = await transaction
            .select({
              venueId: courts.venueId,
              sportId: courts.sportId,
              tenantId: venues.tenantId,
              timezone: venues.timezone,
            })
            .from(courts)
            .innerJoin(venues, eq(venues.id, courts.venueId))
            .where(
              and(eq(courts.id, courtDatabaseId), eq(courts.venueId, venueDatabaseId)),
            )
            .limit(1)
            .for("update");
          if (!court)
            throw new ApiError(
              404,
              "COURT_NOT_FOUND",
              "Lapangan tidak ditemukan pada venue ini.",
            );

          const [settings] = await transaction
            .select()
            .from(courtBookingSettings)
            .where(eq(courtBookingSettings.courtId, courtDatabaseId))
            .limit(1);
          if (!settings)
            throw new ApiError(
              409,
              "BOOKING_SETTINGS_MISSING",
              "Pengaturan booking belum lengkap.",
            );

          const selectedSlots = await transaction
            .select()
            .from(courtSlots)
            .where(
              and(
                eq(courtSlots.courtId, courtDatabaseId),
                inArray(courtSlots.id, slotDatabaseIds),
              ),
            )
            .for("update");
          if (selectedSlots.length !== new Set(input.slotIds).size) {
            throw new ApiError(
              409,
              "SLOT_NOT_FOUND",
              "Sebagian slot tidak lagi tersedia.",
            );
          }
          try {
            validateSlotSelection(selectedSlots, settings);
          } catch (error) {
            throw new ApiError(409, "INVALID_SLOT_SELECTION", messageFrom(error));
          }
          this.validateBookingWindow(selectedSlots[0]!.startsAt, settings, now);

          const [paymentSettings] = await transaction
            .select()
            .from(venuePaymentSettings)
            .where(eq(venuePaymentSettings.venueId, venueDatabaseId))
            .limit(1);
          if (
            !paymentSettings ||
            !isPaymentModeAllowed(input.paymentMode, paymentSettings)
          ) {
            throw new ApiError(
              409,
              "PAYMENT_MODE_NOT_ALLOWED",
              "Metode pembayaran tidak tersedia pada venue ini.",
            );
          }

          const selectedAddons =
            addonDatabaseIds.length === 0
              ? []
              : await transaction
                  .select()
                  .from(addons)
                  .where(
                    and(
                      inArray(addons.id, addonDatabaseIds),
                      eq(addons.venueId, venueDatabaseId),
                      eq(addons.active, true),
                    ),
                  );
          if (selectedAddons.length !== addonDatabaseIds.length) {
            throw new ApiError(
              409,
              "ADDON_NOT_AVAILABLE",
              "Sebagian add-on tidak tersedia pada venue ini.",
            );
          }
          const addonScopes =
            addonDatabaseIds.length === 0
              ? []
              : await transaction
                  .select()
                  .from(addonCourts)
                  .where(inArray(addonCourts.addonId, addonDatabaseIds));
          const unavailableScopedAddon = selectedAddons.find((addon) => {
            const courtScopes = addonScopes.filter(
              (scope) => scope.addonId === addon.id,
            );
            return (
              courtScopes.length > 0 &&
              !courtScopes.some((scope) => scope.courtId === courtDatabaseId)
            );
          });
          if (unavailableScopedAddon) {
            throw new ApiError(
              409,
              "ADDON_NOT_AVAILABLE_FOR_COURT",
              `${unavailableScopedAddon.name} tidak tersedia pada lapangan yang dipilih.`,
            );
          }

          const rules = await transaction
            .select()
            .from(priceRules)
            .where(
              and(eq(priceRules.venueId, venueDatabaseId), eq(priceRules.active, true)),
            );
          const priceCandidates = rules
            .map(toPriceRuleCandidate)
            .filter(isPriceRuleCandidate);
          const slotPrices = selectedSlots.map((slot) => ({
            slot,
            amount: resolvePrice(priceCandidates, {
              courtId: courtDatabaseId,
              ...datePartsInTimeZone(slot.startsAt, court.timezone),
            }).amount,
          }));
          const courtSubtotal = slotPrices.reduce(
            (total, line) => total + line.amount,
            0,
          );
          const addonTotal = selectedAddons.reduce(
            (total, addon) => total + addon.price,
            0,
          );
          const originalAmount = courtSubtotal + addonTotal;
          const adjustedAmount = resolveAdjustedAmount(originalAmount, input);
          const financials = await this.financeService.prepareBookingFinancials(
            transaction,
            {
              tenantId: court.tenantId,
              venueId: venueDatabaseId,
              courtId: courtDatabaseId,
              sportId: court.sportId,
              userId: actorDatabaseId,
              paymentMode: input.paymentMode,
              dpPercentage: paymentSettings.dpPercentage,
              reservationAmount: paymentSettings.reservationAmount,
              courtSubtotal:
                courtSubtotal + Math.max(0, adjustedAmount - originalAmount),
              addonSubtotal: addonTotal,
              promotionCode: input.promotionCode,
              ownerAdjustment: Math.max(0, originalAmount - adjustedAmount),
              timezone: court.timezone,
              now,
            },
          );
          const totalAmount = financials.customerTotal;
          const balanceDue = totalAmount;
          const orderedSelectedSlots = [...selectedSlots].sort(
            (left, right) => left.startsAt.getTime() - right.startsAt.getTime(),
          );
          const selectedEndsAt = orderedSelectedSlots.at(-1)!.endsAt;
          const bufferEndsAt = new Date(
            selectedEndsAt.getTime() + settings.bufferMinutes * 60_000,
          );
          const bufferSlots =
            settings.bufferMinutes === 0
              ? []
              : await transaction
                  .select()
                  .from(courtSlots)
                  .where(
                    and(
                      eq(courtSlots.courtId, courtDatabaseId),
                      gte(courtSlots.startsAt, selectedEndsAt),
                      lt(courtSlots.startsAt, bufferEndsAt),
                    ),
                  )
                  .for("update");
          if (bufferSlots.some((slot) => slot.status !== "OPEN")) {
            throw new ApiError(
              409,
              "BOOKING_BUFFER_UNAVAILABLE",
              "Buffer setelah jadwal bertabrakan dengan slot yang ditutup.",
            );
          }
          const isOfflineBooking = input.source === "OFFLINE";
          const holdExpiresAt = isOfflineBooking
            ? null
            : new Date(now.getTime() + HOLD_DURATION_MILLISECONDS);
          const initialStatus: BookingStatus = isOfflineBooking ? "CONFIRMED" : "HOLD";
          const bookingReference = createPublicReference(BOOKING_REFERENCE_PREFIX);
          const cancellationPolicySnapshot = await resolveCancellationPolicySnapshot(
            transaction,
            venueDatabaseId,
          );

          const [createdBooking] = await transaction
            .insert(bookings)
            .values({
              bookingCode: bookingReference,
              tenantId: court.tenantId,
              venueId: venueDatabaseId,
              customerUserId: input.source === "OFFLINE" ? null : actorDatabaseId,
              source: input.source ?? "ONLINE",
              status: initialStatus,
              paymentMode: input.paymentMode,
              totalAmount,
              balanceDue,
              holdExpiresAt,
              confirmationExpiresAt: null,
              cancellationPolicySnapshot,
              createdByUserId: actorDatabaseId,
            })
            .$returningId();
          if (!createdBooking) throw new Error("MySQL tidak mengembalikan ID booking.");
          const bookingDatabaseId = createdBooking.id;
          await this.financeService.persistBookingFinancials(
            transaction,
            bookingDatabaseId,
            1,
            actorDatabaseId,
            financials,
          );

          const [createdItem] = await transaction
            .insert(bookingItems)
            .values({
              bookingId: bookingDatabaseId,
              courtId: courtDatabaseId,
              startsAt: selectedSlots[0]!.startsAt,
              endsAt: selectedSlots.at(-1)!.endsAt,
              subtotal: courtSubtotal,
            })
            .$returningId();
          if (!createdItem)
            throw new Error("MySQL tidak mengembalikan ID item booking.");
          const bookingItemDatabaseId = createdItem.id;

          await transaction.insert(bookingPriceLines).values(
            slotPrices.map(({ slot, amount }) => ({
              bookingId: bookingDatabaseId,
              lineType: "COURT_SLOT",
              referenceId: slot.id,
              label: `Sewa lapangan ${slot.startsAt.toISOString()}`,
              quantity: 1,
              unitAmount: amount,
              totalAmount: amount,
              ruleSnapshot: { authoritativeAt: now.toISOString() },
            })),
          );
          if (selectedAddons.length > 0) {
            await transaction.insert(bookingAddonItems).values(
              selectedAddons.map((addon) => ({
                bookingId: bookingDatabaseId,
                addonId: addon.id,
                nameSnapshot: addon.name,
                unitPrice: addon.price,
                quantity: 1,
                totalPrice: addon.price,
              })),
            );
            await transaction.insert(bookingPriceLines).values(
              selectedAddons.map((addon) => ({
                bookingId: bookingDatabaseId,
                lineType: "ADDON",
                referenceId: addon.id,
                label: addon.name,
                quantity: 1,
                unitAmount: addon.price,
                totalAmount: addon.price,
                ruleSnapshot: {
                  name: addon.name,
                  unitPrice: addon.price,
                  immutable: true,
                },
              })),
            );
          }
          if (financials.discountAmount > 0) {
            await transaction.insert(bookingPriceLines).values({
              bookingId: bookingDatabaseId,
              lineType: "PROMOTION",
              referenceId: financials.promotionId,
              label: financials.promotionCode
                ? `Promo ${financials.promotionCode}`
                : "Penyesuaian owner",
              quantity: 1,
              unitAmount: financials.discountAmount,
              totalAmount: financials.discountAmount,
              ruleSnapshot: {
                fundingSource: financials.discountFunding,
                immutable: true,
              },
            });
          }
          await transaction.insert(bookingSlotReservations).values(
            [...selectedSlots, ...bufferSlots].map((slot) => ({
              courtSlotId: slot.id,
              bookingId: bookingDatabaseId,
              bookingItemId: bookingItemDatabaseId,
              reservationStatus: initialStatus,
              expiresAt: holdExpiresAt,
            })),
          );
          await transaction.insert(bookingSlotHistory).values(
            [...selectedSlots, ...bufferSlots].map((slot) => ({
              courtSlotId: slot.id,
              bookingId: bookingDatabaseId,
              action: bufferSlots.some((bufferSlot) => bufferSlot.id === slot.id)
                ? "BUFFER_RESERVED"
                : "RESERVED",
              reason:
                input.source === "OFFLINE" ? "Booking offline" : "Checkout customer",
            })),
          );
          await transaction.insert(bookingStateTransitions).values({
            bookingId: bookingDatabaseId,
            fromStatus: null,
            toStatus: initialStatus,
            actorUserId: actorDatabaseId,
            reason: "Booking dibuat",
          });
          await transaction.insert(bookingPaymentSummaries).values({
            bookingId: bookingDatabaseId,
            status: "UNPAID",
            totalPaid: 0,
            totalRefunded: 0,
            balanceDue,
          });
          if (input.source === "OFFLINE" && input.offlineCustomer) {
            await transaction.insert(offlineBookingDetails).values({
              bookingId: bookingDatabaseId,
              customerName: input.offlineCustomer.name,
              customerPhone: input.offlineCustomer.phone,
              channel: input.offlineCustomer.channel,
              originalAmount,
              adjustedAmount: input.offlineCustomer.adjustedAmount,
              adjustmentReason: input.offlineCustomer.adjustmentReason,
            });
            if (input.offlineCustomer.adjustedAmount !== undefined) {
              await transaction.insert(auditLogs).values({
                tenantId: court.tenantId,
                venueId: venueDatabaseId,
                actorUserId: actorDatabaseId,
                action: "booking.offline_price_adjusted",
                resourceType: "booking",
                resourceId: bookingDatabaseId,
                reason: input.offlineCustomer.adjustmentReason,
                beforeState: { totalAmount: originalAmount },
                afterState: { totalAmount },
              });
            }
          }
          await this.insertQrToken(
            transaction,
            bookingDatabaseId,
            selectedSlots.at(-1)!.endsAt,
          );
          await transaction.insert(outboxEvents).values({
            tenantId: court.tenantId,
            eventType: "booking.created",
            resourceType: "booking",
            resourceId: bookingDatabaseId,
            resourceVersion: 1,
            payload: { hint: "refetch-booking", status: initialStatus },
            occurredAt: now,
          });

          const view: BookingView = {
            id: bookingReference,
            venueId: input.venueId,
            paymentMode: input.paymentMode,
            status: initialStatus,
            paymentStatus: "UNPAID",
            totalAmount,
            balanceDue,
            holdExpiresAt: holdExpiresAt?.toISOString() ?? null,
            version: 1,
          };
          await transaction.insert(commandIdempotency).values({
            scope: "booking.create",
            actorUserId: actorDatabaseId,
            idempotencyKey,
            resourceId: bookingDatabaseId,
            responseStatus: 201,
            responseBody: view,
          });
          return view;
        }),
      );
    } catch (error: unknown) {
      if (isDuplicateEntry(error)) {
        throw new ApiError(
          409,
          "SLOT_ALREADY_RESERVED",
          "Slot baru saja dipesan pengguna lain.",
        );
      }
      throw error;
    }

    await this.publishAfterCommit();
    return booking;
  }

  async getForUser(bookingId: string, userId: string): Promise<BookingView> {
    const [row] = await this.database.db
      .select({ booking: bookings, payment: bookingPaymentSummaries })
      .from(bookings)
      .innerJoin(
        bookingPaymentSummaries,
        eq(bookingPaymentSummaries.bookingId, bookings.id),
      )
      .where(
        and(
          eq(bookings.bookingCode, bookingId),
          eq(bookings.customerUserId, parsePublicId(userId)),
        ),
      )
      .limit(1);
    if (!row) throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking tidak ditemukan.");
    await this.expireIfNeeded(row.booking, new Date());
    return this.toView(row.booking, row.payment.status);
  }

  async listForUser(userId: string): Promise<CustomerBookingSummary[]> {
    const rows = await this.database.db
      .select({
        booking: bookings,
        paymentStatus: bookingPaymentSummaries.status,
        venueName: venues.name,
        courtName: courts.name,
        courtId: courts.id,
        startsAt: bookingItems.startsAt,
        endsAt: bookingItems.endsAt,
        reviewId: reviews.id,
      })
      .from(bookings)
      .innerJoin(
        bookingPaymentSummaries,
        eq(bookingPaymentSummaries.bookingId, bookings.id),
      )
      .innerJoin(venues, eq(venues.id, bookings.venueId))
      .innerJoin(bookingItems, eq(bookingItems.bookingId, bookings.id))
      .innerJoin(courts, eq(courts.id, bookingItems.courtId))
      .leftJoin(reviews, eq(reviews.bookingId, bookings.id))
      .where(eq(bookings.customerUserId, parsePublicId(userId)))
      .orderBy(desc(bookingItems.startsAt))
      .limit(100);

    return rows.map((row) => ({
      ...this.toView(row.booking, row.paymentStatus),
      venueName: row.venueName,
      courtName: row.courtName,
      courtId: formatPublicId(row.courtId),
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      reviewId: row.reviewId ? formatPublicId(row.reviewId) : null,
    }));
  }

  async requireBusinessScope(
    bookingId: string,
    tenantId: string,
    venueId: string,
  ): Promise<void> {
    const [booking] = await this.database.db
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.bookingCode, bookingId),
          eq(bookings.tenantId, parsePublicId(tenantId)),
          eq(bookings.venueId, parsePublicId(venueId)),
        ),
      )
      .limit(1);

    if (!booking) {
      throw new ApiError(
        404,
        "BOOKING_NOT_FOUND",
        "Booking tidak ditemukan pada venue ini.",
      );
    }
  }

  async transition(
    bookingId: string,
    nextStatus: BookingStatus,
    actorUserId: string,
    reason: string,
    notification?: {
      title: string;
      body: string;
      kind?: string;
    },
  ): Promise<void> {
    const actorDatabaseId = parsePublicId(actorUserId);
    await this.database.db.transaction(async (transaction) => {
      const [booking] = await transaction
        .select()
        .from(bookings)
        .where(eq(bookings.bookingCode, bookingId))
        .limit(1)
        .for("update");
      if (!booking)
        throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking tidak ditemukan.");
      const bookingDatabaseId = booking.id;
      try {
        assertBookingTransition(booking.status as BookingStatus, nextStatus);
      } catch (error) {
        throw new ApiError(409, "INVALID_BOOKING_TRANSITION", messageFrom(error));
      }
      const nextVersion = booking.version + 1;
      await transaction
        .update(bookings)
        .set({ status: nextStatus, version: nextVersion, updatedAt: new Date() })
        .where(eq(bookings.id, bookingDatabaseId));
      await transaction.insert(bookingStateTransitions).values({
        bookingId: bookingDatabaseId,
        fromStatus: booking.status,
        toStatus: nextStatus,
        actorUserId: actorDatabaseId,
        reason,
      });
      if (nextStatus === "CONFIRMED") {
        await transaction
          .update(bookingSlotReservations)
          .set({ reservationStatus: "CONFIRMED", expiresAt: null })
          .where(eq(bookingSlotReservations.bookingId, bookingDatabaseId));
      }
      if (nextStatus === "CANCELLED" || nextStatus === "EXPIRED") {
        await transaction
          .delete(bookingSlotReservations)
          .where(eq(bookingSlotReservations.bookingId, bookingDatabaseId));
        await this.financeService.releaseUnusedFinancialReservations(
          transaction,
          bookingDatabaseId,
        );
      }
      if (nextStatus === "COMPLETED") {
        await this.financeService.markBookingCompleted(
          transaction,
          bookingDatabaseId,
          new Date(),
        );
      }
      if (booking.customerUserId) {
        await this.notificationService.deliverInTransaction(transaction, {
          eventId: `booking-status:${bookingDatabaseId}:${nextVersion}`,
          userId: booking.customerUserId,
          eventType: "booking.status_changed",
          ...(notification?.kind ? { userNotificationKind: notification.kind } : {}),
          title: notification?.title ?? "Status booking diperbarui",
          body:
            notification?.body ??
            `Booking ${booking.bookingCode} kini berstatus ${nextStatus}.`,
          actionPath: `/bookings/${booking.bookingCode}`,
          critical: true,
        });
      }
      await transaction.insert(outboxEvents).values({
        tenantId: booking.tenantId,
        audienceUserId: booking.customerUserId,
        eventType: "booking.status_changed",
        resourceType: "booking",
        resourceId: bookingDatabaseId,
        resourceVersion: nextVersion,
        payload: { hint: "refetch-booking", status: nextStatus },
        occurredAt: new Date(),
      });
    });
    await this.publishAfterCommit();
  }

  private async publishAfterCommit(): Promise<void> {
    try {
      await this.publishPendingEvents();
    } catch {
      // The committed booking remains authoritative; the outbox poller retries delivery.
    }
  }

  private async findIdempotentResponse(
    actorUserId: string,
    idempotencyKey: string,
  ): Promise<BookingView | null> {
    const [command] = await this.database.db
      .select({ resourceId: commandIdempotency.resourceId })
      .from(commandIdempotency)
      .where(
        and(
          eq(commandIdempotency.scope, "booking.create"),
          eq(commandIdempotency.actorUserId, parsePublicId(actorUserId)),
          eq(commandIdempotency.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);
    if (!command?.resourceId) return null;

    const [row] = await this.database.db
      .select({ booking: bookings, payment: bookingPaymentSummaries })
      .from(bookings)
      .innerJoin(
        bookingPaymentSummaries,
        eq(bookingPaymentSummaries.bookingId, bookings.id),
      )
      .where(eq(bookings.id, command.resourceId))
      .limit(1);

    return row ? this.toView(row.booking, row.payment.status) : null;
  }

  private async expireStaleReservations(
    slotIds: readonly string[],
    now: Date,
  ): Promise<void> {
    const expiredRows = await this.database.db
      .select({
        bookingReference: bookings.bookingCode,
        actorUserId: bookings.createdByUserId,
      })
      .from(bookingSlotReservations)
      .innerJoin(bookings, eq(bookings.id, bookingSlotReservations.bookingId))
      .where(
        and(
          inArray(bookingSlotReservations.courtSlotId, slotIds.map(parsePublicId)),
          inArray(bookings.status, ["HOLD", "PENDING_CONFIRMATION"]),
          lte(bookingSlotReservations.expiresAt, now),
        ),
      );

    const expiredBookings = new Map(
      expiredRows.map((row) => [row.bookingReference, row.actorUserId]),
    );
    for (const [bookingReference, actorUserId] of expiredBookings) {
      try {
        await this.transition(
          bookingReference,
          "EXPIRED",
          formatPublicId(actorUserId),
          "Hold kedaluwarsa saat slot dipilih kembali",
        );
      } catch (error) {
        if (
          !(error instanceof ApiError) ||
          error.code !== "INVALID_BOOKING_TRANSITION"
        ) {
          throw error;
        }
      }
    }
  }

  private async expireIfNeeded(
    booking: typeof bookings.$inferSelect,
    now: Date,
  ): Promise<void> {
    if (
      booking.status === "HOLD" &&
      booking.holdExpiresAt &&
      booking.holdExpiresAt <= now
    ) {
      await this.transition(
        booking.bookingCode,
        "EXPIRED",
        formatPublicId(booking.createdByUserId),
        "Hold kedaluwarsa",
      );
      booking.status = "EXPIRED";
      booking.version += 1;
    }
  }

  private toView(
    booking: typeof bookings.$inferSelect,
    paymentStatus: string,
  ): BookingView {
    return {
      id: booking.bookingCode,
      venueId: formatPublicId(booking.venueId),
      paymentMode: booking.paymentMode as PaymentMode,
      status: booking.status as BookingStatus,
      paymentStatus: paymentStatus as BookingView["paymentStatus"],
      totalAmount: booking.totalAmount,
      balanceDue: booking.balanceDue,
      holdExpiresAt:
        (booking.status === "PENDING_CONFIRMATION"
          ? booking.confirmationExpiresAt
          : booking.holdExpiresAt
        )?.toISOString() ?? null,
      version: booking.version,
    };
  }

  private validateBookingWindow(
    startsAt: Date,
    settings: typeof courtBookingSettings.$inferSelect,
    now: Date,
  ): void {
    const leadTime = startsAt.getTime() - now.getTime();
    if (leadTime < settings.minimumLeadMinutes * 60_000) {
      throw new ApiError(
        409,
        "MINIMUM_LEAD_TIME",
        "Slot melewati batas minimum lead time.",
      );
    }
    if (leadTime > settings.bookingWindowDays * 24 * 60 * 60_000) {
      throw new ApiError(
        409,
        "BOOKING_WINDOW_EXCEEDED",
        "Slot berada di luar booking window.",
      );
    }
  }

  private async insertQrToken(
    transaction: Parameters<Parameters<DatabaseConnection["db"]["transaction"]>[0]>[0],
    bookingId: number,
    expiresAt: Date,
  ): Promise<void> {
    const rawToken = randomBytes(32).toString("base64url");
    await transaction.insert(bookingQrTokens).values({
      bookingId,
      tokenHash: createHash("sha256").update(rawToken).digest("hex"),
      expiresAt,
    });
  }

  private async withDeadlockRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (!isDeadlock(error) || attempt === MAX_TRANSACTION_ATTEMPTS) throw error;
      }
    }
    throw lastError;
  }
}

function isPaymentModeAllowed(
  mode: PaymentMode,
  settings: typeof venuePaymentSettings.$inferSelect,
): boolean {
  if (mode === "FULL") return settings.allowFull;
  if (mode === "DP") return settings.allowDp && settings.dpPercentage !== null;
  return settings.allowPayAtVenue;
}

function resolveAdjustedAmount(
  originalAmount: number,
  input: CreateBookingInput,
): number {
  const adjustedAmount = input.offlineCustomer?.adjustedAmount;
  if (adjustedAmount === undefined) return originalAmount;
  if (!input.offlineCustomer?.adjustmentReason?.trim()) {
    throw new ApiError(
      422,
      "ADJUSTMENT_REASON_REQUIRED",
      "Alasan penyesuaian harga wajib diisi.",
    );
  }
  return adjustedAmount;
}

function toPriceRuleCandidate(
  rule: typeof priceRules.$inferSelect,
): PriceRuleCandidate | null {
  if (!isPriceRuleKind(rule.kind)) return null;
  return {
    id: rule.id,
    kind: rule.kind,
    amount: rule.amount,
    courtId: rule.courtId,
    dayOfWeek: rule.dayOfWeek,
    specialDate: rule.specialDate,
    startsAtLocal: rule.startsAtLocal,
    endsAtLocal: rule.endsAtLocal,
  };
}

function isPriceRuleCandidate(
  value: PriceRuleCandidate | null,
): value is PriceRuleCandidate {
  return value !== null;
}

function isPriceRuleKind(value: string): value is PriceRuleKind {
  return (
    value === "BASE" ||
    value === "WEEKDAY_WEEKEND" ||
    value === "DAY_TIME" ||
    value === "SPECIAL_DATE"
  );
}

function isDuplicateEntry(error: unknown): boolean {
  return databaseErrorCode(error) === "ER_DUP_ENTRY";
}

function isDeadlock(error: unknown): boolean {
  const code = databaseErrorCode(error);
  return code === "ER_LOCK_DEADLOCK" || code === "ER_LOCK_WAIT_TIMEOUT";
}

function databaseErrorCode(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  const cause = "cause" in error ? error.cause : undefined;
  if (typeof cause === "object" && cause !== null && "code" in cause) {
    return String(cause.code);
  }
  return undefined;
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "Aturan booking tidak terpenuhi.";
}

export async function resolveCancellationPolicySnapshot(
  transaction: Parameters<Parameters<DatabaseConnection["db"]["transaction"]>[0]>[0],
  venueId: number,
) {
  const [assignment] = await transaction
    .select({ template: cancellationPolicyTemplates })
    .from(venuePolicyAssignments)
    .innerJoin(
      cancellationPolicyTemplates,
      eq(cancellationPolicyTemplates.id, venuePolicyAssignments.templateId),
    )
    .where(eq(venuePolicyAssignments.venueId, venueId))
    .limit(1);
  if (!assignment) {
    return {
      templateId: null,
      name: "Kebijakan standar LapanganGo",
      tiers: BASELINE_CANCELLATION_TIERS,
    };
  }
  const tiers = await transaction
    .select({
      minimumHoursBefore: cancellationPolicyTiers.minimumHoursBefore,
      maximumHoursBefore: cancellationPolicyTiers.maximumHoursBefore,
      refundBasisPoints: cancellationPolicyTiers.refundBasisPoints,
    })
    .from(cancellationPolicyTiers)
    .where(eq(cancellationPolicyTiers.templateId, assignment.template.id));
  return {
    templateId: formatPublicId(assignment.template.id),
    name: assignment.template.name,
    tiers,
  };
}

const BASELINE_CANCELLATION_TIERS = [
  { minimumHoursBefore: 24, maximumHoursBefore: null, refundBasisPoints: 10_000 },
  { minimumHoursBefore: 6, maximumHoursBefore: 24, refundBasisPoints: 5_000 },
  { minimumHoursBefore: 0, maximumHoursBefore: 6, refundBasisPoints: 0 },
];
