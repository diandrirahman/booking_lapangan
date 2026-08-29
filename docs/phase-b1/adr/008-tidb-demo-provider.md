# ADR-008 — TiDB Cloud Starter untuk Database Demo

## Status

Accepted sebagai perubahan terkontrol untuk environment demo; MySQL 8 tetap canonical.

## Keputusan

- Vercel staging boleh menggunakan TiDB Cloud Starter dengan spending limit `0`.
- Kode tetap menggunakan `mysql2`, Drizzle, migration SQL MySQL-compatible, dan TLS.
- TiFlash, vector search, `AUTO_RANDOM`, query hint TiDB, serta DDL khusus TiDB dilarang.
- Migration, seed, transaction rollback, unique/FK, booking concurrency, webhook
  idempotency, date/time, collation, sorting, dan query catalog/calendar harus diuji pada
  MySQL 8 dan TiDB.
- Kegagalan invariant booking/payment tidak boleh diselesaikan dengan melemahkan rule.
  Provider demo harus diganti atau ditinjau ulang.

## Batas data

Data TiDB demo tidak dipindahkan ke production. Production masa depan menjalankan migration
baru pada MySQL 8 di VPS dan hanya membawa seed master non-transaksional. Akun, tenant,
booking, payment, webhook, refund, dan audit demo dibuang.

## Kondisi saat ini

Project Vercel API belum menampilkan `DATABASE_URL`, sehingga compatibility gate TiDB dan
migration staging belum dijalankan. Tidak ada migration production yang diotorisasi oleh
ADR ini.
