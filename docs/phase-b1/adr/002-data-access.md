# ADR-002 — Data access

Status: diterima.

Drizzle + `mysql2` dipakai karena schema dan migration tetap eksplisit sementara
application service dapat membuka transaction dan row lock secara langsung. Semua
timestamp disimpan UTC; konversi jadwal memakai timezone IANA venue. Migration
bersifat maju dan versioned; rollback mengikuti runbook, bukan schema push.

Internal key memakai numeric auto-increment berdasarkan cardinality: `SMALLINT` untuk
master, `INT` untuk entity sedang, dan `BIGINT` untuk user/transaksi/event. API
menyerialisasi ID sebagai string desimal. Riwayat ULID teks disimpan sebagai legacy;
baseline numeric berada di `backend/drizzle-v2` dan tidak melakukan cast destruktif.
