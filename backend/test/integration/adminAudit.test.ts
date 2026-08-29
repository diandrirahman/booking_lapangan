import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { formatPublicId } from "../../src/database/ids.js";
import { auditLogs } from "../../src/database/schema/index.js";
import { AdminOperationsService } from "../../src/platform/admin/AdminOperationsService.js";
import { testDatabase } from "../support/databaseTestHarness.js";

describe("Admin audit read model", () => {
  it("mengembalikan event server dengan actor, alasan, state, dan cursor", async () => {
    const action = `qa.audit.${Date.now()}`;
    const [created] = await testDatabase.db
      .insert(auditLogs)
      .values({
        tenantId: 1,
        venueId: 1,
        actorUserId: 1,
        action,
        resourceType: "venue",
        resourceId: 1,
        reason: "Bukti remediation audit",
        beforeState: { status: "DRAFT" },
        afterState: { status: "ACTIVE" },
        requestId: "qa-audit-request",
      })
      .$returningId();
    if (!created) throw new Error("Gagal membuat audit QA.");

    const page = await new AdminOperationsService(testDatabase).listAudit({
      limit: 20,
      action,
    });
    expect(page.nextCursor).toBeNull();
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      id: formatPublicId(created.id),
      action,
      resourceType: "venue",
      resourceId: formatPublicId(1),
      reason: "Bukti remediation audit",
      actor: { id: formatPublicId(1) },
      tenant: { id: formatPublicId(1) },
      venue: { id: formatPublicId(1) },
      beforeState: { status: "DRAFT" },
      afterState: { status: "ACTIVE" },
    });

    await testDatabase.db.delete(auditLogs).where(eq(auditLogs.id, created.id));
  });
});

afterAll(async () => testDatabase.close());
