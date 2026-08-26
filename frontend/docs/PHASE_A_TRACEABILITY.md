# Phase A Traceability

| ID    | Implementasi                                               | Bukti otomatis                                   | Status   |
| ----- | ---------------------------------------------------------- | ------------------------------------------------ | -------- |
| A-001 | React + TypeScript, seluruh fixture lokal                  | Build production dan static network audit        | Verified |
| A-002 | Prototype Controls: Customer, Owner, Staff, Admin          | Role-switch E2E pada empat breakpoint            | Verified |
| A-003 | Breakpoint 360, 768, 1024, 1440                            | Playwright overflow + browser visual sampling    | Verified |
| A-004 | Booking, payment variants, Booking Saya, Mabar             | Customer dan Mabar E2E                           | Verified |
| A-005 | Overview, operations, setup venue                          | Owner setup/operations E2E pada empat breakpoint | Verified |
| A-006 | Staff navigation hide + cross-shell 403                    | Permission unit test + Staff E2E                 | Verified |
| A-007 | Admin queue, document review, dan keputusan lintas entity  | Admin revision E2E + reducer unit test           | Verified |
| A-008 | Sembilan scenario + success/disabled/validation state      | Scenario component test                          | Verified |
| A-009 | Reset baseline + sessionStorage migration                  | Reducer unit test + role flow reset              | Verified |
| A-010 | Label Simulasi semantic                                    | 66-route smoke dan visual review                 | Verified |
| A-011 | Tokens, dark/light, Animated Hero, 3D Gallery, 12 WebP     | 16 visual regression baseline + axe              | Verified |
| A-012 | Format, lint, type-check, unit, build, E2E, manual QA gate | `npm run qa` + `PHASE_A_QA.md`                   | Verified |

## Status akhir

**Phase A: Completed — diterima Project Owner pada 26 Agustus 2026.**

Seluruh requirement A-001 sampai A-012 telah lulus. Known limitation non-blocking di bawah diterima sebagai backlog Phase B1 dan tidak menghalangi penutupan Phase A.

## Known design debt / B1

- Kamera QR, upload, payment provider, map, geolocation, dan network tetap berupa simulasi lokal.
- Bundle JavaScript produksi sekitar 714 kB (218 kB gzip); lazy route loading menjadi optimasi B1 non-blocking.
- Visual regression baseline telah diterima sebagai baseline regresi Phase B1.
- TanStack Table dependency sudah tersedia; grid Phase A memakai markup table semantic agar prototipe tetap ringan.
