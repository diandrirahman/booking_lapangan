# QA Visual Customer Booking dan Payment — 28 Agustus 2026

## Metode dan lingkungan

- Target: frontend development `http://localhost:5173` dan backend development `http://localhost:3000`.
- Database: MySQL development setelah migrasi `0001_late_warhawk`.
- Browser: Chromium melalui Playwright, kemudian seluruh screenshot diperiksa secara visual.
- Viewport: desktop 1440×900 dan mobile 360×800.
- Catatan: kontrol browser interaktif tidak tersedia pada sesi Windows ini. Interaksi dijalankan oleh Playwright, sedangkan pemeriksaan tampilannya dilakukan secara visual dari hasil screenshot.

## Hasil flow kritis

| Langkah                                | Desktop                  | Mobile          | Bukti                                        |
| -------------------------------------- | ------------------------ | --------------- | -------------------------------------------- |
| Daftar dan pencarian venue             | Lulus dengan catatan map | Lulus           | `01-daftar-venue.png`                        |
| Detail dan ulasan venue                | Lulus                    | Lulus           | `02-ulasan-venue.png`                        |
| Pilih court dan slot berurutan         | Lulus                    | Lulus           | `03-pilih-slot.png`                          |
| Checkout sebagai tamu                  | Lulus                    | Lulus           | `04-checkout-tamu.png`                       |
| Login gate dan kembali ke checkout     | Lulus                    | Lulus           | `05-login-gate.png`, `06-checkout-login.png` |
| Membuat booking                        | HTTP 201                 | HTTP 201        | assertion browser                            |
| Membuat payment attempt                | HTTP 201                 | HTTP 201        | `07-payment-pending.png`                     |
| Simulasi pembayaran berhasil           | Lulus                    | Lulus           | `08-payment-berhasil.png`                    |
| Detail booking dengan reference `LG-…` | Lulus                    | Lulus           | `09-detail-booking.png`                      |
| Respons HTTP 5xx selama flow           | Tidak ditemukan          | Tidak ditemukan | listener response browser                    |

## Temuan

### QA-2026-08-28-01 — MapLibre belum menampilkan peta sebenarnya

- Severity: **Medium**
- Route: `/venues`
- Aktual: area peta hanya menampilkan background fallback, kontrol, dan marker tanpa tile, label jalan, atau konteks lokasi.
- Dampak: sinkronisasi list/marker dapat diuji, tetapi pengguna belum dapat memahami lokasi venue secara nyata.
- Status: **Known issue**; penyebab library/runtime MapLibre sudah dicatat pada catatan Phase B1.
- Bukti: [desktop/01-daftar-venue.png](desktop/01-daftar-venue.png)

### QA-2026-08-28-02 — Cover venue berulang

- Severity: **Low**
- Route: `/venues`
- Aktual: beberapa venue berbeda memakai gambar cover Arena Cendana yang sama.
- Dampak: daftar terlihat seperti data contoh dan venue lebih sulit dibedakan secara visual.
- Status: **Open design debt**.
- Bukti: [desktop/01-daftar-venue.png](desktop/01-daftar-venue.png), [mobile/01-daftar-venue.png](mobile/01-daftar-venue.png)

### QA-2026-08-28-03 — Format tanggal ringkasan belum konsisten

- Severity: **Low**
- Route: `/venues/arena.cendana/book`
- Aktual: ringkasan menampilkan `2026-08-28`, sedangkan detail checkout memakai `Jum, 28 Agustus 2026`.
- Ekspektasi: seluruh UI customer memakai format tanggal Bahasa Indonesia yang sama.
- Status: **Open UI debt**.
- Bukti: [desktop/03-pilih-slot.png](desktop/03-pilih-slot.png)

### QA-2026-08-28-04 — Screenshot full-page mobile memperlihatkan elemen fixed di tengah halaman

- Severity: **Evidence limitation**, bukan bug yang dikonfirmasi.
- Aktual: header/bottom navigation dapat muncul di tengah hasil screenshot panjang karena Playwright menyatukan halaman ketika elemen `fixed` aktif.
- Dampak: tidak memengaruhi assertion, request, atau viewport pengguna; screenshot viewport nyata perlu digunakan jika ingin menilai posisi sticky secara presisi.

## Kesimpulan

- Blocker: **0**
- Server error pada pembuatan payment attempt: **tidak muncul kembali**.
- Flow desktop: **lulus**.
- Flow mobile: **lulus**.
- Temuan terbuka: **1 Medium, 2 Low**, seluruhnya non-blocking terhadap booking/payment.

## Screenshot desktop

- [01 — Daftar venue](desktop/01-daftar-venue.png)
- [02 — Ulasan venue](desktop/02-ulasan-venue.png)
- [03 — Pilih slot](desktop/03-pilih-slot.png)
- [04 — Checkout tamu](desktop/04-checkout-tamu.png)
- [05 — Login gate](desktop/05-login-gate.png)
- [06 — Checkout setelah login](desktop/06-checkout-login.png)
- [07 — Payment pending](desktop/07-payment-pending.png)
- [08 — Payment berhasil](desktop/08-payment-berhasil.png)
- [09 — Detail booking](desktop/09-detail-booking.png)

## Screenshot mobile

- [01 — Daftar venue](mobile/01-daftar-venue.png)
- [02 — Ulasan venue](mobile/02-ulasan-venue.png)
- [03 — Pilih slot](mobile/03-pilih-slot.png)
- [04 — Checkout tamu](mobile/04-checkout-tamu.png)
- [05 — Login gate](mobile/05-login-gate.png)
- [06 — Checkout setelah login](mobile/06-checkout-login.png)
- [07 — Payment pending](mobile/07-payment-pending.png)
- [08 — Payment berhasil](mobile/08-payment-berhasil.png)
- [09 — Detail booking](mobile/09-detail-booking.png)
