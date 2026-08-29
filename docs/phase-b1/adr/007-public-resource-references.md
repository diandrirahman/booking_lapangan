# ADR 007 — Public Resource References

## Status

Accepted untuk Phase B1 development. Cutover production tetap memerlukan backup,
secret provisioning, dan persetujuan eksplisit.

## Keputusan

Primary dan foreign key MySQL tetap numerik agar index serta join tetap ringkas. Nilai
tersebut tidak dikirim langsung melalui URL/API:

- Resource umum memakai opaque ID 22 karakter. Sebuah blok berisi marker format dan
  unsigned database ID dienkripsi AES-256 menggunakan key turunan `RESOURCE_ID_SECRET`,
  lalu dikodekan base64url.
- Booking memakai `LG-` + 16 karakter random base64url.
- Payment attempt memakai `PAY-` + 16 karakter random base64url.

Opaque ID mencegah enumerasi key internal, tetapi bukan kontrol otorisasi. Setiap lookup
tetap wajib dibatasi session, tenant membership, venue assignment, atau pemilik booking.

## Rotasi key

Mengganti `RESOURCE_ID_SECRET` secara langsung membuat opaque ID lama tidak dapat dibaca.
Production harus memakai salah satu strategi berikut sebelum rotasi:

1. dual-key read (key baru untuk write, key lama sementara untuk read), atau
2. versioned public reference yang dimigrasikan sebelum key lama dicabut.

Secret tidak boleh disimpan di repository, log, browser, atau database aplikasi.

## Data sensitif

| Data          | Perlindungan B1                                                                    |
| ------------- | ---------------------------------------------------------------------------------- |
| Password      | Hash Argon2id; tidak reversible dan tidak dikirim API                              |
| QR check-in   | SHA-256 hash di MySQL; raw token tidak dirender                                    |
| Session ID    | Random, disimpan di Redis, cookie HttpOnly/SameSite/Secure production              |
| ID route/API  | Opaque encrypted ID atau random public reference                                   |
| Email/telepon | Authorization dan log redaction; enkripsi-at-rest menunggu threat model production |

Enkripsi ID tidak boleh disebut enkripsi seluruh data. PII production memerlukan keputusan
terpisah untuk key storage, lookup, rotation, backup, dan disaster recovery.
