# Indeks Bukti Local Readiness Phase B1

- Tanggal: 28 Agustus 2026
- Environment: lokal terisolasi
  Status: automated gate lulus; inspeksi External Chrome protected-role menunggu izin
  login credential demo.

## Bukti otomatis

- `results/`: 16 hasil terstruktur untuk Customer, Owner, Staff, dan Admin pada empat
  breakpoint.
- `screenshots/`: 32 screenshot light/dark dari matriks otomatis.
- `realtime-measurement.json`: tiga sampel realtime 73 ms, 99 ms, dan 102 ms.
- `playwright-report/`: laporan HTML manual-matrix pendukung.
- `test-output/.last-run.json`: status run terakhir `passed`.

## Bukti External Chrome

Folder `external-chrome/` dipakai khusus untuk inspeksi browser Chrome eksternal yang
sudah login. Bukti Playwright tidak akan diberi label sebagai bukti manual Chrome.

Status saat ini:

- Customer tanpa login: koneksi dan console inspection berhasil, tetapi override viewport
  Chrome tidak diterapkan (ukuran aktual tetap 1905 px); capture percobaan tidak disimpan
  sebagai evidence.
- Owner, Staff, dan Admin: menunggu persetujuan eksplisit untuk mengirim credential demo
  ke API lokal saat login.

Sesuai rencana, matriks External Chrome diberi status `blocked-environment` sampai ukuran
aktual dapat diverifikasi. Bukti otomatis Playwright tidak dipindahkan atau diberi label
sebagai bukti manual.

## Bukti audit route

Audit visual 66 route tersimpan terpisah pada
`docs/phase-b1/qa/evidence/2026-08-28-ui-route-audit/` agar tidak tercampur dengan matriks
acceptance empat role.
