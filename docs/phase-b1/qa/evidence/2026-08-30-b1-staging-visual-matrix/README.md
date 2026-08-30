# Phase B1 — Matriks Visual Staging Empat Role

## Environment

- Web: `https://lapangango-b1-staging-web.vercel.app`
- API: `https://lapangango-b1-staging-api.vercel.app`
- Web deployment: `dpl_6eZqH1NzhAPvESFVZn1MtfPznb9A`
- API deployment: `dpl_EWCSxNzQuzP5LifUSDVe1PXc1sH9`
- Source/docs HEAD saat mulai: `fc78a2f7831613aadfbc1aab9ccd30142d46ef14`
- Mulai: `2026-08-30T02:23:26.520Z`
- Selesai: `2026-08-30T02:37:58.357Z`
- Browser: External Chrome

Deployment frontend dan API diperiksa sebelum dan sesudah QA. Keduanya tetap `READY`
dengan ID yang sama selama seluruh pengambilan evidence.

## Hasil

| Role     | 360×800 | 768×1024 | 1024×768 | 1440×900 | Screenshot |
| -------- | ------- | -------- | -------- | -------- | ---------- |
| Customer | Lulus   | Lulus    | Lulus    | Lulus    | 8          |
| Owner    | Lulus   | Lulus    | Lulus    | Lulus    | 8          |
| Staff    | Lulus   | Lulus    | Lulus    | Lulus    | 8          |
| Admin    | Lulus   | Lulus    | Lulus    | Lulus    | 8          |

Total **32/32** kombinasi light/dark lulus. Seluruh viewport aktual sesuai ukuran yang
diminta. Heading dan route role benar, fokus keyboard terlihat, light/dark berfungsi,
serta tidak ditemukan horizontal overflow, elemen kritis terpotong, gambar rusak,
console error/warning, atau API `5xx`.

Ukuran viewport diverifikasi dari `window.innerWidth/innerHeight` dan dicatat pada hasil
terstruktur. Capture External Chrome menyimpan area konten tanpa scrollbar/browser inset,
sehingga dimensi biner screenshot dapat sedikit lebih kecil daripada viewport yang diuji.

Navigasi Staff hanya memuat Overview, Kalender Operasional, Daftar Booking, Booking
Offline, Check-in, Outstanding Payment, Review, Tiket, Mabar di Venue, dan Notifikasi.
Menu Owner-only tidak tampil.

## Indeks bukti

- [Hasil terstruktur](results/manual-matrix.json)
- [Temuan](findings.md)
- [Console Customer](console/customer.md)
- [Console Owner](console/owner.md)
- [Console Staff](console/staff.md)
- [Console Admin](console/admin.md)
- [Vercel API runtime](console/vercel-api-runtime.md)

Screenshot utama:

- [Customer mobile light](matrix/customer/360x800/light.png)
- [Customer desktop dark](matrix/customer/1440x900/dark.png)
- [Owner mobile light](matrix/owner/360x800/light.png)
- [Owner desktop dark](matrix/owner/1440x900/dark.png)
- [Staff mobile light](matrix/staff/360x800/light.png)
- [Staff desktop dark](matrix/staff/1440x900/dark.png)
- [Admin mobile light](matrix/admin/360x800/light.png)
- [Admin desktop dark](matrix/admin/1440x900/dark.png)

Password, cookie, token, authorization header, OAuth code, dan signed URL tidak disimpan
dalam evidence.
