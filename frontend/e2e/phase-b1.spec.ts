import { expect, test } from "@playwright/test";

const demoPassword = process.env.SEED_DEMO_PASSWORD ?? "LapanganGo-E2E-123";

test("@b1 customer booking dan payment sandbox memakai API", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/venues");
  const apiProbe = await page.evaluate(async () => {
    const response = await fetch("/api/v1/venues");
    return { status: response.status, body: await response.text() };
  });
  expect(apiProbe.status, apiProbe.body).toBe(200);
  const catalogItems = JSON.parse(apiProbe.body) as {
    items: Array<{ nearestSlotStartsAt: string | null }>;
  };
  expect(
    catalogItems.items.every(
      (venue) =>
        venue.nearestSlotStartsAt === null ||
        new Date(venue.nearestSlotStartsAt).getTime() >= Date.now(),
    ),
  ).toBe(true);
  await expect(
    page.getByRole("heading", { name: "Temukan tempat mainmu" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: /Arena Cendana/i })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Arena Cendana" })).toBeVisible();
  await page.getByRole("tab", { name: "Ulasan" }).click();
  await expect(
    page.getByRole("heading", { name: "Ulasan untuk Arena Cendana" }),
  ).toBeVisible();
  await expect(page.getByLabel("Distribusi rating")).toBeVisible();
  await expect(page.getByText("Booking terverifikasi").first()).toBeVisible();
  const today = await page.evaluate(() => {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const day = String(currentDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });
  const availabilityLink = page.getByRole("link", { name: /Lihat slot tersedia/i });
  await expect(availabilityLink).toHaveAttribute("href", new RegExp(`date=${today}$`));
  await page.route("**/api/v1/availability?*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });
  await availabilityLink.click();

  await expect(
    page.getByRole("heading", { name: "Pilih jadwal bermain" }),
  ).toBeVisible();
  await expect(page.getByLabel("Tanggal bermain")).toHaveValue(today);
  await expect(page.getByRole("status")).toContainText("Memuat slot tersedia");
  await page.getByLabel("Tanggal bermain").fill(futureDate());
  const availableSlot = page.locator(".slot-button:not([disabled])").first();
  await expect(availableSlot).toBeVisible();
  await availableSlot.click();
  await page.getByRole("button", { name: /Lanjut ke checkout/i }).click();

  await expect(page.getByRole("radio", { name: /Bayar penuh/i })).toBeChecked();
  await expect(page.getByText("Dibayar sekarang")).toBeVisible();
  await page.getByRole("checkbox", { name: /menyetujui kebijakan/i }).check();
  await page.getByRole("button", { name: /Masuk untuk lanjut/i }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Masuk ke LapanganGo" }),
  ).toBeVisible();
  await page.getByLabel("Email").fill("nadia.putri@contoh.test");
  await page.locator("#login-password").fill(demoPassword);
  const loginResponsePromise = page.waitForResponse("**/api/v1/auth/login");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect((await loginResponsePromise).status()).toBe(200);
  await expect(page).toHaveURL(/\/checkout\//);
  await expect
    .poll(async () => page.evaluate(async () => (await fetch("/api/v1/me")).status))
    .toBe(200);
  await page.getByRole("checkbox", { name: /menyetujui kebijakan/i }).check();
  await page.getByRole("button", { name: /Buat booking dan lanjut/i }).click();

  await expect(page).toHaveURL(/\/payments\/PAY-[A-Za-z0-9_-]{16}$/);
  await expect(
    page.getByRole("heading", { name: "Selesaikan pembayaran" }),
  ).toBeVisible();
  const firstAttemptUrl = page.url();
  await page.getByRole("button", { name: "Gagal", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Pembayaran belum berhasil" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Coba bayar lagi" }).click();
  await expect(page).toHaveURL(/\/payments\/PAY-[A-Za-z0-9_-]{16}$/);
  expect(page.url()).not.toBe(firstAttemptUrl);
  await expect(
    page.getByRole("heading", { name: "Selesaikan pembayaran" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Berhasil", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Booking berhasil!" })).toBeVisible();
  await page.getByRole("link", { name: "Lihat detail booking" }).click();
  await expect(page).toHaveURL(/\/bookings\/LG-[A-Za-z0-9_-]{16}$/);
  await expect(page.getByRole("heading", { name: "Detail booking" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("@b1 registrasi membuat session nyata dan mode develop menyembunyikan kontrol prototype", async ({
  page,
}) => {
  const email = `qa.nadia.${Date.now()}@example.test`;

  await page.goto("/register");
  await expect(
    page.getByRole("heading", { name: "Mulai main lebih mudah" }),
  ).toBeVisible();
  await page.getByLabel("Nama lengkap").fill("Nadia Puspita QA");
  await page.getByLabel("Nomor telepon").fill("+6281234567890");
  await page.getByLabel("Email").fill(email);
  await page.locator("#register-password").fill("password-aman-123");
  await page.getByLabel("Konfirmasi password").fill("password-aman-123");
  const registrationResponse = page.waitForResponse("**/api/v1/auth/register");
  await page.getByRole("button", { name: "Buat akun" }).click();

  expect((await registrationResponse).status()).toBe(201);
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: "Buka menu akun" })).toBeVisible();
  await expect(page.getByText("Kontrol prototype")).toHaveCount(0);

  await page.getByRole("button", { name: "Buka menu akun" }).click();
  await page.getByRole("button", { name: "Buka workspace bisnis" }).click();
  await page.getByLabel("Nama bisnis").fill(`Arena QA ${Date.now()}`);
  await page.getByRole("button", { name: "Buat workspace" }).click();
  await expect(page).toHaveURL(/\/business\/[A-Za-z0-9_-]{22}\/overview$/);
  await expect(
    page.getByRole("heading", { name: "Ringkasan operasional" }),
  ).toBeVisible();
});

test("@b1 session server membatasi workspace tenant dan admin", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("andika.pratama@lapangango.test");
  await page.locator("#login-password").fill(demoPassword);
  const loginResponse = page.waitForResponse("**/api/v1/auth/login");
  await page.getByRole("button", { name: "Masuk" }).click();
  expect((await loginResponse).status()).toBe(200);
  await expect(page.getByRole("button", { name: "Buka menu akun" })).toBeVisible();

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Akses dibatasi" })).toBeVisible();

  await page.goto("/business/999999/overview");
  await expect(page.getByRole("heading", { name: "Akses dibatasi" })).toBeVisible();
});

test("@b1 Owner memakai setup venue dan operasi dari API", async ({ page }) => {
  await login(page, "andika.pratama@lapangango.test");
  const tenantId = await firstWorkspaceId(page);

  await page.goto(`/business/${tenantId}/overview`);
  await expect(
    page.getByRole("heading", { name: "Ringkasan operasional" }),
  ).toBeVisible();
  await expect(page.getByText(/server B1/i).first()).toBeVisible();

  await page.goto(`/business/${tenantId}/venues`);
  await expect(page.getByRole("heading", { name: "Kelola venue" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Tambah venue/i })).toBeVisible();
  await expect(page.getByRole("article", { name: /^Venue / }).first()).toBeVisible();
  await expect(page.getByRole("progressbar").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Kelola setup/i }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Kelola setup/i })
    .first()
    .click();
  await expect(page.locator(".setup-option-panels")).toBeVisible();
  await expect(page.locator(".venue-media-form")).toBeVisible();
  const venueImageInput = page.getByLabel("File foto");
  await venueImageInput.setInputFiles({
    name: "bukan-foto.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4"),
  });
  await expect(
    page.getByText("File foto harus berupa JPG, PNG, atau WebP."),
  ).toBeVisible();
  await expect(venueImageInput).toHaveValue("");
  await expect(page.getByRole("button", { name: "Simpan profil" })).toBeVisible();
  const setupFormHasHorizontalOverflow = await page
    .locator(".form-card")
    .evaluate((element) => element.scrollWidth > element.clientWidth);
  expect(setupFormHasHorizontalOverflow).toBe(false);

  await page.goto(`/business/${tenantId}/operations/bookings`);
  await expect(page.getByRole("heading", { name: "Semua booking" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Booking offline/i })).toBeVisible();

  const outstandingResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/business/bookings") &&
      response.url().includes("outstandingOnly=true"),
  );
  await page.goto(`/business/${tenantId}/operations/outstanding`);
  await expect(
    page.getByRole("heading", { name: "Outstanding payment" }),
  ).toBeVisible();
  const outstandingBody = (await (await outstandingResponse).json()) as {
    items: Array<{ status: string; balanceDue: number }>;
  };
  expect(
    outstandingBody.items.every(
      (booking) =>
        booking.balanceDue > 0 &&
        booking.status !== "CANCELLED" &&
        booking.status !== "EXPIRED",
    ),
  ).toBe(true);

  await page.goto(`/business/${tenantId}/operations/calendar`);
  await expect(page.getByRole("heading", { name: "Kalender venue" })).toBeVisible();
  await expect(page.getByLabel("Kalender operasional venue")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Bulan", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Daftar" }).click();
  await expect(page.getByRole("button", { name: "Daftar" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Bulan", exact: true }).click();

  await page.locator(".operations-calendar-event.tone-confirmed").first().click();
  const bookingDialog = page.getByRole("dialog");
  await expect(
    bookingDialog.getByRole("heading", { name: "Detail booking" }),
  ).toBeVisible();
  expect(
    await bookingDialog.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    ),
  ).toBe(false);
});

test("@b1 Staff hanya melihat operasi venue yang ditugaskan", async ({ page }) => {
  await login(page, "agus.firmansyah@tim-lapangango.test");
  const tenantId = await firstWorkspaceId(page);

  await page.goto(`/business/${tenantId}/operations/calendar`);
  await expect(page.getByRole("heading", { name: "Kalender venue" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Kelola Venue" })).toHaveCount(0);

  const venueIds = await page.evaluate(async (activeTenantId) => {
    const response = await fetch(`/api/v1/business/venues?tenantId=${activeTenantId}`);
    if (!response.ok) throw new Error("Daftar venue Staff tidak dapat dimuat.");
    const body = (await response.json()) as { items: Array<{ id: string }> };
    return body.items.map((venue) => venue.id);
  }, tenantId);
  expect(venueIds).toHaveLength(1);

  await page.getByLabel("Filter venue kalender").click();
  await expect(page.getByRole("option")).toHaveCount(venueIds.length + 1);
  await page.keyboard.press("Escape");

  await page.goto(`/business/${tenantId}/operations/bookings/new-offline`);
  await page.getByLabel("Pilih venue").click();
  await expect(page.getByRole("option")).toHaveCount(venueIds.length);
  await page.keyboard.press("Escape");

  await page.goto(`/business/${tenantId}/finance`);
  await expect(page.getByRole("heading", { name: "Akses dibatasi" })).toBeVisible();
});

test("@b1 no-show menampilkan feedback server-backed dan keluar dari kedatangan", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-b1");
  await login(page, "andika.pratama@lapangango.test");
  const tenantId = await firstWorkspaceId(page);

  await page.goto(`/business/${tenantId}/operations/check-in`);
  const upcoming = page.locator(".data-card").filter({
    has: page.getByRole("heading", { name: "Kedatangan berikutnya" }),
  });
  const eligibleBooking = await page.evaluate(async (activeTenantId) => {
    const response = await fetch(
      `/api/v1/business/bookings?tenantId=${activeTenantId}&limit=100`,
    );
    if (!response.ok) throw new Error("Daftar booking Owner tidak dapat dimuat.");
    const body = (await response.json()) as {
      items: Array<{
        customerName: string;
        status: string;
        attendanceStatus: "CHECKED_IN" | "NO_SHOW" | null;
        startsAt: string;
      }>;
    };
    return body.items.find(
      (booking) =>
        booking.status === "CONFIRMED" &&
        booking.attendanceStatus === null &&
        new Date(booking.startsAt).getTime() + 15 * 60_000 <= Date.now(),
    );
  }, tenantId);
  expect(eligibleBooking).toBeDefined();
  if (!eligibleBooking)
    throw new Error("Seed tidak memiliki booking no-show eligible.");

  const eligibleRow = upcoming
    .locator(".list-item")
    .filter({ hasText: eligibleBooking.customerName })
    .first();
  const customerName = await eligibleRow.locator("strong").innerText();
  await eligibleRow.getByRole("button", { name: "Detail" }).click();
  await page.getByRole("button", { name: "Tandai no-show" }).click();

  await expect(page.getByRole("status")).toHaveText("No-show tercatat");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(upcoming).not.toContainText(customerName);
});

test("@b1 Admin membaca dashboard, verifikasi, dan master dari API", async ({
  page,
}) => {
  await login(page, "admin@lapangango.test");

  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Kendali operasional LapanganGo" }),
  ).toBeVisible();

  await page.goto("/admin/verifications");
  await expect(
    page.getByRole("heading", { name: "Review pengajuan venue" }),
  ).toBeVisible();

  await page.goto("/admin/masters/sports");
  await expect(page.getByRole("heading", { name: "Master olahraga" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tambah" })).toBeVisible();
});

test("@b1 realtime reconnect memakai REST sebagai fallback", async ({ page }) => {
  await login(page, "andika.pratama@lapangango.test");
  const tenantId = await firstWorkspaceId(page);
  const eventPattern = /\/api\/v1\/events\?tenantId=/;
  await page.route(eventPattern, (route) => route.abort("connectionfailed"));

  await page.goto(`/business/${tenantId}/overview`);
  await expect(
    page.getByRole("heading", { name: "Ringkasan operasional" }),
  ).toBeVisible();
  await expect(page.getByText(/Koneksi realtime terputus/i)).toBeVisible();

  await page.unroute(eventPattern);
  await expect(page.getByText(/Koneksi realtime terputus/i)).toHaveCount(0, {
    timeout: 10_000,
  });
  await expect(
    page.getByRole("heading", { name: "Ringkasan operasional" }),
  ).toBeVisible();
});

test("@b1 Leaflet menyinkronkan marker, kartu, dan penolakan geolocation", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-b1");
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.fulfill({
      contentType: "image/gif",
      body: Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64"),
    }),
  );

  await page.goto("/venues");
  await expect(page.getByLabel("Peta venue Leaflet")).toBeVisible();
  await page.getByRole("button", { name: "Pilih Menteng Tennis Club" }).click();
  await expect(
    page.locator(".venue-card").filter({ hasText: "Menteng Tennis Club" }),
  ).toHaveAttribute("aria-current", "true");

  await page.getByRole("button", { name: "Gunakan lokasi saya" }).click();
  await expect(page.getByText(/Lokasi tidak dapat diakses/i)).toBeVisible();
});

test("@b1 Leaflet menampilkan SVG fallback ketika tile gagal", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-b1");
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort("failed"),
  );
  await page.goto("/venues");
  await expect(page.getByRole("button", { name: /Coba muat peta lagi/i })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByLabel("Peta lokal Jakarta dengan marker venue")).toBeVisible();
});

test("@b1 layar Customer dan Business tidak memiliki horizontal overflow", async ({
  page,
}) => {
  await page.goto("/venues");
  await expect(
    page.getByRole("heading", { name: "Temukan tempat mainmu" }),
  ).toBeVisible();
  expect(await hasHorizontalOverflow(page)).toBe(false);

  await login(page, "andika.pratama@lapangango.test");
  const tenantId = await firstWorkspaceId(page);
  await page.goto(`/business/${tenantId}/overview`);
  await expect(
    page.getByRole("heading", { name: "Ringkasan operasional" }),
  ).toBeVisible();
  expect(await hasHorizontalOverflow(page)).toBe(false);
});

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.locator("#login-password").fill(demoPassword);
  const response = page.waitForResponse("**/api/v1/auth/login");
  await page.getByRole("button", { name: "Masuk" }).click();
  expect((await response).status()).toBe(200);
}

async function firstWorkspaceId(
  page: import("@playwright/test").Page,
): Promise<string> {
  return page.evaluate(async () => {
    const response = await fetch("/api/v1/business/workspaces");
    if (!response.ok) throw new Error("Workspace test tidak dapat dimuat.");
    const body = (await response.json()) as { items: Array<{ tenantId: string }> };
    const tenantId = body.items[0]?.tenantId;
    if (!tenantId) throw new Error("Workspace test tidak tersedia.");
    return tenantId;
  });
}

async function hasHorizontalOverflow(
  page: import("@playwright/test").Page,
): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
}

function futureDate(): string {
  return new Date(Date.now() + 2 * 24 * 60 * 60 * 1_000).toISOString().slice(0, 10);
}
