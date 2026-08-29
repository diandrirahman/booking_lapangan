import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { routeRegistry, type Shell } from "../src/routes/registry";

const screenshotDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../docs/phase-b1/qa/evidence/2026-08-28-ui-route-audit/screenshots",
);

test.setTimeout(10 * 60 * 1_000);

test("audit visual dan state dasar seluruh 66 route", async ({ page }) => {
  expect(routeRegistry).toHaveLength(66);
  await mkdir(screenshotDirectory, { recursive: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    window.localStorage.setItem("lapangango-theme", "light");
  });

  let activeRole = "";
  const auditFailures: string[] = [];
  for (const [index, route] of routeRegistry.entries()) {
    const requiredRole = roleForShell(route.shell);
    if (requiredRole !== activeRole) {
      await setRole(page, requiredRole);
      activeRole = requiredRole;
    }

    const pageErrors: string[] = [];
    const onPageError = (error: Error) => pageErrors.push(error.message);
    page.on("pageerror", onPageError);
    await page.goto(concretePath(route.path));
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.getByText("Konfigurasi domain belum tersedia")).toHaveCount(0);
    if (await hasHorizontalOverflow(page)) {
      auditFailures.push(`${route.path}: horizontal overflow`);
    }
    const accessibilityViolations = await findBlockingAccessibilityViolations(page);
    if (accessibilityViolations.length > 0) {
      auditFailures.push(`${route.path}: ${JSON.stringify(accessibilityViolations)}`);
    }
    if (pageErrors.length > 0) {
      auditFailures.push(`${route.path}: ${pageErrors.join("; ")}`);
    }

    const normalizedTitle = route.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const fileName = `${String(index + 1).padStart(2, "0")}-${route.shell}-${normalizedTitle}.png`;
    await page.screenshot({
      path: path.join(screenshotDirectory, fileName),
      fullPage: true,
      animations: "disabled",
    });
    page.off("pageerror", onPageError);
  }

  expect(auditFailures).toEqual([]);
});

async function setRole(
  page: Page,
  role: "customer" | "owner" | "admin",
): Promise<void> {
  await page.goto("/");
  await page.evaluate((nextRole) => {
    const storageKey = "lapangango-phase-a";
    const currentState = JSON.parse(sessionStorage.getItem(storageKey) ?? "{}");
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({ ...currentState, role: nextRole }),
    );
  }, role);
}

function roleForShell(shell: Shell): "customer" | "owner" | "admin" {
  if (shell === "business") return "owner";
  if (shell === "admin") return "admin";
  return "customer";
}

function concretePath(routePath: string): string {
  return routePath
    .replace(":tenant", "cendana")
    .replace(":venueId", "v1")
    .replace(":slug", "arena-cendana")
    .replace(":bookingId", "BK-0001")
    .replace(":attemptId", "BK-0001")
    .replace(":id", routePath.includes("/mabar/") ? "MB-1" : "BK-0001");
}

async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
}

async function findBlockingAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  return results.violations
    .filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))
    .map((violation) => ({
      id: violation.id,
      targets: violation.nodes.map((node) => node.target),
    }));
}
