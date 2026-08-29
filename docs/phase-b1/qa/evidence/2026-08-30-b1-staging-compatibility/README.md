# Phase B1 Staging Compatibility — 30 Agustus 2026

Environment:

- web: `https://lapangango-b1-staging-web.vercel.app`;
- API: `https://lapangango-b1-staging-api.vercel.app`;
- API deployment: `dpl_EWCSxNzQuzP5LifUSDVe1PXc1sH9`;
- API region: `sin1`;
- source commit: `9b4b69a`.

## Hasil

| Pemeriksaan                      | Hasil                                                           |
| -------------------------------- | --------------------------------------------------------------- |
| Health live/readiness            | `200` / `200`                                                   |
| TiDB migration                   | 4/4 migration, 56 tabel                                         |
| TiDB seed                        | 42 user, 3 tenant, 6 venue, 50 booking awal                     |
| Login Customer/Owner/Staff/Admin | seluruh login, `/me`, dan endpoint role `200`                   |
| Redis session dan pub/sub        | lulus                                                           |
| Tigris signed upload WebP        | `201` sign, `200` upload, `201` completion                      |
| Delivery media private           | WebP 116.878 byte, `200 image/webp` melalui API dan proxy web   |
| Midtrans Sandbox                 | payment attempt `201 PENDING`, redirect ke domain sandbox resmi |
| Midtrans invalid signature       | `401 INVALID_WEBHOOK_SIGNATURE` tanpa header `Origin`           |
| Google OIDC consent/callback     | lulus, kembali dengan `auth=google-success`                     |
| Google identity conflict         | `409`, session Owner lokal tetap aktif                          |
| Realtime Customer → Owner        | 231 ms, 236 ms, 210 ms; seluruhnya <2.000 ms                    |

Bucket Tigris tetap `private`. Media yang sudah tercatat sebagai `PUBLIC` di database
disajikan melalui redirect download bertanda tangan. Object orphan atau asset privat tidak
dapat menggunakan jalur publik tersebut.

Deployment pertama berjalan di `iad1`, menyebabkan request booking sekitar 5,5 detik.
Deployment diulang dengan region `sin1`; request dan event end-to-end turun menjadi
210–236 ms. Nilai realtime diukur dari sebelum request booking sampai event
`booking.created` diterima Owner. Propagasi event setelah response adalah 0–1 ms.

## Bukti visual

- [Customer — detail venue dan media Tigris](screenshots/customer-venue-tigris-dark.png)
- [Owner — overview server-backed](screenshots/owner-overview-dark.png)
- [Google conflict — session Owner tetap aktif](screenshots/google-conflict-owner-session-preserved.png)

## Remediasi Google account linking

Consent Google pertama berhasil penuh dan membentuk session user Google. Saat identitas
Google yang sama dicoba ditautkan dari akun Owner lain, compatibility QA menemukan callback
lama dapat mengganti session Owner menjadi user pemilik identitas Google tersebut.

Commit `9b4b69a` memperbaiki aturan source of truth: identitas Google yang sudah dimiliki user
lain selalu ditolak `409 GOOGLE_IDENTITY_ALREADY_LINKED`, sementara identitas baru ditautkan
ke user yang sedang login. Regression security 20/20 lulus. Retest deployment
`dpl_EWCSxNzQuzP5LifUSDVe1PXc1sH9` membuktikan callback konflik `409` dan browser tetap
menampilkan session Owner Andika.

## Batas yang belum ditutup

- Matriks visual staging empat role × empat breakpoint belum diulang. Matriks 32/32 lokal
  tetap menjadi baseline visual; staging saat ini baru mendapat desktop compatibility
  smoke.
