import { describe, expect, it, vi } from "vitest";
import { LapanganGoApiClient } from "./client";

describe("LapanganGoApiClient", () => {
  it("menerima respons 2xx tanpa body untuk command void", async () => {
    const fetchImplementation = vi.fn(async () => new Response(null, { status: 201 }));
    const client = new LapanganGoApiClient({ fetchImplementation });

    await expect(
      client.replyToBusinessReview("review-id", "tenant-id", "Terima kasih"),
    ).resolves.toBeUndefined();
  });
});
