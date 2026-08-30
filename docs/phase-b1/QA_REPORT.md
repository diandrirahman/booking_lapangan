# QA Report Phase B1 — Local Readiness

Tanggal pemeriksaan terakhir: 30 Agustus 2026.

Status: **STAGING TECHNICAL GATE COMPLETE — MENUNGGU KEPUTUSAN PROJECT OWNER**

## Matriks visual staging 30 Agustus 2026

- External Chrome empat role × empat breakpoint × light/dark selesai **32/32**.
- Deployment tetap selama QA: web `dpl_6eZqH1NzhAPvESFVZn1MtfPznb9A` dan API
  `dpl_EWCSxNzQuzP5LifUSDVe1PXc1sH9`.
- Seluruh viewport aktual sesuai target; heading/route role, tema, dan fokus keyboard lulus.
- Tidak ditemukan horizontal overflow, elemen kritis terpotong, gambar rusak, console
  error/warning, atau API `5xx` pada rentang QA.
- Staff tetap hanya melihat navigasi operasional sesuai assignment.
- Bukti ada di
  [`2026-08-30-b1-staging-visual-matrix`](qa/evidence/2026-08-30-b1-staging-visual-matrix/README.md).

## Compatibility staging 30 Agustus 2026

- Frontend dan API Vercel berstatus sehat; API berjalan di region `sin1` dekat TiDB.
- TiDB memiliki 4/4 migration dan seed realistis. Login serta endpoint terlindungi empat
  role lulus.
- Redis session/pub-sub lulus. Realtime Customer → Owner tercatat 231 ms, 236 ms, dan
  210 ms terhadap batas 2.000 ms.
- Signed upload Tigris WebP lulus. Bucket tetap private dan media publik diberikan melalui
  redirect bertanda tangan setelah visibility database diperiksa.
- Midtrans Sandbox membuat attempt `PENDING` dan redirect provider resmi; invalid
  signature tanpa `Origin` ditolak `401`.
- Google OIDC consent/callback end-to-end lulus. Temuan session-switch ketika identitas
  Google sudah dimiliki user lain diperbaiki pada `9b4b69a`; retest menolak konflik `409`
  dan mempertahankan session Owner lokal.
- Bukti compatibility ada di
  [`2026-08-30-b1-staging-compatibility`](qa/evidence/2026-08-30-b1-staging-compatibility/README.md).

## Remediasi Medium 29 Agustus 2026

- Staff hanya menerima venue assignment dari source of truth server; Staff tanpa
  assignment menerima daftar kosong dan direct URL venue lain tetap `403`.
- JSON di atas 1 MB kini berhenti pada body parser dengan `413 PAYLOAD_TOO_LARGE`, pesan
  aman, dan request ID; router tidak dijalankan.
- Outstanding memakai filter server yang konsisten dengan dashboard. Booking
  `CANCELLED`/`EXPIRED` dikeluarkan, sementara `COMPLETED` dengan saldo tetap tampil.
- Attendance `CHECKED_IN`/`NO_SHOW` masuk read model; UI menampilkan live feedback,
  menyembunyikan tombol yang sudah dipakai, dan mengeluarkan no-show dari kedatangan.
- Kartu katalog, sort `NEAREST`, dan cursor memakai nearest slot bookable yang dihitung
  live; tanggal lampau tidak lagi ditampilkan.
- Lima finding Medium ditutup melalui 22 integration test, 17 security test, E2E, dan
  External Chrome. Tidak ada finding Blocker/Critical/High/Medium terbuka.

## Remediasi High 29 Agustus 2026

- Webhook Midtrans lokal tanpa `Origin` kini mencapai signature verification; forged
  browser write tetap `403` dan duplicate event tetap idempotent.
- Redis outage tidak lagi menjatuhkan API. Liveness/public catalog tetap tersedia,
  readiness menjadi degraded, protected route gagal tertutup dengan `503`, lalu pulih.
- Signed upload terikat Owner dan venue, dibatasi WebP/JPEG/PNG, serta diverifikasi dari
  metadata dan magic bytes. Upload WebP MinIO mencapai progress 100% di External Chrome.
- Admin Audit sekarang server-backed dan menampilkan submit, revision, submit ulang,
  approve, actor, alasan, waktu, request ID, serta before/after state.
- Lima finding High ditutup pada putaran sebelumnya; lima finding Medium ditutup pada
  putaran ini.

## Keputusan QA manual 29 Agustus 2026

- External Chrome empat role selesai dengan 59 screenshot flow/security.
- Matriks manual 32/32 screenshot selesai pada 360×800, 768×1024, 1024×768,
  dan 1440×900 dalam light/dark mode.
- Supporting Playwright/axe 16/16 lulus, tanpa serious/critical violation,
  horizontal overflow, page error, atau API 5xx pada kondisi normal.
- Customer full payment, gagal→retry→berhasil, DP, pay-at-venue, QR, dan balance due
  lulus manual.
- Owner booking offline, empat precedence pricing, closure dengan 2 impacted booking,
  cancel, reschedule, dan transfer Primary Owner transaksional lulus manual.
- Staff direct URL Owner-only menampilkan 403 dan detail venue tanpa assignment
  dikembalikan 403.
- Realtime manual lulus pada 508 ms, 460 ms, dan 486 ms.
- Putaran QA awal menolak sign-off karena lima temuan High; seluruhnya sudah ditutup pada
  putaran remediasi yang ditautkan di bawah.

## Hasil automated QA lokal

- Migration MySQL 8 berhasil dari database kosong dan seed realistis berhasil dijalankan
  dua kali tanpa menduplikasi data.
- Formatter, lint, type-check, production build, contract, dan documentation test lulus.
- Unit/component: 39 frontend, 45 backend, dan 1 API client lulus.
- Integration: 22 lulus; security: 17 lulus; migration: 3 lulus.
- Concurrency MySQL 8: 50 request pada slot yang sama menghasilkan maksimal satu
  reservasi aktif.
- Phase A E2E: 36 lulus dan 20 skip terencana.
- Phase B1 E2E: 35 lulus dan 9 skip terencana, termasuk alur pembayaran
  gagal → retry attempt baru → berhasil dan feedback no-show server-backed.
- Audit production build: 66/66 route lulus.
- Matriks role/breakpoint otomatis: 16/16 lulus dengan 32 screenshot light/dark.
- Realtime lokal: tiga sampel otomatis diterima dalam 73 ms, 99 ms, dan 102 ms;
  maksimum 102 ms terhadap batas 2.000 ms.
- Tidak ditemukan horizontal overflow, browser/API 5xx, atau axe serious/critical pada
  matriks terakhir.
- `npm audit --omit=dev`: 0 vulnerability runtime.

## Temuan yang telah ditutup

- Retry pembayaran kini membuat attempt `RETRY` baru dan tidak lagi menjadi dead-end UI.
- Preview pricing kandidat membuktikan beberapa tanggal dan respons konflik overlap 409.
- Overflow Staff mobile akibat status aktivitas panjang telah dihilangkan.
- `VenueReviews` tidak lagi memakai kombinasi ARIA yang dilarang.
- Fixture E2E memakai tanggal masa depan dan database `lapangango_e2e` yang dibuat ulang,
  sehingga hasil tidak bergantung pada jam atau data development.
- Snapshot visual workspace switcher diperbarui setelah inspeksi perubahan yang disengaja.
- MapLibre tetap tercatat sebagai masalah lama dan statusnya adalah diganti Leaflet.

## Bukti

- Laporan acceptance: [`qa/B1_ACCEPTANCE_REPORT.md`](qa/B1_ACCEPTANCE_REPORT.md)
- Indeks bukti: [`qa/evidence/2026-08-28-b1-local-readiness/README.md`](qa/evidence/2026-08-28-b1-local-readiness/README.md)
- Screenshot otomatis: [`qa/evidence/2026-08-28-b1-local-readiness/screenshots/`](qa/evidence/2026-08-28-b1-local-readiness/screenshots/)
- Hasil terstruktur: [`qa/evidence/2026-08-28-b1-local-readiness/results/`](qa/evidence/2026-08-28-b1-local-readiness/results/)
- Realtime: [`qa/evidence/2026-08-28-b1-local-readiness/realtime-measurement.json`](qa/evidence/2026-08-28-b1-local-readiness/realtime-measurement.json)
- Audit 66 route: [`qa/evidence/2026-08-28-ui-route-audit/screenshots/`](qa/evidence/2026-08-28-ui-route-audit/screenshots/)

## Bukti manual terbaru

Indeks: [`qa/evidence/2026-08-29-b1-manual-security-local/README.md`](qa/evidence/2026-08-29-b1-manual-security-local/README.md).

Retest remediasi: [`qa/evidence/2026-08-29-b1-high-remediation-local/README.md`](qa/evidence/2026-08-29-b1-high-remediation-local/README.md).

Retest lima Medium: [`qa/evidence/2026-08-29-b1-medium-remediation-local/README.md`](qa/evidence/2026-08-29-b1-medium-remediation-local/README.md).

Matriks staging: [`qa/evidence/2026-08-30-b1-staging-visual-matrix/README.md`](qa/evidence/2026-08-30-b1-staging-visual-matrix/README.md).

Project Owner menerima local sign-off melalui percakapan Codex pada 29 Agustus 2026.
Implementer hanya mencatat keputusan tersebut. Gate teknis staging sudah lengkap; keputusan
akhir staging tetap menunggu Project Owner.

Migration/cutover production tetap di luar Phase B1 dan memerlukan persetujuan terpisah.
