import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { AvailabilityService } from "../../src/schedule/availability/AvailabilityService.js";
import { CatalogService } from "../../src/venue/catalog/CatalogService.js";
import { testDatabase } from "../support/databaseTestHarness.js";
import { formatPublicId } from "../../src/database/ids.js";
import { venueSearchMetrics } from "../../src/database/schema/index.js";

describe("catalog and availability integration", () => {
  it("hanya mengembalikan venue aktif dan approved", async () => {
    const result = await new CatalogService(testDatabase).search({ limit: 20 });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.some((venue) => venue.slug === "urban-kick-bsd")).toBe(false);
  });

  it("menghasilkan slot API dengan harga authoritative", async () => {
    const result = await new AvailabilityService(testDatabase).get(
      formatPublicId(1),
      "2026-08-28",
      new Date("2026-08-27T00:00:00Z"),
    );
    expect(result.items).toHaveLength(16);
    expect(result.items[0]?.price).toBe(85_000);
    expect(result.items.some((slot) => slot.status === "AVAILABLE")).toBe(true);
  });

  it("menutup slot yang melewati minimum lead time sebelum checkout", async () => {
    const service = new AvailabilityService(testDatabase);
    const baseline = await service.get(
      formatPublicId(1),
      "2026-08-28",
      new Date("2026-08-27T00:00:00Z"),
    );
    const availableSlot = baseline.items.find((slot) => slot.status === "AVAILABLE");
    if (!availableSlot) throw new Error("Seed tidak menyediakan slot available.");
    const thirtyMinutesBeforeSlot = new Date(
      new Date(availableSlot.startsAt).getTime() - 30 * 60_000,
    );

    const result = await service.get(
      formatPublicId(1),
      "2026-08-28",
      thirtyMinutesBeforeSlot,
    );

    expect(result.items.find((slot) => slot.id === availableSlot.id)?.status).toBe(
      "BLOCKED",
    );
  });

  it("menghitung nearest slot secara live dan tidak memakai metric lampau", async () => {
    const now = new Date("2026-08-27T00:00:00.000Z");
    const [originalMetric] = await testDatabase.db
      .select({ nearestSlotStartsAt: venueSearchMetrics.nearestSlotStartsAt })
      .from(venueSearchMetrics)
      .where(eq(venueSearchMetrics.venueId, 1))
      .limit(1);
    if (!originalMetric) throw new Error("Metric venue seed tidak tersedia.");

    try {
      await testDatabase.db
        .update(venueSearchMetrics)
        .set({ nearestSlotStartsAt: new Date("2026-08-01T00:00:00.000Z") })
        .where(eq(venueSearchMetrics.venueId, 1));

      const result = await new CatalogService(testDatabase).search(
        { sort: "NEAREST", limit: 20 },
        now,
      );
      const venue = result.items.find((item) => item.id === formatPublicId(1));
      if (!venue) throw new Error("Venue seed tidak muncul di katalog.");

      expect(venue.nearestSlotStartsAt).not.toBeNull();
      expect(new Date(venue.nearestSlotStartsAt ?? 0).getTime()).toBeGreaterThanOrEqual(
        now.getTime(),
      );
      expect(venue.nearestSlotStartsAt).not.toBe("2026-08-01T00:00:00.000Z");
    } finally {
      await testDatabase.db
        .update(venueSearchMetrics)
        .set({ nearestSlotStartsAt: originalMetric.nearestSlotStartsAt })
        .where(eq(venueSearchMetrics.venueId, 1));
    }
  });
});

afterAll(async () => testDatabase.close());
