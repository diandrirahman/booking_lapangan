# ADR-004 — Payment adapter

Status: diterima untuk sandbox.

Local payment intent selalu tersimpan sebelum provider dipanggil. Setiap retry,
DP, balance, atau reservation payment membuat attempt baru. Webhook diverifikasi
dan diproses idempotent melalui provider-event inbox. Pembayaran terlambat dicatat,
tetapi tidak menghidupkan booking expired dan membuat automatic refund simulasi.
