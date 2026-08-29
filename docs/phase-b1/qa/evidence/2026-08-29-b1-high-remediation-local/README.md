# Evidence Phase B1 — Remediasi High Lokal

- Tanggal: 29 Agustus 2026
  Scope: lokal saja (`127.0.0.1`), tanpa Vercel, TiDB, Tigris, Google, atau provider live.

## Hasil

Lima finding High yang menjadi scope remediasi telah ditutup:

| Finding            | Retest                                                                        | Hasil  |
| ------------------ | ----------------------------------------------------------------------------- | ------ |
| `B1-SEC-LOCAL-001` | webhook tanpa Origin, invalid signature, forged Origin, duplicate valid event | Closed |
| `B1-SEC-LOCAL-003` | Redis outage, health degraded, REST publik, protected 503, recovery           | Closed |
| `B1-SEC-LOCAL-004` | venue-bound signed upload, role/tenant boundary, MIME dan magic bytes         | Closed |
| `B1-ENV-LOCAL-001` | upload WebP MinIO dari External Chrome hingga progress 100%                   | Closed |
| `B1-OPS-LOCAL-001` | Admin Audit server-backed dengan actor/reason/timestamp/before-after          | Closed |

Finding Medium dari putaran QA awal memang berada di luar scope putaran ini. Kelimanya
kemudian ditutup pada
[`2026-08-29-b1-medium-remediation-local`](../2026-08-29-b1-medium-remediation-local/README.md).
Rincian historis ada di [findings.md](findings.md).

## Bukti External Chrome

- [Owner upload WebP berhasil](screenshots/owner-webp-upload-success-retest-1440x900-light.png)
- [Owner venue 100% dan submitted](screenshots/owner-venue-100-percent-submitted-1440x900-light.png)
- [Admin Audit event nyata — light](screenshots/admin-audit-events-1440x900-light.png)
- [Admin Audit event nyata — dark](screenshots/admin-audit-events-1440x900-dark.png)
- [Customer/non-Owner direct URL 403](screenshots/customer-owner-direct-url-403-1440x900-light.png)

Admin Audit diuji pada empat breakpoint dalam light/dark mode:

- `360×800`: [light](screenshots/admin-audit-empty-360x800-light.png) · [dark](screenshots/admin-audit-empty-360x800-dark.png)
- `768×1024`: [light](screenshots/admin-audit-empty-768x1024-light.png) · [dark](screenshots/admin-audit-empty-768x1024-dark.png)
- `1024×768`: [light](screenshots/admin-audit-empty-1024x768-light.png) · [dark](screenshots/admin-audit-empty-1024x768-dark.png)
- `1440×900`: [light](screenshots/admin-audit-empty-1440x900-light.png) · [dark](screenshots/admin-audit-empty-1440x900-dark.png)

Seluruh ukuran yang diuji memiliki `scrollWidth <= innerWidth`. Empty state direkam dari
database bersih setelah aggregate gate; screenshot event nyata diambil sebelum reset
gate. Dialog before/after diverifikasi dari DOM dan hasilnya dicatat pada JSON terstruktur.
Tidak ditemukan console error pada alur upload dan Audit yang diretest.

## Bukti terstruktur

- [Hasil automated gate](results/automated-gate.json)
- [Webhook dan idempotensi](security/results/webhook.json)
- [Redis outage dan recovery](security/results/redis-outage.json)
- [Upload authorization](security/results/upload-authorization.json)
- [Admin Audit](security/results/admin-audit.json)

Tidak ada password, cookie, token, signed URL, atau credential storage yang disimpan pada
bukti ini.
