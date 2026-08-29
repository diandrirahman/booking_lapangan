# Audit Seed Data

Status: **baseline development dan isolasi E2E selesai**.

Tanggal diperbarui: 2026-08-27.

## Dataset development

Seed baru deterministik dan memuat:

- 3 tenant, 6 venue, 12 court, dan 8 olahraga;
- 3 Primary Owner, 30 Customer, 8 Staff, dan 1 Platform Admin terpisah;
- 50 booking, termasuk tepat 10 booking offline;
- variasi booking completed, confirmed, pending confirmation, hold, cancelled, expired;
- variasi full payment, DP, pay-at-venue, paid, partially paid, dan unpaid;
- jadwal, slot, harga, fasilitas, lokasi, dan assignment Staff yang saling konsisten.

Nama dibuat seperti data Indonesia yang wajar. Email menggunakan domain reserved `.test`
agar tidak pernah mengirim ke alamat nyata. Tanggal berasal dari satu
`SEED_REFERENCE_DATE`, bukan waktu acak atau `Date.now()`.

## Password

- Plaintext hanya dibaca oleh perintah seed dari `SEED_DEMO_PASSWORD`.
- Database menyimpan hash Argon2id pada `users.password_hash`.
- Login membandingkan input menggunakan `argon2.verify()`; hash tidak dikirim ke browser.
- Session browser memakai cookie `HttpOnly`, sedangkan Redis menyimpan metadata session,
  bukan password.
- Google identity tetap disimpan di `auth_identities`; password lokal tidak dipisah ke
  tabel identity lain.

## Keselamatan reset

Seed melakukan reset penuh agar hasil selalu sama. Karena itu seed hanya dapat berjalan
ke hostname `localhost` atau `127.0.0.1` dan selalu ditolak pada `NODE_ENV=production`.
Jangan menjalankannya pada database yang berisi data manual sebelum membuat backup.

Database E2E memakai MySQL `lapangango_e2e` pada port 3308 dan Redis database 1. API test
berjalan pada port 3101. Registrasi automation hanya masuk ke database disposable yang
di-seed ulang sebelum suite B1.

## Gap fase berikutnya

Refund yang lebih lengkap dan 5 Mabar belum dimasukkan karena runtime entity tersebut
belum menjadi source of truth B1. Seed untuk B2/B3 ditambahkan bersama migration dan
service terkait, bukan sebagai row tanpa consumer.
