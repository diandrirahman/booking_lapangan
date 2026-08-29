# Audit Schema Database

Status: **redesign development selesai; migration production belum disetujui**.

Tanggal diperbarui: 2026-08-27.

## Keputusan yang diterapkan

- ID master berjumlah kecil memakai `SMALLINT UNSIGNED`.
- ID entity seperti tenant, venue, court, media, dan promotion memakai `INT UNSIGNED`.
- ID user, booking, payment, refund, slot, audit, inbox, dan outbox memakai
  `BIGINT UNSIGNED`.
- Junction table murni memakai composite primary key dan tidak lagi memiliki ID buatan.
- API tetap mengirim ID sebagai string desimal. Nilai dikonversi pada boundary sehingga
  frontend tidak bergantung pada tipe integer database.
- Timestamp umum memakai `DATETIME`; hanya event yang membutuhkan urutan rapat memakai
  `DATETIME(3)`. `DATETIME(6)` tidak digunakan.
- Panjang `VARCHAR` mengikuti batas domain. Contoh penting: nama user 50, nama venue 80,
  nama court 50, telepon E.164 16, email 254, booking code 20, dan status 16-24.
- Nilai uang tetap `BIGINT UNSIGNED` dalam rupiah, bukan floating point.

Schema runtime aktif saat ini berisi 54 tabel B1. Entity B2/B3 pada `docs/ERD.md`
merupakan rancangan produk dan tidak ikut migration sampai feature terkait dikerjakan.
Ini sengaja untuk menghindari tabel kosong dan index yang belum mempunyai query consumer.

## Migration

- `backend/drizzle/` adalah riwayat schema legacy berbasis ULID teks.
- `backend/drizzle-v2/` adalah baseline baru dengan ID numerik.
- Konversi langsung `CHAR(26)` ke angka ditolak karena dapat memutus seluruh foreign key.
- Migration runner melakukan preflight. Jika menemukan `users.id` bertipe `CHAR` atau
  `VARCHAR`, proses berhenti dengan `LEGACY_SCHEMA_RESET_REQUIRED`.
- Database development lama harus di-backup lalu dibuat ulang secara eksplisit sebelum
  baseline v2 diterapkan. Tidak ada reset otomatis dari aplikasi atau test.

## Alasan `BIGINT` tidak membebani server

`BIGINT` memakai 8 byte. ULID `CHAR(26)` memakai setidaknya 26 byte per nilai sebelum
overhead index dan collation. Untuk tabel transaksi besar, key numerik membuat primary
key, foreign key, dan secondary index lebih kecil serta comparison lebih murah. `BIGINT`
tetap hanya dipakai pada tabel yang dapat tumbuh besar; master dan entity sedang memakai
tipe yang lebih kecil.

## Gate production yang masih wajib

- Review migration fresh-install dan backup/restore.
- Uji no-double-booking dan query plan pada volume target.
- Uji batas `BIGINT` terhadap serialization API dan generated client.
- Review index berdasarkan slow-query log.
- Rencana cutover data production; baseline v2 saat ini ditujukan untuk development baru.
