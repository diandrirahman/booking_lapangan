# Findings Phase B2 P1/P2 Remediation

| ID              | Prioritas | Temuan                                                              | Disposition | Bukti                                                                         |
| --------------- | --------- | ------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------- |
| B2-PRO-SEC-001  | P1        | Business API menerima funding promo platform                        | Closed      | forged request `422`; security regression                                     |
| B2-PRO-TEN-002  | P1        | Scope/list promo tidak mengikuti tenant dan venue assignment        | Closed      | cross-venue `403`; Owner valid `201`; Staff UI forbidden; security regression |
| B2-PRO-IDEM-003 | P1        | Namespace idempotency promo/commission tidak tenant-scoped          | Closed      | same/cross-tenant dan legacy regression lulus                                 |
| B2-NOT-STG-001  | P2        | Preference email reminder kembali aktif setelah refetch/reload      | Closed      | PUT `204`, GET boolean `false`, dialog dan reload tetap nonaktif              |
| B2-NOT-CON-002  | P2        | Contract/event allowlist dan feedback UI preference terlalu longgar | Closed      | unknown event `422`, critical `409`, typed client dan UI regression lulus     |

Tidak ada finding Blocker/Critical/High/Medium baru dari targeted staging retest.
Staff demo tidak memiliki permission `promotions.manage`; respons `403` adalah expected
RBAC dan merupakan boundary yang lebih ketat, bukan kegagalan venue isolation.
