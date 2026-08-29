# Riwayat Masalah MapLibre dan Penggantian Leaflet

**Status per 28 Agustus 2026: diganti dengan Leaflet.** Catatan akar masalah di
bawah dipertahankan agar kegagalan yang sama tidak terulang.

Tanggal ditemukan: 2026-08-27.

## Gejala

Peta pencarian venue hanya menampilkan bidang abu-abu, kontrol navigasi, dan marker.
Jalan, label wilayah, serta attribution tidak terlihat. Marker yang tidak dipilih tampak
seperti lingkaran putih.

## Penyebab

1. `VenueMap` memberi MapLibre style dengan `sources: {}` dan hanya satu background
   layer. MapLibre adalah renderer dan tidak menyediakan basemap secara otomatis.
2. Marker memakai token CSS `--primary` dan `--shadow-md`, sementara design system
   menyediakan `--brand` dan `--shadow`. Deklarasi yang tidak valid membuat marker
   biasa kehilangan fill dan shadow.
3. Adapter API mengubah latitude/longitude menjadi persentase presentasi, kemudian
   komponen peta mengubahnya kembali ke bounding box Jakarta. Akibatnya koordinat
   database bukan lagi sumber posisi authoritative.
4. Inisialisasi MapLibre tetap dianggap berhasil karena background layer dapat dirender.
   Oleh sebab itu SVG fallback tidak aktif walaupun basemap tidak tersedia.
5. Attribution dimatikan sebelum sumber basemap dan kebijakan attribution ditentukan.

## Perbaikan yang diwajibkan

- Pilih provider/style basemap untuk local, staging, dan production; konfigurasi URL atau
  key melalui environment dan jangan hard-code credential.
- Implementasi pengganti mengirim koordinat WGS84 dari API langsung ke Leaflet
  tanpa konversi persentase.

## Keputusan pengganti

- `VenueMap` sekarang menggunakan Leaflet dan tile URL dari `VITE_MAP_TILE_URL`.
- Development/staging memakai standard OpenStreetMap tiles dengan attribution.
- Geolocation hanya berjalan setelah pengguna menekan tombol lokasi.
- Kegagalan tile menampilkan SVG lokal dan tombol retry.
- Standard OSM tiles bukan provider production; pemilihan provider production
  tetap menjadi release decision terpisah.
- Gunakan token `--brand` dan `--shadow` untuk marker serta pertahankan selected state.
- Aktifkan attribution sesuai lisensi provider.
- Perlakukan kegagalan style/tile sebagai error yang dapat menampilkan SVG fallback dan
  tombol retry, bukan hanya menangkap kegagalan dynamic import.
- Tambahkan test marker/card sync, geolocation denied, style load failure, dan responsive
  overflow.

## Acceptance

- Jalan dan label lokasi terlihat pada peta normal.
- Marker berada pada koordinat API yang sama dan kartu terpilih tetap tersinkron.
- Tidak ada marker transparan pada light maupun dark mode.
- Penolakan geolocation tidak menghalangi pencarian manual.
- Attribution terlihat dan SVG fallback muncul saat style/tile gagal.
