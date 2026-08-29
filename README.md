# LapanganGo

LapanganGo adalah demo sandbox marketplace booking venue olahraga. Phase A berada
di `frontend/`; Phase B1 menambahkan API Express, MySQL, Redis, object storage,
dan Midtrans Sandbox tanpa memindahkan uang nyata.

## Prasyarat

- Node.js 20.11 sampai 22 LTS (`<24`)
- npm
- Docker Desktop untuk MySQL, Redis, dan MinIO lokal

## Menjalankan lokal

```powershell
Copy-Item .env.example .env
docker compose up -d mysql redis minio
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Frontend berjalan di `http://localhost:5173` dan API di
`http://localhost:3000/api/v1`. Health endpoint tersedia pada
`/api/v1/health/live` dan `/api/v1/health/ready`.

Node 24 tidak didukung sementara karena pada sebagian environment Windows, dependency
CLI `tsx`/Drizzle gagal sebelum aplikasi mulai dengan `uv_os_get_passwd ENOMEM`. Gunakan
Node 22 LTS untuk perintah development, migration, dan seed.

Akun seed:

- Owner: `andika.pratama@lapangango.test`
- Customer: `nadia.putri@contoh.test`
- Admin sandbox: `admin@lapangango.test`
- Password: nilai `SEED_DEMO_PASSWORD` pada `.env`

Migration numerik baru berada di `backend/drizzle-v2`. Jika database lama masih memakai
ID `CHAR(26)`, `npm run db:migrate` berhenti dengan `LEGACY_SCHEMA_RESET_REQUIRED`.
Backup lalu recreate database development secara eksplisit; runner tidak menghapus data.

`VITE_SERVER_STATE=off` hanya dipakai oleh regression Phase A. Development normal
memakai API B1. Google OIDC, Midtrans, dan object storage dikonfigurasi melalui
`.env`; jangan gunakan credential production pada demo.

Login dan registrasi tersedia di `/login` dan `/register`. Pada development normal,
header memakai session akun dari API dan kontrol prototype tidak dirender. Jika perlu
melakukan regression visual Phase A secara sengaja, salin `frontend/.env.example` ke
`frontend/.env.local`, ubah `VITE_SERVER_STATE=off`, lalu jalankan frontend kembali.

## Perintah workspace

```powershell
npm run dev
npm run db:generate
npm run db:migrate
npm run db:seed
npm run api:generate
npm run test:integration
npm run test:security
npm run test:concurrency
npm run test:e2e:b1
```

`test:e2e:b1` memakai MySQL `lapangango_e2e` pada port 3308, Redis database 1, dan API
port 3101. Test tidak memakai atau mereset database development pada port 3307.

Migration tidak di-rollback dengan menghapus file SQL. Gunakan backup/restore dan
corrective migration sesuai [runbook](docs/phase-b1/runbooks/operations.md).
Kontrak API berada di [OpenAPI B1](docs/openapi/b1.yaml), sedangkan keputusan
arsitektur dan traceability berada di [dokumentasi Phase B1](docs/phase-b1/architecture.md).

## Quality gate

```powershell
# Gate canonical sebelum deploy atau koneksi provider eksternal
npm run qa:b1:local

# Dijalankan hanya setelah Project Owner memberikan local sign-off
npm run qa:b1:staging

# Agregat final setelah kedua environment tersedia
npm run qa:b1
```

Gate lokal mencakup format, lint, TypeScript, unit/integration/security/concurrency
test, production build, contract check, dokumentasi, regression E2E, audit 66 route,
serta realtime lokal. Gate staging menangani TiDB, Tigris, Google OIDC, dan URL Vercel.

## Batas sandbox

Payment, refund, dokumen verifikasi, dan payout pada Phase B tetap simulasi.
Jangan memakai credential, dokumen legal, atau uang nyata pada environment demo.
