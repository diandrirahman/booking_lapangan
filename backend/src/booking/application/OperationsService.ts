import { and, desc, eq, gt, gte, inArray, lt, lte, notInArray } from "drizzle-orm";
import type { DatabaseConnection } from "../../database/client.js";
import { formatPublicId, parsePublicId } from "../../database/ids.js";
import {
  attendanceRecords,
  bookingCancellations,
  bookingItems,
  bookingPaymentSummaries,
  bookingReschedules,
  bookings,
  bookingSlotHistory,
  bookingSlotReservations,
  bookingStateTransitions,
  courts,
  courtBlocks,
  courtBookingSettings,
  courtSlots,
  refunds,
  refundStateTransitions,
  offlineBookingDetails,
  outboxEvents,
  paymentAttempts,
  userNotifications,
  users,
  venues,
} from "../../database/schema/index.js";
import { ApiError } from "../../http/ApiError.js";
import {
  createPublicReference,
  PAYMENT_REFERENCE_PREFIX,
} from "../../security/publicReference.js";
import { validateSlotSelection } from "../domain/slotSelection.js";
import {
  datePartsInTimeZone,
  localDateBoundsUtc,
} from "../../schedule/availability/timeZone.js";
import type { BookingService } from "./BookingService.js";

const NO_SHOW_GRACE_MILLISECONDS = 15 * 60_000;
const NON_COLLECTIBLE_BOOKING_STATUSES = ["CANCELLED", "EXPIRED"] as const;

export class OperationsService {
  constructor(
    private readonly database: DatabaseConnection,
    private readonly bookingService: BookingService,
    private readonly publishPendingEvents: () => Promise<void> = () =>
      Promise.resolve(),
  ) {}

  async dashboard(
    tenantId: string,
    allowedVenueIds: string[] | null,
  ): Promise<{
    bookingToday: number;
    pendingConfirmation: number;
    outstandingAmount: number;
    activeVenues: number;
    availableSlotsToday: number;
    upcoming: BusinessBookingView[];
    recentActivity: Array<{
      bookingId: string;
      status: string;
      reason: string | null;
      occurredAt: string;
    }>;
  }> {
    const bookingRows = await this.listBookings({
      tenantId,
      allowedVenueIds,
      limit: 100,
    });
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);
    const activeVenueRows =
      allowedVenueIds?.length === 0
        ? []
        : await this.database.db
            .select({ id: venues.id, timezone: venues.timezone })
            .from(venues)
            .where(
              and(
                eq(venues.tenantId, parsePublicId(tenantId)),
                eq(venues.status, "ACTIVE"),
                allowedVenueIds
                  ? inArray(venues.id, allowedVenueIds.map(parsePublicId))
                  : undefined,
              ),
            );
    const now = new Date();
    const availableSlotsToday = (
      await Promise.all(
        activeVenueRows.map((venue) =>
          this.countAvailableSlotsForVenue(venue.id, venue.timezone, now),
        ),
      )
    ).reduce((total, count) => total + count, 0);
    const venueScope = allowedVenueIds?.map(parsePublicId);
    const activityRows = await this.database.db
      .select({
        bookingReference: bookings.bookingCode,
        status: bookingStateTransitions.toStatus,
        reason: bookingStateTransitions.reason,
        occurredAt: bookingStateTransitions.createdAt,
      })
      .from(bookingStateTransitions)
      .innerJoin(bookings, eq(bookings.id, bookingStateTransitions.bookingId))
      .where(
        and(
          eq(bookings.tenantId, parsePublicId(tenantId)),
          venueScope ? inArray(bookings.venueId, venueScope) : undefined,
        ),
      )
      .orderBy(desc(bookingStateTransitions.createdAt))
      .limit(6);
    return {
      bookingToday: bookingRows.filter(
        (booking) =>
          new Date(booking.startsAt) >= startOfToday &&
          new Date(booking.startsAt) < endOfToday,
      ).length,
      pendingConfirmation: bookingRows.filter(
        (booking) => booking.status === "PENDING_CONFIRMATION",
      ).length,
      outstandingAmount: bookingRows
        .filter(isCollectibleOutstanding)
        .reduce((total, booking) => total + booking.balanceDue, 0),
      activeVenues: activeVenueRows.length,
      availableSlotsToday,
      upcoming: bookingRows
        .filter((booking) => new Date(booking.startsAt) >= now)
        .sort(
          (left, right) =>
            new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
        )
        .slice(0, 8),
      recentActivity: activityRows.map((activity) => ({
        bookingId: activity.bookingReference,
        status: activity.status,
        reason: activity.reason,
        occurredAt: activity.occurredAt.toISOString(),
      })),
    };
  }

  private async countAvailableSlotsForVenue(
    venueId: number,
    timezone: string,
    now: Date,
  ): Promise<number> {
    const localDate = datePartsInTimeZone(now, timezone).localDate;
    const bounds = localDateBoundsUtc(localDate, timezone);
    const availabilityStartsAt = now > bounds.start ? now : bounds.start;
    const [slots, blocks] = await Promise.all([
      this.database.db
        .select({
          id: courtSlots.id,
          startsAt: courtSlots.startsAt,
          endsAt: courtSlots.endsAt,
          status: courtSlots.status,
          reservationBookingId: bookingSlotReservations.bookingId,
          reservationExpiresAt: bookingSlotReservations.expiresAt,
        })
        .from(courtSlots)
        .innerJoin(courts, eq(courts.id, courtSlots.courtId))
        .leftJoin(
          bookingSlotReservations,
          eq(bookingSlotReservations.courtSlotId, courtSlots.id),
        )
        .where(
          and(
            eq(courts.venueId, venueId),
            gte(courtSlots.startsAt, availabilityStartsAt),
            lt(courtSlots.startsAt, bounds.end),
          ),
        ),
      this.database.db
        .select({ startsAt: courtBlocks.startsAt, endsAt: courtBlocks.endsAt })
        .from(courtBlocks)
        .where(
          and(
            eq(courtBlocks.venueId, venueId),
            lt(courtBlocks.startsAt, bounds.end),
            gt(courtBlocks.endsAt, bounds.start),
          ),
        ),
    ]);
    return slots.filter((slot) => {
      const hasActiveReservation =
        slot.reservationBookingId !== null &&
        (slot.reservationExpiresAt === null || slot.reservationExpiresAt > now);
      const blocked = blocks.some(
        (block) => block.startsAt < slot.endsAt && block.endsAt > slot.startsAt,
      );
      return slot.status === "OPEN" && !hasActiveReservation && !blocked;
    }).length;
  }

  async listBookings(input: {
    tenantId: string;
    allowedVenueIds: string[] | null;
    venueId?: string | undefined;
    startsAfter?: Date | undefined;
    startsBefore?: Date | undefined;
    status?: string | undefined;
    outstandingOnly?: boolean | undefined;
    limit?: number | undefined;
  }): Promise<BusinessBookingView[]> {
    const tenantDatabaseId = parsePublicId(input.tenantId);
    const venueScope = input.venueId
      ? [parsePublicId(input.venueId)]
      : input.allowedVenueIds?.map(parsePublicId);
    if (venueScope?.length === 0) return [];
    const rows = await this.database.db
      .select({
        booking: bookings,
        item: bookingItems,
        venueName: venues.name,
        courtName: courts.name,
        offlineName: offlineBookingDetails.customerName,
        offlinePhone: offlineBookingDetails.customerPhone,
        customerName: users.name,
        paymentStatus: bookingPaymentSummaries.status,
        attendanceStatus: attendanceRecords.status,
      })
      .from(bookings)
      .innerJoin(bookingItems, eq(bookingItems.bookingId, bookings.id))
      .innerJoin(venues, eq(venues.id, bookings.venueId))
      .innerJoin(courts, eq(courts.id, bookingItems.courtId))
      .innerJoin(
        bookingPaymentSummaries,
        eq(bookingPaymentSummaries.bookingId, bookings.id),
      )
      .leftJoin(offlineBookingDetails, eq(offlineBookingDetails.bookingId, bookings.id))
      .leftJoin(users, eq(users.id, bookings.customerUserId))
      .leftJoin(attendanceRecords, eq(attendanceRecords.bookingId, bookings.id))
      .where(
        and(
          eq(bookings.tenantId, tenantDatabaseId),
          venueScope ? inArray(bookings.venueId, venueScope) : undefined,
          input.startsAfter ? gte(bookingItems.startsAt, input.startsAfter) : undefined,
          input.startsBefore
            ? lte(bookingItems.startsAt, input.startsBefore)
            : undefined,
          input.status ? eq(bookings.status, input.status) : undefined,
          input.outstandingOnly ? gt(bookings.balanceDue, 0) : undefined,
          input.outstandingOnly
            ? notInArray(bookings.status, [...NON_COLLECTIBLE_BOOKING_STATUSES])
            : undefined,
        ),
      )
      .orderBy(desc(bookingItems.startsAt))
      .limit(input.limit ?? 100);

    return rows.map((row) => ({
      id: row.booking.bookingCode,
      venueId: formatPublicId(row.booking.venueId),
      venueName: row.venueName,
      courtId: formatPublicId(row.item.courtId),
      courtName: row.courtName,
      customerName: row.offlineName ?? row.customerName ?? "Customer",
      customerPhone: row.offlinePhone,
      source: row.booking.source,
      status: row.booking.status,
      paymentMode: row.booking.paymentMode,
      paymentStatus: row.paymentStatus,
      attendanceStatus:
        row.attendanceStatus === "CHECKED_IN" || row.attendanceStatus === "NO_SHOW"
          ? row.attendanceStatus
          : null,
      totalAmount: row.booking.totalAmount,
      balanceDue: row.booking.balanceDue,
      startsAt: row.item.startsAt.toISOString(),
      endsAt: row.item.endsAt.toISOString(),
      version: row.booking.version,
    }));
  }

  async listCalendar(input: {
    tenantId: string;
    allowedVenueIds: string[] | null;
    venueId?: string | undefined;
    startsAfter: Date;
    startsBefore: Date;
  }): Promise<{
    bookings: BusinessBookingView[];
    blocks: Array<{
      id: string;
      venueId: string;
      courtId: string | null;
      kind: string;
      startsAt: string;
      endsAt: string;
      reason: string;
    }>;
  }> {
    const bookingRows = await this.listBookings(input);
    const venueScope = input.venueId
      ? [parsePublicId(input.venueId)]
      : input.allowedVenueIds?.map(parsePublicId);
    if (venueScope?.length === 0) return { bookings: bookingRows, blocks: [] };
    const blocks = await this.database.db
      .select({ block: courtBlocks })
      .from(courtBlocks)
      .innerJoin(venues, eq(venues.id, courtBlocks.venueId))
      .where(
        and(
          eq(venues.tenantId, parsePublicId(input.tenantId)),
          venueScope ? inArray(courtBlocks.venueId, venueScope) : undefined,
          lt(courtBlocks.startsAt, input.startsBefore),
          gt(courtBlocks.endsAt, input.startsAfter),
        ),
      )
      .orderBy(courtBlocks.startsAt);
    return {
      bookings: bookingRows,
      blocks: blocks.map(({ block }) => ({
        id: formatPublicId(block.id),
        venueId: formatPublicId(block.venueId),
        courtId: block.courtId ? formatPublicId(block.courtId) : null,
        kind: block.kind,
        startsAt: block.startsAt.toISOString(),
        endsAt: block.endsAt.toISOString(),
        reason: block.reason,
      })),
    };
  }

  async createClosure(input: {
    tenantId: string;
    venueId: string;
    courtId?: string | undefined;
    startsAt: Date;
    endsAt: Date;
    kind: "CLOSURE" | "MAINTENANCE" | "BLOCK";
    reason: string;
  }): Promise<{ blockId: string; impactedBookingIds: string[] }> {
    if (input.endsAt <= input.startsAt) {
      throw new ApiError(
        422,
        "INVALID_BLOCK_RANGE",
        "Waktu selesai harus setelah waktu mulai.",
      );
    }
    const tenantDatabaseId = parsePublicId(input.tenantId);
    const venueDatabaseId = parsePublicId(input.venueId);
    const courtDatabaseId = input.courtId ? parsePublicId(input.courtId) : null;

    const [venue] = await this.database.db
      .select({ id: venues.id })
      .from(venues)
      .where(and(eq(venues.id, venueDatabaseId), eq(venues.tenantId, tenantDatabaseId)))
      .limit(1);
    if (!venue) {
      throw new ApiError(
        404,
        "VENUE_NOT_FOUND",
        "Venue tidak ditemukan pada workspace ini.",
      );
    }

    if (courtDatabaseId) {
      const [court] = await this.database.db
        .select({ id: courts.id })
        .from(courts)
        .where(and(eq(courts.id, courtDatabaseId), eq(courts.venueId, venueDatabaseId)))
        .limit(1);
      if (!court) {
        throw new ApiError(
          404,
          "COURT_NOT_FOUND",
          "Lapangan tidak ditemukan pada venue ini.",
        );
      }
    }

    return this.database.db.transaction(async (transaction) => {
      const [createdBlock] = await transaction
        .insert(courtBlocks)
        .values({
          venueId: venueDatabaseId,
          courtId: courtDatabaseId,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          kind: input.kind,
          reason: input.reason,
        })
        .$returningId();
      if (!createdBlock) throw new Error("MySQL tidak mengembalikan ID closure.");
      const impactedRows = await transaction
        .select({ bookingReference: bookings.bookingCode })
        .from(bookingItems)
        .innerJoin(bookings, eq(bookings.id, bookingItems.bookingId))
        .where(
          and(
            eq(bookings.tenantId, tenantDatabaseId),
            eq(bookings.venueId, venueDatabaseId),
            inArray(bookings.status, ["HOLD", "PENDING_CONFIRMATION", "CONFIRMED"]),
            courtDatabaseId ? eq(bookingItems.courtId, courtDatabaseId) : undefined,
            lt(bookingItems.startsAt, input.endsAt),
            gt(bookingItems.endsAt, input.startsAt),
          ),
        );
      return {
        blockId: formatPublicId(createdBlock.id),
        impactedBookingIds: [
          ...new Set(impactedRows.map((row) => row.bookingReference)),
        ],
      };
    });
  }

  async cancelForClosure(
    bookingId: string,
    actorUserId: string,
    reason: string,
  ): Promise<void> {
    await this.bookingService.transition(bookingId, "CANCELLED", actorUserId, reason);
    const bookingDatabaseId = await this.findBookingDatabaseId(bookingId);
    const actorDatabaseId = parsePublicId(actorUserId);
    await this.database.db.transaction(async (transaction) => {
      const [booking] = await transaction
        .select()
        .from(bookings)
        .where(eq(bookings.id, bookingDatabaseId))
        .limit(1)
        .for("update");
      if (!booking) {
        throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking tidak ditemukan.");
      }
      const [summary] = await transaction
        .select()
        .from(bookingPaymentSummaries)
        .where(eq(bookingPaymentSummaries.bookingId, bookingDatabaseId))
        .limit(1)
        .for("update");
      await transaction.insert(bookingCancellations).values({
        bookingId: bookingDatabaseId,
        actorUserId: actorDatabaseId,
        reason,
        kind: "OPERATIONAL_CLOSURE",
      });
      if (summary && summary.totalPaid > summary.totalRefunded) {
        const amount = summary.totalPaid - summary.totalRefunded;
        const [createdRefund] = await transaction
          .insert(refunds)
          .values({
            bookingId: bookingDatabaseId,
            amount,
            status: "PENDING",
            kind: "AUTOMATIC_CLOSURE",
            reason,
            idempotencyKey: `closure:${bookingId}`,
            requestedByUserId: actorDatabaseId,
          })
          .$returningId();
        if (!createdRefund) throw new Error("MySQL tidak mengembalikan ID refund.");
        await transaction.insert(refundStateTransitions).values({
          refundId: createdRefund.id,
          fromStatus: null,
          toStatus: "PENDING",
          payload: { sandbox: true },
        });
      }
      if (booking.customerUserId) {
        const [notification] = await transaction
          .insert(userNotifications)
          .values({
            userId: booking.customerUserId,
            kind: "booking",
            title: "Booking dibatalkan oleh venue",
            body: reason,
            actionPath: `/bookings/${bookingId}`,
          })
          .$returningId();
        if (!notification) {
          throw new Error("MySQL tidak mengembalikan ID notifikasi.");
        }
        await transaction.insert(outboxEvents).values({
          tenantId: booking.tenantId,
          eventType: "customer.notification_created",
          resourceType: "notification",
          resourceId: notification.id,
          resourceVersion: 1,
          payload: {
            customerUserId: booking.customerUserId,
            hint: "refetch-notifications",
          },
          occurredAt: new Date(),
        });
      }
    });
    await this.publishCommittedEvents();
  }

  async requireBookingScope(
    bookingReference: string,
    tenantId: string,
    venueId: string,
  ): Promise<void> {
    const [booking] = await this.database.db
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.bookingCode, bookingReference),
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

  async reschedule(
    bookingId: string,
    newSlotIds: string[],
    actorUserId: string,
    reason: string,
  ): Promise<void> {
    const newSlotDatabaseIds = newSlotIds.map(parsePublicId);
    const actorDatabaseId = parsePublicId(actorUserId);
    await this.database.db.transaction(async (transaction) => {
      const [booking] = await transaction
        .select()
        .from(bookings)
        .where(eq(bookings.bookingCode, bookingId))
        .limit(1)
        .for("update");
      if (!booking || booking.status !== "CONFIRMED") {
        throw new ApiError(
          409,
          "BOOKING_NOT_RESCHEDULABLE",
          "Hanya booking confirmed yang dapat dijadwalkan ulang.",
        );
      }
      const bookingDatabaseId = booking.id;
      const [item] = await transaction
        .select()
        .from(bookingItems)
        .where(eq(bookingItems.bookingId, bookingDatabaseId))
        .limit(1)
        .for("update");
      if (!item)
        throw new ApiError(
          409,
          "BOOKING_ITEM_MISSING",
          "Detail lapangan booking tidak ditemukan.",
        );
      const [settings] = await transaction
        .select()
        .from(courtBookingSettings)
        .where(eq(courtBookingSettings.courtId, item.courtId))
        .limit(1);
      const newSlots = await transaction
        .select()
        .from(courtSlots)
        .where(
          and(
            eq(courtSlots.courtId, item.courtId),
            inArray(courtSlots.id, newSlotDatabaseIds),
          ),
        )
        .for("update");
      if (!settings || newSlots.length !== new Set(newSlotIds).size) {
        throw new ApiError(
          409,
          "RESCHEDULE_SLOT_INVALID",
          "Slot pengganti tidak valid.",
        );
      }
      try {
        validateSlotSelection(newSlots, settings);
      } catch (error) {
        throw new ApiError(
          409,
          "RESCHEDULE_SLOT_INVALID",
          error instanceof Error ? error.message : "Slot pengganti tidak valid.",
        );
      }
      const orderedSlots = [...newSlots].sort(
        (left, right) => left.startsAt.getTime() - right.startsAt.getTime(),
      );
      const selectedEndsAt = orderedSlots.at(-1)!.endsAt;
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
                  eq(courtSlots.courtId, item.courtId),
                  gte(courtSlots.startsAt, selectedEndsAt),
                  lt(courtSlots.startsAt, bufferEndsAt),
                ),
              )
              .for("update");
      if (bufferSlots.some((slot) => slot.status !== "OPEN")) {
        throw new ApiError(
          409,
          "RESCHEDULE_BUFFER_UNAVAILABLE",
          "Buffer setelah jadwal pengganti bertabrakan dengan slot yang ditutup.",
        );
      }
      const previousReservations = await transaction
        .select()
        .from(bookingSlotReservations)
        .where(eq(bookingSlotReservations.bookingId, bookingDatabaseId))
        .for("update");
      await transaction
        .delete(bookingSlotReservations)
        .where(eq(bookingSlotReservations.bookingId, bookingDatabaseId));
      await transaction.insert(bookingSlotReservations).values(
        [...newSlots, ...bufferSlots].map((slot) => ({
          courtSlotId: slot.id,
          bookingId: bookingDatabaseId,
          bookingItemId: item.id,
          reservationStatus: "CONFIRMED",
          expiresAt: null,
        })),
      );
      await transaction
        .update(bookingItems)
        .set({
          startsAt: orderedSlots[0]!.startsAt,
          endsAt: orderedSlots.at(-1)!.endsAt,
        })
        .where(eq(bookingItems.id, item.id));
      await transaction
        .update(bookings)
        .set({ version: booking.version + 1, updatedAt: new Date() })
        .where(eq(bookings.id, bookingDatabaseId));
      await transaction.insert(bookingReschedules).values({
        bookingId: bookingDatabaseId,
        previousSlotIds: previousReservations.map(
          (reservation) => reservation.courtSlotId,
        ),
        newSlotIds: newSlotDatabaseIds,
        reason,
        actorUserId: actorDatabaseId,
      });
      await transaction.insert(bookingSlotHistory).values([
        ...previousReservations.map((reservation) => ({
          courtSlotId: reservation.courtSlotId,
          bookingId: bookingDatabaseId,
          action: "RELEASED",
          reason,
        })),
        ...newSlots.map((slot) => ({
          courtSlotId: slot.id,
          bookingId: bookingDatabaseId,
          action: "RESCHEDULED",
          reason,
        })),
        ...bufferSlots.map((slot) => ({
          courtSlotId: slot.id,
          bookingId: bookingDatabaseId,
          action: "BUFFER_RESERVED",
          reason,
        })),
      ]);
      if (booking.customerUserId) {
        const [notification] = await transaction
          .insert(userNotifications)
          .values({
            userId: booking.customerUserId,
            kind: "booking",
            title: "Jadwal booking diperbarui",
            body: reason,
            actionPath: `/bookings/${bookingId}`,
          })
          .$returningId();
        if (!notification) {
          throw new Error("MySQL tidak mengembalikan ID notifikasi.");
        }
        await transaction.insert(outboxEvents).values({
          tenantId: booking.tenantId,
          eventType: "customer.notification_created",
          resourceType: "notification",
          resourceId: notification.id,
          resourceVersion: 1,
          payload: {
            customerUserId: booking.customerUserId,
            hint: "refetch-notifications",
          },
          occurredAt: new Date(),
        });
      }
    });
    await this.publishCommittedEvents();
  }

  async recordAttendance(
    bookingId: string,
    actorUserId: string,
    attendance: "CHECKED_IN" | "NO_SHOW",
    reason?: string,
    now = new Date(),
  ): Promise<void> {
    const [booking] = await this.database.db
      .select({
        id: bookings.id,
        status: bookings.status,
        startsAt: bookingItems.startsAt,
      })
      .from(bookings)
      .innerJoin(bookingItems, eq(bookingItems.bookingId, bookings.id))
      .where(eq(bookings.bookingCode, bookingId))
      .limit(1);
    if (!booking) {
      throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking tidak ditemukan.");
    }
    if (booking.status !== "CONFIRMED") {
      throw new ApiError(
        409,
        "ATTENDANCE_NOT_ALLOWED",
        "Kehadiran hanya dapat dicatat pada booking confirmed.",
      );
    }
    const [existingAttendance] = await this.database.db
      .select({ id: attendanceRecords.id })
      .from(attendanceRecords)
      .where(eq(attendanceRecords.bookingId, booking.id))
      .limit(1);
    if (existingAttendance) {
      throw new ApiError(
        409,
        "ATTENDANCE_ALREADY_RECORDED",
        "Kehadiran booking ini sudah dicatat.",
      );
    }
    if (
      attendance === "NO_SHOW" &&
      now.getTime() < booking.startsAt.getTime() + NO_SHOW_GRACE_MILLISECONDS
    ) {
      throw new ApiError(
        409,
        "NO_SHOW_GRACE_ACTIVE",
        "No-show baru dapat dicatat 15 menit setelah jadwal mulai.",
      );
    }
    if (attendance === "CHECKED_IN") {
      await this.bookingService.transition(
        bookingId,
        "IN_PROGRESS",
        actorUserId,
        "Check-in venue",
      );
    }
    await this.database.db.insert(attendanceRecords).values({
      bookingId: await this.findBookingDatabaseId(bookingId),
      status: attendance,
      checkedInAt: attendance === "CHECKED_IN" ? now : null,
      markedByUserId: parsePublicId(actorUserId),
      reason,
    });
  }

  async settleOutstanding(
    bookingReference: string,
    actorUserId: string,
    idempotencyKey: string,
  ): Promise<{ attemptId: string; amount: number }> {
    const existing = await this.database.db
      .select({
        paymentCode: paymentAttempts.paymentCode,
        amount: paymentAttempts.amount,
        bookingReference: bookings.bookingCode,
      })
      .from(paymentAttempts)
      .innerJoin(bookings, eq(bookings.id, paymentAttempts.bookingId))
      .where(eq(paymentAttempts.idempotencyKey, idempotencyKey))
      .limit(1);
    if (existing[0]) {
      if (existing[0].bookingReference !== bookingReference) {
        throw new ApiError(
          409,
          "IDEMPOTENCY_KEY_REUSED",
          "Idempotency key sudah digunakan untuk booking lain.",
        );
      }
      return { attemptId: existing[0].paymentCode, amount: existing[0].amount };
    }

    const result = await this.database.db.transaction(async (transaction) => {
      const [booking] = await transaction
        .select()
        .from(bookings)
        .where(eq(bookings.bookingCode, bookingReference))
        .limit(1)
        .for("update");
      if (!booking) {
        throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking tidak ditemukan.");
      }
      if (isNonCollectibleStatus(booking.status)) {
        throw new ApiError(
          409,
          "OUTSTANDING_NOT_COLLECTIBLE",
          "Booking yang dibatalkan atau kedaluwarsa tidak dapat dilunasi.",
        );
      }
      const [summary] = await transaction
        .select()
        .from(bookingPaymentSummaries)
        .where(eq(bookingPaymentSummaries.bookingId, booking.id))
        .limit(1)
        .for("update");
      if (!summary || summary.balanceDue <= 0) {
        throw new ApiError(
          409,
          "BOOKING_ALREADY_PAID",
          "Booking ini tidak memiliki sisa pembayaran.",
        );
      }
      const now = new Date();
      const paymentCode = createPublicReference(PAYMENT_REFERENCE_PREFIX);
      await transaction.insert(paymentAttempts).values({
        paymentCode,
        bookingId: booking.id,
        kind: "BALANCE",
        amount: summary.balanceDue,
        status: "PAID",
        provider: "VENUE_SANDBOX",
        providerReference: `venue:${parsePublicId(actorUserId)}`,
        idempotencyKey,
        paidAt: now,
        sandbox: true,
      });
      await transaction
        .update(bookingPaymentSummaries)
        .set({
          status: "PAID",
          totalPaid: summary.totalPaid + summary.balanceDue,
          balanceDue: 0,
          updatedAt: now,
        })
        .where(eq(bookingPaymentSummaries.bookingId, booking.id));
      await transaction
        .update(bookings)
        .set({ balanceDue: 0, version: booking.version + 1, updatedAt: now })
        .where(eq(bookings.id, booking.id));
      await transaction.insert(outboxEvents).values({
        tenantId: booking.tenantId,
        eventType: "payment.status_changed",
        resourceType: "booking",
        resourceId: booking.id,
        resourceVersion: booking.version + 1,
        payload: { status: "PAID", hint: "refetch-booking" },
        occurredAt: now,
      });
      return { attemptId: paymentCode, amount: summary.balanceDue };
    });
    try {
      await this.publishPendingEvents();
    } catch {
      // Settlement is committed; the maintenance job retries the outbox signal.
    }
    return result;
  }

  private async findBookingDatabaseId(bookingReference: string): Promise<number> {
    const [booking] = await this.database.db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.bookingCode, bookingReference))
      .limit(1);

    if (!booking) {
      throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking tidak ditemukan.");
    }
    return booking.id;
  }

  private async publishCommittedEvents(): Promise<void> {
    try {
      await this.publishPendingEvents();
    } catch {
      // Domain changes are committed; the maintenance job retries the outbox signal.
    }
  }
}

export interface BusinessBookingView {
  id: string;
  venueId: string;
  venueName: string;
  courtId: string;
  courtName: string;
  customerName: string;
  customerPhone: string | null;
  source: string;
  status: string;
  paymentMode: string;
  paymentStatus: string;
  attendanceStatus: "CHECKED_IN" | "NO_SHOW" | null;
  totalAmount: number;
  balanceDue: number;
  startsAt: string;
  endsAt: string;
  version: number;
}

function isCollectibleOutstanding(booking: BusinessBookingView): boolean {
  return booking.balanceDue > 0 && !isNonCollectibleStatus(booking.status);
}

function isNonCollectibleStatus(status: string): boolean {
  return status === "CANCELLED" || status === "EXPIRED";
}
