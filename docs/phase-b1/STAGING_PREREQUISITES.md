# Prasyarat Staging Phase B1

## Keputusan deployment

Baseline mengikuti PRD:

- frontend React/Vite di Vercel;
- backend Express di Vercel Functions/Fluid compute;
- managed MySQL sebagai source of truth;
- managed Redis untuk session, lock, dan pub/sub;
- S3-compatible object storage untuk media.

Render tidak digunakan. Jika technical spike Vercel gagal memenuhi realtime ≤2 detik,
runtime fallback harus diputuskan melalui change control; provider tidak dipilih diam-diam.

## Project Vercel staging

Staging memakai dua project khusus agar tidak mengubah project production lama:

| Project                     | Fungsi                               | URL stabil                                     |
| --------------------------- | ------------------------------------ | ---------------------------------------------- |
| `lapangango-b1-staging-web` | React/Vite dan same-origin API proxy | `https://lapangango-b1-staging-web.vercel.app` |
| `lapangango-b1-staging-api` | Express API pada Fluid Compute       | `https://lapangango-b1-staging-api.vercel.app` |

Target `production` milik kedua project khusus tersebut merupakan environment aplikasi
**staging**, bukan production LapanganGo. Project lama `lapangan-go` tidak diubah.

## Kesiapan repository

- `backend/src/index.ts` mengekspor Express app untuk deteksi Vercel.
- Listener lokal hanya aktif di luar runtime Vercel.
- `backend/vercel.json` mendaftarkan Express, region `sin1`, dan cron maintenance harian
  yang kompatibel dengan batas Vercel Hobby.
- `frontend/vercel.json` mendaftarkan Vite, same-origin API proxy, dan SPA deep-link rewrite.
- Frontend/backend menargetkan Node.js 22.
- Cron endpoint menerima GET dari Vercel dan POST untuk recovery lokal.
- Secret public resource menggunakan nama `RESOURCE_ID_SECRET`; prefix `PUBLIC_` tidak
  dipakai karena Vercel memperlakukannya sebagai konfigurasi yang boleh diekspos.

## Resource yang sudah terhubung

Vercel mewajibkan pemilik akun menyetujui syarat layanan provider. Implementer tidak
boleh memberikan persetujuan legal atas nama Project Owner.

1. Redis sudah terhubung dan berstatus `Available` pada project API.
2. TiDB Cloud Starter `lapangango-b1-staging` terhubung manual melalui
   `DATABASE_URL` karena integrasi Marketplace tidak dapat memetakan resource Starter.
3. Tigris sudah terpasang pada project API dan variable kompatibilitas `S3_*` sudah
   dipetakan.

Gunakan paket gratis/starter dan jangan mengaktifkan auto-upgrade. Setelah tindakan ini
selesai, provisioning, mapping environment, migration, seed, deploy, dan QA dapat
dilanjutkan oleh implementer.

## Hasil pemeriksaan repository 28 Agustus 2026

`vercel env ls` menunjukkan empat variable pada project frontend
(`VITE_API_BASE_URL`, `VITE_SERVER_STATE`, `VITE_ENABLE_PROTOTYPE_CONTROLS`, dan
`VITE_MAP_TILE_URL`). Project `lapangango-b1-staging-api` sudah memiliki Redis, secret
internal, `APP_ORIGIN`, dan konfigurasi session/outbox. `vercel integration list`
menampilkan resource `lapangango-b1-staging-redis` berstatus Available.

Pada 28 Agustus 2026, koneksi TLS akun aplikasi TiDB berhasil diverifikasi dan seluruh
migration menghasilkan 55 tabel pada database `lapangango`. `DATABASE_URL` disimpan
sebagai Vercel Secret dan `DATABASE_SSL_MODE=required`. Tigris menyediakan credential
melalui integrasi Vercel; backend menormalkan nama variable Tigris ke konfigurasi
S3-compatible yang sama.

Backend sudah berhasil dibangun dan dideploy ke
`https://lapangango-b1-staging-api.vercel.app`. Runtime masih berhenti sebelum health
handler karena `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MIDTRANS_SERVER_KEY`, dan
`MIDTRANS_CLIENT_KEY` belum tersedia. Seed staging juga belum dijalankan karena password
demo harus disepakati Project Owner.

## Dependency API yang belum terpetakan

Nilai berikut harus dibuat khusus staging dan disimpan sebagai encrypted environment
variables pada Vercel. Jangan menaruh nilainya di repository.

| Variable              | Keterangan                                  |
| --------------------- | ------------------------------------------- |
| `DATABASE_URL`        | Managed MySQL staging dengan TLS            |
| `REDIS_URL`           | Managed Redis staging                       |
| `S3_ENDPOINT`         | Endpoint object storage staging             |
| `S3_REGION`           | Region bucket staging                       |
| `S3_BUCKET`           | Nama bucket staging                         |
| `S3_ACCESS_KEY`       | Credential akses bucket                     |
| `S3_SECRET_KEY`       | Secret akses bucket                         |
| `SESSION_SECRET`      | Sudah dikonfigurasi sebagai Vercel Secret   |
| `RESOURCE_ID_SECRET`  | Sudah dikonfigurasi sebagai Vercel Secret   |
| `CRON_SECRET`         | Sudah dikonfigurasi sebagai Vercel Secret   |
| `APP_ORIGIN`          | Sudah menunjuk URL frontend staging         |
| `GOOGLE_REDIRECT_URI` | Sudah menunjuk callback same-origin staging |

`MIDTRANS_*` dan `GOOGLE_*` wajib tersedia untuk Definition of Done plan terbaru karena
acceptance mencakup Google OIDC dan Midtrans Sandbox. UI tetap berlabel Sandbox/Simulasi.

## Pemeriksaan setelah dependency tersedia

1. Jalankan migration dan seed staging dengan password demo yang disepakati.
2. Deploy backend Vercel dan verifikasi `/api/v1/health/live` serta readiness.
3. Hubungkan frontend ke backend melalui same-origin rewrite atau Vercel Services agar
   session cookie tidak menjadi cross-site.
4. Deploy frontend Vercel dan verifikasi login semua role.
5. Jalankan `QA_BASE_URL=<url-staging> playwright test` untuk 16 kombinasi.
6. Jalankan realtime SLO minimal tiga kali dan simpan latency mentah.
7. Perbarui acceptance report dan minta sign-off Project Owner.
