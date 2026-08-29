import { createHash } from "node:crypto";
import { hash } from "argon2";
import { eq } from "drizzle-orm";
import { loadEnvironment } from "../config/environment.js";
import { createDatabaseConnection, type DatabaseConnection } from "./client.js";
import {
  addonCourts,
  addons,
  attendanceRecords,
  auditLogs,
  authIdentities,
  bookingAddonItems,
  bookingBufferOptions,
  bookingCancellations,
  bookingIntervalOptions,
  bookingItems,
  bookingPaymentSummaries,
  bookingPriceLines,
  bookingQrTokens,
  bookingReschedules,
  bookings,
  bookingSlotHistory,
  bookingSlotReservations,
  bookingStateTransitions,
  commandIdempotency,
  courtBlocks,
  courtBookingSettings,
  courts,
  courtSlots,
  courtWeeklySchedules,
  facilities,
  inboxEvents,
  mediaAssets,
  memberVenueAssignments,
  offlineBookingDetails,
  outboxEvents,
  ownerVerificationCases,
  paymentAttempts,
  paymentMethodOptions,
  paymentProviderEvents,
  platformAdmins,
  priceRules,
  promotionScopes,
  promotions,
  refunds,
  refundStateTransitions,
  scheduleExceptions,
  sports,
  tenantMemberships,
  tenants,
  users,
  userNotifications,
  venueFacilities,
  venueMedia,
  venueOperatingHours,
  venuePaymentSettings,
  venuePublicationRequests,
  venueSearchMetrics,
  venueSports,
  venues,
  verificationDocuments,
} from "./schema/index.js";

type DatabaseTransaction = Parameters<
  Parameters<DatabaseConnection["db"]["transaction"]>[0]
>[0];

const SEED_REFERENCE_DATE = new Date("2026-08-27T08:00:00.000Z");

const ownerSeeds = [
  [1, "Andika Pratama", "andika.pratama@lapangango.test", "+6281218456701"],
  [2, "Maya Kusuma", "maya.kusuma@lapangango.test", "+6281287245302"],
  [3, "Bima Aditya", "bima.aditya@lapangango.test", "+6281391764203"],
] as const;

const customerNames = [
  "Nadia Putri",
  "Raka Mahendra",
  "Salsabila Rahma",
  "Fajar Nugroho",
  "Dewi Lestari",
  "Arif Setiawan",
  "Intan Permata",
  "Rizky Ramadhan",
  "Ayu Wulandari",
  "Dimas Saputra",
  "Nabila Azzahra",
  "Galang Prakoso",
  "Citra Maharani",
  "Farhan Akbar",
  "Putri Anindya",
  "Reza Kurniawan",
  "Vina Oktaviani",
  "Yoga Pratama",
  "Tiara Safitri",
  "Bagas Wirawan",
  "Aulia Ramadhani",
  "Kevin Wijaya",
  "Shinta Larasati",
  "Ilham Maulana",
  "Nadya Amelia",
  "Hendra Gunawan",
  "Mutiara Sari",
  "Alvin Hartono",
  "Nurul Hidayah",
  "Joko Santoso",
] as const;

const staffNames = [
  "Agus Firmansyah",
  "Rina Melati",
  "Wahyu Hidayat",
  "Laila Fitria",
  "Doni Kurnia",
  "Siti Marwah",
  "Bayu Pamungkas",
  "Anisa Fauziah",
] as const;

const tenantSeeds = [
  { id: 1, name: "Cendana Sports Group", slug: "cendana-sports-group", ownerId: 1 },
  { id: 2, name: "Urban Athletic Club", slug: "urban-athletic-club", ownerId: 2 },
  { id: 3, name: "Nusantara Arena", slug: "nusantara-arena", ownerId: 3 },
] as const;

const sportNames = [
  "Badminton",
  "Futsal",
  "Padel",
  "Basket",
  "Tenis",
  "Mini Soccer",
  "Voli",
  "Tenis Meja",
] as const;

const facilityNames = [
  "Area parkir",
  "Ruang ganti",
  "Kamar mandi",
  "Kafe",
  "Mushola",
  "Penyewaan alat",
] as const;

const venueSeeds = [
  venue(
    1,
    1,
    1,
    "Arena Cendana",
    "Kemang, Jakarta Selatan",
    -6.2608,
    106.8134,
    4.9,
    284,
    85_000,
  ),
  venue(
    2,
    1,
    2,
    "Soccer Hub Cilandak",
    "Cilandak, Jakarta Selatan",
    -6.2921,
    106.7992,
    4.8,
    193,
    180_000,
  ),
  venue(
    3,
    2,
    3,
    "Padel Park Senayan",
    "Senayan, Jakarta Pusat",
    -6.2185,
    106.8023,
    4.9,
    321,
    220_000,
  ),
  venue(
    4,
    2,
    4,
    "Hoops House Kemang",
    "Kemang, Jakarta Selatan",
    -6.2661,
    106.8178,
    4.7,
    98,
    160_000,
  ),
  venue(
    5,
    3,
    5,
    "Menteng Tennis Club",
    "Menteng, Jakarta Pusat",
    -6.1952,
    106.8326,
    4.8,
    142,
    145_000,
  ),
  venue(
    6,
    3,
    6,
    "Urban Kick BSD",
    "BSD, Tangerang Selatan",
    -6.3017,
    106.6527,
    4.6,
    76,
    250_000,
  ),
] as const;

const environment = loadEnvironment();
assertSafeSeedTarget(environment.DATABASE_URL, environment.NODE_ENV);
const demoPassword = environment.SEED_DEMO_PASSWORD;
if (!demoPassword) {
  throw new Error("SEED_DEMO_PASSWORD wajib diisi untuk menjalankan seed development.");
}
const database = createDatabaseConnection(environment);

try {
  const passwordHash = await hash(demoPassword);
  await database.db.transaction(async (transaction) => {
    await clearDatabase(transaction);
    await seedIdentity(transaction, passwordHash);
    await seedCatalog(transaction);
    await seedBookingHistory(transaction);
    await seedNotifications(transaction);
  });
  console.info("Seed development selesai.");
  console.info("Owner: andika.pratama@lapangango.test");
  console.info("Customer: nadia.putri@contoh.test");
  console.info("Gunakan password dari SEED_DEMO_PASSWORD.");
} finally {
  await database.close();
}

async function clearDatabase(transaction: DatabaseTransaction): Promise<void> {
  await transaction.update(tenants).set({ primaryOwnerMembershipId: null });

  const childTables = [
    paymentProviderEvents,
    refundStateTransitions,
    refunds,
    paymentAttempts,
    attendanceRecords,
    bookingQrTokens,
    bookingStateTransitions,
    bookingSlotHistory,
    bookingSlotReservations,
    bookingAddonItems,
    bookingPriceLines,
    offlineBookingDetails,
    bookingReschedules,
    bookingCancellations,
    bookingPaymentSummaries,
    bookingItems,
    commandIdempotency,
    userNotifications,
    outboxEvents,
    inboxEvents,
    bookings,
    promotionScopes,
    promotions,
    verificationDocuments,
    ownerVerificationCases,
    venuePublicationRequests,
    venueSearchMetrics,
    priceRules,
    courtBlocks,
    scheduleExceptions,
    courtWeeklySchedules,
    venueOperatingHours,
    courtBookingSettings,
    courtSlots,
    addonCourts,
    addons,
    venueMedia,
    venueFacilities,
    venueSports,
    venuePaymentSettings,
    courts,
    mediaAssets,
    auditLogs,
    memberVenueAssignments,
    platformAdmins,
    tenantMemberships,
    venues,
    tenants,
    authIdentities,
    users,
    paymentMethodOptions,
    bookingBufferOptions,
    bookingIntervalOptions,
    facilities,
    sports,
  ] as const;

  for (const table of childTables) await transaction.delete(table);
}

async function seedIdentity(
  transaction: DatabaseTransaction,
  passwordHash: string,
): Promise<void> {
  const customerRows = customerNames.map((name, index) => ({
    id: 100 + index,
    name,
    email: `${slugify(name)}@contoh.test`,
    phoneE164: phoneNumber(100 + index),
    passwordHash,
    emailVerifiedAt: SEED_REFERENCE_DATE,
  }));
  const staffRows = staffNames.map((name, index) => ({
    id: 200 + index,
    name,
    email: `${slugify(name)}@tim-lapangango.test`,
    phoneE164: phoneNumber(200 + index),
    passwordHash,
    emailVerifiedAt: SEED_REFERENCE_DATE,
  }));

  await transaction.insert(users).values([
    ...ownerSeeds.map(([id, name, email, phoneE164]) => ({
      id,
      name,
      email,
      phoneE164,
      passwordHash,
      emailVerifiedAt: SEED_REFERENCE_DATE,
    })),
    {
      id: 4,
      name: "Dian Prakoso",
      email: "admin@lapangango.test",
      phoneE164: "+628117450090",
      passwordHash,
      emailVerifiedAt: SEED_REFERENCE_DATE,
    },
    ...customerRows,
    ...staffRows,
  ]);

  await transaction
    .insert(tenants)
    .values(
      tenantSeeds.map(({ id, name, slug }) => ({ id, name, slug, status: "ACTIVE" })),
    );

  await transaction.insert(tenantMemberships).values([
    ...tenantSeeds.map((seed) => ({
      id: seed.id,
      tenantId: seed.id,
      userId: seed.ownerId,
      role: "PRIMARY_OWNER",
      status: "ACTIVE",
    })),
    ...staffNames.map((_, index) => ({
      id: 10 + index,
      tenantId: (index % 3) + 1,
      userId: 200 + index,
      role: "STAFF",
      status: "ACTIVE",
    })),
  ]);

  for (const tenant of tenantSeeds) {
    await transaction
      .update(tenants)
      .set({ primaryOwnerMembershipId: tenant.id })
      .where(eq(tenants.id, tenant.id));
  }

  await transaction.insert(platformAdmins).values({ userId: 4, active: true });
}

async function seedCatalog(transaction: DatabaseTransaction): Promise<void> {
  await transaction
    .insert(sports)
    .values(
      sportNames.map((name, index) => ({ id: index + 1, name, slug: slugify(name) })),
    );
  await transaction.insert(facilities).values(
    facilityNames.map((name, index) => ({
      id: index + 1,
      name,
      slug: slugify(name),
    })),
  );
  await transaction
    .insert(bookingIntervalOptions)
    .values(
      [30, 45, 60, 90, 120].map((minutes, index) => ({ id: index + 1, minutes })),
    );
  await transaction
    .insert(bookingBufferOptions)
    .values([0, 15, 30].map((minutes, index) => ({ id: index + 1, minutes })));
  await transaction.insert(paymentMethodOptions).values([
    { id: 1, code: "FULL", label: "Bayar penuh" },
    { id: 2, code: "DP", label: "DP 50%" },
    { id: 3, code: "PAY_AT_VENUE", label: "Bayar di venue" },
  ]);

  for (const seed of venueSeeds) {
    await transaction.insert(venues).values({
      id: seed.id,
      tenantId: seed.tenantId,
      name: seed.name,
      slug: slugify(seed.name),
      description: `${seed.name} menyediakan lapangan terawat untuk latihan dan pertandingan komunitas.`,
      phoneE164: phoneNumber(300 + seed.id),
      email: `${slugify(seed.name)}@venue.test`,
      addressLine: seed.address,
      provinceCode: seed.id === 6 ? "36" : "31",
      cityCode:
        seed.id === 6 ? "3674" : seed.address.includes("Pusat") ? "3173" : "3171",
      postalCode: seed.id === 6 ? "15345" : "12150",
      latitude: String(seed.latitude),
      longitude: String(seed.longitude),
      indoorOutdoorType: seed.id % 2 === 0 ? "OUTDOOR" : "INDOOR",
      parkingInfo: "Parkir motor dan mobil tersedia untuk pengunjung.",
      houseRules: "Datang 15 menit sebelum jadwal dan gunakan sepatu olahraga.",
      emergencyContact: phoneNumber(400 + seed.id),
      status: seed.id === 6 ? "DRAFT" : "ACTIVE",
      publicationStatus: seed.id === 6 ? "IN_REVIEW" : "APPROVED",
      publishedAt: seed.id === 6 ? null : new Date("2026-08-01T03:00:00.000Z"),
    });
    await transaction.insert(venueSports).values({
      venueId: seed.id,
      sportId: seed.sportId,
    });
    await transaction
      .insert(venueFacilities)
      .values([1, 2, 3, 5].map((facilityId) => ({ venueId: seed.id, facilityId })));
    await transaction.insert(venueSearchMetrics).values({
      venueId: seed.id,
      ratingAverage: String(seed.rating),
      reviewCount: seed.reviewCount,
      popularityScore: seed.reviewCount * 10,
      minimumPrice: seed.minimumPrice,
      nearestSlotStartsAt: slotStart(1, 0),
    });
    await transaction.insert(venuePaymentSettings).values({
      venueId: seed.id,
      allowFull: true,
      allowDp: true,
      dpPercentage: 50,
      allowPayAtVenue: true,
      reservationAmount: Math.min(50_000, seed.minimumPrice),
      balanceDeadlineMinutes: 120,
    });

    for (let courtOffset = 0; courtOffset < 2; courtOffset += 1) {
      const courtId = (seed.id - 1) * 2 + courtOffset + 1;
      await transaction.insert(courts).values({
        id: courtId,
        venueId: seed.id,
        sportId: seed.sportId,
        name: `Lapangan ${courtOffset + 1}`,
        surface: surfaceForSport(seed.sportId),
        capacity: seed.sportId === 2 || seed.sportId === 6 ? 14 : 8,
      });
      await transaction.insert(courtBookingSettings).values({
        courtId,
        intervalMinutes: 60,
        maximumDurationMinutes: 180,
      });
      await transaction.insert(courtWeeklySchedules).values(
        Array.from({ length: 7 }, (_, dayOfWeek) => ({
          id: courtId * 10 + dayOfWeek + 1,
          courtId,
          dayOfWeek,
          opensAt: "07:00:00",
          closesAt: "23:00:00",
        })),
      );
      await transaction.insert(priceRules).values({
        id: courtId,
        venueId: seed.id,
        courtId,
        kind: "BASE",
        priority: 1,
        amount: seed.minimumPrice + courtOffset * 15_000,
      });
      await transaction.insert(courtSlots).values(
        Array.from({ length: 7 }, (_, slotIndex) => ({
          id: slotId(courtId, slotIndex),
          courtId,
          startsAt: slotStart(courtId, slotIndex),
          endsAt: new Date(slotStart(courtId, slotIndex).getTime() + 3_600_000),
        })),
      );
    }
    await transaction.insert(addons).values([
      {
        id: seed.id * 10 + 1,
        venueId: seed.id,
        name: "Sewa perlengkapan premium",
        price: 25_000,
      },
      {
        id: seed.id * 10 + 2,
        venueId: seed.id,
        name: "Air mineral 4 botol",
        price: 20_000,
      },
    ]);
  }

  await transaction.insert(promotions).values({
    id: 1,
    name: "Harga komunitas weekday",
    description: "Badge discovery; belum mengurangi total checkout B1.",
    status: "ACTIVE",
    startsAt: new Date("2026-08-01T00:00:00.000Z"),
    endsAt: new Date("2026-12-31T16:59:59.000Z"),
    discoveryOnly: true,
  });
  await transaction.insert(promotionScopes).values({
    id: 1,
    promotionId: 1,
    scopeType: "VENUE",
    scopeReferenceId: 1,
  });
  await transaction.insert(memberVenueAssignments).values(
    staffNames.map((_, index) => ({
      membershipId: 10 + index,
      venueId: (index % 3) * 2 + 1 + (Math.floor(index / 3) % 2),
    })),
  );
}

async function seedBookingHistory(transaction: DatabaseTransaction): Promise<void> {
  for (let index = 0; index < 50; index += 1) {
    const bookingId = 1_001 + index;
    const courtId = (index % 12) + 1;
    const venueId = Math.ceil(courtId / 2);
    const venueSeed = venueSeeds[venueId - 1]!;
    const source = index % 5 === 0 ? "OFFLINE" : "ONLINE";
    const status = bookingStatus(index);
    const paymentMode =
      index % 4 === 0 ? "DP" : index % 5 === 0 ? "PAY_AT_VENUE" : "FULL";
    const totalAmount = venueSeed.minimumPrice + (courtId % 2) * 15_000;
    const paidAmount = paidAmountFor(status, paymentMode, totalAmount);
    const balanceDue = totalAmount - paidAmount;
    const customerUserId = source === "ONLINE" ? 100 + ((index + 29) % 30) : null;
    const createdByUserId = source === "ONLINE" ? customerUserId! : 200 + (index % 8);
    const activeReservation = ["HOLD", "PENDING_CONFIRMATION", "CONFIRMED"].includes(
      status,
    );
    const activeSlotIndex = Math.floor(index / 12);
    const startsAt = activeReservation
      ? slotStart(courtId, activeSlotIndex)
      : new Date(SEED_REFERENCE_DATE.getTime() - (index + 1) * 86_400_000);
    const endsAt = new Date(startsAt.getTime() + 3_600_000);
    const expiresAt = new Date(SEED_REFERENCE_DATE.getTime() + 7_200_000);

    await transaction.insert(bookings).values({
      id: bookingId,
      bookingCode: seedPublicReference("LG", `booking-${bookingId}`),
      tenantId: venueSeed.tenantId,
      venueId,
      customerUserId,
      source,
      status,
      paymentMode,
      totalAmount,
      balanceDue,
      holdExpiresAt: status === "HOLD" ? expiresAt : null,
      confirmationExpiresAt: status === "PENDING_CONFIRMATION" ? expiresAt : null,
      createdByUserId,
      createdAt: new Date(SEED_REFERENCE_DATE.getTime() - (index + 2) * 86_400_000),
    });
    await transaction.insert(bookingItems).values({
      id: 2_001 + index,
      bookingId,
      courtId,
      startsAt,
      endsAt,
      subtotal: totalAmount,
    });
    await transaction.insert(bookingPriceLines).values({
      id: 3_001 + index,
      bookingId,
      lineType: "COURT_SLOT",
      referenceId: activeReservation ? slotId(courtId, activeSlotIndex) : null,
      label: `Sewa ${venueSeed.name} - Lapangan ${((courtId - 1) % 2) + 1}`,
      quantity: 1,
      unitAmount: totalAmount,
      totalAmount,
      ruleSnapshot: { source: "seed", priceRuleId: courtId },
    });
    await transaction.insert(bookingPaymentSummaries).values({
      bookingId,
      status: paymentSummaryStatus(paidAmount, totalAmount),
      totalPaid: paidAmount,
      totalRefunded: 0,
      balanceDue,
    });
    await transaction.insert(bookingStateTransitions).values({
      id: 4_001 + index,
      bookingId,
      fromStatus: null,
      toStatus: status,
      actorUserId: createdByUserId,
      reason:
        source === "OFFLINE" ? "Dicatat oleh petugas venue" : "Dibuat melalui aplikasi",
      createdAt: new Date(SEED_REFERENCE_DATE.getTime() - (index + 2) * 86_400_000),
    });
    await transaction.insert(bookingQrTokens).values({
      id: 5_001 + index,
      bookingId,
      tokenHash: createHash("sha256").update(`seed-qr-${bookingId}`).digest("hex"),
      active: status === "CONFIRMED",
      expiresAt: endsAt,
    });

    if (source === "OFFLINE") {
      await transaction.insert(offlineBookingDetails).values({
        bookingId,
        customerName: customerNames[index % customerNames.length]!,
        customerPhone: phoneNumber(500 + index),
        channel: index % 10 === 0 ? "WHATSAPP" : "WALK_IN",
        originalAmount: totalAmount,
      });
    }
    if (activeReservation) {
      const reservedSlotId = slotId(courtId, activeSlotIndex);
      await transaction.insert(bookingSlotReservations).values({
        courtSlotId: reservedSlotId,
        bookingId,
        bookingItemId: 2_001 + index,
        reservationStatus: status === "CONFIRMED" ? "CONFIRMED" : status,
        expiresAt: status === "CONFIRMED" ? null : expiresAt,
      });
      await transaction.insert(bookingSlotHistory).values({
        id: 6_001 + index,
        courtSlotId: reservedSlotId,
        bookingId,
        action: "RESERVED",
        reason: "Data jadwal awal development",
      });
    }
    if (paidAmount > 0) {
      await transaction.insert(paymentAttempts).values({
        id: 7_001 + index,
        paymentCode: seedPublicReference("PAY", `payment-${bookingId}`),
        bookingId,
        kind: paymentMode,
        amount: paidAmount,
        status: "PAID",
        providerReference: `SANDBOX-${String(index + 1).padStart(5, "0")}`,
        idempotencyKey: `seed-payment-${bookingId}`,
        paidAt: new Date(SEED_REFERENCE_DATE.getTime() - index * 3_600_000),
      });
    }
    if (status === "COMPLETED") {
      await transaction.insert(attendanceRecords).values({
        id: 8_001 + index,
        bookingId,
        status: "CHECKED_IN",
        checkedInAt: startsAt,
        markedByUserId: 200 + (index % 8),
      });
    }
  }
}

async function seedNotifications(transaction: DatabaseTransaction): Promise<void> {
  await transaction.insert(userNotifications).values([
    {
      userId: 100,
      kind: "booking",
      title: "Booking telah selesai",
      body: "Terima kasih sudah bermain. Detail kehadiran tersedia di Booking Saya.",
      actionPath: `/bookings/${seedPublicReference("LG", "booking-1002")}`,
      createdAt: new Date("2026-08-27T10:15:00.000Z"),
    },
    {
      userId: 100,
      kind: "payment",
      title: "Pembayaran sandbox berhasil",
      body: "Pembayaran booking telah tercatat. Dana pada demo ini tidak nyata.",
      actionPath: `/bookings/${seedPublicReference("LG", "booking-1002")}`,
      readAt: new Date("2026-08-27T09:30:00.000Z"),
      createdAt: new Date("2026-08-27T09:20:00.000Z"),
    },
    {
      userId: 101,
      kind: "system",
      title: "Jadwal venue diperbarui",
      body: "Periksa kembali waktu bermain pada detail booking Anda.",
      actionPath: `/bookings/${seedPublicReference("LG", "booking-1003")}`,
      createdAt: new Date("2026-08-27T11:00:00.000Z"),
    },
  ]);
}

function bookingStatus(index: number): string {
  if (index < 12) return "COMPLETED";
  if (index < 24) return "CONFIRMED";
  if (index < 30) return "PENDING_CONFIRMATION";
  if (index < 36) return "HOLD";
  if (index < 44) return "CANCELLED";
  return "EXPIRED";
}

function paidAmountFor(status: string, mode: string, totalAmount: number): number {
  if (status === "COMPLETED" || status === "CONFIRMED") {
    return mode === "DP" ? Math.ceil(totalAmount / 2) : totalAmount;
  }
  return 0;
}

function paymentSummaryStatus(paidAmount: number, totalAmount: number): string {
  if (paidAmount === 0) return "UNPAID";
  return paidAmount === totalAmount ? "PAID" : "PARTIALLY_PAID";
}

function slotId(courtId: number, slotIndex: number): number {
  return 10_000 + courtId * 100 + slotIndex;
}

function seedPublicReference(prefix: string, subject: string): string {
  const randomLikePart = createHash("sha256")
    .update(`lapangango-development:${subject}`)
    .digest("base64url")
    .slice(0, 16);
  return `${prefix}-${randomLikePart}`;
}

function slotStart(_courtId: number, slotIndex: number): Date {
  return new Date(Date.UTC(2026, 7, 28, 9 + slotIndex, 0));
}

function phoneNumber(sequence: number): string {
  return `+62812${String(7_000_000 + sequence).padStart(7, "0")}`;
}

function surfaceForSport(sportId: number): string {
  if (sportId === 2 || sportId === 6) return "Rumput sintetis";
  if (sportId === 3 || sportId === 5) return "Akrilik";
  if (sportId === 4) return "Kayu maple";
  return "Vinyl olahraga";
}

function venue(
  id: number,
  tenantId: number,
  sportId: number,
  name: string,
  address: string,
  latitude: number,
  longitude: number,
  rating: number,
  reviewCount: number,
  minimumPrice: number,
) {
  return {
    id,
    tenantId,
    sportId,
    name,
    address,
    latitude,
    longitude,
    rating,
    reviewCount,
    minimumPrice,
  };
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/(^\.|\.$)/g, "");
}

function assertSafeSeedTarget(databaseUrl: string, nodeEnvironment: string): void {
  const parsed = new URL(databaseUrl);
  const localHost = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if (nodeEnvironment === "production" || !localHost) {
    throw new Error(
      "Seed reset hanya boleh dijalankan pada database lokal non-production.",
    );
  }
}
