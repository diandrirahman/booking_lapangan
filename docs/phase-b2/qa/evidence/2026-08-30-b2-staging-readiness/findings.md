# Findings Phase B2 Staging Readiness

## B2-NOT-STG-001 — Notification preference tidak persisten

- Severity: **Medium**
- Status: **Open**
- Role: Customer
- Route: `/notifications`
- Environment: staging, External Chrome, desktop light
- Requirement terkait: `B2-NOT-001`, `B2-NOT-003`

Langkah reproduksi:

1. Login sebagai Customer.
2. Buka Notifikasi lalu dialog `Atur preferensi`.
3. Matikan `Reminder bermain melalui email`.
4. Tunggu response/refetch, kemudian reload halaman dan buka dialog kembali.

Expected: preference tetap nonaktif sampai Customer mengaktifkannya kembali.

Actual: checkbox sempat nonaktif, kemudian kembali aktif setelah refetch dan tetap aktif
setelah reload. Tidak ada console error dan tidak ada API `5xx` pada rentang QA.

Impact: Customer tidak dapat mempercayai perubahan channel notification non-critical.
Critical notification tetap dipaksa aktif dan tidak ada tenant/data leakage, sehingga
severity ditetapkan Medium.

Evidence: `flows/customer/customer-notification-preference-reverted.png`.

## Disposition

Visual matrix lulus 24/24. Empat submission lain lulus. Staging technical gate tetap
terbuka sampai root cause diperbaiki dan preference diuji ulang terhadap source of truth
server. Finding ini belum diterima sebagai risiko oleh Project Owner.
