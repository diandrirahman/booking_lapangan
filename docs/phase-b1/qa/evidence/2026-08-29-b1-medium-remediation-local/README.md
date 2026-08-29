# Evidence Phase B1 — Remediasi Medium Lokal

- Tanggal: 29 Agustus 2026
  Scope: lokal saja (`127.0.0.1`), tanpa Vercel, TiDB, Tigris, Google, atau provider live.

## Hasil

| Finding              | Perubahan yang diverifikasi                               | Status |
| -------------------- | --------------------------------------------------------- | ------ |
| `B1-AUTHZ-LOCAL-001` | list dan dropdown Staff hanya memuat venue assignment     | Closed |
| `B1-SEC-LOCAL-002`   | body di atas 1 MB menjadi `413 PAYLOAD_TOO_LARGE`         | Closed |
| `B1-OPS-LOCAL-002`   | outstanding dan dashboard memakai collectible rule server | Closed |
| `B1-BKG-LOCAL-001`   | attendance read model, live feedback, tombol hilang       | Closed |
| `B1-SRC-LOCAL-001`   | nearest slot live, bookable, dan tidak lampau             | Closed |

`qa:b1:local` lulus pada Node.js `v22.23.2`: format, lint, type-check, 85
unit/component/client tests, 22 integration, 17 security, build, Phase A/B1 E2E,
concurrency 50 request, contract, migration, dan documentation gate.

## External Chrome

Retest manual memakai web `127.0.0.1:4175` dan API `127.0.0.1:3102`. Matriks layar
yang berubah menghasilkan 40 screenshot: Customer katalog (8), Owner outstanding (8),
Owner no-show (8), Staff kalender (8), dan Admin regression smoke (8). Setiap layar
diambil pada `360×800`, `768×1024`, `1024×768`, dan `1440×900`, light/dark.

Hasil inspeksi:

- tidak ada horizontal overflow setelah toolbar memakai track `minmax(0, 1fr)`;
- tidak ada console error/warning atau API 5xx;
- Staff kalender hanya memiliki “Semua venue” dan “Arena Cendana”;
- Booking Offline Staff hanya memiliki “Arena Cendana”;
- outstanding tidak memuat `CANCELLED`/`EXPIRED`, tetapi `COMPLETED` bersaldo tetap ada;
- sesudah no-show, live region menampilkan “No-show tercatat”, dialog/tombol hilang, dan
  booking keluar dari “Kedatangan berikutnya”;
- kartu katalog tidak menampilkan nearest slot lampau;
- Admin Audit tetap dapat dibuka sebagai regression smoke.

## Indeks bukti

- [Status finding](findings.md)
- [Hasil automated gate](results/automated-gate.json)
- [Ringkasan matriks manual](results/manual-matrix.json)
- [Oversized JSON tersensor](security/results/oversized-json.json)
- [Console External Chrome](console/external-chrome-console.md)
- [Staff venue isolation](security/screenshots/staff-venue-isolation-1440x900-light.png)
- [Staff Booking Offline isolation](security/screenshots/staff-offline-venue-isolation-1440x900-light.png)
- [Direct URL Owner-only 403](security/screenshots/staff-owner-route-forbidden-1440x900-light.png)
- [No-show feedback](security/screenshots/owner-no-show-feedback-confirmed-1440x900-light.png)

Folder [`matrix`](matrix/) berisi seluruh 40 screenshot. Tidak ada password, cookie,
token, authorization header, signed URL, atau credential storage dalam bukti ini.
