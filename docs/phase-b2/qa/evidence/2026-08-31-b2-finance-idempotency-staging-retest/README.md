# Phase B2 Finance dan Idempotency Staging Retest

- Tanggal: 31 Agustus 2026
- Source commit: `9ed32bb00424863cf3a8d744aa7ee007e90f70dc`
- Migration deployment: `dpl_9yp9ifpMjSFLPFjFjtrnrwxjCieh` (tidak dipromosikan)
- API deployment: `dpl_9pDwU27JiRdvULSQ7QDVJnJ1Naqq` (`sin1`)
- Web deployment: `dpl_BsdCU8wX1QfPeTtNiHJyTd9ZBfRT`
- Status: **FINANCE PASS — SSE REMEDIATION MENUNGGU REDEPLOY/RETEST**

Retest ini hanya membuktikan integration boundary dari remediation finance dan mutation
idempotency terbaru. Automated local gate tetap menjadi bukti utama untuk seluruh
permutasi ledger, refund, earning, payout, reschedule, tenant, dan concurrency.

## Deployment dan migration

- Migration `0008` dijalankan forward-only pada build production terisolasi dengan
  environment terenkripsi Vercel. Build mencatat `Migration schema numerik selesai`.
- Deployment migration memakai `--skip-domain`; artefaknya tidak menjadi API stabil.
- API kemudian dideploy dari working tree bersih pada source commit di atas dan
  diverifikasi berada di `sin1`.
- Frontend dideploy dari source commit yang sama dan tetap memakai same-origin rewrite.
- API live, API ready, web, dan same-origin ready seluruhnya merespons `200`.
  Readiness memeriksa database, Redis, dan object storage.

## Targeted retest

- Existing Playwright B2 Staff/Admin smoke: **2/2 pass**.
- Staff direct finance tetap menampilkan forbidden; Admin membuka seluruh read surface
  B2 yang diuji tanpa error.
- Owner finance summary, ledger, dan payout list masing-masing merespons `200`.
- Create promotion dengan key baru merespons `201`; replay payload identik merespons
  `201` dan mengembalikan resource yang sama; payload berubah dengan key yang sama
  ditolak `409`.
- Halaman ringkasan keuangan Owner berhasil dirender tanpa console error setelah smoke.
- Query HTTP `500` bersih. Follow-up runtime query menemukan 14 timeout SSE pada batas
  provider 300 detik dan membuka `B2-RT-STG-002`.

## Follow-up SSE

- Root cause: stream `/api/v1/events` tidak mempunyai planned lifetime dan hanya
  berhenti ketika client menutup koneksi atau Redis gagal.
- Fix lokal: stream berakhir pada 240 detik, subscriber dan timer dibersihkan, lalu
  `EventSource` frontend memakai reconnect bawaan.
- Regression: router memakai lifetime pendek dan membuktikan stream ready berakhir serta
  subscriber disconnect tepat sekali.
- Relevant test, lint, typecheck, dan full `qa:b2:local` lulus.
- Staging technical gate tetap tertahan sampai fix dideploy dan koneksi lebih dari
  240 detik tidak menghasilkan runtime timeout baru.

Tidak ada screenshot baru karena delta ini hanya backend/database. Visual matrix staging
24/24 dan targeted visual promotion/notification sebelumnya tetap menjadi baseline.

## Struktur evidence

- `results/targeted-retest.json`: hasil terstruktur yang tidak memuat credential.
- `console/runtime.md`: health, region, dan runtime log summary.
- `findings.md`: disposition gate setelah retest.

Evidence tidak menyimpan password, cookie, token, authorization header, signed URL,
atau nilai environment staging.
