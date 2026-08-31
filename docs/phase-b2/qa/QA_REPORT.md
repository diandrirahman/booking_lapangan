# Phase B2 QA Report

- Tanggal pembaruan terakhir: 31 Agustus 2026
- Runtime canonical: Node.js `v22.23.2`
- Environment: MySQL 8 E2E `3308`, Redis `6380/1`, API `3102`, web `4175`
- Scope: lokal terisolasi, regression B1 + fitur B2
- Status lokal: **local readiness accepted; 43/43 complete-local**
- Status staging source terbaru: **accepted — final Project Owner sign-off**

## Hasil otomatis

| Gate                         | Hasil                                            |
| ---------------------------- | ------------------------------------------------ |
| Formatter                    | Lulus                                            |
| ESLint                       | Lulus                                            |
| TypeScript                   | Lulus                                            |
| Unit frontend/backend/client | 49 + 57 + 2 lulus                                |
| Integration                  | 65/65 lulus                                      |
| Security                     | 29/29 lulus                                      |
| Concurrency                  | 2/2 lulus; promo quota diuji dengan 50 request   |
| OpenAPI contract             | Lulus                                            |
| B2 Playwright empat role     | 4/4 lulus, termasuk regression dialog dan axe    |
| Runtime dependency audit     | 0 High/Critical; 2 Moderate transitive pada UUID |
| Agregat `qa:b2:local`        | Lulus final setelah remediasi UI                 |

Migration dijalankan dari database `lapangango_e2e` kosong dan seed sintetis. Perubahan
QA terakhir menambah `reviewId` nullable pada read model booking Customer serta
regression API client untuk respons sukses 2xx tanpa body.

## QA manual External Chrome

Alur empat role selesai pada desktop 1440×900:

- Customer membuat tiket, membuat review, memeriksa booking, dan preference.
- Owner memeriksa finance/ledger/refund/payout, membuat promo, membalas review,
  mengatur reminder, serta memeriksa role/assignment.
- Staff hanya melihat menu dan venue assignment yang diizinkan; direct finance URL
  menghasilkan forbidden.
- Admin memproses payout sandbox, hide/restore review, resolve support, menambah reminder,
  dan memeriksa commission/promo/ledger/refund.

Matriks responsive menghasilkan **24/24 screenshot lulus**:

- Light: 4 role × 4 breakpoint (`360×800`, `768×1024`, `1024×768`, `1440×900`).
- Dark: 4 role × `360×800` dan `1440×900`.
- Seluruh viewport aktual sesuai; tidak ada horizontal overflow, broken image, clipped
  critical element, atau console error/warning.
- Focus keyboard terlihat pada seluruh kombinasi.
- Axe WCAG A/AA serious/critical dijalankan sebagai bukti otomatis pendukung pada
  halaman representatif empat role.

Evidence: `evidence/2026-08-30-b2-local-readiness/`.

## Retest delta UI terbaru

Setelah penyegaran UI Customer, Owner, dan Admin, External Chrome mengulang halaman
yang berubah pada mobile `360x800` dan desktop `1440x900`, light/dark. Staff mendapat
regression shell/menu serta direct finance forbidden.

- **87 screenshot** tersedia dengan dimensi file sesuai viewport.
- Customer booking authenticated/unauthenticated, support, review, notification, dan
  dialog terkait lulus.
- Sepuluh halaman Owner B2 lulus; finance breakdown menampilkan nama venue untuk setiap
  lapangan dan export memakai satu dialog pemilihan dataset/format.
- Admin notification configuration dan presenter/list B2 lulus.
- Tidak ada overflow, critical clipping, console error/warning, atau API `5xx`.

Evidence delta: `evidence/2026-08-30-b2-ui-refresh-local/`.

Database development juga telah dimigrasikan forward-only melalui migration `0004`
sampai `0007`. API live/ready dan query OutboxPublisher berhasil tanpa reset database.

## Remediasi finance dan idempotency terbaru 31 Agustus 2026

Tujuh putaran review terarah menutup seluruh finding aktif pada lifecycle refund,
earning, payout, reschedule, authorization, tenant isolation, dan mutation idempotency.
Migration `0008` diterapkan forward-only pada database development tanpa reset data.

- Ledger refund dibalik menurut semantic account lifecycle, termasuk partial refund,
  refund sebelum completion, reschedule beda harga, dan koreksi posting legacy.
- Earning dan payout menjaga state, lock order, cancellation, retry, audit, outbox, serta
  rekonsiliasi legacy yang idempotent.
- Refund, reschedule, promotion, commission, payout status, dan cancellation menolak
  false replay ketika payload atau reason berubah; create concurrent tidak menjadi 500.
- Boundary `team.manage`, export promo, review Staff, tenant, dan venue assignment
  diterapkan server-side dengan regression negatif.

Full `npm run qa:b2:local` lulus setelah remediasi: integration 65/65, security 29/29,
seluruh unit/contract/migration/concurrency/E2E/documentation lulus, serta audit tetap
tanpa High/Critical. Re-review terakhir tidak menemukan P1/P2 aktif.

Evidence root cause, fix, dan regression per finding:
`evidence/2026-08-31-b2-ponytail-review/findings.md`.

## Temuan dan remediasi selama QA

1. Respons sukses `201` tanpa body diparse sebagai JSON oleh API client. Command sudah
   tersimpan, tetapi UI menampilkan state seolah gagal. Client kini menerima semua 2xx
   kosong dan mempunyai regression test.
2. Dialog create/reply tidak ditutup/reset setelah sukses. Dialog kini controlled dan
   hanya ditutup setelah command server berhasil.
3. Eligibility review tidak server-backed. `CustomerBookingSummary.reviewId` kini
   membuat CTA hilang secara konsisten setelah review tersimpan.
4. Payout terminal masih menawarkan tombol proses. CTA kini hanya tersedia pada
   `SCHEDULED` dan `PROCESSING`.
5. Ledger generik menampilkan ID opaque dan Rp0. Presenter sekarang memprioritaskan
   deskripsi domain serta total debit transaksi.

Tidak ada finding Blocker/Critical/High dari QA yang masih terbuka. Finding Medium
dependency `B2-DEP-LOCAL-001` diterima Project Owner sebagai `Accepted Risk` untuk Phase
B2 lokal pada 30 Agustus 2026.

## QA staging 30 Agustus 2026

Staging memakai source commit `d93a9f03175b53d27f0a5847d83513a679794cef` pada
deployment web `dpl_JnR5gZNF5XLm1QMzoxRsBKzWwpX3` dan API
`dpl_GUR3MuQgrR1oz7L9J3cMLPb7Fgqu`. Migration B2 dan bootstrap default dijalankan
forward-only tanpa reset data B1. Live/readiness sehat dan runtime log menunjukkan nol
API/web `5xx` pada rentang QA.

External Chrome menghasilkan matriks **24/24 pass**. Empat submission server-backed
lulus: tiket Customer, review Customer, promo sandbox Owner, dan balasan Owner. Uji
preference email reminder gagal persisten setelah refetch/reload dan dicatat sebagai
`B2-NOT-STG-001` Medium/Open. Karena finding Medium belum diremediasi atau diterima
Project Owner, staging technical gate belum selesai.

Evidence: `evidence/2026-08-30-b2-staging-readiness/`.

## Baseline targeted staging retest 31 Agustus 2026

Remediasi promotion funding, tenant/venue isolation, tenant-scoped idempotency, serta
notification preference telah lulus full `qa:b2:local`. Source commit
`b74ab1390f3debb5ac2cc4a63c1949b680432c41` dideploy ke API
`dpl_Gy4M9phJynEiPSpY7aNX22oET3hQ` (`sin1`) dan web
`dpl_BmEcQsRF6s9qzLNBENfMzSqMdqvb`.

- Forged business promo `PLATFORM` ditolak `422`; promo Owner valid mendapat `201`.
- Staff demo hanya mempunyai satu assignment dan tidak mempunyai
  `promotions.manage`; API serta direct UI promo ditolak `403`, tanpa disclosure data.
- Preference email reminder menghasilkan PUT `204`, GET boolean `false`, dan tetap
  nonaktif setelah dialog dibuka ulang serta reload. State demo dikembalikan ke awal.
- Console Customer/Owner/Staff bersih; runtime API tidak mempunyai `5xx` atau error log.
- Visual delta 12/12 lulus pada `360x800` dan `1440x900`, light/dark.

Lima finding remediation berstatus Closed, termasuk `B2-NOT-STG-001`. Tidak ada
Blocker/Critical/High/Medium baru pada source tersebut.

Evidence: `evidence/2026-08-31-b2-p1-p2-staging-retest/`.

Baseline ini tetap valid sebagai bukti integration boundary, tetapi belum membuktikan
remediasi finance/idempotency terbaru pada working source. Status staging source terbaru
baru boleh kembali menjadi technical gate complete setelah commit yang lulus local gate
dideploy ke API dan web, lalu targeted retest tersimpan sebagai evidence baru.

## Remediasi finance/idempotency — targeted staging retest 31 Agustus 2026

Source remediation finance `9ed32bb...` menjalankan migration `0008` forward-only.
Setelah follow-up SSE, source final `d4e8bef35172d69b1b50dd34d64b6282e10e74e8`
dideploy ke API `dpl_7aMdfQLfV2DXfrakEuRxJoZSvHgD` (`sin1`) dan web
`dpl_DkqVPw5PhKhE7tfgupKmcZhC8S5j`.

- API live/ready, web, dan same-origin readiness merespons `200`.
- Staff forbidden dan Admin read smoke Playwright lulus 2/2.
- Finance summary, ledger, dan payout list Owner merespons `200`.
- Create promotion merespons `201`; replay identik mengembalikan resource sama;
  perubahan payload dengan key sama ditolak `409`.
- Halaman finance Owner tidak menghasilkan console error pada smoke terakhir.
- Query HTTP `500` bersih, tetapi follow-up runtime log menemukan 14 timeout SSE
  `/api/v1/events` pada batas Vercel 300 detik.

Follow-up runtime log sempat membuka P2 `B2-RT-STG-002`: stream SSE tidak memiliki
planned lifetime dan diputus Vercel pada 300 detik. Stream sekarang ditutup terencana
pada 240 detik agar `EventSource` reconnect otomatis. Regression dan full
`qa:b2:local` lulus; staging connection test 250 detik juga lulus tanpa page/session
error. Deployment final tidak mempunyai error log atau HTTP `500`, dan Staff/Admin smoke
sesudah redeploy lulus 2/2. Finding ditutup. Visual matrix tidak diulang karena delta
hanya backend/database.

Tidak ada P1/P2 aktif dan tidak ada finding Blocker/Critical/High/Medium baru. Project
Owner memberikan keputusan final `Diterima` pada 31 Agustus 2026; Phase B2 staging
berstatus accepted. Implementer hanya mencatat keputusan tersebut.

Evidence: `evidence/2026-08-31-b2-finance-idempotency-staging-retest/`.
