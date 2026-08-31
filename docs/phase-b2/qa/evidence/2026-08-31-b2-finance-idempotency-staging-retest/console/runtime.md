# Runtime dan deployment summary

- API stable deployment `dpl_7aMdfQLfV2DXfrakEuRxJoZSvHgD`: Ready, function region
  `sin1`.
- Web stable deployment `dpl_DkqVPw5PhKhE7tfgupKmcZhC8S5j`: Ready.
- API live: `200`.
- API readiness: `200`.
- Web root: `200`.
- Same-origin `/api/v1/health/ready`: `200`.
- Runtime error logs deployment final setelah long-run 250 detik: tidak ada.
- Runtime HTTP `500` logs deployment final: tidak ada.

Output migration terverifikasi pada build terisolasi:
`Migration schema numerik selesai.` Nilai environment dan credential tidak disalin ke
evidence.

Deployment sebelumnya mempunyai 14 timeout setelah stream aktif 300 detik. Planned close
240 detik kemudian dideploy; test 250 detik membuktikan halaman dan session tetap sehat,
dan log deployment final bersih. Tidak ada credential dari raw runtime log disalin ke
evidence.
