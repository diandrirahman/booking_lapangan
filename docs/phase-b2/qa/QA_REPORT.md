# Phase B2 Local QA Report

- Tanggal: 30 Agustus 2026
- Runtime canonical: Node.js `v22.23.2`
- Environment: MySQL 8 E2E `3308`, Redis `6380/1`, API `3102`, web `4175`
- Scope: lokal terisolasi, regression B1 + fitur B2
- Status lokal: **local readiness accepted; 43/43 complete-local**
- Status staging: **technical gate belum selesai — 1 finding Medium terbuka**

## Hasil otomatis

| Gate                         | Hasil                                            |
| ---------------------------- | ------------------------------------------------ |
| Formatter                    | Lulus                                            |
| ESLint                       | Lulus                                            |
| TypeScript                   | Lulus                                            |
| Unit frontend/backend/client | 47 + 54 + 2 lulus                                |
| Integration                  | 34/34 lulus; targeted B2 11/11                   |
| Security                     | 23/23 lulus                                      |
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
