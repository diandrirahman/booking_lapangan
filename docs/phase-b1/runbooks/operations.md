# Runbook Operasional Phase B1

## Migration dan rollback

1. Ambil backup MySQL dan catat migration terakhir di `__drizzle_migrations`.
2. Jalankan `npm run db:migrate`, lalu health/readiness dan contract smoke.
3. Jika gagal, hentikan write traffic, pulihkan backup, dan deploy artifact sebelumnya.
4. Jangan menghapus migration yang pernah diterapkan; buat corrective migration baru.

## Hold cleanup

Panggil `POST /api/v1/internal/jobs/maintenance` dengan `Authorization: Bearer
<CRON_SECRET>`. Job memakai Redis lock, membatasi batch, dan aman dipanggil ulang.
Jika Redis gagal, expiry tetap diproses saat booking dibaca atau command dijalankan.

## Webhook replay

Cari `provider_event_id` pada `payment_provider_events`. Event yang sudah ada tidak
boleh diproses ulang. Untuk event provider yang belum masuk, replay payload asli
dengan signature valid; jangan mengubah amount/status secara manual.

## Outbox recovery

Periksa `outbox_events.processed_at`, `attempt_count`, dan `last_error`. Pulihkan
Redis, lalu jalankan maintenance job. Publisher mengurutkan event dari yang paling
lama dan client selalu authoritative REST refetch.

## Secret rotation

Rotasi satu secret per deployment. Untuk session secret, revoke seluruh key session
Redis. Untuk Midtrans, simpan key lama selama webhook in-flight selesai. Rotasi
`RESOURCE_ID_SECRET` wajib memakai dual-key read atau migrasi versioned reference; mengganti
key langsung akan memutus seluruh opaque URL lama. Jangan menulis credential ke log atau
repository.
