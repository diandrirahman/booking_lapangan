# Temuan QA Manual dan Security Lokal Phase B1

Temuan High ditutup pada pekerjaan remediasi terpisah. Bukti retest tersimpan di
[`../2026-08-29-b1-high-remediation-local/`](../2026-08-29-b1-high-remediation-local/README.md).

## B1-SEC-LOCAL-001 — Webhook Midtrans diblokir origin guard

- Severity: **High**
- Status: **Closed — 29 Agustus 2026**
- Area: Payment webhook / origin protection
- Endpoint: `POST /api/v1/payments/webhooks/midtrans`
- Expected: webhook tanpa browser `Origin` melewati origin guard lalu diverifikasi
  menggunakan signature provider.
- Actual:
  - mode test: signature invalid ditolak `401 INVALID_WEBHOOK_SIGNATURE`;
  - mode development: request yang sama ditolak lebih awal dengan
    `403 ORIGIN_NOT_ALLOWED`.
- Remediasi: origin exemption sekarang hanya berlaku pada route webhook aktual.
  Signature salah menghasilkan `401`, forged browser write tetap `403`, dan event valid
  duplikat hanya menghasilkan satu transition.

## B1-SEC-LOCAL-002 — Oversized JSON menghasilkan HTTP 500

- Severity: **Medium**
- Status: **Closed — 29 Agustus 2026**
- Area: API input boundary
- Endpoint uji: `POST /api/v1/auth/register`
- Expected: body di atas batas 1 MB ditolak sebagai client error, idealnya `413`.
- Actual: body ditolak tetapi error handler mengembalikan `500 INTERNAL_ERROR`.
- Dampak: klasifikasi error dan telemetry salah; request tidak melewati body limit dan
  rate limit tetap membatasi abuse.
- Remediasi: error `entity.too.large` kini menghasilkan `413 PAYLOAD_TOO_LARGE`, pesan
  aman, dan request ID sebelum router dijalankan. Bukti baru:
  [`../2026-08-29-b1-medium-remediation-local/`](../2026-08-29-b1-medium-remediation-local/README.md).

## B1-SEC-LOCAL-003 — Redis outage menjatuhkan seluruh API

- Severity: **High**
- Status: **Closed — 29 Agustus 2026**
- Area: Redis/SSE availability dan REST fallback
- Expected: Redis hanya untuk session, coordination, cache, dan pub/sub; outage tidak
  menjatuhkan API atau data MySQL, dan frontend dapat memakai REST fallback.
- Remediasi: API tetap hidup, readiness menjadi degraded, public REST tetap tersedia,
  protected request gagal tertutup dengan `503 SESSION_STORE_UNAVAILABLE`, dan proses
  pulih setelah Redis aktif kembali. Cleanup SSE/Redis kini idempotent dan outbox tetap
  berada di MySQL.

## B1-SEC-LOCAL-004 — Signed upload dapat diminta Customer untuk PDF dan MIME spoof

- Severity: **High**
- Status: **Closed — 29 Agustus 2026**
- Area: object storage / upload authorization
- Remediasi: signing dipindahkan ke venue milik Owner, dibatasi WebP/JPEG/PNG, namespace
  tenant/venue/user, dan completion memverifikasi metadata serta magic bytes. Customer,
  Staff, tenant lain, PDF, dan MIME spoof ditolak sebelum signing/completion.

## B1-AUTHZ-LOCAL-001 — Daftar venue Staff membocorkan venue tanpa assignment

- Severity: **Medium**
- Status: **Closed — 29 Agustus 2026**
- Area: Staff venue assignment
- Expected: Staff hanya melihat Arena Cendana.
- Actual: endpoint/list dropdown mengembalikan venue QA, Arena Cendana, dan Soccer Hub
  Cilandak. Detail venue tanpa assignment tetap ditolak `403`, dan court tidak dimuat.
- Dampak: kebocoran nama venue tenant dan UX yang menyesatkan, tetapi object-level
  mutation tetap terblokir.
- Bukti: `security/screenshots/staff-unassigned-venues-exposed.png`.
- Remediasi: list venue sekarang memakai assignment server; Staff hanya melihat Arena
  Cendana, Staff tanpa assignment menerima daftar kosong, dan direct URL tetap `403`.

## B1-ENV-LOCAL-001 — Upload WebP MinIO gagal dan memblokir submission venue

- Severity: **High (environment/functional gate)**
- Status: **Closed — 29 Agustus 2026**
- Area: Owner Setup / MinIO local adapter
- Remediasi: CORS MinIO lokal mencakup origin QA `localhost`/`127.0.0.1` dan signed URL
  memakai host yang dapat dijangkau Chrome. Upload WebP, progress 100%, submit, revision,
  submit ulang, dan approve lulus di External Chrome.

## B1-OPS-LOCAL-001 — Admin Audit Log masih memakai data prototype

- Severity: **High**
- Status: **Closed — 29 Agustus 2026**
- Area: Admin audit history
- Remediasi: `/admin/audit` kini memakai endpoint Admin-only dengan filter, cursor,
  loading/error/empty state, dan dialog before/after. Submit, revision, submit ulang, dan
  approve nyata tampil dengan actor, reason, request ID, timestamp, serta state change.

## B1-OPS-LOCAL-002 — Outstanding memasukkan booking CANCELLED dan EXPIRED

- Severity: **Medium**
- Status: **Closed — 29 Agustus 2026**
- Area: Owner/Staff outstanding read model
- Actual: daftar outstanding Staff memasukkan booking `CANCELLED` dan `EXPIRED`.
- Dampak: total dan daftar penagihan dapat menyesatkan petugas.
- Bukti: `flows/staff/staff-08-outstanding-payments.png`.
- Remediasi: query `outstandingOnly=true` dan dashboard memakai aturan kolektibilitas
  yang sama; terminal booking dikeluarkan dan `COMPLETED` bersaldo tetap ditampilkan.

## B1-BKG-LOCAL-001 — Aksi no-show tidak memberi hasil yang dapat diverifikasi

- Severity: **Medium**
- Status: **Closed — 29 Agustus 2026**
- Area: attendance
- Actual: setelah Staff menekan `Tandai no-show`, modal masih menawarkan aksi yang sama
  dan booking tetap muncul pada `Kedatangan berikutnya`; tidak ada success/error state.
- Dampak: operator tidak tahu apakah attendance tersimpan.
- Bukti: `flows/staff/staff-06-no-show-recorded.png` dan
  `flows/staff/staff-07-attendance-page.png`.
- Remediasi: attendance masuk read model, UI menampilkan live feedback server-backed,
  tombol hilang, dan no-show keluar dari kedatangan berikutnya.

## B1-SRC-LOCAL-001 — Nearest slot katalog berada di tanggal lampau

- Severity: **Medium**
- Status: **Closed — 29 Agustus 2026**
- Area: Customer catalog read model
- Actual: pada 29 Agustus 2026, kartu venue menampilkan nearest slot `28 Agu, 16.00`,
  sedangkan detail venue memilih 29 Agustus 2026 dengan benar.
- Dampak: discovery memberi informasi slot yang tidak dapat dipesan.
- Bukti: `flows/customer/customer-01-public-catalog.png` dan
  `flows/customer/customer-05-venue-detail.png`.
- Remediasi: catalog memakai query nearest slot bookable live untuk kartu, sorting, dan
  cursor; jika tidak ada slot, UI menampilkan “Lihat slot terbaru”.
