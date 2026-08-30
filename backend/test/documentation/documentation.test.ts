import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const requiredDocuments = [
  "README.md",
  "docs/openapi/b1.yaml",
  "docs/phase-b1/architecture.md",
  "docs/phase-b1/traceability.md",
  "docs/phase-b1/UI_ROUTE_AUDIT.md",
  "docs/phase-b1/QA_REPORT.md",
  "docs/phase-b1/KNOWN_LIMITATIONS.md",
  "docs/phase-b1/runbooks/operations.md",
  "docs/phase-b1/adr/001-session-auth.md",
  "docs/phase-b1/adr/002-data-access.md",
  "docs/phase-b1/adr/003-slot-reservation.md",
  "docs/phase-b1/adr/004-payment-adapter.md",
  "docs/phase-b1/adr/005-outbox-sse.md",
  "docs/phase-b1/adr/006-runtime-fallback.md",
  "docs/phase-b2/traceability.md",
  "docs/phase-b2/qa/QA_REPORT.md",
  "docs/phase-b2/qa/B2_ACCEPTANCE_REPORT.md",
  "docs/phase-b2/qa/KNOWN_LIMITATIONS.md",
  "docs/phase-b2/qa/PROJECT_OWNER_SIGNOFF.md",
  "docs/phase-b2/qa/evidence/2026-08-30-b2-local-readiness/README.md",
];

describe("B1 documentation gate", () => {
  it("menyediakan seluruh ADR, runbook, contract, QA, dan traceability", async () => {
    await Promise.all(
      requiredDocuments.map((relativePath) =>
        access(`${repositoryRoot}${relativePath}`),
      ),
    );
  });

  it("memetakan tepat 43 requirement B2 dan mencatat local sign-off Project Owner", async () => {
    const [traceability, acceptance, signoff] = await Promise.all([
      readFile(`${repositoryRoot}docs/phase-b2/traceability.md`, "utf8"),
      readFile(`${repositoryRoot}docs/phase-b2/qa/B2_ACCEPTANCE_REPORT.md`, "utf8"),
      readFile(`${repositoryRoot}docs/phase-b2/qa/PROJECT_OWNER_SIGNOFF.md`, "utf8"),
    ]);
    const requirementRows = traceability.match(
      /^\| B2-(?:COM|PRO|REF|FIN|PERM|NOT|REV|SUP)-\d{3} \|/gm,
    );

    expect(requirementRows).toHaveLength(43);
    expect(new Set(requirementRows).size).toBe(43);
    expect(traceability.match(/^\| B2-.*\| complete-local \|/gm)).toHaveLength(43);
    expect(acceptance).toContain("LOCAL READINESS ACCEPTED");
    expect(signoff).toContain("- [x] QA manual External Chrome");
    expect(signoff).toContain("- [x] Medium telah ditutup atau diterima eksplisit");
    expect(signoff).toContain(
      "- [x] Diterima; pekerjaan staging B2 boleh dilanjutkan.",
    );
  });

  it("menyatakan sandbox boundary dan no-double-booking invariant", async () => {
    const [readme, traceability] = await Promise.all([
      readFile(`${repositoryRoot}README.md`, "utf8"),
      readFile(`${repositoryRoot}docs/phase-b1/traceability.md`, "utf8"),
    ]);
    expect(readme).toMatch(/sandbox/i);
    expect(traceability).toContain("50 request");
  });

  it("memetakan tepat 67 requirement B1 dan 66 route UI", async () => {
    const [traceability, routeAudit] = await Promise.all([
      readFile(`${repositoryRoot}docs/phase-b1/traceability.md`, "utf8"),
      readFile(`${repositoryRoot}docs/phase-b1/UI_ROUTE_AUDIT.md`, "utf8"),
    ]);
    const requirementRows = traceability.match(
      /^\| B1-(?:AUTH|TEN|VEN|SCH|PRI|SRC|BKG|PAY|OPS)-\d{3} \|/gm,
    );
    const routeRows = routeAudit.match(/^\|\s+`\/[^`]*`\s+\|/gm);

    expect(requirementRows).toHaveLength(67);
    expect(new Set(requirementRows).size).toBe(67);
    expect(routeRows).toHaveLength(66);
    expect(new Set(routeRows).size).toBe(66);
  });
});
