# Phase A QA Report

Tanggal pemeriksaan: 26 Agustus 2026  
Environment: fixture lokal, tanpa backend atau business network request.

## Automated gate

| Gate                     | Hasil                                        |
| ------------------------ | -------------------------------------------- |
| Prettier format check    | Pass                                         |
| ESLint                   | Pass, zero warning                           |
| TypeScript               | Pass                                         |
| Unit/component           | 26 pass                                      |
| Production build         | Pass                                         |
| E2E/route/axe/visual     | Pass: 36 aktif, 20 skip lintas-project       |
| Route registry           | 66 route: 19 Customer, 24 Business, 23 Admin |
| Supporting domain config | 35/35 route memiliki konfigurasi khusus      |
| Visual baseline          | 16 screenshot mobile/desktop                 |

## Critical flow matrix

Kelima flow dijalankan pada 360×800, 768×1024, 1024×768, dan 1440×900.

| Flow                        | 360  | 768  | 1024 | 1440 |
| --------------------------- | ---- | ---- | ---- | ---- |
| Customer booking            | Pass | Pass | Pass | Pass |
| Owner setup                 | Pass | Pass | Pass | Pass |
| Owner operations            | Pass | Pass | Pass | Pass |
| Admin verification/revision | Pass | Pass | Pass | Pass |
| Mabar create/publish/manage | Pass | Pass | Pass | Pass |

## Temuan dan disposition

| ID     | Severity | Route                | Temuan                                                | Expected                                            | Disposition |
| ------ | -------- | -------------------- | ----------------------------------------------------- | --------------------------------------------------- | ----------- |
| PA-001 | Blocker  | E2E                  | Heading dan role selector test tertinggal dari UI     | Test mengikuti UI Radix terbaru                     | Closed      |
| PA-002 | High     | `/` 768px            | Header menimbulkan horizontal overflow                | Tidak ada horizontal scrollbar                      | Closed      |
| PA-003 | High     | `/admin`             | Staff dapat membuka Admin melalui direct URL          | Cross-shell route menghasilkan 403                  | Closed      |
| PA-004 | High     | 35 supporting routes | Satu placeholder generik dipakai lintas domain        | Fixture, copy, action, dan empty state khusus route | Closed      |
| PA-005 | High     | Role switch          | Dialog control tetap terbuka setelah pindah workspace | Dialog tertutup sebelum navigation                  | Closed      |
| PA-006 | High     | Owner setup          | Draft, court, jadwal, harga, policy tidak persisten   | Mutasi lintas page memakai store bersama            | Closed      |
| PA-007 | High     | Operations           | Detail, confirmation, check-in, outstanding dead-end  | Drawer action memperbarui booking yang sama         | Closed      |
| PA-008 | High     | Mabar                | Confirmed-origin dan host controls tidak lengkap      | Validation, approval, FIFO, announcement, cancel    | Closed      |

## Accessibility dan responsive sampling

- Axe tidak menemukan violation serious/critical pada critical desktop screens.
- Keyboard semantics menggunakan native button/link serta Radix focus management.
- Customer memakai bottom navigation pada mobile; Business/Admin memakai drawer.
- Automated overflow test lulus pada empat viewport.
- Browser visual sampling dilakukan pada landing 768×1024, dark mode, dan Owner workspace 1024×768.

## Known limitation non-blocking

- Kamera QR, upload, payment provider, mock map, geolocation, payout, dan dokumen legal tetap simulasi lokal sesuai Phase A.
- Bundle utama sekitar 714 kB (218 kB gzip); lazy route/code splitting dicatat untuk B1.
- Baseline visual baru dianggap diterima setelah Project Owner melakukan review.

## Acceptance

Blocker tersisa: 0.  
Status teknis A-001–A-012: verified.  
Project Owner acceptance: diterima pada 26 Agustus 2026.  
Status akhir Phase A: **Completed**.

Visual baseline dan known limitation non-blocking diterima sebagai baseline serta backlog Phase B1. Perubahan berikutnya tetap wajib menjalankan regression gate Phase A.
