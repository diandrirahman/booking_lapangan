import { afterAll, describe, expect, it } from "vitest";
import { OperationsService } from "../../src/booking/application/OperationsService.js";
import { formatPublicId } from "../../src/database/ids.js";
import { bookings } from "../../src/database/schema/index.js";
import { RefundService } from "../../src/payment/application/RefundService.js";
import { TenantAuthorizationService } from "../../src/tenant/authorization/TenantAuthorizationService.js";
import { VenueSetupService } from "../../src/venue/setup/VenueSetupService.js";
import { testDatabase } from "../support/databaseTestHarness.js";
import { eq } from "drizzle-orm";

describe("tenant isolation", () => {
  it("menolak owner tenant pertama mengakses tenant kedua", async () => {
    const authorization = new TenantAuthorizationService(testDatabase);
    await expect(
      authorization.requireTenantAccess(formatPublicId(1), formatPublicId(2)),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "TENANT_ACCESS_DENIED",
    });
  });

  it("menolak venue yang tidak berada pada tenant aktif", async () => {
    const authorization = new TenantAuthorizationService(testDatabase);
    await expect(
      authorization.requireVenueAccess(
        formatPublicId(1),
        formatPublicId(1),
        formatPublicId(3),
      ),
    ).rejects.toMatchObject({ statusCode: 404, code: "VENUE_NOT_FOUND" });
  });

  it("membatasi Staff pada venue assignment", async () => {
    const authorization = new TenantAuthorizationService(testDatabase);
    await expect(
      authorization.requireVenueAccess(
        formatPublicId(200),
        formatPublicId(1),
        formatPublicId(2),
      ),
    ).rejects.toMatchObject({ statusCode: 403, code: "VENUE_ACCESS_DENIED" });
  });

  it("memfilter daftar venue Staff memakai assignment yang sama", async () => {
    const authorization = new TenantAuthorizationService(testDatabase);
    const access = await authorization.requireTenantAccess(
      formatPublicId(200),
      formatPublicId(1),
    );
    const service = new VenueSetupService(testDatabase);

    const staffVenues = await service.listForTenant(
      formatPublicId(1),
      access.assignedVenueIds,
    );
    const ownerVenues = await service.listForTenant(formatPublicId(1));
    const unassignedStaffVenues = await service.listForTenant(formatPublicId(1), []);

    expect(staffVenues.map((venue) => venue.id)).toEqual(access.assignedVenueIds);
    expect(ownerVenues.length).toBeGreaterThan(staffVenues.length);
    expect(unassignedStaffVenues).toEqual([]);
  });

  it("menolak Staff menjalankan aksi harga yang khusus Owner", async () => {
    const authorization = new TenantAuthorizationService(testDatabase);
    await expect(
      authorization.requireOwner(formatPublicId(200), formatPublicId(1)),
    ).rejects.toMatchObject({ statusCode: 403, code: "OWNER_ACCESS_REQUIRED" });
  });

  it("menolak Staff tanpa permission finance meskipun berada di tenant yang benar", async () => {
    const authorization = new TenantAuthorizationService(testDatabase);
    await expect(
      authorization.requirePermission(
        formatPublicId(200),
        formatPublicId(1),
        "finance.view",
      ),
    ).rejects.toMatchObject({ statusCode: 403, code: "PERMISSION_REQUIRED" });
  });

  it("mempertahankan payout account sebagai aksi Primary Owner-only", async () => {
    const authorization = new TenantAuthorizationService(testDatabase);
    await expect(
      authorization.requirePrimaryOwner(formatPublicId(200), formatPublicId(1)),
    ).rejects.toMatchObject({ statusCode: 403, code: "PRIMARY_OWNER_REQUIRED" });
  });

  it("menolak closure untuk venue milik tenant lain", async () => {
    const operations = new OperationsService(testDatabase, {} as never);
    await expect(
      operations.createClosure({
        tenantId: formatPublicId(1),
        venueId: formatPublicId(3),
        startsAt: new Date("2026-09-01T01:00:00Z"),
        endsAt: new Date("2026-09-01T03:00:00Z"),
        kind: "CLOSURE",
        reason: "Perawatan listrik terjadwal",
      }),
    ).rejects.toMatchObject({ statusCode: 404, code: "VENUE_NOT_FOUND" });
  });

  it("menolak refund booking di luar tenant dan venue aktif", async () => {
    const [foreignBooking] = await testDatabase.db
      .select({ code: bookings.bookingCode })
      .from(bookings)
      .where(eq(bookings.tenantId, 2))
      .limit(1);
    if (!foreignBooking) throw new Error("Seed booking tenant kedua tidak tersedia.");

    const refunds = new RefundService(testDatabase);
    await expect(
      refunds.requestBusinessRefund({
        bookingReference: foreignBooking.code,
        tenantId: formatPublicId(1),
        venueId: formatPublicId(1),
        amount: 1,
        reason: "Uji batas tenant",
        actorUserId: formatPublicId(1),
        idempotencyKey: `tenant-boundary-${Date.now()}`,
        manualRequired: false,
      }),
    ).rejects.toMatchObject({ statusCode: 404, code: "BOOKING_NOT_FOUND" });
  });
});

afterAll(async () => testDatabase.close());
