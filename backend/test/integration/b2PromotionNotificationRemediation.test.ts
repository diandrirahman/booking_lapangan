import { and, eq, inArray, like } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { formatPublicId, parsePublicId } from "../../src/database/ids.js";
import {
  auditLogs,
  commandIdempotency,
  commissionConfigs,
  notificationDeliveries,
  notificationPreferences,
  promotionScopes,
  promotions,
  userNotifications,
} from "../../src/database/schema/index.js";
import { FinanceService } from "../../src/finance/FinanceService.js";
import { NotificationService } from "../../src/identity/notifications/NotificationService.js";
import { testDatabase } from "../support/databaseTestHarness.js";

const ADMIN_USER_ID = formatPublicId(4);

describe("Phase B2 promotion and notification remediation", () => {
  it("menjaga scope promo pada tenant dan assignment Staff", async () => {
    const finance = new FinanceService(testDatabase);
    const suffix = uniqueSuffix();
    const createdIds: number[] = [];
    const idempotencyKeys: string[] = [];
    const baseInput = {
      tenantId: formatPublicId(1),
      name: "Regression promotion isolation",
      discountType: "PERCENT" as const,
      discountValue: 1_000,
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
      endsAt: new Date("2026-12-31T00:00:00.000Z"),
      fundingSource: "OWNER" as const,
      actorUserId: ADMIN_USER_ID,
      reason: "Regression tenant dan venue isolation",
    };

    try {
      const tenantWideKey = `tenant-wide-${suffix}`;
      idempotencyKeys.push(tenantWideKey);
      const tenantWide = await finance.createPromotion({
        ...baseInput,
        code: `TW${suffix}`,
        idempotencyKey: tenantWideKey,
      });
      createdIds.push(parsePublicId(tenantWide.id));

      const assignedKey = `assigned-${suffix}`;
      idempotencyKeys.push(assignedKey);
      const assignedInput = {
        ...baseInput,
        code: `AS${suffix}`,
        idempotencyKey: assignedKey,
        allowedVenueIds: [formatPublicId(1)],
        scopes: [{ type: "VENUE" as const, referenceId: formatPublicId(1) }],
      };
      const assigned = await finance.createPromotion(assignedInput);
      createdIds.push(parsePublicId(assigned.id));
      await expect(finance.createPromotion(assignedInput)).resolves.toEqual(assigned);

      const otherVenueKey = `other-venue-${suffix}`;
      idempotencyKeys.push(otherVenueKey);
      const otherVenue = await finance.createPromotion({
        ...baseInput,
        code: `OV${suffix}`,
        idempotencyKey: otherVenueKey,
        scopes: [{ type: "VENUE", referenceId: formatPublicId(2) }],
      });
      createdIds.push(parsePublicId(otherVenue.id));

      await expect(
        finance.createPromotion({
          ...baseInput,
          code: `FO${suffix}`,
          idempotencyKey: `forbidden-other-${suffix}`,
          allowedVenueIds: [formatPublicId(1)],
          scopes: [{ type: "COURT", referenceId: formatPublicId(3) }],
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "PROMOTION_VENUE_ACCESS_DENIED",
      });
      await expect(
        finance.createPromotion({
          ...baseInput,
          code: `XT${suffix}`,
          idempotencyKey: `cross-tenant-${suffix}`,
          scopes: [{ type: "VENUE", referenceId: formatPublicId(3) }],
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "PROMOTION_SCOPE_NOT_FOUND",
      });
      await expect(
        finance.createPromotion({
          ...baseInput,
          code: `SO${suffix}`,
          idempotencyKey: `sport-only-${suffix}`,
          allowedVenueIds: [formatPublicId(1)],
          scopes: [{ type: "SPORT", referenceId: formatPublicId(1) }],
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "PROMOTION_VENUE_ACCESS_DENIED",
      });
      await expect(
        finance.createPromotion({
          ...baseInput,
          code: `NA${suffix}`,
          idempotencyKey: `no-assignment-${suffix}`,
          allowedVenueIds: [],
          scopes: [{ type: "VENUE", referenceId: formatPublicId(1) }],
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "PROMOTION_VENUE_ACCESS_DENIED",
      });

      const visible = await finance.listPromotions(formatPublicId(1), [
        formatPublicId(1),
      ]);
      expect(visible.some((promotion) => promotion.id === tenantWide.id)).toBe(true);
      expect(visible.some((promotion) => promotion.id === assigned.id)).toBe(true);
      expect(visible.some((promotion) => promotion.id === otherVenue.id)).toBe(false);
      await expect(finance.listPromotions(formatPublicId(1), [])).resolves.toEqual([]);

      const assignedExport = await finance.exportFinance(
        formatPublicId(1),
        "promotions",
        "csv",
        [formatPublicId(1)],
      );
      const assignedCsv = assignedExport.body.toString("utf8");
      expect(assignedCsv).toContain(assignedInput.code);
      expect(assignedCsv).not.toContain(`OV${suffix}`);

      const unassignedExport = await finance.exportFinance(
        formatPublicId(1),
        "promotions",
        "csv",
        [],
      );
      expect(unassignedExport.body.toString("utf8")).not.toContain(assignedInput.code);
    } finally {
      await cleanupPromotions(createdIds, idempotencyKeys);
    }
  });

  it("mengisolasi idempotency promo dan commission berdasarkan tenant", async () => {
    const finance = new FinanceService(testDatabase);
    const suffix = uniqueSuffix();
    const promotionIds: number[] = [];
    const commissionIds: number[] = [];
    const idempotencyKeys: string[] = [];

    try {
      const promotionKey = `promotion-tenant-scope-${suffix}`;
      idempotencyKeys.push(promotionKey);
      const createPromotionFor = (tenantId: number, code: string) =>
        finance.createPromotion({
          tenantId: formatPublicId(tenantId),
          code,
          name: `Promo tenant ${tenantId}`,
          discountType: "FIXED",
          discountValue: 1_000,
          startsAt: new Date("2026-08-01T00:00:00.000Z"),
          endsAt: new Date("2026-12-31T00:00:00.000Z"),
          fundingSource: "OWNER",
          actorUserId: ADMIN_USER_ID,
          idempotencyKey: promotionKey,
        });
      const firstTenant = await createPromotionFor(1, `I1${suffix}`);
      promotionIds.push(parsePublicId(firstTenant.id));
      await expect(createPromotionFor(1, `IGNORED${suffix}`)).rejects.toMatchObject({
        statusCode: 409,
        code: "IDEMPOTENCY_KEY_REUSED",
      });
      await expect(createPromotionFor(1, `I1${suffix}`)).resolves.toEqual(firstTenant);
      const secondTenant = await createPromotionFor(2, `I2${suffix}`);
      promotionIds.push(parsePublicId(secondTenant.id));
      expect(secondTenant.id).not.toBe(firstTenant.id);

      const commissionKey = `commission-tenant-scope-${suffix}`;
      idempotencyKeys.push(commissionKey);
      const createCommissionFor = (tenantId: number) =>
        finance.createCommissionConfig({
          tenantId: formatPublicId(tenantId),
          rateBasisPoints: 800,
          effectiveFrom: new Date("2030-01-01T00:00:00.000Z"),
          gatewayFeeFunding: "OWNER",
          reason: `Regression idempotency tenant ${tenantId}`,
          actorUserId: ADMIN_USER_ID,
          idempotencyKey: commissionKey,
        });
      const firstCommission = await createCommissionFor(1);
      commissionIds.push(parsePublicId(firstCommission.id));
      await expect(createCommissionFor(1)).resolves.toEqual(firstCommission);
      const secondCommission = await createCommissionFor(2);
      commissionIds.push(parsePublicId(secondCommission.id));
      expect(secondCommission.id).not.toBe(firstCommission.id);

      const [legacyPromotion] = await testDatabase.db
        .insert(promotions)
        .values({
          tenantId: 1,
          code: `LG${suffix}`,
          name: "Legacy promotion replay",
          status: "ACTIVE",
          startsAt: new Date("2026-08-01T00:00:00.000Z"),
          endsAt: new Date("2026-12-31T00:00:00.000Z"),
          fundingSource: "OWNER",
          discountType: "FIXED",
          discountValue: 1_000,
          discoveryOnly: false,
        })
        .$returningId();
      if (!legacyPromotion) throw new Error("Legacy promotion test gagal dibuat.");
      promotionIds.push(legacyPromotion.id);
      const legacyKey = `legacy-promotion-${suffix}`;
      idempotencyKeys.push(legacyKey);
      await testDatabase.db.insert(commandIdempotency).values({
        scope: "promotion.create",
        idempotencyKey: legacyKey,
        actorUserId: 4,
        resourceId: legacyPromotion.id,
        responseStatus: 201,
      });
      const replayedLegacy = await finance.createPromotion({
        tenantId: formatPublicId(1),
        code: `LG${suffix}`,
        name: "Legacy promotion replay",
        discountType: "FIXED",
        discountValue: 1_000,
        startsAt: new Date("2026-08-01T00:00:00.000Z"),
        endsAt: new Date("2026-12-31T00:00:00.000Z"),
        fundingSource: "OWNER",
        actorUserId: ADMIN_USER_ID,
        idempotencyKey: legacyKey,
      });
      expect(replayedLegacy.id).toBe(formatPublicId(legacyPromotion.id));

      const [legacyCommission] = await testDatabase.db
        .insert(commissionConfigs)
        .values({
          tenantId: 1,
          rateBasisPoints: 900,
          effectiveFrom: new Date("2031-01-01T00:00:00.000Z"),
          gatewayFeeFunding: "OWNER",
          reason: "Legacy commission replay",
          createdByUserId: 4,
        })
        .$returningId();
      if (!legacyCommission) throw new Error("Legacy commission test gagal dibuat.");
      commissionIds.push(legacyCommission.id);
      const legacyCommissionKey = `legacy-commission-${suffix}`;
      idempotencyKeys.push(legacyCommissionKey);
      await testDatabase.db.insert(commandIdempotency).values({
        scope: "commission.create",
        idempotencyKey: legacyCommissionKey,
        actorUserId: 4,
        resourceId: legacyCommission.id,
        responseStatus: 201,
      });
      const replayedLegacyCommission = await finance.createCommissionConfig({
        tenantId: formatPublicId(1),
        rateBasisPoints: 900,
        effectiveFrom: new Date("2031-01-01T00:00:00.000Z"),
        gatewayFeeFunding: "OWNER",
        reason: "Legacy commission replay",
        actorUserId: ADMIN_USER_ID,
        idempotencyKey: legacyCommissionKey,
      });
      expect(replayedLegacyCommission.id).toBe(formatPublicId(legacyCommission.id));
      const otherTenantFromLegacyKey = await finance.createCommissionConfig({
        tenantId: formatPublicId(2),
        rateBasisPoints: 950,
        effectiveFrom: new Date("2032-01-01T00:00:00.000Z"),
        gatewayFeeFunding: "OWNER",
        reason: "Legacy commission cross tenant isolation",
        actorUserId: ADMIN_USER_ID,
        idempotencyKey: legacyCommissionKey,
      });
      commissionIds.push(parsePublicId(otherTenantFromLegacyKey.id));
      expect(otherTenantFromLegacyKey.id).not.toBe(replayedLegacyCommission.id);
    } finally {
      await cleanupPromotions(promotionIds, idempotencyKeys);
      if (commissionIds.length > 0) {
        await testDatabase.db
          .delete(auditLogs)
          .where(
            and(
              eq(auditLogs.resourceType, "commission_config"),
              inArray(auditLogs.resourceId, commissionIds),
            ),
          );
        await testDatabase.db
          .delete(commissionConfigs)
          .where(inArray(commissionConfigs.id, commissionIds));
      }
    }
  });

  it("membuat create promo dan commission concurrent tetap deterministic", async () => {
    const finance = new FinanceService(testDatabase);
    const suffix = uniqueSuffix();
    const promotionKey = `promotion-concurrent-${suffix}`;
    const commissionKey = `commission-concurrent-${suffix}`;
    const promotionIds: number[] = [];
    const commissionIds: number[] = [];
    try {
      const promotionInput = {
        tenantId: formatPublicId(1),
        code: `PC${suffix}`,
        name: "Promo concurrent",
        discountType: "FIXED" as const,
        discountValue: 1_000,
        startsAt: new Date("2026-08-01T00:00:00.000Z"),
        endsAt: new Date("2026-12-31T00:00:00.000Z"),
        fundingSource: "OWNER" as const,
        actorUserId: ADMIN_USER_ID,
        idempotencyKey: promotionKey,
      };
      const promotionsCreated = await Promise.all([
        finance.createPromotion(promotionInput),
        finance.createPromotion(promotionInput),
      ]);
      expect(promotionsCreated[1]).toEqual(promotionsCreated[0]);
      promotionIds.push(parsePublicId(promotionsCreated[0].id));
      await expect(
        finance.createPromotion({ ...promotionInput, name: "Payload berbeda" }),
      ).rejects.toMatchObject({ statusCode: 409, code: "IDEMPOTENCY_KEY_REUSED" });

      const commissionInput = {
        tenantId: formatPublicId(1),
        rateBasisPoints: 875,
        effectiveFrom: new Date("2035-01-01T00:00:00.000Z"),
        gatewayFeeFunding: "OWNER" as const,
        reason: "Commission concurrent",
        actorUserId: ADMIN_USER_ID,
        idempotencyKey: commissionKey,
      };
      const commissionsCreated = await Promise.all([
        finance.createCommissionConfig(commissionInput),
        finance.createCommissionConfig(commissionInput),
      ]);
      expect(commissionsCreated[1]).toEqual(commissionsCreated[0]);
      commissionIds.push(parsePublicId(commissionsCreated[0].id));
      await expect(
        finance.createCommissionConfig({ ...commissionInput, rateBasisPoints: 900 }),
      ).rejects.toMatchObject({ statusCode: 409, code: "IDEMPOTENCY_KEY_REUSED" });
    } finally {
      await cleanupPromotions(promotionIds, [promotionKey]);
      await testDatabase.db
        .delete(commandIdempotency)
        .where(eq(commandIdempotency.idempotencyKey, commissionKey));
      if (commissionIds.length > 0) {
        await testDatabase.db
          .delete(auditLogs)
          .where(
            and(
              eq(auditLogs.resourceType, "commission_config"),
              inArray(auditLogs.resourceId, commissionIds),
            ),
          );
        await testDatabase.db
          .delete(commissionConfigs)
          .where(inArray(commissionConfigs.id, commissionIds));
      }
    }
  });

  it("mempertahankan preference nonaktif pada read model dan delivery", async () => {
    const notifications = new NotificationService(testDatabase);
    const userId = 100;
    const publicUserId = formatPublicId(userId);
    const eventPrefix = `preference-regression-${Date.now()}`;
    const previousRows = await testDatabase.db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.userId, userId),
          eq(notificationPreferences.eventType, "booking.reminder"),
        ),
      );

    try {
      await notifications.setPreference(
        publicUserId,
        "booking.reminder",
        "EMAIL",
        false,
      );
      const preferences = await notifications.listPreferences(publicUserId);
      expect(
        preferences.find(
          (preference) =>
            preference.eventType === "booking.reminder" &&
            preference.channel === "EMAIL",
        ),
      ).toEqual({
        eventType: "booking.reminder",
        channel: "EMAIL",
        enabled: false,
      });

      const firstEventId = `${eventPrefix}-email-disabled`;
      await expect(
        notifications.deliver({
          eventId: firstEventId,
          userId,
          eventType: "booking.reminder",
          title: "Reminder regression",
          body: "Email tidak boleh dicapture.",
          actionPath: "/bookings",
          critical: false,
        }),
      ).resolves.toBe(1);
      const firstDeliveries = await testDatabase.db
        .select({ channel: notificationDeliveries.channel })
        .from(notificationDeliveries)
        .where(eq(notificationDeliveries.eventId, firstEventId));
      expect(firstDeliveries).toEqual([{ channel: "IN_APP" }]);

      await notifications.setPreference(
        publicUserId,
        "booking.reminder",
        "IN_APP",
        false,
      );
      await expect(
        notifications.deliver({
          eventId: `${eventPrefix}-both-disabled`,
          userId,
          eventType: "booking.reminder",
          title: "Reminder regression",
          body: "Tidak ada channel yang aktif.",
          actionPath: "/bookings",
          critical: false,
        }),
      ).resolves.toBe(0);
      await expect(
        notifications.setPreference(publicUserId, "unknown.event", "EMAIL", false),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: "NOTIFICATION_EVENT_UNSUPPORTED",
      });
    } finally {
      await testDatabase.db
        .delete(userNotifications)
        .where(like(userNotifications.eventId, `${eventPrefix}%`));
      await testDatabase.db
        .delete(notificationDeliveries)
        .where(like(notificationDeliveries.eventId, `${eventPrefix}%`));
      await testDatabase.db
        .delete(notificationPreferences)
        .where(
          and(
            eq(notificationPreferences.userId, userId),
            eq(notificationPreferences.eventType, "booking.reminder"),
          ),
        );
      if (previousRows.length > 0) {
        await testDatabase.db.insert(notificationPreferences).values(previousRows);
      }
    }
  });
});

async function cleanupPromotions(
  promotionIds: number[],
  idempotencyKeys: string[],
): Promise<void> {
  if (idempotencyKeys.length > 0) {
    await testDatabase.db
      .delete(commandIdempotency)
      .where(inArray(commandIdempotency.idempotencyKey, idempotencyKeys));
  }
  if (promotionIds.length === 0) return;
  await testDatabase.db
    .delete(promotionScopes)
    .where(inArray(promotionScopes.promotionId, promotionIds));
  await testDatabase.db
    .delete(auditLogs)
    .where(
      and(
        eq(auditLogs.resourceType, "promotion"),
        inArray(auditLogs.resourceId, promotionIds),
      ),
    );
  await testDatabase.db.delete(promotions).where(inArray(promotions.id, promotionIds));
}

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
    .toUpperCase()
    .slice(0, 16);
}

afterAll(async () => testDatabase.close());
