import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { routeRegistry, type Shell } from "../src/routes/registry";

async function setRole(
  page: Page,
  role: "customer" | "owner" | "staff" | "admin",
) {
  await page.goto("/");
  await page.evaluate((nextRole) => {
    const key = "lapangango-phase-a";
    const current = JSON.parse(sessionStorage.getItem(key) ?? "{}");
    sessionStorage.setItem(key, JSON.stringify({ ...current, role: nextRole }));
  }, role);
}

function roleForShell(shell: Shell) {
  if (shell === "admin") return "admin";
  if (shell === "business") return "owner";
  return "customer";
}

function concretePath(path: string) {
  return path
    .replace(":tenant", "cendana")
    .replace(":venueId", "v1")
    .replace(":slug", "arena-cendana")
    .replace(":bookingId", "BK-0001")
    .replace(":attemptId", "BK-0001")
    .replace(":id", path.includes("/mabar/") ? "MB-1" : "BK-0001");
}

test("customer booking flow tidak dead-end", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Main di mana hari ini/i }),
  ).toBeVisible();
  await page.goto("/venues/arena-cendana/book");
  await page.getByRole("button", { name: /17.00/i }).click();
  await page.getByRole("button", { name: /Lanjut ke checkout/i }).click();
  await expect(
    page.getByRole("heading", { name: "Periksa dan bayar" }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: /menyetujui kebijakan/i }).check();
  await page.getByRole("button", { name: "Lanjut pembayaran" }).click();
  await page.getByRole("button", { name: "Simulasikan berhasil" }).click();
  await expect(
    page.getByRole("heading", { name: "Booking berhasil!" }),
  ).toBeVisible();
});

test("Owner dapat membuat draft venue dan melanjutkan setup", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Kontrol prototype/i }).click();
  await page.getByRole("combobox", { name: "Peran aktif" }).click();
  await page.getByRole("option", { name: "Owner" }).click();
  await page.goto("/business/cendana/venues");
  await page.getByRole("button", { name: "Tambah venue" }).click();
  await page.getByLabel("Nama venue").fill("Arena Prototype Baru");
  await page.getByLabel("Lokasi").fill("Kemang, Jakarta Selatan");
  await page.getByRole("button", { name: "Buat dan lanjutkan" }).click();
  await expect(page).toHaveURL(/\/venues\/v7\/profile$/);
  await expect(
    page.getByRole("heading", { name: "Profil dan media" }),
  ).toBeVisible();
});

test("Owner operations menjalankan confirmation dan check-in", async ({
  page,
}) => {
  await setRole(page, "owner");
  await page.goto("/business/cendana/operations/bookings");
  await page.getByRole("button", { name: "Detail" }).first().click();
  await page.getByRole("button", { name: "Konfirmasi" }).click();
  await page.goto("/business/cendana/operations/check-in");
  await page
    .getByRole("button", { name: /^Check-in$/ })
    .first()
    .click();
  await expect(page.getByRole("status")).toContainText("Check-in berhasil");
});

test("Admin revision kembali terlihat di workspace Owner", async ({ page }) => {
  await setRole(page, "admin");
  await page.goto("/admin/verifications");
  await page
    .getByLabel("Catatan keputusan")
    .fill("Perbarui bukti pengelolaan venue.");
  await page.getByRole("button", { name: "Minta revisi" }).click();
  await expect(page.getByRole("status")).toContainText("revision");
  await setRole(page, "owner");
  await page.goto("/business/cendana/venues");
  await expect(
    page.getByText(/Perbarui bukti pengelolaan venue/),
  ).toBeVisible();
});

test("Mabar dibuat, dipublikasikan, dan menerima pengumuman", async ({
  page,
}) => {
  await page.goto("/mabar");
  await page.getByRole("button", { name: "Buat dari booking" }).click();
  await page.getByRole("link", { name: /BK-/ }).first().click();
  await page.getByRole("button", { name: "Simpan draft" }).click();
  await page.getByRole("button", { name: "Publikasikan" }).click();
  await page
    .getByLabel("Pesan pengumuman")
    .fill("Berkumpul 15 menit lebih awal.");
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  await expect(page.getByText("Berkumpul 15 menit lebih awal.")).toBeVisible();
});

test("route kritis tidak overflow pada breakpoint utama", async ({ page }) => {
  for (const path of ["/", "/venues", "/venues/arena-cendana", "/mabar"]) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflow, `overflow di ${path}`).toBe(false);
  }
});

test("seluruh 66 route merender konten dan interaction domain", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  expect(routeRegistry).toHaveLength(66);
  let activeRole = "";
  for (const route of routeRegistry) {
    const requiredRole = roleForShell(route.shell);
    if (requiredRole !== activeRole) {
      await setRole(page, requiredRole);
      activeRole = requiredRole;
    }
    await page.goto(concretePath(route.path));
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(
      page
        .locator(
          "main button, main a, main input, main [role=alert], main .state-card",
        )
        .first(),
    ).toBeVisible();
  }
});

test("halaman kritis tanpa violation axe serious/critical", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  const samples = [
    ["customer", "/"],
    ["customer", "/venues/arena-cendana/book"],
    ["owner", "/business/cendana/overview"],
    ["admin", "/admin/verifications"],
    ["customer", "/mabar"],
  ] as const;
  for (const [role, path] of samples) {
    await setRole(page, role);
    await page.goto(path);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(
      result.violations.filter(
        (violation) =>
          violation.impact === "serious" || violation.impact === "critical",
      ),
      path,
    ).toEqual([]);
  }
});

test("visual regression layar kritis", async ({ page }, testInfo) => {
  test.skip(!["mobile", "desktop"].includes(testInfo.project.name));
  const screens = [
    ["customer", "/", "landing"],
    ["customer", "/venues", "venue-search"],
    ["customer", "/venues/arena-cendana", "venue-detail"],
    ["customer", "/venues/arena-cendana/book", "booking"],
    ["customer", "/checkout/BK-0001", "checkout"],
    ["owner", "/business/cendana/overview", "owner-dashboard"],
    ["admin", "/admin/verifications", "admin-verification"],
    ["customer", "/mabar", "mabar"],
  ] as const;
  for (const [role, path, name] of screens) {
    await setRole(page, role);
    await page.goto(path);
    await expect(page).toHaveScreenshot(`${name}.png`, {
      animations: "disabled",
      fullPage: true,
    });
  }
});

test("Staff mendapat menu terbatas, 403 sensitif, dan tidak dapat membuka Admin", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.goto("/");
  await page.getByRole("button", { name: /Kontrol prototype/i }).click();
  await page.getByRole("combobox", { name: "Peran aktif" }).click();
  await page.getByRole("option", { name: "Staff" }).click();
  await expect(page).toHaveURL(/business\/cendana\/overview/);
  await expect(page.getByRole("link", { name: "Kelola Venue" })).toHaveCount(0);
  await page.goto("/business/cendana/venues");
  await expect(
    page.getByRole("heading", { name: "Akses dibatasi" }),
  ).toBeVisible();
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Akses dibatasi" }),
  ).toBeVisible();
});

test("slot hanya bisa diperpanjang secara berurutan", async ({ page }) => {
  await page.goto("/venues/arena-cendana/book");
  await page.getByRole("button", { name: /17\.00/ }).click();
  await expect(page.getByRole("button", { name: /18\.00/ })).toBeEnabled();
  await expect(page.getByRole("button", { name: /20\.00/ })).toBeDisabled();
  await page.getByRole("button", { name: /18\.00/ }).click();
  await expect(
    page.getByText("17.00–19.00", { exact: true }).first(),
  ).toBeVisible();
});

test("sidebar Business hanya mengaktifkan route yang tepat", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await setRole(page, "owner");
  await page.goto("/business/cendana/operations/bookings/new-offline");
  await expect(
    page.locator(".workspace-sidebar .nav-group a.active"),
  ).toHaveText(["Booking Offline"]);
  await page.goto("/business/cendana/venues/v1/pricing");
  await expect(
    page.locator(".workspace-sidebar .nav-group a.active"),
  ).toHaveText(["Harga"]);
});

test("tab Lapangan menampilkan kartu court yang lengkap", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.goto("/venues/hoops-house-kemang");
  await page.getByRole("tab", { name: "Lapangan" }).click();
  await expect(page.locator(".court-detail-card")).toHaveCount(2);
  await expect(page.getByText("Standar kompetisi").first()).toBeVisible();
  await page
    .getByRole("link", { name: /Pilih jadwal/ })
    .last()
    .click();
  await expect(page.getByRole("button", { name: /Lapangan 2/ })).toHaveClass(
    /active/,
  );
});

test("favorit Mabar konsisten dari Beranda ke menu Mabar", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.goto("/");
  const saveFromHome = page.getByRole("button", {
    name: "Simpan Futsal Jumat Seru ke favorit",
  });
  await saveFromHome.click();
  await expect(
    page.getByRole("button", {
      name: "Hapus Futsal Jumat Seru dari favorit",
    }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.goto("/mabar");
  const removeFromMabar = page.getByRole("button", {
    name: "Hapus Futsal Jumat Seru dari favorit",
  });
  await expect(removeFromMabar).toHaveAttribute("aria-pressed", "true");

  await page.goto("/favorites");
  await expect(
    page.getByRole("heading", { name: "Futsal Jumat Seru" }),
  ).toBeVisible();
});
