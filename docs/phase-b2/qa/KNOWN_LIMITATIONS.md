# Known Limitations Phase B2 Lokal

- Email lokal berhenti pada delivery `CAPTURED` di database; tidak ada provider SMTP.
- Payment, refund, commission, ledger, dan payout adalah sandbox/simulasi. Payout tidak
  memanggil transfer bank.
- Snapshot B2 menghitung gateway fee dari provider/config source of truth. Data seed B1
  lama dapat tetap bernilai nol karena adapter legacy tidak membawa metadata fee.
- Export dibuat sinkron untuk dataset lokal dan tidak mempunyai queue/history/object
  storage karena tidak diwajibkan PRD B2.
- Review tidak mendukung foto. Support tidak mendukung attachment, WhatsApp, atau live
  chat sesuai batas scope.
- Satu currency Rupiah; tidak ada tax engine, accounting integration, KYC, atau real
  payout account.
- Google OIDC, Midtrans live, provider email, Vercel, TiDB, dan Tigris tidak termasuk
  gate lokal B2.
- QA manual External Chrome dan matriks 24 screenshot telah selesai. Playwright/axe
  tetap dipakai sebagai bukti pendukung, bukan pengganti inspeksi manual.
- `ExcelJS 4.4.0` membawa `uuid 8.3.2` dengan dua advisory Moderate untuk API UUID
  v3/v5/v6 ketika caller memberi buffer. Implementasi export hanya memakai ExcelJS dan
  jalur dependency tersebut hanya memanggil `uuid.v4()` tanpa buffer. Tidak ada versi
  ExcelJS stabil yang menarik UUID aman, sedangkan `npm audit fix --force` menyarankan
  downgrade breaking. Gate otomatis tetap gagal untuk High/Critical. Project Owner
  menerima finding ini sebagai `Accepted Risk` untuk Phase B2 lokal pada 30 Agustus 2026;
  review ulang dilakukan saat tersedia upgrade ExcelJS yang aman, penggunaan UUID
  berubah, atau sebelum keputusan deployment production.
