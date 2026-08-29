# ADR-005 — Outbox dan SSE

Status: diterima.

Domain mutation dan outbox ditulis dalam transaction yang sama. Publisher idempotent
mengirim event melalui Redis setelah commit. SSE hanya sinyal; client mengabaikan
version lama, reconnect secara eksponensial, melakukan full resync, lalu REST
refetch. Kegagalan Redis/SSE tidak mengubah kebenaran MySQL atau memblokir REST.
