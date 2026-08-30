# Phase B2 P1/P2 Staging Retest

- Tanggal: 31 Agustus 2026
- Source commit: `b74ab1390f3debb5ac2cc4a63c1949b680432c41`
- API deployment: `dpl_Gy4M9phJynEiPSpY7aNX22oET3hQ` (`sin1`)
- Web deployment: `dpl_BmEcQsRF6s9qzLNBENfMzSqMdqvb`
- Status: **PASS — staging technical gate complete, menunggu keputusan Project Owner**

Retest ini hanya mencakup delta remediation promotion authorization/idempotency dan
notification preference. Matriks staging 24/24 sebelumnya tetap menjadi baseline.

## Hasil utama

- Business promo dengan `fundingSource: PLATFORM` ditolak `422`.
- Owner membuat promo `OWNER` untuk dua venue tenant dengan respons `201`.
- Staff demo hanya mempunyai satu venue assignment dan tidak memiliki
  `promotions.manage`; request ke promo venue lain dan list promo sama-sama ditolak
  `403`. UI tidak menampilkan menu finance/promo dan direct URL menampilkan forbidden.
- Preference `booking.reminder`/`EMAIL` berubah menjadi boolean `false`, tetap `false`
  setelah GET, dialog dibuka ulang, dan reload. State akun kemudian dikembalikan ke
  nilai awal.
- Console tab bersih untuk Customer, Owner, dan Staff: nol error/warning.
- Runtime log API sejak deployment: nol `5xx` dan nol log level error.
- Dua belas screenshot delta mempunyai viewport aktual tepat `360x800` atau
  `1440x900`, light/dark.

## Struktur evidence

- `results/targeted-retest.json`: hasil request dan visual tersanitasi.
- `console/`: hasil console per role serta runtime log.
- `screenshots/`: Customer preference, Owner promotions, dan Staff forbidden.
- `findings.md`: disposition lima finding remediation.

Evidence tidak menyimpan password, cookie, token, authorization header, signed URL,
atau data sensitif lain.
