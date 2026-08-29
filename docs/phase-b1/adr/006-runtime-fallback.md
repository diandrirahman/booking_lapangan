# ADR-006 — Runtime fallback realtime

Status: fallback dipilih.

Vercel Function mempunyai maximum duration sehingga koneksi SSE tidak dapat dianggap
persisten. API, SSE, dan worker B1 ditargetkan ke runtime Node always-on; frontend tetap
dapat berada di Vercel dan kontrak `/api/v1` tidak berubah.

SSE tidak memakai timeout Vercel. Reconnect diuji dengan kegagalan koneksi terkontrol.
Spike lokal membuktikan reconnect, full resync, stale-event guard, serta REST fallback;
latency delivery maksimal dua detik harus diukur ulang pada environment staging.
