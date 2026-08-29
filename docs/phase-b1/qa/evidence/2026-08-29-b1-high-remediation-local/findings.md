# Status Finding Setelah Remediasi High

## Closed

- `B1-SEC-LOCAL-001` — webhook Midtrans mencapai signature verification tanpa browser
  Origin dan tetap idempotent.
- `B1-SEC-LOCAL-003` — Redis outage tidak menjatuhkan API; session gagal tertutup dan
  REST publik tetap tersedia.
- `B1-SEC-LOCAL-004` — signed upload hanya untuk Owner venue yang sesuai dan completion
  memvalidasi namespace, metadata, ukuran, tipe, serta magic bytes.
- `B1-ENV-LOCAL-001` — WebP dapat diunggah ke MinIO melalui External Chrome.
- `B1-OPS-LOCAL-001` — Admin Audit memakai data server nyata dan menampilkan detail
  before/after.

## Medium backlog pada saat putaran High

- `B1-SEC-LOCAL-002` — **Closed** pada remediasi Medium; oversized JSON menjadi `413`.
- `B1-AUTHZ-LOCAL-001` — **Closed**; list venue Staff mengikuti assignment server.
- `B1-OPS-LOCAL-002` — **Closed**; outstanding memakai shared collectible rule.
- `B1-BKG-LOCAL-001` — **Closed**; feedback/persistensi no-show server-backed.
- `B1-SRC-LOCAL-001` — **Closed**; catalog memakai live bookable nearest slot.

Daftar ini dipertahankan sebagai histori putaran High. Bukti penutupan ada di
[`../2026-08-29-b1-medium-remediation-local/`](../2026-08-29-b1-medium-remediation-local/README.md).
