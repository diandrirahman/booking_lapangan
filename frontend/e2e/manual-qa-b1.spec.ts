import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const demoPassword = process.env.SEED_DEMO_PASSWORD ?? "LapanganGo-E2E-123";
const visualTransitionSettleMs = 300;
const evidenceDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../docs/phase-b1/qa/evidence/2026-08-28-b1-local-readiness/screenshots",
);

type QaRole = "customer" | "owner" | "staff" | "admin";

interface RoleScenario {
  role: QaRole;
  email: string;
  openPage: (page: Page) => Promise<void>;
  heading: string;
}

const scenarios: RoleScenario[] = [
  {
    role: "customer",
    email: "nadia.putri@contoh.test",
    openPage: async (page) => page.goto("/venues").then(() => undefined),
    heading: "Temukan tempat mainmu",
  },
  {
    role: "owner",
    email: "andika.pratama@lapangango.test",
    openPage: openBusinessOverview,
    heading: "Ringkasan operasional",
  },
  {
    role: "staff",
    email: "agus.firmansyah@tim-lapangango.test",
    openPage: openBusinessOverview,
    heading: "Ringkasan operasional",
  },
  {
    role: "admin",
    email: "admin@lapangango.test",
    openPage: async (page) => page.goto("/admin").then(() => undefined),
    heading: "Kendali operasional LapanganGo",
  },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("lapangango-theme", "light");
  });
});

for (const scenario of scenarios) {
  test(`@manual ${scenario.role}: visual, responsive, keyboard, dan aksesibilitas`, async ({
    page,
  }, testInfo) => {
    const pageErrors: string[] = [];
    const serverErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      if (response.url().includes("/api/") && response.status() >= 500) {
        serverErrors.push(`${response.status()} ${response.url()}`);
      }
    });

    await login(page, scenario.email);
    await scenario.openPage(page);
    await expect(page.getByRole("heading", { name: scenario.heading })).toBeVisible();
    await page.waitForTimeout(visualTransitionSettleMs);

    const lightHasHorizontalOverflow = await hasHorizontalOverflow(page);
    const keyboardFocusPassed = await verifyKeyboardFocus(page);
    await saveScreenshot(page, testInfo, scenario.role, "light");
    const lightAccessibilityViolations =
      await findBlockingAccessibilityViolations(page);

    await page.getByRole("button", { name: "Aktifkan mode gelap" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.waitForTimeout(visualTransitionSettleMs);
    const darkHasHorizontalOverflow = await hasHorizontalOverflow(page);
    await saveScreenshot(page, testInfo, scenario.role, "dark");
    const darkAccessibilityViolations = await findBlockingAccessibilityViolations(page);
    const result = {
      role: scenario.role,
      viewport: testInfo.project.name,
      lightHasHorizontalOverflow,
      darkHasHorizontalOverflow,
      keyboardFocusPassed,
      lightAccessibilityViolations,
      darkAccessibilityViolations,
      pageErrors,
      serverErrors,
    };
    await saveResult(testInfo, scenario.role, result);

    expect.soft(lightHasHorizontalOverflow).toBe(false);
    expect.soft(darkHasHorizontalOverflow).toBe(false);
    expect.soft(keyboardFocusPassed).toBe(true);
    expect
      .soft({
        light: lightAccessibilityViolations,
        dark: darkAccessibilityViolations,
      })
      .toEqual({ light: [], dark: [] });
    expect
      .soft(pageErrors, "Browser tidak boleh menghasilkan uncaught error.")
      .toEqual([]);
    expect.soft(serverErrors, "API tidak boleh mengembalikan HTTP 5xx.").toEqual([]);
  });
}

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.locator("#login-password").fill(demoPassword);
  const responsePromise = page.waitForResponse("**/api/v1/auth/login");
  await page.getByRole("button", { name: "Masuk" }).click();
  const response = await responsePromise;
  expect(response.status(), await response.text()).toBe(200);
}

async function openBusinessOverview(page: Page): Promise<void> {
  const tenantId = await firstWorkspaceId(page);
  await page.goto(`/business/${tenantId}/overview`);
}

async function firstWorkspaceId(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const response = await fetch("/api/v1/business/workspaces");
    if (!response.ok) throw new Error("Workspace QA tidak dapat dimuat.");
    const body = (await response.json()) as { items: Array<{ tenantId: string }> };
    const tenantId = body.items[0]?.tenantId;
    if (!tenantId) throw new Error("Workspace QA tidak tersedia.");
    return tenantId;
  });
}

async function verifyKeyboardFocus(page: Page): Promise<boolean> {
  await page.keyboard.press("Tab");
  const focusedTagName = await page.evaluate(() => document.activeElement?.tagName);
  return focusedTagName !== "BODY";
}

async function findBlockingAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  return results.violations
    .filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((node) => ({
        target: node.target,
        failureSummary: node.failureSummary,
      })),
    }));
}

async function saveScreenshot(
  page: Page,
  testInfo: TestInfo,
  role: QaRole,
  theme: "light" | "dark",
): Promise<void> {
  await mkdir(evidenceDirectory, { recursive: true });
  const fileName = `${testInfo.project.name}-${role}-${theme}.png`;
  await page.screenshot({
    path: path.join(evidenceDirectory, fileName),
    fullPage: true,
  });
}

async function saveResult(
  testInfo: TestInfo,
  role: QaRole,
  result: object,
): Promise<void> {
  const resultDirectory = path.join(evidenceDirectory, "..", "results");
  await mkdir(resultDirectory, { recursive: true });
  await writeFile(
    path.join(resultDirectory, `${testInfo.project.name}-${role}.json`),
    `${JSON.stringify(result, null, 2)}\n`,
    "utf8",
  );
}

async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
}
