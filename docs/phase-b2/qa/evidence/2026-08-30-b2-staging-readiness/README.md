# Evidence Phase B2 Staging Readiness

- Tanggal: 30 Agustus 2026
- Source commit: `d93a9f03175b53d27f0a5847d83513a679794cef`
- Web deployment: `dpl_JnR5gZNF5XLm1QMzoxRsBKzWwpX3`
- API deployment: `dpl_GUR3MuQgrR1oz7L9J3cMLPb7Fgqu`
- Browser: External Chrome
- Status: **staging technical gate belum selesai**

Evidence tidak memuat password, cookie, token, authorization header, signed URL, atau
data pribadi nyata. Semua data yang dibuat diberi label QA staging/sintetis.

## Hasil

- Visual matrix: **24/24 pass** dengan viewport aktual sesuai target.
- Light: empat role pada `360x800`, `768x1024`, `1024x768`, dan `1440x900`.
- Dark: empat role pada `360x800` dan `1440x900`.
- Tidak ada horizontal overflow, gambar rusak, critical clipping, console error/warning,
  atau API/web `5xx` selama rentang QA.
- API health: live `ok`, readiness `ready`.
- Staff tetap memiliki navigasi terbatas dan direct finance access ditolak.
- Admin smoke membaca commission, promotion, refund, payout, ledger, review, support,
  dan reminder dari server.

Submission yang berhasil dan terverifikasi setelah reload:

- Customer membuat tiket `QA staging B2 — verifikasi tiket Customer`.
- Customer mengirim review sintetis 5/5 untuk booking selesai yang eligible.
- Owner membuat promo sandbox `B2STAGEQA`.
- Owner membalas review sintetis; CTA balasan tidak tersedia lagi setelah reload.

Uji perubahan preference `booking.reminder` channel Email tidak persisten. Checkbox
sempat mati, lalu kembali aktif setelah response/refetch dan tetap aktif setelah reload.
Final state yang terlihat tetap sama seperti sebelum uji. Finding
`B2-NOT-STG-001` berstatus Medium/Open dan menahan staging technical gate.

## Struktur

- `matrix/<role>/<viewport>/<theme>.png`: 24 screenshot matriks.
- `flows/customer/`: tiket, review, dan bukti state preference setelah refetch.
- `flows/owner/`: promo sandbox dan balasan review.
- `results/manual-matrix.json`: hasil terstruktur per kombinasi.
- `console/<role>.md`: hasil inspeksi console per role.
- `findings.md`: disposition finding staging.
