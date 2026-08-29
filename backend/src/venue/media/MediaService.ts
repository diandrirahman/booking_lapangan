import { and, eq, inArray, sql } from "drizzle-orm";
import type { DatabaseConnection } from "../../database/client.js";
import { formatPublicId, parsePublicId } from "../../database/ids.js";
import { mediaAssets, venueMedia, venues } from "../../database/schema/index.js";
import { ApiError } from "../../http/ApiError.js";
import type { ObjectStorageService } from "./ObjectStorageService.js";

export interface CompleteVenueUploadInput {
  tenantId: string;
  venueId: string;
  storageKey: string;
  mimeType: string;
  byteSize: number;
  altText: string;
  purpose: "COVER" | "GALLERY";
}

export class MediaService {
  constructor(
    private readonly database: DatabaseConnection,
    private readonly storage: ObjectStorageService,
  ) {}

  async createVenueUpload(
    userId: string,
    input: {
      tenantId: string;
      venueId: string;
      fileName: string;
      mimeType: string;
      byteSize: number;
    },
  ) {
    await this.requireVenue(input.tenantId, input.venueId);
    return this.storage.createSignedUpload(
      userId,
      input.tenantId,
      input.venueId,
      input.fileName,
      input.mimeType,
      input.byteSize,
    );
  }

  async completeVenueUpload(
    userId: string,
    input: CompleteVenueUploadInput,
  ): Promise<{ id: string }> {
    if (!input.mimeType.startsWith("image/")) {
      throw new ApiError(
        422,
        "VENUE_MEDIA_MUST_BE_IMAGE",
        "Cover dan galeri venue hanya menerima file gambar.",
      );
    }
    if (
      !input.storageKey.startsWith(
        `uploads/${input.tenantId}/${input.venueId}/${userId}/`,
      )
    ) {
      throw new ApiError(
        403,
        "UPLOAD_OWNER_MISMATCH",
        "Upload tidak dibuat oleh akun aktif.",
      );
    }
    const [existingAsset] = await this.database.db
      .select({ id: mediaAssets.id })
      .from(mediaAssets)
      .where(eq(mediaAssets.storageKey, input.storageKey))
      .limit(1);
    if (existingAsset) {
      throw new ApiError(
        409,
        "UPLOAD_ALREADY_COMPLETED",
        "Upload ini sudah pernah disimpan sebagai media.",
      );
    }
    await this.storage.verifyUpload(input.storageKey, input.mimeType, input.byteSize);
    const venueDatabaseId = await this.requireVenue(input.tenantId, input.venueId);

    return this.database.db.transaction(async (transaction) => {
      const existingMedia = await transaction
        .select({
          mediaAssetId: venueMedia.mediaAssetId,
          purpose: venueMedia.purpose,
          sortOrder: venueMedia.sortOrder,
        })
        .from(venueMedia)
        .where(eq(venueMedia.venueId, venueDatabaseId))
        .for("update");
      if (existingMedia.length >= 12) {
        throw new ApiError(
          409,
          "VENUE_MEDIA_LIMIT_REACHED",
          "Maksimal 12 foto dapat disimpan untuk satu venue.",
        );
      }
      if (input.purpose === "COVER") {
        const previousCover = existingMedia.find((media) => media.purpose === "COVER");
        if (previousCover) {
          await transaction
            .update(venueMedia)
            .set({ purpose: "GALLERY" })
            .where(
              and(
                eq(venueMedia.venueId, venueDatabaseId),
                eq(venueMedia.mediaAssetId, previousCover.mediaAssetId),
              ),
            );
        }
      }
      const [asset] = await transaction
        .insert(mediaAssets)
        .values({
          ownerUserId: parsePublicId(userId),
          storageKey: input.storageKey,
          mimeType: input.mimeType,
          byteSize: input.byteSize,
          visibility: "PUBLIC",
          altText: input.altText,
        })
        .$returningId();
      if (!asset) throw new Error("MySQL tidak mengembalikan ID media.");
      await transaction.insert(venueMedia).values({
        venueId: venueDatabaseId,
        mediaAssetId: asset.id,
        purpose: input.purpose,
        sortOrder:
          existingMedia.reduce(
            (highest, media) => Math.max(highest, media.sortOrder),
            -1,
          ) + 1,
      });
      await transaction
        .update(venues)
        .set({ version: sql`${venues.version} + 1`, updatedAt: new Date() })
        .where(eq(venues.id, venueDatabaseId));
      return { id: formatPublicId(asset.id) };
    });
  }

  async cleanupOrphanUploads(cutoff = new Date(Date.now() - 60 * 60 * 1_000)) {
    const candidates = await this.storage.listUploadsOlderThan(cutoff, 100);
    if (!candidates.length) return 0;
    const referenced = await this.database.db
      .select({ storageKey: mediaAssets.storageKey })
      .from(mediaAssets)
      .where(inArray(mediaAssets.storageKey, candidates));
    const referencedKeys = new Set(referenced.map((asset) => asset.storageKey));
    const orphans = candidates.filter((storageKey) => !referencedKeys.has(storageKey));
    for (const storageKey of orphans) await this.storage.deleteUpload(storageKey);
    return orphans.length;
  }

  private async requireVenue(tenantId: string, venueId: string): Promise<number> {
    const venueDatabaseId = parsePublicId(venueId);
    const [venue] = await this.database.db
      .select({ id: venues.id })
      .from(venues)
      .where(
        and(
          eq(venues.id, venueDatabaseId),
          eq(venues.tenantId, parsePublicId(tenantId)),
        ),
      )
      .limit(1);
    if (!venue) throw new ApiError(404, "VENUE_NOT_FOUND", "Venue tidak ditemukan.");
    return venue.id;
  }
}
