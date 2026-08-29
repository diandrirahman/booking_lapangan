# Known Limitations Phase B1

- **Cutover production belum disetujui.** Schema development sudah memakai primary key
  numerik dan batas kolom berbasis domain. Database legacy harus di-backup dan direcreate
  sebelum baseline `drizzle-v2` diterapkan. Lihat
  [DATABASE_SCHEMA_AUDIT_HOLD.md](DATABASE_SCHEMA_AUDIT_HOLD.md).
- Midtrans, refund, payout, dan dokumen legal tetap sandbox/simulasi. Tidak ada uang atau
  dokumen legal nyata yang diproses oleh build B1.
- Google OIDC memerlukan credential dan callback domain staging. Adapter, state
  validation, account linking, dan fallback email/password sudah tersedia lokal;
  provider live merupakan gate staging setelah local sign-off.
- Leaflet telah menggantikan MapLibre. Standard OpenStreetMap tiles hanya digunakan untuk
  development/staging; provider tile production belum dipilih. Riwayat akar masalah ada
  di [MAPLIBRE_REMEDIATION.md](MAPLIBRE_REMEDIATION.md).
- Realtime normal lulus manual dengan maksimum 508 ms dari tiga sampel. Redis outage
  kini menghasilkan readiness degraded; public REST/liveness tetap tersedia, protected
  request gagal tertutup dengan `503`, dan API pulih setelah Redis aktif kembali.
- Catalog, availability, booking, payment, Owner Setup, Owner Operations, dan Admin Audit
  memakai API sebagai source of truth pada development normal.
  `PrototypeStore` hanya dipakai ketika `VITE_SERVER_STATE=off` atau pada fitur B2/B3 yang
  jelas berlabel simulasi.
- Mabar, favorite persistence, review creation, promo redemption, ledger, commission,
  payout, dan permission kustom tetap scope B2/B3.
- ID numerik tidak dikirim melalui URL/API. Resource umum memakai opaque ID terenkripsi;
  booking dan payment memakai random public reference. Ini tidak menggantikan object-level
  authorization. Rotasi `RESOURCE_ID_SECRET` memerlukan strategi dual-key atau migrasi URL.
- Enkripsi-at-rest untuk email dan nomor telepon production belum diputuskan karena
  memerlukan threat model, key management, rotation, lookup, backup, dan recovery.
- `npm audit --omit=dev` bersih. Advisory development-only harus dinilai terpisah dan tidak
  boleh disamakan dengan dependency runtime production.
- Matriks External Chrome telah menghasilkan 32/32 screenshot manual; supporting
  Playwright/axe 16/16 lulus. Hasil ada di evidence 29 Agustus 2026.
- Tigris dan TiDB tidak dipakai untuk membuktikan local readiness. MinIO dan MySQL 8
  menjadi acuan lokal; compatibility provider dijalankan setelah local sign-off.
- Signed upload lokal sudah terikat Owner/tenant/venue dan membatasi WebP/JPEG/PNG;
  completion memeriksa metadata serta magic bytes. Pembersihan orphan dibatasi 100 object
  berumur lebih dari satu jam per maintenance run. Compatibility Tigris tetap gate
  staging.
- Audit production build sudah menghasilkan 66 screenshot, satu per route, dan lulus
  pemeriksaan heading domain, overflow, browser error, serta axe serius/kritis. Route
  B2/B3 tetap berupa simulasi visual sesuai batas fase, bukan integrasi server B1.
- Weekly schedule dan exception kini membentuk slot secara lazy dan atomik saat
  availability tanggal dibuka. Untuk demo B1 ini menghindari pre-generation job besar;
  pemantauan volume materialisasi tetap diperlukan pada staging.
- Refund sandbox diselesaikan oleh maintenance processor dan memperbarui aggregate secara
  terkunci. Pelunasan online memakai deadline venue serta grace 30 menit. Provider refund
  eksternal tetap memerlukan acceptance staging.
