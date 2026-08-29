# Evidence QA Manual dan Security Lokal Phase B1

- Tanggal: 29 Agustus 2026
- Environment: lokal terisolasi
  Status: **SELESAI — local sign-off DITOLAK karena temuan High terbuka**

## Environment

- Node.js `v22.23.2` melalui runtime QA.
- Web: `http://127.0.0.1:4175`.
- API functional QA: `http://127.0.0.1:3102`.
- API security boundary (development mode): `http://127.0.0.1:3103`.
- MySQL E2E: port `3308`, database `lapangango_e2e`.
- Redis: port `6380`; MinIO: port `9000`.
- Database development tidak disentuh.

## Ringkasan bukti

- External Chrome: 59 screenshot flow/security empat role.
- Matriks manual: 32/32 screenshot (`4 role × 4 viewport × 2 theme`).
- Matriks pendukung Playwright/axe: 16/16 lulus; hasil JSON ada di
  `matrix/results/`.
- Customer: register/login/logout, search/filter/sorting/map, venue detail, slot,
  full/DP/pay-at-venue, retry, Booking Saya, QR, dan balance due.
- Owner: setup venue sampai 88%, schedule/exception, empat tingkat pricing,
  payment option/add-on, kalender, booking offline, closure, reschedule, impacted
  booking, Tim, dan transfer Primary Owner.
- Staff: sidebar terbatas, direct URL 403, booking venue assigned, confirmation,
  pelunasan sandbox, check-in, outstanding, kalender, serta realtime.
- Admin: dashboard, tenant, venue, booking, payment, refund, master, system, dan
  audit screen. Decision manual venue QA terblokir upload MinIO lokal.
- Security: `security/results/pre-auth-boundaries.json`,
  `security/results/post-auth-boundaries.json`, dan
  `security/results/realtime-redis.json`.
- Semua defect dan security finding ada di `findings.md`.

## Automated supporting evidence

- Security: 8/8 lulus.
- Concurrency: 1/1 lulus; maksimal satu reservasi aktif dari 50 request.
- Integration: 18/18 lulus.
- Runtime dependency audit: 0 vulnerability.
- Frontend production build Node.js 22: lulus; tidak ditemukan pola secret pada bundle.
- Playwright/axe supporting matrix: 16/16 lulus, tanpa serious/critical violation,
  horizontal overflow, page error, atau API 5xx pada layar kritis kondisi normal.

## Hasil realtime dan Redis

- Realtime booking ke kalender: `508 ms`, `460 ms`, dan `486 ms`; seluruhnya lulus
  target 2 detik.
- Saat Redis dihentikan, API `3102` crash karena error ioredis/SSE tidak tertangani.
- Sebelum dan sesudah outage tetap terdapat 57 booking dan 29 payment attempt;
  tidak ada kehilangan transaksi MySQL.
- Setelah Redis dan API dinyalakan kembali, katalog kembali menampilkan 5 venue dan
  session Staff masih valid.

## Keputusan

Local sign-off **tidak dapat diterima**. Temuan High terbuka mencakup webhook
Midtrans yang diblokir origin guard, signed upload yang terlalu luas, crash API saat
Redis unavailable, dan Admin Audit Log yang masih memakai data prototype. Upload
WebP MinIO lokal juga gagal sehingga submission venue QA dan keputusan Admin manual
tidak dapat ditutup.

Project Owner sign-off tidak diisi oleh implementer.
