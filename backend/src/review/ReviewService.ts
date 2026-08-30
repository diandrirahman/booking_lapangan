import { and, avg, desc, eq, sql } from "drizzle-orm";
import type { DatabaseConnection } from "../database/client.js";
import { formatPublicId, parsePublicId } from "../database/ids.js";
import {
  auditLogs,
  bookings,
  reviewReplies,
  reviewReports,
  reviews,
  venueSearchMetrics,
} from "../database/schema/index.js";
import { ApiError } from "../http/ApiError.js";
import type { RequestAuditContext } from "../http/requestAuditContext.js";

export interface ReviewInput {
  rating: number;
  cleanliness: number;
  courtQuality: number;
  facility: number;
  service: number;
  value: number;
  comment: string;
}

export class ReviewService {
  constructor(private readonly database: DatabaseConnection) {}

  async create(bookingReference: string, userId: string, input: ReviewInput) {
    return this.database.db.transaction(async (transaction) => {
      const [booking] = await transaction
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.bookingCode, bookingReference),
            eq(bookings.customerUserId, parsePublicId(userId)),
          ),
        )
        .limit(1)
        .for("update");
      if (!booking)
        throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking tidak ditemukan.");
      if (booking.status !== "COMPLETED") {
        throw new ApiError(
          409,
          "REVIEW_BOOKING_NOT_COMPLETED",
          "Review hanya dapat dibuat setelah booking selesai.",
        );
      }
      const [existing] = await transaction
        .select({ id: reviews.id })
        .from(reviews)
        .where(eq(reviews.bookingId, booking.id))
        .limit(1);
      if (existing) {
        throw new ApiError(
          409,
          "REVIEW_ALREADY_EXISTS",
          "Booking ini sudah memiliki review.",
        );
      }
      const createdRows = await transaction
        .insert(reviews)
        .values({
          bookingId: booking.id,
          venueId: booking.venueId,
          customerUserId: parsePublicId(userId),
          ...input,
        })
        .$returningId();
      const created = createdRows[0];
      if (!created) throw new Error("MySQL tidak mengembalikan ID review.");
      await refreshVenueMetrics(transaction, booking.venueId);
      return { id: formatPublicId(created.id) };
    });
  }

  async update(reviewId: string, userId: string, input: ReviewInput): Promise<void> {
    await this.database.db.transaction(async (transaction) => {
      const [review] = await transaction
        .select()
        .from(reviews)
        .where(
          and(
            eq(reviews.id, parsePublicId(reviewId)),
            eq(reviews.customerUserId, parsePublicId(userId)),
          ),
        )
        .limit(1)
        .for("update");
      if (!review)
        throw new ApiError(404, "REVIEW_NOT_FOUND", "Review tidak ditemukan.");
      if (Date.now() > review.createdAt.getTime() + 7 * 86_400_000) {
        throw new ApiError(
          409,
          "REVIEW_EDIT_WINDOW_CLOSED",
          "Masa edit review tujuh hari telah berakhir.",
        );
      }
      await transaction
        .update(reviews)
        .set({ ...input, editedAt: new Date(), updatedAt: new Date() })
        .where(eq(reviews.id, review.id));
      await refreshVenueMetrics(transaction, review.venueId);
    });
  }

  async listVenue(venueId: string) {
    const rows = await this.database.db
      .select({ review: reviews, reply: reviewReplies })
      .from(reviews)
      .leftJoin(reviewReplies, eq(reviewReplies.reviewId, reviews.id))
      .where(
        and(eq(reviews.venueId, parsePublicId(venueId)), eq(reviews.status, "VISIBLE")),
      )
      .orderBy(desc(reviews.createdAt));
    return rows.map(({ review, reply }) => reviewView(review, reply));
  }

  async listBusiness(tenantId: string, venueIds?: string[]) {
    const venueDatabaseIds = venueIds?.map(parsePublicId);
    const rows = await this.database.db
      .select({ review: reviews, booking: bookings, reply: reviewReplies })
      .from(reviews)
      .innerJoin(bookings, eq(bookings.id, reviews.bookingId))
      .leftJoin(reviewReplies, eq(reviewReplies.reviewId, reviews.id))
      .where(
        and(
          eq(bookings.tenantId, parsePublicId(tenantId)),
          venueDatabaseIds
            ? sql`${reviews.venueId} in (${sql.join(
                venueDatabaseIds.map((id) => sql`${id}`),
                sql`, `,
              )})`
            : undefined,
        ),
      )
      .orderBy(desc(reviews.createdAt));
    return rows.map(({ review, reply }) => reviewView(review, reply));
  }

  async listAdmin() {
    const rows = await this.database.db
      .select({ review: reviews, reply: reviewReplies })
      .from(reviews)
      .leftJoin(reviewReplies, eq(reviewReplies.reviewId, reviews.id))
      .orderBy(desc(reviews.id))
      .limit(200);
    return rows.map(({ review, reply }) => reviewView(review, reply));
  }

  async reply(
    reviewId: string,
    tenantId: string,
    venueIds: string[] | undefined,
    actorUserId: string,
    body: string,
    auditContext: RequestAuditContext = {},
  ): Promise<void> {
    await this.database.db.transaction(async (transaction) => {
      const [row] = await transaction
        .select({ review: reviews, booking: bookings })
        .from(reviews)
        .innerJoin(bookings, eq(bookings.id, reviews.bookingId))
        .where(
          and(
            eq(reviews.id, parsePublicId(reviewId)),
            eq(bookings.tenantId, parsePublicId(tenantId)),
          ),
        )
        .limit(1);
      if (
        !row ||
        (venueIds && !venueIds.map(parsePublicId).includes(row.review.venueId))
      ) {
        throw new ApiError(404, "REVIEW_NOT_FOUND", "Review tidak ditemukan.");
      }
      await transaction.insert(reviewReplies).values({
        reviewId: row.review.id,
        authorUserId: parsePublicId(actorUserId),
        body,
      });
      await transaction.insert(auditLogs).values({
        tenantId: row.booking.tenantId,
        venueId: row.review.venueId,
        actorUserId: parsePublicId(actorUserId),
        action: "review.replied",
        resourceType: "review",
        resourceId: row.review.id,
        afterState: { replied: true },
        ...auditContext,
      });
    });
  }

  async report(reviewId: string, userId: string, reason: string): Promise<void> {
    await this.database.db.insert(reviewReports).values({
      reviewId: parsePublicId(reviewId),
      reporterUserId: parsePublicId(userId),
      reason,
    });
  }

  async moderate(
    reviewId: string,
    actorUserId: string,
    status: "VISIBLE" | "HIDDEN",
    reason: string,
    auditContext: RequestAuditContext = {},
  ): Promise<void> {
    await this.database.db.transaction(async (transaction) => {
      const [review] = await transaction
        .select()
        .from(reviews)
        .where(eq(reviews.id, parsePublicId(reviewId)))
        .limit(1)
        .for("update");
      if (!review)
        throw new ApiError(404, "REVIEW_NOT_FOUND", "Review tidak ditemukan.");
      await transaction
        .update(reviews)
        .set({ status, updatedAt: new Date() })
        .where(eq(reviews.id, review.id));
      await transaction
        .update(reviewReports)
        .set({ status: "RESOLVED" })
        .where(eq(reviewReports.reviewId, review.id));
      await transaction.insert(auditLogs).values({
        venueId: review.venueId,
        actorUserId: parsePublicId(actorUserId),
        action: "review.moderated",
        resourceType: "review",
        resourceId: review.id,
        reason,
        beforeState: { status: review.status },
        afterState: { status },
        ...auditContext,
      });
      await refreshVenueMetrics(transaction, review.venueId);
    });
  }
}

type Transaction = Parameters<
  Parameters<DatabaseConnection["db"]["transaction"]>[0]
>[0];

async function refreshVenueMetrics(
  transaction: Transaction,
  venueId: number,
): Promise<void> {
  const [summary] = await transaction
    .select({ count: sql<number>`count(*)`, average: avg(reviews.rating) })
    .from(reviews)
    .where(and(eq(reviews.venueId, venueId), eq(reviews.status, "VISIBLE")));
  await transaction
    .insert(venueSearchMetrics)
    .values({
      venueId,
      reviewCount: Number(summary?.count ?? 0),
      ratingAverage: String(summary?.average ?? 0),
    })
    .onDuplicateKeyUpdate({
      set: {
        reviewCount: Number(summary?.count ?? 0),
        ratingAverage: String(summary?.average ?? 0),
        updatedAt: new Date(),
      },
    });
}

function reviewView(
  review: typeof reviews.$inferSelect,
  reply: typeof reviewReplies.$inferSelect | null,
) {
  return {
    ...review,
    id: formatPublicId(review.id),
    bookingId: formatPublicId(review.bookingId),
    venueId: formatPublicId(review.venueId),
    customerUserId: formatPublicId(review.customerUserId),
    reply: reply
      ? { body: reply.body, createdAt: reply.createdAt.toISOString() }
      : null,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
  };
}
