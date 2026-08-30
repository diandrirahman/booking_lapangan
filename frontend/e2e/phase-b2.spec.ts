import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const demoPassword = process.env.SEED_DEMO_PASSWORD ?? "LapanganGo-E2E-123";

test("Customer membuka review, support, dan preferensi notifikasi server-backed", async ({
  page,
}) => {
  await page.goto("/bookings");
  await expect(
    page.getByRole("heading", { name: "Masuk untuk melihat booking" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Masuk ke akun" })).toBeVisible();
  await login(page, "nadia.putri@contoh.test");
  await page.getByRole("button", { name: "Buka menu akun" }).click();
  await expect(page.getByRole("link", { name: "Review Saya" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Pusat Bantuan" })).toBeVisible();
  await page.getByRole("link", { name: "Pusat Bantuan" }).click();
  await expect(page.getByRole("heading", { name: "Tiket bantuan" })).toBeVisible();
  const supportContainer = page.locator(".b2-customer-page");
  const supportBox = await supportContainer.boundingBox();
  expect(supportBox?.x).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Buat tiket" }).click();
  await page.getByLabel("Judul").fill("QA otomatis B2");
  await page.getByLabel("Pesan").fill("Tiket sintetis untuk regresi dialog B2.");
  await page.getByRole("button", { name: "Kirim tiket" }).click();
  await expect(page.getByRole("heading", { name: "Buat tiket" })).toBeHidden();
  await expect(page.getByText("QA otomatis B2")).toBeVisible();
  await page.getByRole("button", { name: "Buka menu akun" }).click();
  await page.getByRole("link", { name: "Review Saya" }).click();
  await expect(page.getByRole("heading", { name: "Review Saya" })).toBeVisible();
  await page.getByRole("button", { name: "Beri review" }).first().click();
  await page.getByRole("button", { name: "Kebersihan: 4 dari 5" }).click();
  await expect(
    page.getByRole("button", { name: "Kebersihan: 4 dari 5", pressed: true }),
  ).toBeVisible();
  await page
    .getByLabel("Komentar")
    .fill("Review sintetis untuk regresi eligibility B2.");
  await page.getByRole("button", { name: "Kirim review" }).click();
  await expect(page.getByRole("heading", { name: "Tulis review" })).toBeHidden();
  await expect(page.getByText("Review terkirim")).toBeVisible();
  await page.goto("/notifications");
  await page.getByRole("button", { name: "Atur preferensi" }).click();
  await expect(page.getByText("Pembayaran terverifikasi")).toBeVisible();
  await expect(page.getByText("Wajib aktif").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectNoBlockingAccessibilityViolations(page);
});

test("Owner membuka finance, ledger, payout, promo, dan policy lokal", async ({
  page,
}) => {
  const session = await login(page, "andika.pratama@lapangango.test");
  const tenantId = session.memberships[0]!.tenantId;
  await page.goto(`/business/${tenantId}/finance`);
  await expect(page.getByRole("heading", { name: "Ringkasan keuangan" })).toBeVisible();
  await expect(page.getByText("Sebelum potongan")).toBeVisible();
  await page.goto(`/business/${tenantId}/finance/ledger`);
  await expect(
    page.getByRole("heading", { name: "Ledger", exact: true }),
  ).toBeVisible();
  await page.goto(`/business/${tenantId}/growth/promotions`);
  await expect(
    page.getByRole("heading", { name: "Promosi", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tambah promo" }).click();
  await page.getByLabel("Kode").fill("B2E2E");
  await page.getByLabel("Nama").fill("Promo regresi B2");
  await page.getByRole("button", { name: "Simpan promo" }).click();
  await expect(page.getByRole("heading", { name: "Buat promo owner" })).toBeHidden();
  await expect(page.getByText("Promo regresi B2")).toBeVisible();

  await page.goto(`/business/${tenantId}/growth/reviews`);
  await page.getByRole("button", { name: "Balas" }).first().click();
  await page.getByLabel("Balasan").fill("Balasan sintetis regresi B2.");
  await page.getByRole("button", { name: "Kirim balasan" }).click();
  await expect(page.getByRole("heading", { name: "Balas review" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Balas" })).toHaveCount(0);
  await expectNoBlockingAccessibilityViolations(page);
});

test("Staff tanpa finance permission mendapat 403 dari direct URL", async ({
  page,
}) => {
  const session = await login(page, "agus.firmansyah@tim-lapangango.test");
  const tenantId = session.memberships[0]!.tenantId;
  await page.goto(`/business/${tenantId}/finance`);
  await expect(page.getByRole("heading", { name: "Akses dibatasi" })).toBeVisible();
  await expectNoBlockingAccessibilityViolations(page);
});

test("Admin membuka komisi, promo, ledger, refund, review, dan support", async ({
  page,
}) => {
  await login(page, "admin@lapangango.test");
  for (const [path, heading] of [
    ["/admin/commissions", "Komisi dan trial"],
    ["/admin/promotions", "Promo platform"],
    ["/admin/finance", "Ledger platform"],
    ["/admin/refunds", "Refund dan sengketa"],
    ["/admin/reviews", "Review dan laporan"],
    ["/admin/support", "Tiket bantuan"],
    ["/admin/config/notifications", "Opsi reminder"],
  ] as const) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
  }
  await expectNoBlockingAccessibilityViolations(page);
});

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}

async function expectNoBlockingAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const blocking = results.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
  expect(blocking).toEqual([]);
}

async function login(
  page: Page,
  email: string,
): Promise<{
  memberships: Array<{ tenantId: string }>;
}> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.locator("#login-password").fill(demoPassword);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect
    .poll(async () => page.evaluate(async () => (await fetch("/api/v1/me")).status))
    .toBe(200);
  return page.evaluate(async () => {
    const response = await fetch("/api/v1/me");
    return response.json();
  });
}
