import heroImage from "../assets/hero-lapangango.webp";
import arenaImage from "../assets/venue-arena-cendana.webp";
import soccerImage from "../assets/venue-soccer-hub.webp";
import padelImage from "../assets/venue-padel-senayan.webp";
import hoopsImage from "../assets/venue-hoops-kemang.webp";
import tennisImage from "../assets/venue-tennis-menteng.webp";
import miniSoccerImage from "../assets/venue-mini-soccer.webp";
import mabarBadminton from "../assets/mabar-badminton.webp";
import mabarFutsal from "../assets/mabar-futsal.webp";
import type {
  Booking,
  Court,
  Mabar,
  Notification,
  PrototypeRole,
  PrototypeState,
  Slot,
  Tenant,
  Venue,
} from "../domain/types";

export { heroImage };
export const galleryImages = [arenaImage, heroImage, padelImage];
export const roleLabels: Record<PrototypeRole, string> = {
  customer: "Customer",
  owner: "Owner",
  staff: "Staff",
  admin: "Admin Platform",
};
export const sports = [
  "Badminton",
  "Futsal",
  "Padel",
  "Basket",
  "Tenis",
  "Mini Soccer",
  "Voli",
  "Tenis Meja",
];

export const venues: Venue[] = [
  {
    id: "v1",
    slug: "arena-cendana",
    tenantId: "t1",
    name: "Arena Cendana",
    location: "Kemang, Jakarta Selatan",
    distance: "2,4 km",
    sport: "Badminton",
    rating: 4.9,
    reviewCount: 284,
    priceFrom: 85000,
    nextSlot: "Hari ini, 19.00",
    image: arenaImage,
    status: "published",
    facilities: ["Parkir luas", "Ruang ganti", "Shower", "Kafe"],
    lat: -6.2607,
    lng: 106.816,
  },
  {
    id: "v2",
    slug: "soccer-hub-cilandak",
    tenantId: "t1",
    name: "Soccer Hub Cilandak",
    location: "Cilandak, Jakarta Selatan",
    distance: "4,1 km",
    sport: "Futsal",
    rating: 4.8,
    reviewCount: 193,
    priceFrom: 180000,
    nextSlot: "Besok, 18.00",
    image: soccerImage,
    status: "published",
    facilities: ["Tribun", "Parkir", "Mushola"],
    lat: -6.2924,
    lng: 106.7993,
  },
  {
    id: "v3",
    slug: "padel-park-senayan",
    tenantId: "t2",
    name: "Padel Park Senayan",
    location: "Senayan, Jakarta Pusat",
    distance: "5,8 km",
    sport: "Padel",
    rating: 4.9,
    reviewCount: 321,
    priceFrom: 220000,
    nextSlot: "Hari ini, 20.00",
    image: padelImage,
    status: "published",
    facilities: ["Kafe", "Pro shop", "Shower"],
    lat: -6.2186,
    lng: 106.8025,
  },
  {
    id: "v4",
    slug: "hoops-house-kemang",
    tenantId: "t2",
    name: "Hoops House Kemang",
    location: "Kemang, Jakarta Selatan",
    distance: "3,2 km",
    sport: "Basket",
    rating: 4.7,
    reviewCount: 98,
    priceFrom: 160000,
    nextSlot: "Sabtu, 10.00",
    image: hoopsImage,
    status: "published",
    facilities: ["AC", "Locker", "Tribun"],
    lat: -6.2615,
    lng: 106.8144,
  },
  {
    id: "v5",
    slug: "menteng-tennis-club",
    tenantId: "t3",
    name: "Menteng Tennis Club",
    location: "Menteng, Jakarta Pusat",
    distance: "7,4 km",
    sport: "Tenis",
    rating: 4.8,
    reviewCount: 142,
    priceFrom: 145000,
    nextSlot: "Besok, 07.00",
    image: tennisImage,
    status: "published",
    facilities: ["Coach", "Kafe", "Locker"],
    lat: -6.1944,
    lng: 106.8294,
  },
  {
    id: "v6",
    slug: "urban-kick-bsd",
    tenantId: "t3",
    name: "Urban Kick BSD",
    location: "BSD, Tangerang Selatan",
    distance: "18 km",
    sport: "Mini Soccer",
    rating: 4.6,
    reviewCount: 76,
    priceFrom: 250000,
    nextSlot: "Minggu, 16.00",
    image: miniSoccerImage,
    status: "in_review",
    facilities: ["Lounge", "Parkir", "Shower"],
    lat: -6.3018,
    lng: 106.6502,
  },
];

export const tenants: Tenant[] = [
  {
    id: "t1",
    name: "Cendana Sports Group",
    owner: "Andika Pratama",
    status: "verified",
  },
  {
    id: "t2",
    name: "Urban Athletic Club",
    owner: "Maya Kusuma",
    status: "verified",
  },
  {
    id: "t3",
    name: "Nusantara Arena",
    owner: "Bima Aditya",
    status: "pending",
  },
];

export const courts: Court[] = venues.flatMap((venue, venueIndex) =>
  [0, 1].map((index) => ({
    id: `c${venueIndex * 2 + index + 1}`,
    venueId: venue.id,
    name: `Lapangan ${index + 1}`,
    sport: venue.sport,
    surface: venue.sport === "Futsal" ? "Rumput sintetis" : "Premium vinyl",
    active: true,
  })),
);
export const slots: Slot[] = courts.slice(0, 4).flatMap((court, courtIndex) =>
  ["17.00", "18.00", "19.00", "20.00", "21.00", "22.00"].map((time, index) => ({
    id: `${court.id}-${time}`,
    courtId: court.id,
    time,
    price: 85000 + courtIndex * 15000,
    status: index === 2 ? "booked" : index === 4 ? "held" : "available",
  })),
);
export const customers = Array.from({ length: 30 }, (_, index) => ({
  id: `u${index + 1}`,
  name: ["Raka", "Nadia", "Fikri", "Alya", "Dimas"][index % 5] + ` ${index + 1}`,
  city: index % 2 ? "Jakarta" : "Tangerang",
}));
export const staff = Array.from({ length: 8 }, (_, index) => ({
  id: `s${index + 1}`,
  name: `Staff Operasional ${index + 1}`,
  permissions: index < 4 ? ["booking", "check-in"] : ["booking"],
}));
export const bookings: Booking[] = Array.from({ length: 50 }, (_, index) => ({
  id: `BK-${String(index + 1).padStart(4, "0")}`,
  customerId: `u${(index % 30) + 1}`,
  venueId: venues[index % venues.length].id,
  courtId: courts[index % courts.length].id,
  date: `2026-08-${String(27 + (index % 4)).padStart(2, "0")}`,
  slots: [`${17 + (index % 5)}.00`],
  amount: 85000 + (index % 6) * 25000,
  paymentStatus: index % 7 === 0 ? "dp" : index % 5 === 0 ? "unpaid" : "paid",
  status: index % 8 === 0 ? "pending" : index % 6 === 0 ? "completed" : "confirmed",
  source: index % 9 === 0 ? "offline" : "online",
}));
export const mabars: Mabar[] = Array.from({ length: 5 }, (_, index) => ({
  id: `MB-${index + 1}`,
  bookingId: bookings[index].id,
  host: ["Raka", "Nadia", "Fikri", "Alya", "Dimas"][index],
  title: [
    "Mabar Badminton Santai",
    "Futsal Jumat Seru",
    "Padel First Timer",
    "Basket After Office",
    "Mini Soccer Weekend",
  ][index],
  sport: venues[index].sport,
  venueId: venues[index].id,
  startsAt: [
    "Jumat, 19.00",
    "Jumat, 20.00",
    "Sabtu, 09.00",
    "Sabtu, 18.00",
    "Minggu, 16.00",
  ][index],
  capacity: index === 1 ? 10 : 6,
  participantIds: customers.slice(index, index + 3).map((c) => c.id),
  pendingApprovalIds: [],
  waitlistIds: [],
  status: "published",
  image: index % 2 ? mabarFutsal : mabarBadminton,
  level: index % 2 ? "Menengah" : "Semua level",
  price: 45000 + index * 10000,
  requireApproval: index % 2 === 0,
  announcements: [],
}));

const defaultSchedule = Object.fromEntries(
  ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"].map((day) => [
    day,
    { enabled: true, opensAt: "07:00", closesAt: "23:00" },
  ]),
);

const venueDrafts = Object.fromEntries(
  venues.map((venue) => [
    venue.id,
    {
      venueId: venue.id,
      contact: "0812 3456 7890",
      mediaReady: true,
      schedule: structuredClone(defaultSchedule),
      exceptions: [],
      bufferMinutes: 15,
      basePrice: venue.priceFrom,
      peakPrice: venue.priceFrom + 25_000,
      policies: ["DP minimum 30%", "Bayar di venue", "Reschedule maksimal H-1"],
    },
  ]),
);

export const notifications: Notification[] = [
  {
    id: "NOT-001",
    kind: "booking",
    title: "Booking Arena Cendana dikonfirmasi",
    body: "Lapangan 1 siap untuk Kamis, 27 Agustus pukul 17.00.",
    time: "5 menit lalu",
    actionHref: "/bookings/BK-0001",
    read: false,
  },
  {
    id: "NOT-002",
    kind: "payment",
    title: "Pembayaran simulasi berhasil",
    body: "Pembayaran booking BK-0002 telah tercatat sebagai lunas.",
    time: "32 menit lalu",
    actionHref: "/bookings/BK-0002",
    read: false,
  },
  {
    id: "NOT-003",
    kind: "system",
    title: "Pengingat jadwal bermain",
    body: "Sesi badmintonmu dimulai besok. Datang 15 menit lebih awal.",
    time: "2 jam lalu",
    actionHref: "/bookings/BK-0003",
    read: false,
  },
  {
    id: "NOT-004",
    kind: "verification",
    title: "Mabar menerima peserta baru",
    body: "Nadia bergabung ke Mabar Badminton Santai.",
    time: "Kemarin, 19.42",
    actionHref: "/mabar/MB-1",
    read: true,
  },
  {
    id: "NOT-005",
    kind: "booking",
    title: "Permintaan reschedule diperbarui",
    body: "Jadwal barumu telah disetujui oleh venue.",
    time: "Kemarin, 14.10",
    actionHref: "/bookings/BK-0004",
    read: true,
  },
];

export const initialState: PrototypeState = {
  role: "customer",
  scenario: "baseline",
  activeTenantId: "t1",
  venues,
  courts,
  slots,
  bookings,
  venueDrafts,
  tenants,
  mabars,
  favoriteVenueIds: ["v1", "v3", "v4"],
  favoriteMabarIds: ["MB-1", "MB-3"],
  notifications,
  selectedVenueId: venues[0].id,
  selectedSlots: [],
};
