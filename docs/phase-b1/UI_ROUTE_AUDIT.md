# Audit UI 66 Route — Phase B1

Referensi di bawah adalah pola visual, bukan source code yang disalin. Semua adaptasi wajib
memakai token, bahasa, accessibility, dark mode, dan domain LapanganGo.

Kode referensi:

- `PCC`: [Product Cards and Checkout](https://21st.dev/blog/react-product-card-checkout-components)
- `DASH`: [Dashboard Components](https://21st.dev/blog/dashboard-component-libraries)
- `SEL`: [Dropdowns and Selects](https://21st.dev/blog/react-dropdown-menu-components)
- `REV`: review summary/customer review card pada kategori Reviews
- `AUTH`: sign-in/sign-up form yang tenang, tanpa flip/3D/glass
- `DATA`: TanStack-style data table, filter toolbar, row actions
- `STATE`: empty/error/notification card dengan hierarchy sederhana

Status `verified` berarti route diperiksa melalui automated/manual evidence. `adapted`
berarti komponen sudah disesuaikan dan bukti route tersedia, tetapi integrasi domain
berikutnya tetap mengikuti fase yang tertulis. Audit production build menyimpan satu
screenshot untuk setiap route; bukti render tidak mengubah fitur B2/B3 menjadi fitur B1.

## Customer — 19 route

| Route                         | Referensi       | Adaptasi LapanganGo dan state utama                                          | Status/evidence                       |
| ----------------------------- | --------------- | ---------------------------------------------------------------------------- | ------------------------------------- |
| `/`                           | PCC             | image-forward venue/Mabar card; hover dan focus setara; reduced motion       | verified Phase A visual               |
| `/venues`                     | PCC, SEL, STATE | filter toolbar, 4:3 card, Leaflet/list sync, retry/empty/geolocation denial  | verified B1 E2E                       |
| `/venues/:slug`               | PCC, REV        | gallery, facility/court facts, review distribution/cards, sticky booking CTA | verified B1 E2E                       |
| `/venues/:slug/book`          | SEL             | date/court selector dan slot grid contiguous dengan disabled reason          | verified B1 E2E                       |
| `/checkout/:bookingId`        | PCC             | compact booking item, radio payment cards, add-on, sticky price summary      | verified B1 E2E                       |
| `/payments/:attemptId`        | PCC, STATE      | payment status, countdown, sandbox action hierarchy                          | adapted; component test               |
| `/payments/:attemptId/result` | STATE           | separate success/pending/failed/expired result                               | adapted; Customer E2E success         |
| `/bookings`                   | DATA, STATE     | status filter dan booking cards/list                                         | adapted; route smoke                  |
| `/bookings/:id`               | PCC             | status timeline, price facts, QR simulation, balance action                  | adapted; component test               |
| `/mabar`                      | PCC, STATE      | community event cards, favorite and hover/focus                              | adapted; B3 simulation                |
| `/mabar/:id`                  | PCC             | event facts/host/capacity/action                                             | adapted; B3 simulation                |
| `/mabar/create/:bookingId`    | AUTH, SEL       | clear validated creation form                                                | adapted; B3 simulation                |
| `/mabar/:id/manage`           | DATA            | participant/waitlist management                                              | adapted; B3 simulation                |
| `/favorites`                  | PCC, STATE      | venue favorites, no fake customer table or add button                        | adapted; B2 simulation                |
| `/history`                    | PCC, STATE      | recently viewed venue list/empty state                                       | verified visual; B2 simulation        |
| `/notifications`              | STATE           | server notification center, read/read-all, retry/unauthorized                | adapted; API integration              |
| `/reviews`                    | REV, STATE      | customer review history/empty state                                          | verified visual; B2 simulation        |
| `/support`                    | DATA, STATE     | support ticket list/create state                                             | verified visual; B2 simulation        |
| `/profile`                    | AUTH, SEL       | profile/security/Google linking sections                                     | verified visual; OIDC staging blocked |

## Business — 24 route

| Route                                               | Referensi   | Adaptasi LapanganGo dan state utama                                    | Status/evidence                |
| --------------------------------------------------- | ----------- | ---------------------------------------------------------------------- | ------------------------------ |
| `/business/:tenant/overview`                        | DASH        | KPI strip, attention queue, schedule/activity hierarchy                | verified 4-breakpoint evidence |
| `/business/:tenant/operations/calendar`             | DASH, DATA  | operational calendar with status legend and detail drawer              | verified Staff/Owner E2E       |
| `/business/:tenant/operations/bookings`             | DATA        | domain columns, filters, booking drawer/actions                        | verified Owner E2E             |
| `/business/:tenant/operations/bookings/new-offline` | AUTH, SEL   | two-column form, contiguous slot selection, explicit adjustment reason | adapted; integration test      |
| `/business/:tenant/operations/check-in`             | AUTH, STATE | QR/code entry and attendance result                                    | adapted; route smoke           |
| `/business/:tenant/operations/outstanding`          | DATA        | balance table and settlement action                                    | adapted; route smoke           |
| `/business/:tenant/venues`                          | DATA, STATE | setup progress list and create drawer                                  | verified Owner E2E             |
| `/business/:tenant/venues/:venueId/profile`         | AUTH, SEL   | profile/media/catalog sections with autosave feedback                  | adapted; setup integration     |
| `/business/:tenant/venues/:venueId/courts`          | DATA, AUTH  | court list/editor and master sport select                              | adapted; setup integration     |
| `/business/:tenant/venues/:venueId/availability`    | DASH, SEL   | weekly schedule, exceptions, closure and impacted bookings             | verified; integration test     |
| `/business/:tenant/venues/:venueId/pricing`         | DATA, SEL   | rule table/editor, conflict alert, candidate preview                   | adapted; pricing tests         |
| `/business/:tenant/venues/:venueId/policies`        | AUTH, STATE | payment settings and publication checklist                             | adapted; setup integration     |
| `/business/:tenant/finance`                         | DASH        | sandbox finance summary only                                           | verified visual; B2 simulation |
| `/business/:tenant/finance/transactions`            | DATA        | transaction table with sandbox boundary                                | verified visual; B2 simulation |
| `/business/:tenant/finance/refunds`                 | DATA, STATE | refund state list                                                      | verified visual; B2 simulation |
| `/business/:tenant/finance/ledger`                  | DATA        | ledger rows, no decorative cards                                       | verified visual; B2 simulation |
| `/business/:tenant/finance/payouts`                 | DATA, STATE | payout simulation table/empty                                          | verified visual; B2 simulation |
| `/business/:tenant/growth/promotions`               | DATA, STATE | discovery promotion list only                                          | verified visual; B2 simulation |
| `/business/:tenant/growth/reviews`                  | REV, DATA   | rating summary and review rows                                         | verified visual; B2 simulation |
| `/business/:tenant/growth/support`                  | DATA, STATE | tenant support tickets                                                 | verified visual; B2 simulation |
| `/business/:tenant/growth/mabar`                    | DATA        | read-only venue Mabar list                                             | verified visual; B3 simulation |
| `/business/:tenant/team`                            | DATA, SEL   | membership and venue assignment                                        | adapted; Staff guard test      |
| `/business/:tenant/notifications`                   | STATE       | operational notification list                                          | verified visual; B2 simulation |
| `/business/:tenant/settings`                        | AUTH, SEL   | tenant lifecycle/ownership/security sections                           | verified visual                |

## Admin — 23 route

| Route                         | Referensi   | Adaptasi LapanganGo dan state utama                               | Status/evidence                  |
| ----------------------------- | ----------- | ----------------------------------------------------------------- | -------------------------------- |
| `/admin`                      | DASH        | KPI strip, sandbox volume, integration status and attention queue | verified Admin evidence          |
| `/admin/customers`            | DATA        | searchable customer table/status actions                          | verified visual; API deferred    |
| `/admin/tenants`              | DATA, SEL   | lifecycle table/action dialog with required reason                | adapted; Admin E2E               |
| `/admin/verifications`        | DATA, STATE | queue/filter/document simulation/decision dialog                  | verified Admin E2E               |
| `/admin/venues`               | DATA, SEL   | venue lifecycle table/action dialog                               | adapted; Admin E2E               |
| `/admin/masters/sports`       | DATA, SEL   | master table/add/toggle                                           | verified Admin E2E               |
| `/admin/masters/facilities`   | DATA, SEL   | master table/add/toggle                                           | adapted; contract test           |
| `/admin/masters/scheduling`   | DATA, SEL   | interval/buffer options                                           | adapted; contract test           |
| `/admin/templates/payments`   | DATA, AUTH  | payment option management                                         | adapted; Admin service           |
| `/admin/templates/refunds`    | DATA, AUTH  | refund policy template simulation                                 | verified visual; B2 simulation   |
| `/admin/templates/mabar`      | DATA, AUTH  | Mabar cancellation template                                       | verified visual; B3 simulation   |
| `/admin/commissions`          | DATA        | commission configuration                                          | verified visual; B2 simulation   |
| `/admin/promotions`           | DATA        | platform promo discovery                                          | verified visual; B2 simulation   |
| `/admin/bookings`             | DATA        | platform booking list/status                                      | verified visual; API deferred    |
| `/admin/payments`             | DATA        | sandbox payment attempts                                          | verified visual; API deferred    |
| `/admin/refunds`              | DATA        | limited B1 automatic refund list                                  | verified visual; API deferred    |
| `/admin/finance`              | DASH, DATA  | sandbox aggregate, no real-money claim                            | verified visual; B2 simulation   |
| `/admin/payouts`              | DATA, STATE | payout simulation                                                 | verified visual; B2 simulation   |
| `/admin/reviews`              | REV, DATA   | summary/moderation placeholder limited to read model              | verified visual; B2 simulation   |
| `/admin/support`              | DATA, STATE | support queue                                                     | verified visual; B2 simulation   |
| `/admin/audit`                | DATA        | sensitive action log with actor/reason/time                       | verified visual; B2 integration  |
| `/admin/config/notifications` | DATA, AUTH  | notification configuration                                        | verified visual; B2 simulation   |
| `/admin/system`               | DASH, STATE | health, cron, outbox and external integration status              | verified visual; staging blocked |

## Temuan lintas route

1. Critical B1 Customer/Owner/Staff/Admin screens sudah memakai hierarchy dari `PCC` dan
   `DASH`, bukan glass/bento/3D decoration.
2. Supporting B2/B3 memakai reusable domain pattern dan tetap berlabel simulasi. Audit
   visual tidak mengubah status integrasi domain yang memang berada di fase berikutnya.
3. Bukti empat role/empat breakpoint terbaru berada di
   `docs/phase-b1/qa/evidence/2026-08-28-b1-local-readiness/`. Bukti tersebut tidak mencakup
   seluruh route; bukti terpisah 66 route berada di
   `docs/phase-b1/qa/evidence/2026-08-28-ui-route-audit/screenshots/`.
