# Evidence B1 Acceptance — 2026-08-28

Folder ini berisi bukti pengujian lokal E2E terisolasi. Ini bukan hasil staging resmi
karena dependency managed MySQL/Redis/object storage staging belum tersedia.

## Bukti terbaru

- `realtime-measurement.json`: tiga event booking otomatis diterima dalam 82–120 ms.
- `results/`: 16 hasil JSON untuk empat role × empat breakpoint.
- `screenshots/`: 32 screenshot terbaru, masing-masing light dan dark.
- `playwright-report/`: laporan HTML Playwright.

Folder `contact-sheets/` dan sebagian artefak `test-output/` berasal dari run diagnostik
sebelumnya. Gunakan screenshot individual dan JSON `results/` sebagai bukti acceptance
terbaru.

## Ringkasan terbaru

- Realtime otomatis: tiga sampel lulus 82–120 ms, tanpa trigger maintenance manual.
- Manual/visual QA: 16/16 lulus.
- Serious/critical axe violation: 0 pada light dan dark mode.
- Overflow, keyboard focus, browser error, dan API 5xx: lulus 16/16.

Laporan utama berada di [`../../../B1_ACCEPTANCE_REPORT.md`](../../../B1_ACCEPTANCE_REPORT.md).
