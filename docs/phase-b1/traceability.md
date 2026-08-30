# Traceability 67 Requirement Phase B1

Status pada dokumen ini berdasarkan perilaku domain yang sudah dibuktikan, bukan hanya
keberadaan route. `complete-local` berarti implementasi dan bukti otomatis lokal
tersedia; `partial` berarti sebagian acceptance lokal belum terpenuhi. Validasi provider
dan environment eksternal dicatat sebagai gate staging terpisah. Gate staging telah
lulus dan diterima Project Owner pada 30 Agustus 2026.

## Authentication

| ID          | Status         | Modul/API                                   | Bukti otomatis/manual                     | Kekurangan yang tersisa      |
| ----------- | -------------- | ------------------------------------------- | ----------------------------------------- | ---------------------------- |
| B1-AUTH-001 | complete-local | `CatalogService`, `/venues`, checkout guard | `phase-b1.spec.ts` browse lalu login gate | Retest staging lulus         |
| B1-AUTH-002 | complete-local | `AuthService`, `POST /auth/register`        | `auth.test.ts`, register E2E              | SMTP verification di luar B1 |
| B1-AUTH-003 | complete-local | `GoogleOidcService`, `/auth/google/*`       | Unit validation + adapter lokal           | Google OIDC staging lulus    |
| B1-AUTH-004 | complete-local | `/me`, workspace switcher, shell guards     | register/workspace dan 403 E2E            | -                            |
| B1-AUTH-005 | complete-local | Redis session, secure cookie, logout        | auth/security + outage/recovery manual    | -                            |
| B1-AUTH-006 | complete-local | auth/tenant/admin middleware                | `tenantIsolation.test.ts`, 403 E2E        | -                            |

## Tenant

| ID         | Status         | Modul/API                                  | Bukti otomatis/manual                               | Kekurangan yang tersisa               |
| ---------- | -------------- | ------------------------------------------ | --------------------------------------------------- | ------------------------------------- |
| B1-TEN-001 | complete-local | `TenantService.createDraft`                | workspace creation E2E                              | -                                     |
| B1-TEN-002 | complete-local | `transferPrimaryOwner` transaction + audit | tenant unit/integration + External Chrome           | Transfer dan audit DB terbukti manual |
| B1-TEN-003 | complete-local | memberships dan workspace query            | auth/workspace E2E                                  | -                                     |
| B1-TEN-004 | complete-local | verification submit/decision/history       | integration + External Chrome submit/review/approve | -                                     |
| B1-TEN-005 | complete-local | assignment API + authorization scope       | security + External Chrome venue isolation          | -                                     |
| B1-TEN-006 | complete-local | lifecycle status dan soft-delete fields    | admin status service + route smoke                  | Regression staging lulus              |

## Venue

| ID         | Status         | Modul/API                                 | Bukti otomatis/manual         | Kekurangan yang tersisa                      |
| ---------- | -------------- | ----------------------------------------- | ----------------------------- | -------------------------------------------- |
| B1-VEN-001 | complete-local | venue draft + publication preview         | Owner setup integration/E2E   | -                                            |
| B1-VEN-002 | complete-local | validated venue profile + progress        | `ownerSetupApproval.test.ts`  | -                                            |
| B1-VEN-003 | complete-local | sport master references                   | setup integration             | -                                            |
| B1-VEN-004 | complete-local | venue sports dan single-sport court FK    | migration + setup integration | -                                            |
| B1-VEN-005 | complete-local | facilities/add-ons + booking snapshot     | `bookingAddons.test.ts`       | -                                            |
| B1-VEN-006 | complete-local | venue-bound signed upload + S3 adapter    | security + External Chrome    | -                                            |
| B1-VEN-007 | complete-local | immutable publication snapshot + decision | `ownerSetupApproval.test.ts`  | Retest staging lulus                         |
| B1-VEN-008 | complete-local | `AdminMasterService`                      | contract/E2E master           | enforcement opsi schedule lengkap di SCH-004 |

## Schedule

| ID         | Status         | Modul/API                                          | Bukti otomatis/manual                                | Kekurangan yang tersisa  |
| ---------- | -------------- | -------------------------------------------------- | ---------------------------------------------------- | ------------------------ |
| B1-SCH-001 | complete-local | weekly schedule + atomic lazy slot materialization | Owner setup integration membuat 14 slot              | -                        |
| B1-SCH-002 | complete-local | court/venue exception precedence + status refresh  | Owner setup integration `CLOSED`                     | -                        |
| B1-SCH-003 | complete-local | closure/block/maintenance + impacted query         | `operationsCollision.test.ts`                        | -                        |
| B1-SCH-004 | complete-local | admin interval master + active-option validation   | Owner setup integration menolak 75 menit             | -                        |
| B1-SCH-005 | complete-local | `validateSlotSelection`                            | contiguous slot unit/concurrency                     | -                        |
| B1-SCH-006 | complete-local | buffer reservation setelah slot terakhir           | Owner setup integration memverifikasi 2 reservation  | -                        |
| B1-SCH-007 | complete-local | booking window + lead time                         | `catalogAvailability.test.ts` dan booking validation | -                        |
| B1-SCH-008 | complete-local | shared reservation transaction                     | online/offline collision + concurrency               | -                        |
| B1-SCH-009 | complete-local | impacted booking, cancel/reschedule, notification  | integration + External Chrome 2 impacted booking     | -                        |
| B1-SCH-010 | complete-local | MySQL reservation authoritative                    | concurrency/security tests                           | Compatibility TiDB lulus |

## Pricing

| ID         | Status         | Modul/API                         | Bukti otomatis/manual                            | Kekurangan yang tersisa |
| ---------- | -------------- | --------------------------------- | ------------------------------------------------ | ----------------------- |
| B1-PRI-001 | complete-local | `priceResolver` four rule kinds   | resolver unit tests                              | -                       |
| B1-PRI-002 | complete-local | court override resolver           | resolver unit tests                              | -                       |
| B1-PRI-003 | complete-local | overlap guard + conflict detail   | pricing service/contract + candidate integration | -                       |
| B1-PRI-004 | complete-local | half-open overlap helper          | resolver/overlap unit                            | -                       |
| B1-PRI-005 | complete-local | slot/add-on immutable price lines | `bookingAddons.test.ts`                          | -                       |
| B1-PRI-006 | complete-local | final owner price; no tax engine  | booking integration                              | -                       |
| B1-PRI-007 | complete-local | candidate price preview API/UI    | multi-date integration + External Chrome pricing | -                       |

## Search

| ID         | Status         | Modul/API                                              | Bukti otomatis/manual                        | Kekurangan yang tersisa             |
| ---------- | -------------- | ------------------------------------------------------ | -------------------------------------------- | ----------------------------------- |
| B1-SRC-001 | complete-local | catalog query filters                                  | catalog integration + Customer E2E           | -                                   |
| B1-SRC-002 | complete-local | cursor 20 + infinite query                             | contract/component/E2E                       | -                                   |
| B1-SRC-003 | complete-local | six catalog sort modes                                 | catalog integration                          | -                                   |
| B1-SRC-004 | complete-local | Leaflet + action geolocation + fallback                | Leaflet E2E                                  | production tile provider di luar B1 |
| B1-SRC-005 | complete-local | live nearest-bookable-slot catalog read model          | integration + Customer E2E + External Chrome | -                                   |
| B1-SRC-006 | complete-local | shareable detail/gallery/facility/court/review summary | Customer E2E                                 | review creation tetap B2            |

## Booking

| ID         | Status         | Modul/API                                            | Bukti otomatis/manual                             | Kekurangan yang tersisa          |
| ---------- | -------------- | ---------------------------------------------------- | ------------------------------------------------- | -------------------------------- |
| B1-BKG-001 | complete-local | HOLD 10 menit server-side                            | booking integration/E2E                           | -                                |
| B1-BKG-002 | complete-local | payment mode validation                              | `paymentLifecycle.test.ts`                        | Midtrans Sandbox lulus           |
| B1-BKG-003 | complete-local | DP amount dan balance attempt                        | `paymentLifecycle.test.ts`                        | -                                |
| B1-BKG-004 | complete-local | reservation mengurangi balance                       | `paymentLifecycle.test.ts`                        | -                                |
| B1-BKG-005 | complete-local | paid reservation -> pending -> reject/timeout refund | `paymentLifecycle.test.ts`                        | Job production di luar B1        |
| B1-BKG-006 | complete-local | offline booking tanpa customer user                  | `operationsCollision.test.ts`                     | -                                |
| B1-BKG-007 | complete-local | Owner-only adjustment + audit before/after/reason    | operations integration + owner authorization test | custom permission tetap B2       |
| B1-BKG-008 | complete-local | Booking Saya/detail/QR/payment/balance               | Customer E2E                                      | -                                |
| B1-BKG-009 | complete-local | attendance record + check-in transition              | operations integration/component                  | QR scanner hardware di luar demo |
| B1-BKG-010 | complete-local | 15-minute no-show guard + attendance read model      | integration + E2E + External Chrome live feedback | -                                |
| B1-BKG-011 | complete-local | late payment creates automatic refund only           | payment integration/unit                          | Provider production di luar B1   |
| B1-BKG-012 | complete-local | booking state machine + transition history           | state machine unit/integration                    | -                                |

## Payment

| ID         | Status         | Modul/API                                              | Bukti otomatis/manual                              | Kekurangan yang tersisa    |
| ---------- | -------------- | ------------------------------------------------------ | -------------------------------------------------- | -------------------------- |
| B1-PAY-001 | complete-local | separate attempt rows for DP/balance/reservation/retry | integration + External Chrome gagal→retry→berhasil | -                          |
| B1-PAY-002 | complete-local | Midtrans adapter mapping                               | `paymentProvider.test.ts`                          | Midtrans Sandbox lulus     |
| B1-PAY-003 | complete-local | signature + provider event inbox                       | security/integration + duplicate manual retest     | -                          |
| B1-PAY-004 | complete-local | locked paid/refund aggregate + cap                     | payment lifecycle + refund processor               | -                          |
| B1-PAY-005 | complete-local | attempt expiry follows HOLD; late payment guarded      | payment integration                                | Cron production di luar B1 |
| B1-PAY-006 | complete-local | deadline + grace 30 menit + maintenance cancellation   | payment lifecycle integration                      | -                          |
| B1-PAY-007 | complete-local | Sandbox/Simulasi labels                                | checkout/payment/admin visual tests                | -                          |

## Operations

| ID         | Status         | Modul/API                                                    | Bukti otomatis/manual                       | Kekurangan yang tersisa |
| ---------- | -------------- | ------------------------------------------------------------ | ------------------------------------------- | ----------------------- |
| B1-OPS-001 | complete-local | dashboard schedule/availability/pending/outstanding/activity | integration + External Chrome server filter | -                       |
| B1-OPS-002 | complete-local | calendar + outbox/SSE/refetch                                | realtime + Redis outage/recovery retest     | -                       |
| B1-OPS-003 | complete-local | admin summary + sandbox/integration/audit                    | Admin Audit integration + External Chrome   | -                       |
| B1-OPS-004 | complete-local | grouped business navigation                                  | route/Owner E2E                             | -                       |
| B1-OPS-005 | complete-local | Staff shell, hidden nav, server 403, venue scope             | security + Staff E2E + External Chrome      | -                       |

## Ringkasan gate

- MySQL 8 migration dan seed: lulus lokal.
- Integration: 10 file, 22 test lulus setelah perubahan terakhir.
- Security: 2 file, 17 test lulus, termasuk webhook, session-store outage, upload, dan
  authorization.
- Concurrency: 50 request menghasilkan maksimal satu active reservation.
- E2E B1: 35 test lulus dan 9 skip terencana; alur retry pembayaran, Staff isolation,
  outstanding, no-show, nearest slot, serta empat breakpoint telah diuji ulang.
- Manual External Chrome: matriks dasar 32/32 dan 40 screenshot layar yang berubah
  selesai; supporting Playwright/axe 16/16 lulus.
- Realtime normal lokal: 508/460/486 ms. Redis outage/recovery lulus tanpa API crash.
- Vercel, TiDB/Tigris, Google OIDC, Midtrans Sandbox, realtime staging, dan matriks
  visual staging telah lulus.

Seluruh 67 requirement lokal berstatus `complete-local`; tidak ada status `partial` atau
`missing`, dan tidak ada finding Blocker/Critical/High/Medium terbuka. Project Owner
menerima local readiness pada 29 Agustus 2026 dan final staging sign-off pada 30 Agustus 2026. Phase B1 dinyatakan selesai.
