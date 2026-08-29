import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { mediaAssets } from "../../src/database/schema/index.js";
import { MediaService } from "../../src/venue/media/MediaService.js";
import type { ObjectStorageService } from "../../src/venue/media/ObjectStorageService.js";
import { testDatabase } from "../support/databaseTestHarness.js";

describe("media orphan cleanup", () => {
  it("menghapus hanya object lama yang tidak direferensikan", async () => {
    const referencedKey = `uploads/qa/referenced-${Date.now()}.webp`;
    const orphanKey = `uploads/qa/orphan-${Date.now()}.webp`;
    const [created] = await testDatabase.db
      .insert(mediaAssets)
      .values({
        ownerUserId: 1,
        storageKey: referencedKey,
        mimeType: "image/webp",
        byteSize: 12,
        visibility: "PUBLIC",
        altText: "Media QA cleanup",
      })
      .$returningId();
    if (!created) throw new Error("Gagal membuat media QA.");
    const deleteUpload = vi.fn().mockResolvedValue(undefined);
    const storage = {
      listUploadsOlderThan: vi.fn().mockResolvedValue([referencedKey, orphanKey]),
      deleteUpload,
    } as unknown as ObjectStorageService;

    const deleted = await new MediaService(
      testDatabase,
      storage,
    ).cleanupOrphanUploads();
    expect(deleted).toBe(1);
    expect(deleteUpload).toHaveBeenCalledOnce();
    expect(deleteUpload).toHaveBeenCalledWith(orphanKey);

    await testDatabase.db.delete(mediaAssets).where(eq(mediaAssets.id, created.id));
  });

  it("hanya membuat download untuk asset berstatus publik", async () => {
    const publicKey = `uploads/qa/public-${Date.now()}.webp`;
    const privateKey = `uploads/qa/private-${Date.now()}.webp`;
    const created = await testDatabase.db
      .insert(mediaAssets)
      .values([
        {
          ownerUserId: 1,
          storageKey: publicKey,
          mimeType: "image/webp",
          byteSize: 12,
          visibility: "PUBLIC",
          altText: "Media publik QA",
        },
        {
          ownerUserId: 1,
          storageKey: privateKey,
          mimeType: "image/webp",
          byteSize: 12,
          visibility: "PRIVATE",
          altText: "Media privat QA",
        },
      ])
      .$returningId();
    const createSignedDownload = vi
      .fn()
      .mockResolvedValue("https://storage.example.test/signed-media");
    const service = new MediaService(testDatabase, {
      createSignedDownload,
    } as unknown as ObjectStorageService);

    await expect(service.createPublicDownloadUrl(publicKey)).resolves.toBe(
      "https://storage.example.test/signed-media",
    );
    await expect(service.createPublicDownloadUrl(privateKey)).rejects.toMatchObject({
      statusCode: 404,
      code: "MEDIA_NOT_FOUND",
    });
    expect(createSignedDownload).toHaveBeenCalledOnce();

    await testDatabase.db.delete(mediaAssets).where(
      inArray(
        mediaAssets.id,
        created.map((asset) => asset.id),
      ),
    );
  });
});

afterAll(async () => testDatabase.close());
