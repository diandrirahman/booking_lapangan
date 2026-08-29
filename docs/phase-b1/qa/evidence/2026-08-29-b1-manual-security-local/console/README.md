# Console dan API error inspection

- Supporting Playwright matrix: 16/16 test lulus; setiap test memantau uncaught page
  error dan API response `>=500` pada kondisi normal.
- Hasil per role/viewport ada di `../matrix/results/`; seluruh `pageErrors` dan
  `serverErrors` kosong.
- External Chrome secara manual memperlihatkan error `Failed to fetch` ketika upload
  WebP MinIO dan state katalog kosong ketika Redis dihentikan. Keduanya dicatat sebagai
  temuan terbuka, bukan disembunyikan oleh hasil matrix normal.
