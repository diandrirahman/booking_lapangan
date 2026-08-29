import { expect, test, type Page } from "@playwright/test";

const demoPassword = process.env.SEED_DEMO_PASSWORD;
const evidenceRoot = "../docs/phase-b1/qa/evidence/2026-08-28-payment-flow";

function screenshotPath(projectName: string, fileName: string): string {
  return `${evidenceRoot}/${projectName}/${fileName}`;
}

async function capture(page: Page, projectName: string, fileName: string) {
  await page.screenshot({
    path: screenshotPath(projectName, fileName),
    fullPage: true,
    animations: "disabled",
  });
}

test("QA manual visual customer booking sampai detail booking", async ({
  page,
}, testInfo) => {
  test.skip(!demoPassword, "SEED_DEMO_PASSWORD wajib tersedia untuk QA development.");

  const serverErrors: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 500) {
      serverErrors.push(
        `${response.status()} ${response.request().method()} ${response.url()}`,
      );
    }
  });

  await page.goto("/venues");
  await expect(
    page.getByRole("heading", { name: "Temukan tempat mainmu" }),
  ).toBeVisible();
  await capture(page, testInfo.project.name, "01-daftar-venue.png");

  await page
    .getByRole("link", { name: /Arena Cendana/i })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Arena Cendana" })).toBeVisible();
  await page.getByRole("tab", { name: "Ulasan" }).click();
  await expect(
    page.getByRole("heading", { name: "Ulasan untuk Arena Cendana" }),
  ).toBeVisible();
  await capture(page, testInfo.project.name, "02-ulasan-venue.png");

  await page.getByRole("link", { name: /Lihat slot tersedia/i }).click();
  await expect(
    page.getByRole("heading", { name: "Pilih jadwal bermain" }),
  ).toBeVisible();
  await page.getByLabel("Tanggal bermain").fill(futureDate());
  const availableSlot = page.locator(".slot-button:not([disabled])").first();
  await expect(availableSlot).toBeVisible();
  await availableSlot.click();
  await capture(page, testInfo.project.name, "03-pilih-slot.png");

  await page.getByRole("button", { name: /Lanjut ke checkout/i }).click();
  await expect(page.getByRole("heading", { name: "Periksa dan bayar" })).toBeVisible();
  await capture(page, testInfo.project.name, "04-checkout-tamu.png");

  await page.getByRole("checkbox", { name: /menyetujui kebijakan/i }).check();
  await page.getByRole("button", { name: /Buat booking dan lanjut/i }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Masuk ke LapanganGo" }),
  ).toBeVisible();
  await capture(page, testInfo.project.name, "05-login-gate.png");

  await page.getByLabel("Email").fill("nadia.putri@contoh.test");
  await page.locator("#login-password").fill(demoPassword!);
  const loginResponse = page.waitForResponse("**/api/v1/auth/login");
  await page.getByRole("button", { name: "Masuk" }).click();
  expect((await loginResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/checkout\//);
  await expect(page.getByRole("heading", { name: "Periksa dan bayar" })).toBeVisible();
  await capture(page, testInfo.project.name, "06-checkout-login.png");

  await page.getByRole("checkbox", { name: /menyetujui kebijakan/i }).check();
  const bookingResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/bookings") &&
      response.request().method() === "POST",
  );
  const paymentResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/payment-attempts") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /Buat booking dan lanjut/i }).click();

  expect((await bookingResponse).status()).toBe(201);
  expect((await paymentResponse).status()).toBe(201);
  await expect(page).toHaveURL(/\/payments\/PAY-[A-Za-z0-9_-]{16}$/);
  await expect(
    page.getByRole("heading", { name: "Selesaikan pembayaran" }),
  ).toBeVisible();
  await capture(page, testInfo.project.name, "07-payment-pending.png");

  await page.getByRole("button", { name: "Berhasil", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Booking berhasil!" })).toBeVisible();
  await capture(page, testInfo.project.name, "08-payment-berhasil.png");

  await page.getByRole("link", { name: "Lihat detail booking" }).click();
  await expect(page).toHaveURL(/\/bookings\/LG-[A-Za-z0-9_-]{16}$/);
  await expect(page.getByRole("heading", { name: "Detail booking" })).toBeVisible();
  await capture(page, testInfo.project.name, "09-detail-booking.png");

  expect(
    serverErrors,
    `Ditemukan respons server error:\n${serverErrors.join("\n")}`,
  ).toEqual([]);
});

function futureDate(): string {
  return new Date(Date.now() + 2 * 24 * 60 * 60 * 1_000).toISOString().slice(0, 10);
}
