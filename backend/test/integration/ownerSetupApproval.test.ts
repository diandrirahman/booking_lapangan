import { afterAll, describe, expect, it } from "vitest";
import { BookingService } from "../../src/booking/application/BookingService.js";
import { formatPublicId, parsePublicId } from "../../src/database/ids.js";
import {
  auditLogs,
  bookingSlotReservations,
  bookings,
  mediaAssets,
  venueMedia,
} from "../../src/database/schema/index.js";
import { PricingService } from "../../src/pricing/application/PricingService.js";
import { AvailabilityService } from "../../src/schedule/availability/AvailabilityService.js";
import { TenantService } from "../../src/tenant/application/TenantService.js";
import { CatalogService } from "../../src/venue/catalog/CatalogService.js";
import { VenueSetupService } from "../../src/venue/setup/VenueSetupService.js";
import { testDatabase } from "../support/databaseTestHarness.js";
import { removeBooking } from "../support/databaseTestHarness.js";
import { eq } from "drizzle-orm";

const CUSTOMER_USER_ID = formatPublicId(100);
const ADMIN_USER_ID = formatPublicId(4);
const BADMINTON_SPORT_ID = formatPublicId(1);
const PARKING_FACILITY_ID = formatPublicId(1);

describe("Owner setup dan Admin approval", () => {
  it("menerbitkan venue lengkap ke katalog Customer", async () => {
    const uniqueSuffix = Date.now().toString().slice(-7);
    const venueName = `Arena Integrasi ${uniqueSuffix}`;
    const tenantService = new TenantService(testDatabase);
    const venueSetupService = new VenueSetupService(testDatabase);

    const workspace = await tenantService.createDraft(
      CUSTOMER_USER_ID,
      `Grup Integrasi ${uniqueSuffix}`,
    );
    const venue = await venueSetupService.createDraft(workspace.tenantId, venueName);

    await venueSetupService.updateProfile(venue.id, workspace.tenantId, {
      name: venueName,
      description: "Arena badminton indoor untuk keluarga dan komunitas lokal.",
      phoneE164: "+6281212345600",
      email: "halo@arena-integrasi.test",
      addressLine: "Jalan Integrasi No. 18, Jakarta Selatan",
      provinceCode: "31",
      cityCode: "3174",
      districtCode: "3174010",
      postalCode: "12190",
      latitude: "-6.2614930",
      longitude: "106.8106000",
      timezone: "Asia/Jakarta",
      indoorOutdoorType: "INDOOR",
      parkingInfo: "Parkir motor dan mobil tersedia.",
      houseRules: "Gunakan sepatu olahraga dan hadir 15 menit sebelum jadwal.",
      emergencyContact: "+6281212345699",
    });
    await venueSetupService.replaceCatalog(
      venue.id,
      workspace.tenantId,
      [BADMINTON_SPORT_ID],
      [PARKING_FACILITY_ID],
    );
    await attachTestMedia(venue.id);

    const court = await venueSetupService.createCourt(venue.id, workspace.tenantId, {
      sportId: BADMINTON_SPORT_ID,
      name: "Lapangan Utama",
      surface: "Vinyl",
      capacity: 4,
    });
    await expect(
      venueSetupService.saveCourtAvailability(venue.id, court.id, workspace.tenantId, {
        intervalMinutes: 75,
        bufferMinutes: 0,
        minimumDurationMinutes: 75,
        maximumDurationMinutes: 150,
        bookingWindowDays: 30,
        minimumLeadMinutes: 60,
        weeklySchedule: [],
      }),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: "SCHEDULE_OPTION_INACTIVE",
    });
    await venueSetupService.saveCourtAvailability(
      venue.id,
      court.id,
      workspace.tenantId,
      {
        intervalMinutes: 60,
        bufferMinutes: 15,
        minimumDurationMinutes: 60,
        maximumDurationMinutes: 180,
        bookingWindowDays: 30,
        minimumLeadMinutes: 60,
        weeklySchedule: [
          {
            dayOfWeek: 5,
            opensAt: "08:00:00",
            closesAt: "22:00:00",
            active: true,
          },
        ],
      },
    );
    const pricingService = new PricingService(testDatabase);
    await pricingService.createRule({
      tenantId: workspace.tenantId,
      venueId: venue.id,
      courtId: null,
      kind: "BASE",
      amount: 95_000,
      dayOfWeek: null,
      specialDate: null,
      startsAtLocal: null,
      endsAtLocal: null,
    });
    const candidateRule = {
      tenantId: workspace.tenantId,
      venueId: venue.id,
      courtId: null,
      kind: "SPECIAL_DATE" as const,
      amount: 145_000,
      dayOfWeek: null,
      specialDate: "2026-08-28",
      startsAtLocal: null,
      endsAtLocal: null,
    };
    await expect(
      pricingService.preview({
        tenantId: workspace.tenantId,
        venueId: venue.id,
        courtId: court.id,
        samples: [
          { localDate: "2026-08-28", localTime: "10:00:00" },
          { localDate: "2026-08-29", localTime: "10:00:00" },
        ],
        candidate: candidateRule,
      }),
    ).resolves.toEqual({
      items: [
        expect.objectContaining({
          amount: 145_000,
          selectedKind: "SPECIAL_DATE",
          selectedRuleId: "candidate",
        }),
        expect.objectContaining({ amount: 95_000, selectedKind: "BASE" }),
      ],
    });
    await expect(
      pricingService.preview({
        tenantId: workspace.tenantId,
        venueId: venue.id,
        courtId: court.id,
        samples: [{ localDate: "2026-08-28", localTime: "10:00:00" }],
        candidate: {
          ...candidateRule,
          kind: "BASE",
          specialDate: null,
        },
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: "PRICE_RULE_OVERLAP" });
    await venueSetupService.savePaymentSettings(venue.id, workspace.tenantId, {
      allowFull: true,
      allowDp: true,
      dpPercentage: 50,
      allowPayAtVenue: true,
      reservationAmount: 50_000,
      manualConfirmationMinutes: 30,
      balanceDeadlineMinutes: 120,
    });

    const progress = await venueSetupService.progress(venue.id, workspace.tenantId);
    expect(progress.complete).toBe(true);

    const submission = await venueSetupService.submit(
      venue.id,
      workspace.tenantId,
      CUSTOMER_USER_ID,
    );
    await venueSetupService.decide(
      submission.requestId,
      ADMIN_USER_ID,
      "APPROVED",
      "Data dan fasilitas telah diverifikasi.",
    );

    const auditEvents = await testDatabase.db
      .select({
        action: auditLogs.action,
        actorUserId: auditLogs.actorUserId,
        reason: auditLogs.reason,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(eq(auditLogs.venueId, parsePublicId(venue.id)));
    expect(auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "venue.publication_submitted",
          actorUserId: parsePublicId(CUSTOMER_USER_ID),
          createdAt: expect.any(Date),
        }),
        expect.objectContaining({
          action: "venue.publication_decided",
          actorUserId: parsePublicId(ADMIN_USER_ID),
          reason: "Data dan fasilitas telah diverifikasi.",
          createdAt: expect.any(Date),
        }),
      ]),
    );

    const catalogService = new CatalogService(testDatabase);
    const catalog = await catalogService.search({
      query: venueName,
      limit: 20,
    });
    expect(catalog.items).toEqual([
      expect.objectContaining({
        id: venue.id,
        name: venueName,
        priceFrom: 95_000,
      }),
    ]);
    await expect(catalogService.getBySlug(venue.slug)).resolves.toEqual(
      expect.objectContaining({ id: venue.id, slug: venue.slug }),
    );
    const availabilityService = new AvailabilityService(testDatabase);
    const generatedAvailability = await availabilityService.get(
      court.id,
      "2026-08-28",
      new Date("2026-08-27T00:00:00Z"),
    );
    expect(generatedAvailability.items).toHaveLength(14);
    expect(
      generatedAvailability.items.every((slot) => slot.status === "AVAILABLE"),
    ).toBe(true);

    const firstSlot = generatedAvailability.items[0];
    if (!firstSlot) throw new Error("Materializer tidak membuat slot pertama.");
    const booking = await new BookingService(testDatabase).create(
      {
        venueId: venue.id,
        courtId: court.id,
        slotIds: [firstSlot.id],
        paymentMode: "FULL",
      },
      CUSTOMER_USER_ID,
      `buffer-integration-${uniqueSuffix}`,
      new Date("2026-08-27T00:00:00Z"),
    );
    const [createdBooking] = await testDatabase.db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.bookingCode, booking.id))
      .limit(1);
    if (!createdBooking) throw new Error("Booking buffer tidak tersimpan.");
    const reservations = await testDatabase.db
      .select({ courtSlotId: bookingSlotReservations.courtSlotId })
      .from(bookingSlotReservations)
      .where(eq(bookingSlotReservations.bookingId, createdBooking.id));
    expect(reservations).toHaveLength(2);
    await removeBooking(String(createdBooking.id));

    await venueSetupService.createException(venue.id, workspace.tenantId, {
      courtId: court.id,
      localDate: "2026-08-28",
      kind: "CLOSED",
      reason: "Perawatan khusus integration test.",
    });
    const closedAvailability = await availabilityService.get(
      court.id,
      "2026-08-28",
      new Date("2026-08-27T00:00:00Z"),
    );
    expect(closedAvailability.items.every((slot) => slot.status === "BLOCKED")).toBe(
      true,
    );

    const nextOwner = await tenantService.addMember(
      workspace.tenantId,
      "raka.mahendra@contoh.test",
      "OWNER",
    );
    await tenantService.transferPrimaryOwner(
      workspace.tenantId,
      CUSTOMER_USER_ID,
      nextOwner.membershipId,
      "Serah terima operasional integration test.",
      `owner-transfer-${uniqueSuffix}`,
    );
    const members = await tenantService.listMembers(workspace.tenantId);
    expect(members.filter((member) => member.role === "PRIMARY_OWNER")).toEqual([
      expect.objectContaining({
        membershipId: nextOwner.membershipId,
        userId: formatPublicId(101),
      }),
    ]);
  });
});

async function attachTestMedia(venueId: string): Promise<void> {
  const [asset] = await testDatabase.db
    .insert(mediaAssets)
    .values({
      ownerUserId: parsePublicId(CUSTOMER_USER_ID),
      storageKey: `integration/${venueId}/cover.webp`,
      mimeType: "image/webp",
      byteSize: 24_000,
      visibility: "PUBLIC",
      altText: "Lapangan badminton indoor",
    })
    .$returningId();
  if (!asset) throw new Error("Gagal membuat media test.");
  await testDatabase.db.insert(venueMedia).values({
    venueId: parsePublicId(venueId),
    mediaAssetId: asset.id,
    purpose: "COVER",
    sortOrder: 0,
  });
}

afterAll(async () => testDatabase.close());
