# Phase B2 Ponytail Review Findings

- Tanggal review: 31 Agustus 2026
- Metode: trace source of truth, caller, authorization boundary, finance posting, dan
  regression coverage
- Status gate: **remediation local complete; targeted staging retest pending**
- Scope: remediation source lokal; belum ada redeploy atau targeted staging retest

Temuan berikut ditemukan setelah targeted staging retest sebelumnya selesai. Evidence
staging lama tetap historis dan tidak diubah. Seluruh temuan telah ditutup pada source
lokal setelah regression test dan full local gate lulus. Status staging tetap terbuka
sampai redeploy dan targeted staging retest yang relevan lulus.

| ID                   | Priority | Area                    | Status       |
| -------------------- | -------- | ----------------------- | ------------ |
| B2-REV-FIN-001       | P1       | Ledger refund reversal  | Closed-local |
| B2-REV-REF-IDEM-002  | P1       | Refund idempotency      | Closed-local |
| B2-REV-EXP-TEN-003   | P1       | Promotion export scope  | Closed-local |
| B2-REV-TEAM-AUTH-004 | P1       | Team authorization      | Closed-local |
| B2-REV-RSCH-IDEM-005 | P2       | Reschedule idempotency  | Closed-local |
| B2-REV-REV-SCOPE-006 | P2       | Review venue assignment | Closed-local |

## B2-REV-FIN-001 — P1 — Refund tidak membalik akun ledger yang diakui

`FinanceService.recordRefund()` selalu mencatat debit `REFUND_EXPENSE` dan kredit
`SANDBOX_CASH`. Posting tersebut tidak membalik `CUSTOMER_FUNDS_HELD` untuk refund
sebelum completion, serta tidak membalik `OWNER_PAYABLE` dan
`PLATFORM_COMMISSION_REVENUE` setelah completion. `ownerEarnings` direversal melalui
state/adjustment terpisah, tetapi semantic account ledger dan agregasi commission/net
owner tetap berasal dari snapshot penuh.

- Requirement terkait: `B2-COM-006`, `B2-REF-006`, `B2-FIN-002`, `AC-011`.
- Source: `backend/src/finance/FinanceService.ts` pada `markBookingCompleted()`,
  `recordRefund()`, dan `financeSummary()`.
- Risiko: ledger tetap balanced secara matematis tetapi tidak menjelaskan liability,
  commission reversal, dan owner entitlement setelah refund.
- Regression wajib: full dan partial refund sebelum/sesudah completion memeriksa saldo
  setiap account code, commission, earning, dan finance summary.
- Remediasi: refund sekarang memposting delta kumulatif terhadap account lifecycle yang
  sudah diakui. Sebelum completion, liability `CUSTOMER_FUNDS_HELD` dibalik. Setelah
  completion, `OWNER_PAYABLE`, `PLATFORM_COMMISSION_REVENUE`, promo platform, dan fee
  yang tidak kembali dibalik pada account semantiknya. Finance summary membaca net
  commission ledger dan earning yang tidak reversed.
- Verifikasi: `b2ActiveFindings.test.ts` mencakup partial/full refund sebelum dan sesudah
  completion serta memastikan setiap jurnal tetap balanced.

## B2-REV-REF-IDEM-002 — P1 — Refund idempotency dapat melintasi tenant

`RefundService.requestRefund()` mencari replay hanya berdasarkan raw `idempotencyKey`,
sementara schema memakai unique index global pada kolom tersebut. Request tenant kedua
dengan key yang sudah dipakai tenant pertama dapat menerima ID refund tenant pertama,
mencatat audit yang menunjuk resource lintas tenant, dan tidak membuat refund untuk
booking yang diminta.

- Requirement terkait: tenant isolation, idempotency refund, `AC-008`, `NFR-006`.
- Source: `backend/src/payment/application/RefundService.ts` dan
  `backend/src/database/schema/payment.ts`.
- Risiko: cross-tenant resource reference, audit corruption, dan command palsu berhasil.
- Regression wajib: raw key sama pada dua tenant/booking menghasilkan resource terpisah;
  retry tenant dan booking yang sama mengembalikan resource semula.
- Remediasi: key refund disimpan sebagai hash deterministik dari tenant dan raw key.
  Replay hanya diterima untuk booking yang sama; penggunaan ulang key untuk booking lain
  dalam tenant yang sama menghasilkan `409`. Lookup legacy tetap dibatasi tenant.
- Verifikasi: retry booking yang sama menghasilkan ID sama; raw key yang sama pada dua
  tenant menghasilkan dua refund berbeda tanpa referensi silang, sedangkan reuse pada
  booking lain dalam tenant yang sama ditolak.

## B2-REV-EXP-TEN-003 — P1 — Export promosi Staff melewati venue assignment

`financeRouter` meneruskan `assignedVenueIds` ke `FinanceService.exportFinance()`, tetapi
cabang dataset `promotions` di `exportRows()` memanggil `listPromotions()` tanpa argumen
venue. Staff dengan `exports.run` dapat mengekspor promo yang hanya berlaku pada venue
lain dalam tenant yang sama.

- Requirement terkait: `B2-PERM-003`, `B2-FIN-009`, `AC-007`.
- Source: `backend/src/finance/financeRouter.ts` dan
  `backend/src/finance/FinanceService.ts`.
- Risiko: data venue di luar assignment bocor melalui jalur export.
- Regression wajib: export promo Staff assigned, unassigned, dan venue lain; Owner tetap
  memperoleh seluruh promo tenant yang diizinkan.
- Remediasi: `exportRows()` meneruskan `venueIds` ke `listPromotions()` sehingga jalur
  export memakai filter yang sama dengan list bisnis.
- Verifikasi: CSV Staff memuat promo assigned dan tidak memuat promo venue lain; Staff
  tanpa assignment tidak menerima promo.

## B2-REV-TEAM-AUTH-004 — P1 — Daftar anggota melewati permission team.manage

`GET /business/tenants/:tenantId/members` hanya memakai `requireTenantAccess()`. Response
`TenantService.listMembers()` berisi nama, email, role, status, venue assignments, custom
role, dan seluruh permission. Staff tanpa `team.manage` dapat membaca data tersebut
melalui direct API walaupun menu frontend disembunyikan.

- Requirement terkait: `B2-PERM-002`, `B2-PERM-003`, `AC-007`.
- Source: `backend/src/tenant/http/tenantRouter.ts` dan
  `backend/src/tenant/application/TenantService.ts`.
- Risiko: granular permission bypass dan disclosure data anggota tenant.
- Regression wajib: Staff tanpa `team.manage` mendapat `403`; Staff dengan permission dan
  Owner memperoleh response sesuai policy; tenant lain tetap ditolak.
- Remediasi: route GET member memakai `requirePermission(..., "team.manage")` sebelum
  memanggil service.
- Verifikasi: direct API tanpa permission menghasilkan `403` dan tidak memanggil
  `listMembers`; request berizin tetap menghasilkan `200`.

## B2-REV-RSCH-IDEM-005 — P2 — Reschedule idempotency tidak atomik

Customer mengecek `commandIdempotency` sebelum transaksi. Core `reschedule()` tidak
memeriksa replay sebelum lifecycle guard dan baru menyimpan command pada akhir transaksi.
Business retry karena itu menghasilkan `RESCHEDULE_LIMIT_REACHED`, sedangkan concurrent
customer retry dapat berakhir sebagai unique constraint error. Scope actor + key juga
tidak membedakan booking atau tenant.

- Requirement terkait: idempotency critical command, `B2-REF-007`, `AC-012`.
- Source: `backend/src/booking/application/OperationsService.ts` dan
  `backend/src/booking/http/operationsRouter.ts`.
- Risiko: retry tidak deterministik, false success/no-op pada resource lain, atau `500`.
- Regression wajib: sequential/concurrent replay Customer dan Business serta key sama
  pada booking berbeda.
- Remediasi: scope command mencakup booking ID dan replay diperiksa di dalam transaksi
  setelah booking row lock, sebelum lifecycle guard. Record legacy hanya direplay bila
  `resourceId` sama.
- Verifikasi: dua request concurrent dan retry business hanya membuat satu reschedule;
  key yang sama pada booking berbeda tetap menghasilkan command terpisah.

## B2-REV-REV-SCOPE-006 — P2 — Review Staff tanpa assignment membentuk IN kosong

`ReviewService.listBusiness()` membangun SQL `IN (...)` secara manual untuk
`assignedVenueIds`. Untuk Staff dengan `reviews.manage` tetapi tanpa assignment, array
kosong menghasilkan `IN ()`, bukan `items: []`.

- Requirement terkait: `B2-PERM-003`, `AC-007`, error boundary konsisten.
- Source: `backend/src/review/ReviewService.ts` dan
  `backend/src/review/reviewRouter.ts`.
- Risiko: SQL error dan API `500` untuk Staff tanpa venue assignment.
- Regression wajib: Staff tanpa assignment menerima list kosong; assigned Staff hanya
  menerima review venue yang diizinkan.
- Remediasi: array assignment kosong langsung menghasilkan `[]`; assignment berisi venue
  memakai `inArray()` Drizzle, bukan SQL manual.
- Verifikasi: service mengembalikan list kosong tanpa query SQL invalid atau HTTP `500`.

## Targeted Re-review — Payout, Refund Command, Team Scope, dan Legacy Ledger

Permintaan remediasi lanjutan menyebut “enam finding”, tetapi daftar eksplisitnya berisi
lima finding. Lima finding yang disebut tersebut menjadi scope implementasi. Regression
reschedule concurrent/retry dari review sebelumnya tetap dijalankan sebagai guard, bukan
dianggap finding keenam baru.

| ID                      | Priority | Area                         | Status       |
| ----------------------- | -------- | ---------------------------- | ------------ |
| B2-REREV-PAYOUT-001     | P1       | Full refund / payout reserve | Closed-local |
| B2-REREV-REF-CMD-002    | P1       | Refund decision/retry        | Closed-local |
| B2-REREV-TEAM-SCOPE-003 | P1       | Team venue assignment        | Closed-local |
| B2-REREV-LEDGER-004     | P1       | Legacy refund ledger         | Closed-local |
| B2-REREV-REF-RACE-005   | P2       | Concurrent refund request    | Closed-local |

### B2-REREV-PAYOUT-001 — Full refund melewati payout reserved

- Root cause: full refund menandai earning `REVERSED` sebelum memproses state
  `RESERVED_FOR_PAYOUT`, sehingga cabang pembatalan payout tidak pernah dapat mengenali
  earning reserved.
- Remediasi: payout `SCHEDULED` dibatalkan lebih dahulu dan seluruh earning batch
  dikembalikan ke `AVAILABLE`; setelah itu full reversal diterapkan. Payout `PROCESSING`
  tidak dibatalkan secara tidak aman dan menerima negative adjustment sesuai lifecycle.
- Regression: full refund atas earning dalam payout `SCHEDULED` membatalkan batch dan
  mereversal earning; upaya membatalkan payout `PROCESSING` tetap ditolak.

### B2-REREV-REF-CMD-002 — Decision/retry false-replay lintas resource

- Root cause: scope command hanya `refund.decision` atau `refund.retry`; kombinasi actor
  dan raw key yang sama dapat mereplay command milik refund lain.
- Remediasi: scope mencakup refund ID, row refund dikunci sebelum replay/lifecycle check,
  dan record legacy hanya direplay bila `resourceId` sama.
- Regression: key sama dapat dipakai independen pada refund berbeda dan tenant berbeda,
  sedangkan retry resource yang sama tidak menggandakan command atau attempt.

### B2-REREV-TEAM-SCOPE-003 — `team.manage` melewati venue assignment

- Root cause: permission `team.manage` sudah diperiksa, tetapi hasil authorization
  `assignedVenueIds` tidak diteruskan ke read model anggota.
- Remediasi: route meneruskan assignment khusus Staff; service hanya mengembalikan
  membership yang mempunyai minimal satu assignment pada venue yang diizinkan. Staff
  tanpa assignment menerima `items: []`, dan ID assignment dalam payload juga dibatasi
  ke venue yang diizinkan; Owner tetap menerima seluruh tenant.
- Regression: direct API tanpa permission tetap `403`; Staff berizin hanya melihat
  anggota venue assigned, anggota venue lain tidak terlihat, dan assignment kosong
  menghasilkan list kosong.

### B2-REREV-LEDGER-004 — Ledger refund lama tidak terkoreksi saat redeploy

- Root cause: perbaikan posting baru tidak mengubah jurnal refund legacy yang immutable,
  sehingga redeploy saja meninggalkan agregasi akun lama yang salah.
- Remediasi: maintenance existing menjalankan rekonsiliasi forward-only yang mendeteksi
  booking dengan posting `REFUND_SUCCEEDED` legacy, menghitung delta dari source of truth
  refund/snapshot, lalu menambah jurnal immutable `REFUND_RECONCILIATION`. Tidak ada
  update/delete jurnal lama, migration, atau endpoint baru.
- Regression: fixture ledger legacy dikoreksi tepat satu kali, tetap balanced, semantic
  account kembali sesuai lifecycle, dan run kedua idempotent (`0` koreksi).

### B2-REREV-REF-RACE-005 — Concurrent reuse key refund dapat menjadi `500`

- Root cause: dua request dapat sama-sama melewati lookup awal; loser pada unique index
  menerima `ER_DUP_ENTRY` mentah, sementara reuse key pada booking lain juga tidak
  menghasilkan domain response deterministik.
- Remediasi: duplicate insert ditangkap di transaction lalu resource scoped di-lock dan
  dibaca ulang. Booking sama mereplay ID yang sama; booking lain menghasilkan `409
IDEMPOTENCY_KEY_REUSED`.
- Regression: concurrent request booking sama keduanya sukses dengan satu ID; concurrent
  reuse pada dua booking menghasilkan satu sukses dan satu `409`, tanpa `500`.

## Second Targeted Re-review — Payout Rebatch dan Rekonsiliasi Refund

Permintaan menyebut “enam finding”, tetapi daftar scope eksplisit berisi lima finding.
Kelima finding tersebut diremediasi dan divalidasi. Regression authorization/tenant
isolation serta concurrent reschedule tetap dijalankan sebagai guard, bukan dihitung
sebagai finding keenam baru.

| ID                            | Priority | Area                               | Status       |
| ----------------------------- | -------- | ---------------------------------- | ------------ |
| B2-REREV2-PAYOUT-REBATCH-001  | P1       | Cancelled payout earning lifecycle | Closed-local |
| B2-REREV2-REFUND-ROUNDING-002 | P1       | Partial refund accounting          | Closed-local |
| B2-REREV2-LEGACY-EARNING-003  | P1       | Legacy earning reconciliation      | Closed-local |
| B2-REREV2-DEPLOY-RECON-004    | P2       | Deployment reconciliation          | Closed-local |
| B2-REREV2-PAYOUT-EVENTS-005   | P2       | Automatic payout audit/outbox      | Closed-local |

### B2-REREV2-PAYOUT-REBATCH-001 — Cancelled earning tidak dapat masuk payout baru

- Root cause: `payout_items` mempunyai unique index global pada `earning_id`. Saat payout
  dibatalkan, earning sudah kembali `AVAILABLE`, tetapi item historis yang immutable
  tetap memblokir insert ke batch pengganti.
- Remediasi: index menjadi unik per pasangan earning dan batch. Migration menambahkan
  constraint baru sebelum index lama dihapus agar foreign key MySQL tetap valid. Earning
  payout `FAILED` lama dibackfill ke `RESERVED_FOR_PAYOUT`, dan runtime hanya melepas
  earning pada status `CANCELLED`; retry payout gagal tetap memakai batch semula.
- Regression: full refund membatalkan batch, earning booking lain kembali tersedia, dan
  item historis yang sama berhasil dimasukkan ke batch pengganti. Migration database
  kosong serta aturan backfill/index juga diverifikasi.

### B2-REREV2-REFUND-ROUNDING-002 — Partial refund berbeda dari owner earning

- Root cause: ledger menghitung setiap komponen refund secara proporsional lalu
  membulatkan ke bawah, sedangkan owner earning memakai rasio `ownerNet` terpisah dengan
  pembulatan berbeda. Selisih satu rupiah dapat muncul pada refund parsial/bertahap.
- Remediasi: satu perhitungan semantic refund menjadi source of truth untuk ledger dan
  cumulative owner reversal. Adjustment earning hanya mencatat delta dari reversal yang
  sudah pernah diposting.
- Regression: partial refund memeriksa jurnal balanced dan memastikan perubahan
  `netOwnerRevenue` tepat sama dengan debit semantic `OWNER_PAYABLE`; full refund
  bertahap tetap berakhir pada nilai snapshot yang benar.

### B2-REREV2-LEGACY-EARNING-003 — Rekonsiliasi legacy hanya memperbaiki ledger

- Root cause: rekonsiliasi lama berhenti setelah menemukan
  `REFUND_RECONCILIATION`. Booking yang ledger-nya sudah dikoreksi pada deployment
  sebelumnya tidak dikunjungi lagi walaupun kumpulan `owner_earnings` masih selisih.
- Remediasi: setiap booking dengan refund diperiksa berurutan memakai cursor untuk kedua
  source of truth. Koreksi earning dibuat sebagai adjustment immutable
  `refund-reconciliation:{bookingId}`; run berikutnya menghitung delta nol tanpa mengubah
  jurnal atau earning lama, sedangkan refund baru pada rolling deployment tetap ikut
  diperiksa.
- Regression: fixture memulai dari ledger yang sudah semantik benar tetapi earning masih
  selisih satu rupiah. Rekonsiliasi menambah hanya koreksi earning, tidak membuat jurnal
  kedua, dan run berikutnya memproses nol booking.

### B2-REREV2-DEPLOY-RECON-004 — Rekonsiliasi tidak berjalan saat redeploy

- Root cause: rekonsiliasi hanya dipanggil maintenance harian; entry point migration
  deployment selesai tanpa menjalankan perbaikan data legacy.
- Remediasi: runner migration existing menjalankan rekonsiliasi berulang dalam batch
  setelah semua migration schema sukses. Tidak dibuat scheduler, command, atau service
  baru; kegagalan rekonsiliasi menggagalkan deployment secara fail-safe.
- Regression: migration test memastikan runner deployment memanggil rekonsiliasi dan
  migration `0008` dapat dijalankan nyata pada database kosong melalui seluruh database
  preparation di integration, security, concurrency, dan E2E.

### B2-REREV2-PAYOUT-EVENTS-005 — Refund cancellation melewati audit dan outbox

- Root cause: jalur refund mengubah payout `SCHEDULED` langsung ke `CANCELLED`, sedangkan
  audit dan event hanya berada pada command `updatePayoutStatus()`.
- Remediasi: satu helper internal yang sama mencatat `payout.status_changed` ke audit dan
  transactional outbox, baik untuk command manual maupun cancellation otomatis di dalam
  transaksi refund.
- Regression: full refund atas payout reserved membuktikan status `CANCELLED`, audit
  before/after, dan outbox event tersedia dalam tenant/resource yang sama.

## Third Targeted Re-review — Active Payout dan Versioned Refund Reconciliation

Enam finding eksplisit pada re-review ketiga telah diremediasi tanpa perubahan API,
dependency, infrastructure, atau layer baru.

| ID                             | Priority | Area                                  | Status       |
| ------------------------------ | -------- | ------------------------------------- | ------------ |
| B2-REREV3-PAYOUT-ACTIVE-001    | P1       | Active payout selection               | Closed-local |
| B2-REREV3-PAYOUT-FAILED-002    | P1       | Failed payout refund lifecycle        | Closed-local |
| B2-REREV3-RECON-VERSION-003    | P1       | Repeat reconciliation                 | Closed-local |
| B2-REREV3-RECON-EARNING-004    | P1       | Reconciled earning lifecycle          | Closed-local |
| B2-REREV3-REFUND-AUDIT-005     | P2       | Partial refund audit semantics        | Closed-local |
| B2-REREV3-MAINTENANCE-SCAN-006 | P2       | Legacy reconciliation execution scope | Closed-local |

### B2-REREV3-PAYOUT-ACTIVE-001 — Refund memilih payout historis cancelled

- Root cause: lookup payout berdasarkan `earningId` memakai `limit(1)` tanpa status
  batch. Setelah earning dibatch ulang, item historis `CANCELLED` dapat terpilih sebelum
  batch pengganti yang masih aktif.
- Remediasi: lookup hanya mempertimbangkan batch aktif `SCHEDULED`, `PROCESSING`, atau
  `FAILED`, lalu memilih batch aktif terbaru di dalam transaksi refund.
- Regression: earning dimasukkan ke payout pengganti setelah batch pertama dibatalkan;
  refund berikutnya membatalkan batch pengganti dan mereversal earning, bukan memakai
  item historis.

### B2-REREV3-PAYOUT-FAILED-002 — Refund membiarkan payout FAILED retryable

- Root cause: cancellation otomatis hanya menangani `SCHEDULED`; batch `FAILED` tetap
  menyimpan earning reserved dan masih dapat ditransisikan ke `PROCESSING` walaupun
  refund sudah mengurangi hak owner.
- Remediasi: refund membatalkan `FAILED` dengan lifecycle yang sama aman seperti
  `SCHEDULED`, mengembalikan seluruh earning batch ke `AVAILABLE`, lalu menerapkan
  reversal/adjustment refund. Batch `CANCELLED` tidak dapat di-retry.
- Regression: partial refund pada payout `FAILED` menghasilkan batch `CANCELLED`; upaya
  transisi kembali ke `PROCESSING` ditolak.

### B2-REREV3-RECON-VERSION-003 — Rekonsiliasi kedua tidak dapat diposting

- Root cause: ledger dan owner earning memakai key tetap per booking. Setelah koreksi
  pertama, cumulative refund baru masih mereplay resource lama atau melempar mismatch.
- Remediasi: cumulative refund menjadi versi immutable pada ledger idempotency key dan
  source earning. Row lock owner earning tetap menjadi guard atomic; run ulang pada
  cumulative refund yang sama menghitung delta nol.
- Regression: refund legacy 30.000 direkonsiliasi, kemudian cumulative refund 60.000
  direkonsiliasi lagi menjadi dua posting versioned; run ketiga tidak menambah posting.

### B2-REREV3-RECON-EARNING-004 — Earning rekonsiliasi tidak ikut refund berikutnya

- Root cause: query adjustment refund hanya mengenali prefix `refund:` sedangkan source
  rekonsiliasi legacy memakai `refund-reconciliation:`. Adjustment satu rupiah dapat
  tertinggal setelah refund penuh berikutnya.
- Remediasi: satu predicate source refund mengenali format baru versioned dan format
  legacy. Perhitungan prior reversal serta full reversal memakai predicate yang sama.
- Regression: earning koreksi +1 dari partial legacy reconciliation ikut berubah menjadi
  `REVERSED` pada refund penuh berikutnya dan aggregate owner earning berakhir nol.

### B2-REREV3-REFUND-AUDIT-005 — Partial refund ditulis sebagai full refund

- Root cause: reason audit cancellation payout di-hardcode `Full refund` walaupun jalur
  tersebut juga dijalankan oleh partial refund.
- Remediasi: reason mencatat nominal dan booking secara netral tanpa mengklasifikasikan
  partial sebagai full.
- Regression: audit partial refund Rp30.000 menyimpan alasan nominal yang tepat dan tidak
  mengandung teks `Full refund`.

### B2-REREV3-MAINTENANCE-SCAN-006 — Semua refund dipindai tiap maintenance

- Root cause: rekonsiliasi forward-only sudah dijalankan migration runner saat deploy,
  tetapi juga dipanggil setiap maintenance. Akibatnya seluruh booking refund dipindai
  berulang dan berpotensi melampaui TTL lock maintenance.
- Remediasi: rekonsiliasi tetap fail-safe pada migration runner dan dihapus dari hot path
  maintenance. Tidak dibuat scheduler, marker table, atau infrastructure baru.
- Regression: migration test memastikan deploy runner tetap memanggil rekonsiliasi dan
  `MaintenanceJobs` tidak lagi memanggil full scan tersebut.

## Fourth Targeted Re-review — Pre-completion Refund, Rolling Deploy, dan Finance Aggregation

Permintaan menyebut “keenam finding” pada langkah verifikasi, tetapi scope eksplisit
berisi empat finding. Keempat finding tersebut diremediasi dan divalidasi. Regression
tenant isolation, unauthorized access, serta concurrent/retry reschedule yang sudah ada
tetap dijalankan sebagai guard dan tidak dihitung sebagai finding tambahan.

| ID                             | Priority | Area                              | Status       |
| ------------------------------ | -------- | --------------------------------- | ------------ |
| B2-REREV4-PRECOMP-REFUND-001   | P1       | Refund sebelum completion         | Closed-local |
| B2-REREV4-ROLLING-RECON-002    | P1       | Rolling deployment reconciliation | Closed-local |
| B2-REREV4-FINANCE-LOCK-003     | P2       | Refund/payout lock ordering       | Closed-local |
| B2-REREV4-COMPARISON-TOTAL-004 | P2       | Venue/court payment comparison    | Closed-local |

### B2-REREV4-PRECOMP-REFUND-001 — Completion merusak refund yang sudah diposting

- Root cause: refund yang terjadi sebelum `BOOKING_COMPLETED` hanya mempunyai posting
  `REFUND_SUCCEEDED`. Saat completion kemudian mem-posting gross/commission/owner net,
  tidak ada semantic delta yang mengoreksi lifecycle refund tersebut. Selain itu,
  `availableAt` hanya diperbarui pada earning dasar sehingga adjustment refund yang
  masih `PENDING` tidak pernah dapat dirilis.
- Remediasi: completion memanggil kalkulasi semantic refund existing setelah posting
  completion dan menambah jurnal immutable `REFUND_RECONCILIATION` versioned berdasarkan
  cumulative refund. Semua earning booking berstatus `PENDING` memperoleh `availableAt`;
  earning full refund yang sudah `REVERSED` tidak dihidupkan kembali.
- Regression: partial refund sebelum completion berakhir pada saldo semantic yang tepat,
  balanced, dan seluruh adjustment pending memiliki buffer. Full refund sebelum
  completion tetap menghasilkan aggregate earning nol sesudah completion.

### B2-REREV4-ROLLING-RECON-002 — Refund legacy dapat lolos saat rolling deployment

- Root cause: full reconciliation hanya berjalan satu kali di migration runner. Instance
  versi lama yang masih aktif dapat menulis refund legacy setelah runner selesai,
  sementara full scan maintenance memang sudah dihapus untuk menghindari pemindaian
  seluruh histori setiap hari.
- Remediasi: maintenance existing menjalankan reconciliation bounded untuk jurnal refund
  yang dibuat dalam jendela 48 jam. Migration runner tetap melakukan full scan saat
  deploy; tidak ada scheduler, table marker, migration, atau infrastructure baru.
- Regression: fixture refund terbaru di dalam jendela direkonsiliasi, sedangkan fixture
  histori di luar jendela tidak ikut dipindai. Migration test memastikan full deploy
  reconciliation dan bounded rolling reconciliation sama-sama tetap terpasang.

### B2-REREV4-FINANCE-LOCK-003 — Lock order refund dan payout terbalik

- Root cause: refund mengunci payment summary/earning sebelum payout batch, sedangkan
  transition payout mengunci batch sebelum earning. Eksekusi bersamaan dapat membentuk
  siklus lock dan deadlock.
- Remediasi: refund, pembuatan payout, dan transition payout mengambil row lock tenant
  yang sama terlebih dahulu. Serialisasi hanya berlaku untuk mutation finance dalam
  tenant yang sama; tenant lain tetap independen dan urutan lock downstream menjadi
  deterministik.
- Regression: refund dan transition payout dijalankan concurrent. Refund selalu selesai;
  transition hanya boleh sukses atau ditolak sebagai domain conflict `409`, bukan
  deadlock/`500`. Regression tenant isolation dan unauthorized access tetap lulus.

### B2-REREV4-COMPARISON-TOTAL-004 — Venue/court menggandakan total pembayaran

- Root cause: query comparison mengembalikan satu row per booking item, tetapi
  `totalPaid` booking dijumlahkan pada setiap row. Booking multi-court menggandakan total
  venue dan memberikan nilai booking penuh kepada setiap court.
- Remediasi: row dikelompokkan per booking. Total venue ditambahkan sekali, sedangkan
  total court dialokasikan proporsional berdasarkan subtotal item; item terakhir
  menerima sisa pembulatan agar jumlah court selalu persis sama dengan total booking.
- Regression: booking Rp100.000 dengan dua court bersubtotal Rp40.000/Rp60.000 menambah
  venue tepat Rp100.000 dan court tepat Rp40.000/Rp60.000, tanpa duplikasi.

## Fifth Targeted Re-review — Concurrent Completion dan Refund Decision Replay

Tiga finding P1 dalam scope eksplisit telah diremediasi tanpa perubahan API, schema,
dependency, atau layer baru. Guard negative authorization/tenant isolation serta
concurrent/retry reschedule tetap dijalankan dalam full gate.

| ID                                 | Priority | Area                                   | Status       |
| ---------------------------------- | -------- | -------------------------------------- | ------------ |
| B2-REREV5-COMPLETION-RACE-001      | P1       | Completion/refund serialization        | Closed-local |
| B2-REREV5-REFUND-DECISION-IDEM-002 | P1       | Refund decision idempotency payload    | Closed-local |
| B2-REREV5-EXISTING-POSTING-003     | P1       | Existing refund posting reconciliation | Closed-local |

### B2-REREV5-COMPLETION-RACE-001 — Completion melewatkan refund concurrent

- Root cause: completion memutuskan menjalankan reconciliation dari `totalRefunded`
  yang dibaca tanpa lock. Refund yang commit setelah read tersebut dapat terlewat.
- Remediasi: completion selalu menjalankan kalkulasi delta refund setelah posting
  `BOOKING_COMPLETED`. Kalkulasi existing mengunci payment summary dan menghasilkan
  entry kosong saat memang tidak ada refund, sehingga tidak diperlukan branch atau
  service baru.
- Regression: dua transaksi overlap secara deterministik. Completion membentuk read view
  lama, refund lalu commit, dan completion tetap menghasilkan semantic ledger balanced
  dengan held balance nol.

### B2-REREV5-REFUND-DECISION-IDEM-002 — Decision dapat false-replay

- Root cause: replay decision hanya mencocokkan actor, key, dan refund ID. Payload
  `approved` tidak disimpan, sehingga keputusan berlawanan pada key yang sama mendapat
  respons sukses palsu.
- Remediasi: nilai `approved` disimpan pada `command_idempotency.response_body` existing.
  Retry payload sama tetap sukses; payload berlawanan ditolak `409
IDEMPOTENCY_KEY_REUSED`. Record legacy tanpa payload tetap replay-compatible.
- Regression: approve pertama dan retry approve memakai satu command, sedangkan reject
  dengan key sama ditolak dan refund tetap `PENDING/APPROVED`.

### B2-REREV5-EXISTING-POSTING-003 — Posting refund existing tidak direkonsiliasi

- Root cause: setelah menunggu payment-summary lock, query ledger refund sebelumnya
  masih consistent read dari snapshot transaksi lama. Posting refund yang baru commit
  tidak masuk existing balance dan dapat dihitung dua kali.
- Remediasi: query entry `REFUND_SUCCEEDED/REFUND_RECONCILIATION` menjadi locking current
  read. Delta selalu dihitung terhadap seluruh posting yang sudah commit tanpa mengubah
  jurnal immutable.
- Regression: posting refund commit setelah read view completion. Aggregate cash hanya
  berkurang sebesar refund sebenarnya, owner/commission reversal tepat, held balance
  nol, dan ledger balanced.

## Sixth Targeted Re-review — Idempotency Payload dan Development Migration

Empat finding replay dan satu blocker database development dari review keenam telah
diremediasi memakai `responseBody`, row domain, dan migration existing. Tidak ada schema,
dependency, endpoint, atau service baru.

| ID                                  | Priority | Area                         | Status       |
| ----------------------------------- | -------- | ---------------------------- | ------------ |
| B2-REREV6-PAYOUT-IDEM-001           | P1       | Payout status replay         | Closed-local |
| B2-REREV6-REFUND-CREATE-IDEM-002    | P1       | Refund create replay         | Closed-local |
| B2-REREV6-LEGACY-DECISION-IDEM-003  | P2       | Legacy refund decision       | Closed-local |
| B2-REREV6-RESCHEDULE-PAYLOAD-004    | P2       | Reschedule payload replay    | Closed-local |
| B2-REREV6-DEVELOPMENT-MIGRATION-005 | Blocker  | Development schema migration | Closed-local |

### B2-REREV6-PAYOUT-IDEM-001 — Status payout false-replay

- Root cause: command payout hanya menyimpan resource ID; key yang sama dengan target
  status berbeda dikembalikan sebagai sukses tanpa menjalankan transition.
- Remediasi: target status disimpan pada `command_idempotency.response_body` dan wajib
  sama saat replay. Command legacy tanpa payload gagal aman dengan `409` karena status
  asal tidak dapat diinfer dari batch yang mutable.
- Regression: `PROCESSING` dapat direplay dengan key yang sama, sedangkan `SUCCEEDED`
  dengan key tersebut ditolak dan batch tetap `PROCESSING`.

### B2-REREV6-REFUND-CREATE-IDEM-002 — Refund create menerima payload berbeda

- Root cause: replay hanya mencocokkan tenant, booking, dan key. Amount, kind, payment
  attempt, serta requester tidak dibandingkan; business replay juga menambah audit lagi.
- Remediasi: field finansial immutable pada refund existing wajib sama sebelum aggregate
  refund cap dihitung. Replay identik mengembalikan response create existing tanpa audit
  kedua; payload berbeda ditolak `409`.
- Regression: retry identik menghasilkan ID/status sama dan satu audit. Amount berbeda
  dengan key sama ditolak dan nilai refund tersimpan tidak berubah.

### B2-REREV6-LEGACY-DECISION-IDEM-003 — Decision legacy false-replay

- Root cause: command legacy tanpa `responseBody.approved` diterima untuk approve maupun
  reject.
- Remediasi: decision immutable pada row refund menjadi fallback untuk command legacy.
  Keputusan searah tetap idempotent dan keputusan berlawanan ditolak.
- Regression: legacy approve tanpa response body dapat direplay sebagai approve, tetapi
  reject dengan key yang sama menghasilkan `IDEMPOTENCY_KEY_REUSED`.

### B2-REREV6-RESCHEDULE-PAYLOAD-004 — Reschedule target berbeda false-replay

- Root cause: command reschedule hanya mencocokkan booking, actor, dan key tanpa target
  slot. Precheck customer juga berada di luar booking lock.
- Remediasi: target slot dinormalisasi dan disimpan pada response body. Perbandingan
  authoritative dilakukan setelah booking row lock; record reschedule menjadi fallback
  untuk command legacy. Precheck customer hanya mempercepat replay yang sudah commit.
- Regression: concurrent request dan retry slot sama tetap menghasilkan satu reschedule;
  slot berbeda dengan key sama ditolak, sedangkan key sama pada booking lain tetap valid.

### B2-REREV6-DEVELOPMENT-MIGRATION-005 — Database development tertinggal

- Root cause: database development masih memiliki unique index payout-item lama walau
  migration `0008` sudah tersedia.
- Remediasi: migration `0008` diterapkan forward-only tanpa reset development data.
- Regression: active-finding suite pada database development berubah dari kegagalan
  duplicate index menjadi 23/23 lulus; migration test dan database test hasil reset juga
  lulus.

## Seventh Targeted Re-review — Finance Lifecycle dan Mutation Idempotency

Enam finding aktif terakhir telah diremediasi dengan row lock, tabel idempotency, dan
service existing. Tidak ada endpoint, schema, dependency, atau abstraction baru.

| ID                                 | Priority | Area                                 | Status       |
| ---------------------------------- | -------- | ------------------------------------ | ------------ |
| B2-REREV7-RESCHEDULE-LEDGER-001    | P1       | Lower-price reschedule completion    | Closed-local |
| B2-REREV7-REFUND-CAP-002           | P1       | Aggregate refund reservation         | Closed-local |
| B2-REREV7-RECON-PAYOUT-003         | P1       | Legacy earning pada active payout    | Closed-local |
| B2-REREV7-CREATE-IDEM-004          | P2       | Promotion/commission create replay   | Closed-local |
| B2-REREV7-CANCELLATION-IDEM-005    | P2       | Customer cancellation retry          | Closed-local |
| B2-REREV7-MUTATION-FINGERPRINT-006 | P2       | Reason/decision mutation fingerprint | Closed-local |

### B2-REREV7-RESCHEDULE-LEDGER-001 — Completion lower-price reschedule salah semantic

- Root cause: refund selisih harga diperlakukan seperti refund pendapatan setelah
  completion. Completion juga mendebit gross pembayaran lama, bukan customer total dari
  snapshot current, sehingga owner/commission dapat direversal dua kali dan held funds
  tidak sesuai snapshot terbaru.
- Remediasi: refund `RESCHEDULE_DIFFERENCE` membalik held funds ke sandbox cash saja;
  completion memakai customer total snapshot current. Owner earning dasar disinkronkan
  ke snapshot baru saat reschedule difinalisasi.
- Regression: lower-price reschedule dilanjutkan sampai refund dan completion; ledger
  tetap balanced, refund tidak menyentuh owner/commission, dan earning sama dengan
  snapshot current.

### B2-REREV7-REFUND-CAP-002 — Refund PENDING dapat melebihi pembayaran

- Root cause: capacity check hanya membandingkan setiap request dengan
  `totalPaid-totalRefunded`; refund PENDING lain belum mengurangi kapasitas.
- Remediasi: payment summary dikunci dan seluruh refund PENDING dijumlahkan sebagai dana
  yang sudah dicadangkan, baik saat create approved maupun approve manual refund.
- Regression: request kedua yang membuat aggregate PENDING melampaui pembayaran ditolak.
  Late-payment webhook lebih dahulu mencatat pembayaran pada summary dan ledger sebelum
  membuat refund otomatis, sehingga source of truth dan cap tetap konsisten.

### B2-REREV7-RECON-PAYOUT-003 — Rekonsiliasi mengabaikan earning reserved

- Root cause: legacy earning correction dihitung saat earning masih berada pada payout
  `SCHEDULED/FAILED`, sehingga earning reserved dapat tetap terikat pada batch lama dan
  koreksi menghasilkan aggregate yang keliru.
- Remediasi: rekonsiliasi mengambil tenant finance lock, membatalkan batch cancelable
  yang memuat earning, melepaskan seluruh item, lalu membaca ulang earning sebelum
  menghitung koreksi. Audit dan outbox payout existing tetap digunakan.
- Regression: earning reserved pada payout scheduled dilepas, batch menjadi cancelled,
  dan nilai net earning setelah koreksi tepat.

### B2-REREV7-CREATE-IDEM-004 — Create promotion/commission false-replay dan race 500

- Root cause: command create hanya menyimpan resource ID; payload berbeda dapat
  false-replay. Dua request pertama dengan key sama juga dapat sama-sama melewati lookup
  lalu salah satunya gagal sebagai duplicate-key `500`.
- Remediasi: fingerprint payload normalized disimpan pada `responseBody`. Placeholder
  command diinsert sebelum resource di transaksi yang sama, sehingga unique command key
  menjadi serialization point. Duplicate membaca command canonical dan hanya replay bila
  fingerprint identik. Record legacy divalidasi terhadap resource persisted.
- Regression: retry identik mengembalikan ID sama, payload berbeda ditolak `409`, dan dua
  create concurrent tidak menghasilkan `500` atau resource ganda.

### B2-REREV7-CANCELLATION-IDEM-005 — Retry cancellation menjadi not-cancellable

- Root cause: status booking diperiksa sebelum command cancellation, sehingga retry
  request yang sudah sukses melihat booking `CANCELLED` dan gagal sebelum replay.
- Remediasi: booking dikunci lalu command resource-scoped diperiksa sebelum status guard.
  Hasil cancellation disimpan juga ketika refund nol dan replay memvalidasi reason.
- Regression: retry key/reason sama mengembalikan hasil yang sama; reason berbeda dengan
  key sama ditolak tanpa cancellation atau refund tambahan.

### B2-REREV7-MUTATION-FINGERPRINT-006 — Reason dan decision tidak ikut replay identity

- Root cause: beberapa mutation hanya membandingkan resource/key atau target utama;
  reason refund, keputusan manual, reason payout, serta reason reschedule dapat berubah
  tetapi tetap dianggap retry identik.
- Remediasi: response command menyimpan field mutation yang menentukan intent. Replay
  refund create/decision, payout status, dan reschedule wajib cocok; fallback legacy
  hanya diterima bila intent dapat dibuktikan dari row persisted, selain itu gagal aman
  dengan `409`.
- Regression: payload dan reason identik tetap idempotent; perubahan reason, decision,
  status, atau target slot dengan key sama ditolak.

### Follow-up review — Late payment tidak boleh mengakui owner earning

- Review akhir menemukan bahwa pembaruan source of truth late payment sempat memakai
  `recordPayment` penuh, yang juga membuat owner earning walaupun booking sudah
  `EXPIRED/CANCELLED`.
- `recordPayment` tetap mem-posting cash dan held funds, tetapi berhenti sebelum membuat
  earning untuk status terminal tersebut. Refund berikutnya mengembalikan held funds
  tanpa meninggalkan earning owner.
- Regression lifecycle memproses late payment sampai refund sukses, memastikan booking
  tetap expired, summary menjadi refunded, dan tidak ada owner earning.

### Follow-up review — Refund request reason harus immutable setelah decision

- Review akhir juga menemukan decision manual menambahkan reason keputusan ke
  `refund.reason`. Akibatnya retry create yang identik setelah decision salah dianggap
  payload berbeda.
- Reason request sekarang tetap immutable. Reason keputusan tetap tersimpan pada state
  transition, audit, dan command response existing.
- Regression menjalankan create → approve → retry create identik dan memastikan ID sama;
  perubahan reason create dengan key yang sama tetap ditolak `409`.

## Verification Gate

- Seluruh komponen `npm run qa:b2:local`: lulus. Satu sesi browser Playwright mobile
  tertutup saat invocation pertama; rerun test yang sama tanpa perubahan kode/test lulus.
- Unit: frontend 49, backend 56, API client 2 — lulus.
- Integration: 65 — lulus, termasuk 27 test active-finding regression terbaru.
- Security: 29 — lulus.
- Concurrency: 2 — lulus, ditambah concurrent reschedule regression pada integration.
- Contract: 1; migration: 4; E2E B1: 35 passed/9 existing skips; E2E B2: 4; docs: 4.
- Production audit: tidak ada High; dua advisory Moderate ExcelJS/uuid tetap mengikuti
  accepted risk Project Owner yang sudah tercatat dan wajib direview sebelum production.

## Disposition

- Tidak diperlukan dependency, infrastructure, schema domain, service layer, atau
  pemecahan `FinanceService` baru untuk melakukan remediation.
- Enam finding review awal, lima finding targeted re-review pertama, lima finding
  targeted re-review kedua, enam finding targeted re-review ketiga, dan empat finding
  targeted re-review keempat, tiga finding targeted re-review kelima, serta empat
  finding dan satu blocker review keenam, serta enam finding review ketujuh berstatus
  `Closed-local` berdasarkan regression test dan full local gate, bukan hanya code
  review.
- Project Owner sign-off sebelumnya tetap menjadi catatan historis. Technical gate perlu
  dievaluasi ulang setelah redeploy dan targeted staging retest; implementer tidak
  memberikan staging sign-off.
