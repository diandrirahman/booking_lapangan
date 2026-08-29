# ADR-003 — Slot reservation

Status: diterima.

Checkout mengunci court dan slot, memvalidasi ulang jadwal/harga, lalu menulis
booking, price lines, active reservation, history, dan outbox dalam satu transaction.
Primary key `booking_slot_reservations.court_slot_id` adalah guard terakhir terhadap
double booking. Hold sepuluh menit dapat kedaluwarsa pada read/command maupun job.
