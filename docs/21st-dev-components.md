# Adaptasi komponen 21st.dev

Dokumen ini mencatat pola 21st.dev yang dipakai sebagai referensi visual dan interaksi pada prototype LapanganGo. Implementasinya tidak disalin sebagai template utuh: struktur, API komponen, aksesibilitas, dan styling disesuaikan dengan design token serta kebutuhan domain LapanganGo.

| Referensi | Adaptasi LapanganGo | Lokasi |
| --- | --- | --- |
| [Calendar Dropdown — coss](https://21st.dev/community/components/coss.com/calendar/dropdown) | Date picker berbahasa Indonesia di pencarian customer dan kartu booking venue | `frontend/src/components/DatePicker.tsx` |
| [Basic Data Table — HextaUI](https://21st.dev/@preetsuthar17/components/basic-data-table) | Tabel booking dengan pencarian, sorting, dan pagination | `frontend/src/components/DataTable.tsx` |
| [Fullscreen Calendar — ahmedmayara](https://21st.dev/community/components/ahmedmayara/fullscreen-calendar/default) | Kalender operasi dengan tampilan hari dan bulan | `frontend/src/components/OperationsMonthCalendar.tsx` |
| [Animated Hero collection](https://21st.dev/community/components/s/animated-hero-section) | Reveal bertahap, image drift yang halus, dan dukungan `prefers-reduced-motion` | `frontend/src/pages/CustomerPages.tsx`, `frontend/src/styles.css` |
| [React Image Gallery collection](https://21st.dev/community/components/explore/react-image-gallery) dan [Lightbox collection](https://21st.dev/community/components/s/lightbox) | Galeri venue dengan depth/tilt ringan dan lightbox keyboard-accessible | `frontend/src/components/InteractiveGallery.tsx` |
| [Collapsible Sidebar collection](https://21st.dev/community/components/explore/collapsible-sidebar) | Sidebar Business/Admin yang dapat diringkas tanpa mengubah status route aktif | `frontend/src/components/AppShell.tsx` |
| [Select — shadcn](https://21st.dev/community/components/shadcn/select/default) | Dropdown berbasis Radix dengan keyboard navigation, focus state, portal, dan varian ringkas untuk hero | `frontend/src/components/SelectField.tsx` |
| [Animated Theme Toggle Button](https://21st.dev/@arunachalam/components/animated-theme-toggle-button) | Tombol matahari/bulan dengan CSS ringan, preferensi tersimpan, dan dukungan reduced motion | `frontend/src/components/ThemeToggle.tsx`, `frontend/src/theme/ThemeProvider.tsx` |
| [Property Card — LaviKatiyar](https://21st.dev/@lavikatiyar/components/card-3) | Kartu Favorit image-forward untuk Venue dan Mabar dengan metadata domain serta aksi hapus yang eksplisit | `frontend/src/pages/CustomerEngagementPages.tsx` |
| [Notification Inbox Popover — Ruixen UI](https://21st.dev/community/components/ruixenui/notification-inbox-popover/default) | Inbox header dan feed penuh dengan tab Semua/Belum dibaca, unread dot, timestamp, deep-link, dan tandai semua dibaca | `frontend/src/components/NotificationInbox.tsx`, `frontend/src/pages/CustomerEngagementPages.tsx` |

## Kenapa Interactive Checkout tidak dipakai

[Interactive Checkout](https://21st.dev/community/components/kokonutd/interactive-checkout/default) memakai mental model keranjang belanja: banyak produk, kuantitas, tambah/hapus item, dan total yang berubah karena isi cart. LapanganGo memakai satu snapshot reservasi yang terikat pada venue, lapangan, tanggal, slot berurutan, status ketersediaan, dan batas waktu pembayaran.

Memakai komponennya secara utuh akan membuat checkout terlihat seperti e-commerce dan berisiko menyamarkan aturan slot serta hold. Pola yang masih relevan—transisi ringkasan, pemilihan metode pembayaran, dan feedback proses—dapat diadaptasi secara terpisah tanpa membawa perilaku cart.

## Batasan implementasi

- Seluruh gambar penting tetap berupa aset lokal.
- Animasi menggunakan CSS ringan; tidak ada Three.js, WebGL, atau request jaringan bisnis.
- Efek perspektif dinonaktifkan pada layar sentuh kecil dan seluruh motion dikurangi ketika pengguna memilih `prefers-reduced-motion`.
- Primitive popover/dialog tetap memakai Radix agar pengelolaan fokus dan keyboard konsisten.
