# Traceability 43 Requirement Phase B2

Status `complete-local` berarti source of truth server, UI server-backed, contract,
bukti otomatis, dan bukti manual lokal tersedia serta local readiness telah diterima
Project Owner. Dependency Medium tetap tercatat sebagai `Accepted Risk`.

## Commission

| ID         | Status         | Implementasi                                                  | Bukti otomatis                       | Bukti manual |
| ---------- | -------------- | ------------------------------------------------------------- | ------------------------------------ | ------------ |
| B2-COM-001 | complete-local | `FinanceService.createCommissionConfig`, Admin Commission UI  | finance unit/integration, contract   | QA manual    |
| B2-COM-002 | complete-local | config versioned dengan nullable tenant, reason dan audit     | integration/security                 | QA manual    |
| B2-COM-003 | complete-local | resolver trial hari/completed booking                         | `calculateFinancialSnapshot.test.ts` | QA manual    |
| B2-COM-004 | complete-local | funding gateway dan subsidy cap/period pada config snapshot   | finance unit/integration             | QA manual    |
| B2-COM-005 | complete-local | satu pure calculation untuk commission base dan funding promo | finance unit                         | QA manual    |
| B2-COM-006 | complete-local | snapshot immutable, ledger reversal, earning lifecycle        | integration/idempotency              | QA manual    |

## Promotion

| ID         | Status         | Implementasi                                                       | Bukti otomatis          | Bukti manual |
| ---------- | -------------- | ------------------------------------------------------------------ | ----------------------- | ------------ |
| B2-PRO-001 | complete-local | promo platform/tenant dengan scope server-side                     | integration/security    | QA manual    |
| B2-PRO-002 | complete-local | type, limit, tanggal/jam, quota, user, payment, dan scope existing | integration/contract    | QA manual    |
| B2-PRO-003 | complete-local | code normalized, satu redemption per booking                       | integration/concurrency | QA manual    |
| B2-PRO-004 | complete-local | platform budget, subsidy cap, period, dan auto exhausted           | concurrency 50 request  | QA manual    |
| B2-PRO-005 | complete-local | lock promo + reservation/consume/release transaksional             | concurrency 50 request  | QA manual    |
| B2-PRO-006 | complete-local | promo line, funding source, dan config ID pada snapshot            | finance integration     | QA manual    |

## Refund dan Reschedule

| ID         | Status         | Implementasi                                                       | Bukti otomatis                 | Bukti manual |
| ---------- | -------------- | ------------------------------------------------------------------ | ------------------------------ | ------------ |
| B2-REF-001 | complete-local | template/tier Admin dan assignment venue                           | migration/integration/contract | QA manual    |
| B2-REF-002 | complete-local | baseline 24h/6h berbasis timezone venue                            | cancellation policy unit       | QA manual    |
| B2-REF-003 | complete-local | customer auto, owner exception, admin decision + actor/reason      | integration/audit              | QA manual    |
| B2-REF-004 | complete-local | decision terpisah dari execution, manual/failed/retry              | integration/idempotency        | QA manual    |
| B2-REF-005 | complete-local | aggregate cap terhadap successful paid amount                      | integration/security           | QA manual    |
| B2-REF-006 | complete-local | closure/system refund melalui `RefundService` dan reversal finance | integration                    | QA manual    |
| B2-REF-007 | complete-local | satu reschedule, 24 jam, slot baru dikunci sebelum lama dilepas    | integration/concurrency        | QA manual    |
| B2-REF-008 | complete-local | snapshot policy asal dan rule lebih ketat                          | policy unit/integration        | QA manual    |
| B2-REF-009 | complete-local | late payment membuat refund tanpa revive expired booking           | payment lifecycle integration  | QA manual    |

## Finance

| ID         | Status         | Implementasi                                                | Bukti otomatis               | Bukti manual |
| ---------- | -------------- | ----------------------------------------------------------- | ---------------------------- | ------------ |
| B2-FIN-001 | complete-local | immutable financial snapshot per booking version            | finance unit/integration     | QA manual    |
| B2-FIN-002 | complete-local | fixed account code, immutable double-entry ledger           | balanced-ledger integration  | QA manual    |
| B2-FIN-003 | complete-local | PENDING/AVAILABLE/RESERVED/PAID_OUT/REVERSED earning        | integration/maintenance      | QA manual    |
| B2-FIN-004 | complete-local | weekly dan manual sandbox payout, minimum default Rp100.000 | integration/security         | QA manual    |
| B2-FIN-005 | complete-local | negative adjustment dan payout hold saat balance negatif    | integration                  | QA manual    |
| B2-FIN-006 | complete-local | finance read model dashboard/filter/venue/court/trend       | integration/E2E              | QA manual    |
| B2-FIN-007 | complete-local | payout/ledger/export berlabel simulasi tanpa transfer       | E2E                          | QA manual    |
| B2-FIN-008 | complete-local | dispute support membekukan earning terkait                  | support integration          | QA manual    |
| B2-FIN-009 | complete-local | tujuh dataset CSV native dan XLSX ExcelJS                   | signature/export integration | QA manual    |

## Permission

| ID          | Status         | Implementasi                                                            | Bukti otomatis                | Bukti manual          |
| ----------- | -------------- | ----------------------------------------------------------------------- | ----------------------------- | --------------------- |
| B2-PERM-001 | complete-local | lima template global immutable dan copy tenant                          | integration/E2E               | QA manual             |
| B2-PERM-002 | complete-local | role tenant dan 15 permission B2                                        | integration/security          | QA manual             |
| B2-PERM-003 | complete-local | venue assignment dipakai query dan mutation guard                       | tenant isolation security/E2E | QA manual             |
| B2-PERM-004 | complete-local | hard guard Primary Owner untuk aksi nondelegable                        | security/E2E                  | QA manual             |
| B2-PERM-005 | complete-local | audit existing: before/after, actor, scope, time, request/IP/UA, reason | integration/security          | inspeksi audit manual |

## Notification

| ID         | Status         | Implementasi                                         | Bukti otomatis               | Bukti manual       |
| ---------- | -------------- | ---------------------------------------------------- | ---------------------------- | ------------------ |
| B2-NOT-001 | complete-local | in-app + DB email capture; critical forced enabled   | notification integration/E2E | QA manual          |
| B2-NOT-002 | complete-local | Admin reminder options, venue selection, seed 24h/2h | migration/integration        | QA manual          |
| B2-NOT-003 | complete-local | unique event/user/channel delivery + preferences     | integration/unit             | QA manual realtime |

## Review dan Support

| ID         | Status         | Implementasi                                                 | Bukti otomatis         | Bukti manual |
| ---------- | -------------- | ------------------------------------------------------------ | ---------------------- | ------------ |
| B2-REV-001 | complete-local | ownership + COMPLETED + unique booking review                | integration            | QA manual    |
| B2-REV-002 | complete-local | rating total dan enam aspek/comment tanpa foto               | migration/contract/E2E | QA manual    |
| B2-REV-003 | complete-local | edit 7 hari, owner reply, report, Admin hide/restore         | integration/security   | QA manual    |
| B2-SUP-001 | complete-local | ticket category/reference/thread dan controlled dispute flag | integration/security   | QA manual    |
| B2-SUP-002 | complete-local | Admin assignment/status/resolution dan audit                 | integration/E2E        | QA manual    |

## Ringkasan

- Requirement B2 terpetakan: **43/43**.
- Implementasi + automated + manual evidence: **43/43 `complete-local`**.
- Matriks visual baseline: **24/24 lulus**; alur empat role selesai di External Chrome.
- Retest UI delta: **87 screenshot lulus**.
- `complete-local`: **43/43**, diterima Project Owner pada 30 Agustus 2026.
- Scope staging dan provider live tidak dihitung dalam local readiness B2.

## Catatan staging 30–31 Agustus 2026

Status `complete-local` 43/43 tidak berubah. Deployment dan visual matrix staging
24/24 lulus. Finding `B2-NOT-STG-001` dan empat finding promotion/notification hasil
review P1/P2 telah diremediasi dengan regression test, full local gate, redeploy, dan
targeted staging retest. Preference email reminder tetap `false` setelah GET, dialog
dibuka ulang, dan reload; Staff promotion boundary menghasilkan `403`; forged platform
promo menghasilkan `422`. Baseline staging tersebut lulus dan dilanjutkan dengan
targeted retest source terbaru.

Setelah baseline tersebut, remediation finance/idempotency menambah migration `0008`
dan regression untuk ledger refund, earning/payout, reschedule, tenant/venue boundary,
serta mutation replay. Seluruh 43 status `complete-local` tetap berlaku dan full local
gate lulus tanpa P1/P2 aktif. Bukti staging baseline belum mewakili delta ini; source
terbaru harus dideploy dan menjalani targeted staging retest sebelum keputusan final
Project Owner.

Targeted retest tersebut selesai pada source `9ed32bb...`: migration `0008` forward-only,
API `sin1`, web, dan same-origin health lulus; Staff/Admin Playwright 2/2; finance read
Owner `200`; create idempotency mereplay resource sama dan menolak payload berbeda
dengan `409`; HTTP `500` bersih. Follow-up runtime log menemukan P2 `B2-RT-STG-002`:
SSE diputus Vercel pada 300 detik. Planned close 240 detik lulus full local gate dan
staging long-run 250 detik; deployment final `d4e8bef...` di `sin1` tidak mempunyai error
atau HTTP `500`. `B2-RT-STG-002` Closed dan tidak ada P1/P2 aktif. Project Owner
memberikan keputusan final staging `Diterima` pada 31 Agustus 2026; Phase B2 diterima
untuk lokal dan staging.
