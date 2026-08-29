# Status Lima Finding Medium Setelah Remediasi

## Closed

- `B1-AUTHZ-LOCAL-001` — endpoint list venue memakai hasil tenant access. Owner melihat
  seluruh venue; Staff hanya assignment; Staff tanpa assignment menerima `items: []`.
- `B1-SEC-LOCAL-002` — body `1 MB + 1 byte` ditolak dengan HTTP `413`, kode
  `PAYLOAD_TOO_LARGE`, pesan aman, dan request ID.
- `B1-OPS-LOCAL-002` — query `outstandingOnly=true`, dashboard, dan settlement memakai
  aturan kolektibilitas yang sama.
- `B1-BKG-LOCAL-001` — `attendanceStatus` berasal dari server, no-show memiliki feedback
  live, dan booking tidak lagi muncul sebagai kedatangan berikutnya.
- `B1-SRC-LOCAL-001` — nearest slot dihitung dari slot aktif dan bookable setelah waktu
  request, termasuk lead time, booking window, reservation, dan operational block.

Kelima status hanya ditutup setelah targeted test, `qa:b1:local`, serta External Chrome
lulus. Tidak ada finding Blocker/Critical/High/Medium terbuka pada gate lokal.
