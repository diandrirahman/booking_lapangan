# Laporan Acceptance Phase B1 — Lokal

- Tanggal pengujian: 29 Agustus 2026
- Runtime QA: Node.js `v22.23.2`
- Database canonical: MySQL 8
- Status: **LOCAL SIGN-OFF DITERIMA — GATE STAGING BERJALAN**

## Status gate staging 30 Agustus 2026

Vercel frontend/API, TiDB, Redis, Tigris private-media delivery, Midtrans Sandbox, login
empat role, dan realtime staging telah lulus compatibility smoke. Realtime end-to-end
tercatat 231 ms, 236 ms, dan 210 ms setelah API dipindahkan dari `iad1` ke `sin1`.

Google OIDC baru diverifikasi sampai authorization redirect. Consent/callback penuh dan
matriks visual staging empat role × empat breakpoint masih menunggu pelaksanaan, sehingga
laporan ini belum menyatakan final staging sign-off.

Bukti: [`2026-08-30-b1-staging-compatibility`](evidence/2026-08-30-b1-staging-compatibility/README.md).

## Environment

Pengujian menggunakan environment E2E lokal terisolasi:

- web `http://127.0.0.1:4175`;
- API `http://127.0.0.1:3102`;
- MySQL E2E port `3308`;
- Redis port `6380`, database `1`;
- MinIO sebagai adapter object storage lokal.

Database E2E dibuat ulang dari migration kosong. Seed realistis dijalankan dua kali untuk
membuktikan idempotensi. Database development tidak diubah oleh harness QA.

## Gate engineering

| Pemeriksaan                     | Hasil                                |
| ------------------------------- | ------------------------------------ |
| Format, lint, type-check, build | Lulus                                |
| Unit/component/API client       | 39 + 45 + 1 lulus                    |
| Integration/security/migration  | 22 + 17 + 3 lulus                    |
| Phase A / Phase B1 E2E          | 36 / 35 lulus; skip terencana 20 / 9 |
| Contract dan documentation test | Lulus                                |
| Concurrency 50 request          | Maksimal 1 reservasi aktif           |
| Audit 66 route                  | 66/66 lulus                          |
| Runtime dependency audit        | 0 vulnerability                      |

## Realtime lokal

|           Sampel |  Latency |
| ---------------: | -------: |
|                1 |    73 ms |
|                2 |   102 ms |
|                3 |    99 ms |
| Batas acceptance | 2.000 ms |

Outbox ditulis dalam transaksi domain. SSE hanya memberi sinyal dan frontend melakukan
REST refetch authoritative. Reconnect, stale/duplicate event, resync, dan fallback REST
telah diuji. Bukti mentah ada pada
[`realtime-measurement.json`](evidence/2026-08-28-b1-local-readiness/realtime-measurement.json).

## Matriks role dan breakpoint otomatis

| Breakpoint | Customer | Owner | Staff | Admin |
| ---------- | -------- | ----- | ----- | ----- |
| 360×800    | Lulus    | Lulus | Lulus | Lulus |
| 768×1024   | Lulus    | Lulus | Lulus | Lulus |
| 1024×768   | Lulus    | Lulus | Lulus | Lulus |
| 1440×900   | Lulus    | Lulus | Lulus | Lulus |

Seluruh 16 kombinasi bebas horizontal overflow, uncaught browser error, API 5xx, dan
axe serious/critical. Keyboard focus diuji pada setiap kombinasi. Bukti tersimpan pada
folder [`results`](evidence/2026-08-28-b1-local-readiness/results/) dan
[`screenshots`](evidence/2026-08-28-b1-local-readiness/screenshots/).

Screenshot utama:

- [Customer desktop](evidence/2026-08-28-b1-local-readiness/screenshots/desktop-1440x900-customer-light.png)
- [Owner desktop](evidence/2026-08-28-b1-local-readiness/screenshots/desktop-1440x900-owner-light.png)
- [Staff mobile](evidence/2026-08-28-b1-local-readiness/screenshots/mobile-360x800-staff-light.png)
- [Admin desktop dark](evidence/2026-08-28-b1-local-readiness/screenshots/desktop-1440x900-admin-dark.png)

## Defect dan disposition

| ID                 | Severity | Temuan                                       | Status                                |
| ------------------ | -------- | -------------------------------------------- | ------------------------------------- |
| B1-QA-RT-001       | Blocker  | Event menunggu maintenance job               | Closed — maksimum 102 ms              |
| B1-QA-A11Y-001     | High     | Kontras dark mode                            | Closed — 16/16 lulus                  |
| B1-QA-A11Y-002     | High     | ARIA rating tidak valid                      | Closed — audit 66 route lulus         |
| B1-QA-UI-001       | High     | Overflow Staff mobile                        | Closed — 360×800 lulus                |
| B1-QA-PAY-001      | High     | Retry payment menjadi dead-end               | Closed — E2E gagal→retry→berhasil     |
| B1-QA-TEST-001     | Medium   | Fixture bergantung data/jam development      | Closed — isolated reset + future date |
| B1-QA-MANUAL-001   | Gate     | External Chrome protected-role belum selesai | Closed — 32/32 screenshot manual      |
| B1-SEC-LOCAL-001   | High     | Webhook Midtrans diblokir origin guard       | Closed — signature/idempotency lulus  |
| B1-SEC-LOCAL-003   | High     | Redis outage menjatuhkan API                 | Closed — degraded/fallback/recovery   |
| B1-SEC-LOCAL-004   | High     | Signed upload terlalu luas                   | Closed — venue/role/MIME/magic bytes  |
| B1-ENV-LOCAL-001   | High     | Upload WebP MinIO gagal                      | Closed — External Chrome 100%         |
| B1-OPS-LOCAL-001   | High     | Admin Audit Log masih prototype              | Closed — server-backed audit          |
| B1-SEC-LOCAL-002   | Medium   | Oversized JSON menjadi 500                   | Closed — 413 + request ID             |
| B1-AUTHZ-LOCAL-001 | Medium   | List Staff menampilkan venue unassigned      | Closed — server assignment filter     |
| B1-OPS-LOCAL-002   | Medium   | Outstanding memasukkan terminal booking      | Closed — shared collectible rule      |
| B1-BKG-LOCAL-001   | Medium   | No-show tanpa feedback/persistensi terlihat  | Closed — read model + live feedback   |
| B1-SRC-LOCAL-001   | Medium   | Nearest slot katalog dapat lampau            | Closed — live bookable-slot query     |

## Keputusan QA lokal

Inspeksi External Chrome, matriks dasar 32/32, dan 40 screenshot tambahan untuk layar
yang berubah telah selesai. Seluruh lima finding High dan lima finding Medium sudah
ditutup tanpa horizontal overflow, console error, API 5xx, atau axe serious/critical.

Seluruh requirement lokal berstatus `complete-local`. Project Owner memberikan keputusan
`Diterima` melalui percakapan Codex pada 29 Agustus 2026. Implementer hanya mencatat
keputusan tersebut; gate staging belum dijalankan.

Bukti lengkap dan screenshot ada pada
[`2026-08-29-b1-manual-security-local`](evidence/2026-08-29-b1-manual-security-local/README.md).
Retest High ada pada
[`2026-08-29-b1-high-remediation-local`](evidence/2026-08-29-b1-high-remediation-local/README.md).
Retest Medium ada pada
[`2026-08-29-b1-medium-remediation-local`](evidence/2026-08-29-b1-medium-remediation-local/README.md).
Catatan keputusan tersedia pada [`PROJECT_OWNER_SIGNOFF.md`](PROJECT_OWNER_SIGNOFF.md).

Vercel, TiDB, Tigris, Google OIDC live, dan realtime staging tidak menjadi blocker lokal.
Semua itu dapat dijalankan sebagai pekerjaan gate staging berikutnya setelah instruksi
terpisah dari Project Owner.
