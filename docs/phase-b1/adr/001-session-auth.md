# ADR-001 — Session dan authentication

Status: diterima.

Password memakai Argon2id. Session ID acak disimpan sebagai hash key di Redis dan
dikirim lewat cookie HttpOnly, SameSite=Lax, serta Secure pada production. Login,
logout, privilege change, dan account linking menjadi boundary rotasi session.
Google OIDC memverifikasi issuer, audience, nonce, dan email verification. Identity
dengan email yang sudah ada hanya dapat ditautkan setelah password reauthentication.
