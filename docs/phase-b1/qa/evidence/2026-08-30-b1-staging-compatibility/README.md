# Phase B1 Staging Compatibility — 30 Agustus 2026

Environment:

- web: `https://lapangango-b1-staging-web.vercel.app`;
- API: `https://lapangango-b1-staging-api.vercel.app`;
- API deployment: `dpl_DmkUKBi8euDXzytr1dMV5K11s1uf`;
- API region: `sin1`;
- source commit: `375005f`.

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
| Google OIDC start                | `302`, client/state/callback staging tersedia                   |
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

## Batas yang belum ditutup

- Google authorization/consent end-to-end belum dijalankan karena langkah tersebut
  mengirim profil Google pribadi Project Owner ke aplikasi staging dan memerlukan
  persetujuan action-time terpisah.
- Matriks visual staging empat role × empat breakpoint belum diulang. Matriks 32/32 lokal
  tetap menjadi baseline visual; staging saat ini baru mendapat desktop compatibility
  smoke.
