# Runtime dan deployment summary

- API stable deployment `dpl_9pDwU27JiRdvULSQ7QDVJnJ1Naqq`: Ready, function region
  `sin1`.
- Web stable deployment `dpl_BsdCU8wX1QfPeTtNiHJyTd9ZBfRT`: Ready.
- API live: `200`.
- API readiness: `200`.
- Web root: `200`.
- Same-origin `/api/v1/health/ready`: `200`.
- Runtime error logs setelah follow-up query: 14 timeout pada `GET /api/v1/events`.
- Runtime HTTP `500` logs sejak deployment: tidak ada.

Output migration terverifikasi pada build terisolasi:
`Migration schema numerik selesai.` Nilai environment dan credential tidak disalin ke
evidence.

Timeout terjadi setelah stream aktif 300 detik dan Vercel menghentikan function. Tidak
ada credential dari raw runtime log disalin ke evidence. Finding ini menahan technical
gate sampai planned close 240 detik dideploy dan diverifikasi.
