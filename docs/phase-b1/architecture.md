# Arsitektur Phase B1

Phase B1 memakai npm workspace dengan tiga boundary: `frontend` untuk presentasi,
`packages/api-client` untuk kontrak OpenAPI, dan `backend` untuk aturan aplikasi
serta adapter. MySQL adalah sumber kebenaran. Redis tidak pernah mengesahkan
booking atau payment.

```mermaid
flowchart LR
  UI[React + TanStack Query] --> Client[Generated API client]
  Client --> HTTP[Express controllers]
  HTTP --> App[Application services]
  App --> Domain[Pure domain rules]
  App --> DB[(MySQL 8)]
  App --> Redis[(Redis)]
  App --> S3[(S3 / MinIO)]
  App --> Pay[Midtrans adapter]
  DB --> Outbox[Transactional outbox]
  Outbox --> Redis
  Redis --> SSE[SSE signal]
  SSE --> UI
  UI -->|authoritative refetch| HTTP
```

## Dependency rule

- Controller memvalidasi transport dan meneruskan command.
- Application service mengatur transaction dan authorization-aware workflow.
- Domain helper menyimpan invariant tanpa bergantung Express, Drizzle, atau React.
- Repository/provider adapter menghadap infrastruktur.
- React component menggunakan API client; tidak ada `fetch` langsung pada feature.

## Booking, payment, dan realtime

```mermaid
sequenceDiagram
  participant UI
  participant API
  participant DB
  participant Provider
  participant Redis
  UI->>API: POST /bookings + Idempotency-Key
  API->>DB: lock + validate + HOLD + reservation + outbox
  DB-->>API: commit
  API-->>UI: booking snapshot
  UI->>API: POST /payment-attempts
  API->>DB: persist local intent
  API->>Provider: create sandbox payment
  Provider-->>API: redirect/reference
  Provider->>API: signed webhook
  API->>DB: inbox + transition + outbox (transaction)
  API->>Redis: best-effort publish after commit
  Redis-->>UI: SSE signal
  UI->>API: REST refetch
```
