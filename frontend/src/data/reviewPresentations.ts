export interface ReviewPresentation {
  id: string;
  author: string;
  date: string;
  rating: number;
  court: string;
  comment: string;
  highlights: string[];
}

export const reviewPresentations: ReviewPresentation[] = [
  {
    id: "review-nadia",
    author: "Nadia Putri",
    date: "24 Agustus 2026",
    rating: 5,
    court: "Booking terverifikasi · Badminton",
    comment:
      "Court terawat, staf sigap, dan proses check-in cepat. Pencahayaan lapangannya juga nyaman untuk bermain malam.",
    highlights: ["Court terawat", "Check-in cepat"],
  },
  {
    id: "review-raka",
    author: "Raka Mahendra",
    date: "18 Agustus 2026",
    rating: 5,
    court: "Booking terverifikasi · Padel",
    comment:
      "Jadwal sesuai aplikasi dan staf langsung membantu saat kami tiba. Area tunggunya bersih dan tidak terlalu ramai.",
    highlights: ["Jadwal akurat", "Staf membantu"],
  },
  {
    id: "review-salsa",
    author: "Salsa Anindya",
    date: "11 Agustus 2026",
    rating: 4,
    court: "Booking terverifikasi · Basket",
    comment:
      "Pengalaman booking sangat mudah. Akan lebih nyaman jika pilihan minuman di area venue ditambah.",
    highlights: ["Booking mudah", "Venue nyaman"],
  },
];

export const ratingDistribution = [
  { stars: 5, percentage: 76 },
  { stars: 4, percentage: 18 },
  { stars: 3, percentage: 4 },
  { stars: 2, percentage: 1 },
  { stars: 1, percentage: 1 },
] as const;
