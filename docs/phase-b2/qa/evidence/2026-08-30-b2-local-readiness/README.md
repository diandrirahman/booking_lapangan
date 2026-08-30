# Evidence Phase B2 Local Readiness

Evidence ini dibuat pada environment lokal terisolasi dan tidak menyimpan password,
cookie, token, authorization header, signed URL, atau data pribadi nyata.

## Ringkasan

- External Chrome flow: Customer, Owner, Staff, Admin selesai.
- Visual matrix: **24/24 pass**.
- Console: tidak ada error/warning selama sesi matriks terisolasi.
- Automated support: B2 E2E 4/4 dan axe serious/critical empat role lulus.

## Struktur

- `flows/customer/`: support, review, preference, booking, dan bukti remediasi dialog.
- `flows/owner/`: finance, ledger, payout, refund, promo, review, support, team, reminder.
- `flows/staff/`: permission menu, forbidden finance, dan venue isolation.
- `flows/admin/`: commission, promo, ledger, payout, review, support, reminder, refund.
- `matrix/<role>/<viewport>/<theme>.png`: screenshot full-page setiap kombinasi.
- `results/manual-matrix.json`: viewport aktual, theme, overflow, focus, gambar, dan status.
- `console/<role>.md`: ringkasan console.
- `findings.md`: finding terbuka dan finding yang ditutup.

## Matriks

Light tersedia untuk `360x800`, `768x1024`, `1024x768`, dan `1440x900` setiap role.
Dark tersedia untuk `360x800` dan `1440x900` setiap role.

Screenshot utama:

- `matrix/customer/360x800/light.png`
- `matrix/owner/1440x900/dark.png`
- `matrix/staff/360x800/dark.png`
- `matrix/admin/1440x900/light.png`

Hasil lengkap dirangkum di `../../../QA_REPORT.md`.

Penyegaran UI setelah baseline ini memiliki evidence delta terpisah di
`../2026-08-30-b2-ui-refresh-local/` agar screenshot baseline tidak ditimpa.
