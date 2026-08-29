import { asc, eq } from "drizzle-orm";
import type { DatabaseConnection } from "../../database/client.js";
import { formatPublicId, parsePublicId } from "../../database/ids.js";
import {
  bookingBufferOptions,
  bookingIntervalOptions,
  facilities,
  paymentMethodOptions,
  sports,
} from "../../database/schema/index.js";
import { ApiError } from "../../http/ApiError.js";

export class AdminMasterService {
  constructor(private readonly database: DatabaseConnection) {}

  async list(): Promise<{
    sports: Array<{ id: string; slug: string; name: string; active: boolean }>;
    facilities: Array<{ id: string; slug: string; name: string; active: boolean }>;
    bookingIntervals: Array<{ id: string; minutes: number; active: boolean }>;
    buffers: Array<{ id: string; minutes: number; active: boolean }>;
    paymentOptions: Array<{ id: string; code: string; label: string; active: boolean }>;
  }> {
    const [sportRows, facilityRows, intervalRows, bufferRows, paymentRows] =
      await Promise.all([
        this.database.db.select().from(sports).orderBy(asc(sports.name)),
        this.database.db.select().from(facilities).orderBy(asc(facilities.name)),
        this.database.db
          .select()
          .from(bookingIntervalOptions)
          .orderBy(asc(bookingIntervalOptions.minutes)),
        this.database.db
          .select()
          .from(bookingBufferOptions)
          .orderBy(asc(bookingBufferOptions.minutes)),
        this.database.db
          .select()
          .from(paymentMethodOptions)
          .orderBy(asc(paymentMethodOptions.label)),
      ]);
    return {
      sports: sportRows.map(({ id, slug, name, active }) => ({
        id: formatPublicId(id),
        slug,
        name,
        active,
      })),
      facilities: facilityRows.map(({ id, slug, name, active }) => ({
        id: formatPublicId(id),
        slug,
        name,
        active,
      })),
      bookingIntervals: intervalRows.map((row) => ({
        ...row,
        id: formatPublicId(row.id),
      })),
      buffers: bufferRows.map((row) => ({
        ...row,
        id: formatPublicId(row.id),
      })),
      paymentOptions: paymentRows.map((row) => ({
        ...row,
        id: formatPublicId(row.id),
      })),
    };
  }

  async createNamedMaster(
    kind: "sport" | "facility",
    name: string,
  ): Promise<{ id: string; slug: string }> {
    const slug = slugify(name);
    const existing =
      kind === "sport"
        ? await this.database.db
            .select({ id: sports.id })
            .from(sports)
            .where(eq(sports.slug, slug))
            .limit(1)
        : await this.database.db
            .select({ id: facilities.id })
            .from(facilities)
            .where(eq(facilities.slug, slug))
            .limit(1);
    if (existing[0]) {
      throw new ApiError(
        409,
        "MASTER_ALREADY_EXISTS",
        "Master dengan nama tersebut sudah tersedia.",
      );
    }
    const [created] =
      kind === "sport"
        ? await this.database.db.insert(sports).values({ name, slug }).$returningId()
        : await this.database.db
            .insert(facilities)
            .values({ name, slug })
            .$returningId();
    if (!created) throw new Error("MySQL tidak mengembalikan ID master baru.");
    return { id: formatPublicId(created.id), slug };
  }

  async setNamedMasterActive(
    kind: "sport" | "facility",
    id: string,
    active: boolean,
  ): Promise<void> {
    if (kind === "sport") {
      await this.database.db
        .update(sports)
        .set({ active })
        .where(eq(sports.id, parsePublicId(id)));
    } else {
      await this.database.db
        .update(facilities)
        .set({ active })
        .where(eq(facilities.id, parsePublicId(id)));
    }
  }

  async createDurationOption(
    kind: "interval" | "buffer",
    minutes: number,
  ): Promise<{ id: string }> {
    const existing =
      kind === "interval"
        ? await this.database.db
            .select({ id: bookingIntervalOptions.id })
            .from(bookingIntervalOptions)
            .where(eq(bookingIntervalOptions.minutes, minutes))
            .limit(1)
        : await this.database.db
            .select({ id: bookingBufferOptions.id })
            .from(bookingBufferOptions)
            .where(eq(bookingBufferOptions.minutes, minutes))
            .limit(1);
    if (existing[0]) {
      throw new ApiError(
        409,
        "DURATION_OPTION_ALREADY_EXISTS",
        "Opsi durasi tersebut sudah tersedia.",
      );
    }
    const [created] =
      kind === "interval"
        ? await this.database.db
            .insert(bookingIntervalOptions)
            .values({ minutes })
            .$returningId()
        : await this.database.db
            .insert(bookingBufferOptions)
            .values({ minutes })
            .$returningId();
    if (!created) throw new Error("MySQL tidak mengembalikan ID opsi durasi.");
    return { id: formatPublicId(created.id) };
  }

  async createPaymentOption(code: string, label: string): Promise<{ id: string }> {
    const [existing] = await this.database.db
      .select({ id: paymentMethodOptions.id })
      .from(paymentMethodOptions)
      .where(eq(paymentMethodOptions.code, code))
      .limit(1);
    if (existing) {
      throw new ApiError(
        409,
        "PAYMENT_OPTION_ALREADY_EXISTS",
        "Kode opsi pembayaran sudah tersedia.",
      );
    }
    const [created] = await this.database.db
      .insert(paymentMethodOptions)
      .values({ code, label })
      .$returningId();
    if (!created) throw new Error("MySQL tidak mengembalikan ID opsi pembayaran.");
    return { id: formatPublicId(created.id) };
  }

  async setPaymentOptionActive(id: string, active: boolean): Promise<void> {
    await this.database.db
      .update(paymentMethodOptions)
      .set({ active })
      .where(eq(paymentMethodOptions.id, parsePublicId(id)));
  }
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
