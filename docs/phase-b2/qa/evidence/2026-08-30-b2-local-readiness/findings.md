# Findings Phase B2 Local

## Accepted Risk

### B2-DEP-LOCAL-001 — Medium — Accepted Risk

ExcelJS 4.4.0 membawa UUID 8.3.2 dengan dua advisory buffer-bound pada API UUID
v3/v5/v6. Jalur export proyek tidak memanggil API tersebut; ExcelJS hanya memanggil v4
tanpa buffer. Tidak ada upgrade stabil dan downgrade paksa bersifat breaking. Project
Owner menerima risiko ini secara eksplisit untuk Phase B2 lokal pada 30 Agustus 2026.
Review ulang dilakukan saat tersedia upgrade ExcelJS yang aman, penggunaan UUID berubah,
atau sebelum keputusan deployment production.

## Closed saat QA manual

### B2-UI-LOCAL-001 — Medium — Closed

Command yang mengembalikan `201` tanpa body sudah tersimpan di server, tetapi API client
memaksa parse JSON dan menganggapnya gagal. Client sekarang menerima body kosong untuk
semua respons sukses 2xx. Regression: `packages/api-client/src/client.test.ts`.

### B2-UI-LOCAL-002 — Medium — Closed

Dialog support, review, promotion, dan reply tidak menutup/reset setelah sukses. Dialog
sekarang controlled, menutup sesudah server success, dan read model booking membawa
`reviewId`. Regression: `frontend/e2e/phase-b2.spec.ts` dan integration review.

### B2-UI-LOCAL-003 — Low — Closed

Payout terminal masih menampilkan tombol proses. UI sekarang hanya menawarkan transisi
`SCHEDULED → PROCESSING → SUCCEEDED`. Regression: `B2IntegratedPages.test.ts`.

### B2-UI-LOCAL-004 — Low — Closed

Footer sidebar Admin menampilkan role Customer. Label kini `Admin platform`.

### B2-UI-LOCAL-005 — Low — Closed

Daftar ledger generik menampilkan ID opaque dan nilai Rp0. Presenter memakai deskripsi
domain dan total debit ledger. Regression: `B2IntegratedPages.test.ts`.

## Manual matrix

Tidak ada finding Blocker, Critical, High, atau Medium dari 24 kombinasi visual. Semua
viewport, theme, focus, overflow, broken image, clipped element, dan console check lulus.
