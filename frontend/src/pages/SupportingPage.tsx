import {
  Bell,
  CircleDollarSign,
  FileClock,
  MessageSquareText,
  Plus,
  Search,
  Settings2,
  Tag,
  Users,
} from "lucide-react";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageTitle,
  ScenarioBoundary,
  SimulasiLabel,
} from "../components/ui";
import type { RouteDefinition } from "../routes/registry";
import { usePrototype } from "../store/PrototypeStore";

type DomainSource =
  "bookings" | "venues" | "mabars" | "notifications" | "static";

interface DomainScreenDefinition {
  description: string;
  action: string;
  source: DomainSource;
  items: string[];
  simulation?: boolean;
  emptyDescription: string;
}

const domainScreens: Record<string, DomainScreenDefinition> = {
  "/history": screen(
    "Venue yang baru dilihat tersimpan selama tab aktif.",
    "Bersihkan riwayat",
    "venues",
    [],
    "Riwayat akan muncul setelah membuka detail venue.",
  ),
  "/reviews": screen(
    "Berikan penilaian hanya untuk booking yang sudah selesai.",
    "Tulis review",
    "bookings",
    [],
    "Belum ada booking selesai yang dapat direview.",
  ),
  "/support": screen(
    "Pantau percakapan bantuan dan status penyelesaiannya.",
    "Buat tiket",
    "static",
    ["TKT-842 · Perubahan jadwal", "TKT-817 · Pembayaran tertunda"],
    "Belum ada tiket bantuan.",
  ),
  "/profile": screen(
    "Kelola identitas, preferensi olahraga, dan keamanan akun prototype.",
    "Simpan profil",
    "static",
    ["Profil Raka Mahendra", "Preferensi Badminton", "Kota Jakarta Selatan"],
    "Profil belum dilengkapi.",
  ),
  "/business/:tenant/finance": simulationScreen(
    "Ringkas GMV, pendapatan bersih, outstanding, dan payout tenant.",
    "Unduh ringkasan",
    [
      "GMV Agustus · Rp42.860.000",
      "Pendapatan bersih · Rp38.240.000",
      "Outstanding · Rp1.270.000",
    ],
  ),
  "/business/:tenant/finance/transactions": simulationScreen(
    "Telusuri transaksi masuk dan pelunasan per booking.",
    "Ekspor transaksi",
    ["TRX-0842 · Lunas", "TRX-0839 · DP", "TRX-0834 · Bayar di venue"],
  ),
  "/business/:tenant/finance/refunds": simulationScreen(
    "Tinjau refund, sengketa, alasan, dan nilai pengembalian.",
    "Catat refund",
    ["RFD-031 · Menunggu", "RFD-027 · Disetujui", "DSP-008 · Perlu bukti"],
  ),
  "/business/:tenant/finance/ledger": simulationScreen(
    "Lihat jurnal debit dan kredit dari fixture tenant.",
    "Ekspor ledger",
    ["LED-402 · Booking", "LED-401 · Komisi", "LED-398 · Refund"],
  ),
  "/business/:tenant/finance/payouts": simulationScreen(
    "Pantau jadwal dan status pencairan tenant.",
    "Jadwalkan payout",
    ["Payout Agustus · Dijadwalkan", "Payout Juli · Selesai"],
  ),
  "/business/:tenant/growth/promotions": screen(
    "Buat promo tenant dengan periode dan kuota eksplisit.",
    "Buat promosi",
    "static",
    ["WEEKEND10 · Aktif", "MEMBERBARU · Terjadwal"],
    "Belum ada promosi tenant.",
  ),
  "/business/:tenant/growth/reviews": screen(
    "Balas review venue dan tandai laporan untuk Admin.",
    "Balas review",
    "venues",
    [],
    "Belum ada review venue.",
  ),
  "/business/:tenant/growth/support": screen(
    "Kelola tiket customer yang terkait dengan venue aktif.",
    "Balas tiket",
    "static",
    ["TKT-842 · Jadwal", "TKT-829 · Fasilitas"],
    "Tidak ada tiket terbuka.",
  ),
  "/business/:tenant/growth/mabar": screen(
    "Pantau Mabar di venue tanpa mengubah peserta atau host.",
    "Lihat kalender Mabar",
    "mabars",
    [],
    "Belum ada Mabar di venue ini.",
  ),
  "/business/:tenant/team": screen(
    "Atur assignment venue dan permission operasional anggota tim.",
    "Undang anggota",
    "static",
    ["Sinta N. · Booking, Check-in", "Dio P. · Booking"],
    "Belum ada anggota tim.",
  ),
  "/business/:tenant/notifications": screen(
    "Kelola inbox operasional dan status sudah dibaca.",
    "Tandai semua dibaca",
    "notifications",
    [],
    "Tidak ada notifikasi operasional.",
  ),
  "/business/:tenant/settings": screen(
    "Simpan identitas organisasi dan preferensi workspace.",
    "Simpan pengaturan",
    "static",
    ["Cendana Sports Group", "Zona waktu Asia/Jakarta", "Bahasa Indonesia"],
    "Pengaturan organisasi belum tersedia.",
  ),
  "/admin/customers": screen(
    "Tinjau customer, aktivitas booking, dan status akun.",
    "Tambah catatan",
    "static",
    [
      "Nadia Putri · 8 booking",
      "Raka Mahendra · 12 booking",
      "Alya Prameswari · 5 booking",
    ],
    "Belum ada customer.",
  ),
  "/admin/masters/sports": screen(
    "Kelola olahraga, ikon, dan status publikasi katalog.",
    "Tambah olahraga",
    "static",
    ["Badminton · Aktif", "Futsal · Aktif", "Padel · Aktif", "Basket · Aktif"],
    "Belum ada master olahraga.",
  ),
  "/admin/masters/facilities": screen(
    "Kelola fasilitas yang dapat dipilih Owner pada profil venue.",
    "Tambah fasilitas",
    "static",
    ["Parkir luas", "Ruang ganti", "Shower", "Kafe"],
    "Belum ada master fasilitas.",
  ),
  "/admin/masters/scheduling": screen(
    "Atur interval slot, buffer, dan batas durasi prototype.",
    "Simpan interval",
    "static",
    [
      "Interval slot · 60 menit",
      "Buffer default · 15 menit",
      "Durasi maksimal · 3 jam",
    ],
    "Konfigurasi jadwal belum tersedia.",
  ),
  "/admin/templates/payments": simulationScreen(
    "Kelola copy status dan instruksi pembayaran sandbox.",
    "Simpan template",
    ["Pembayaran berhasil", "Pembayaran pending", "Pembayaran kedaluwarsa"],
  ),
  "/admin/templates/refunds": simulationScreen(
    "Kelola alasan dan pemberitahuan refund simulasi.",
    "Simpan template",
    ["Refund disetujui", "Refund ditolak", "Bukti tambahan diperlukan"],
  ),
  "/admin/templates/mabar": screen(
    "Kelola kebijakan pembatalan Mabar untuk host dan peserta.",
    "Simpan template",
    "static",
    ["Pembatalan host", "Kursi waitlist", "Pengembalian kontribusi"],
    "Template Mabar belum tersedia.",
  ),
  "/admin/commissions": simulationScreen(
    "Atur komisi platform dan masa trial tenant.",
    "Tambah aturan",
    ["Komisi default · 8%", "Trial Owner baru · 30 hari"],
  ),
  "/admin/promotions": simulationScreen(
    "Kelola promo platform, kuota, dan periode berlaku.",
    "Buat promo",
    ["MAINTERUS · Aktif", "WELCOME20 · Terjadwal"],
  ),
  "/admin/bookings": screen(
    "Pantau lifecycle booking lintas tenant dan sumber.",
    "Tambah catatan",
    "bookings",
    [],
    "Belum ada booking platform.",
  ),
  "/admin/payments": simulationScreen(
    "Pantau attempt pembayaran dan hasil sandbox.",
    "Ekspor pembayaran",
    ["PAY-0842 · Berhasil", "PAY-0839 · Pending", "PAY-0834 · Kedaluwarsa"],
  ),
  "/admin/refunds": simulationScreen(
    "Putuskan refund dan sengketa lintas tenant.",
    "Review refund",
    ["RFD-031 · Perlu keputusan", "RFD-027 · Disetujui"],
  ),
  "/admin/finance": simulationScreen(
    "Audit ledger platform, komisi, dan settlement.",
    "Ekspor ledger",
    ["Platform revenue · Rp4.620.000", "Settlement tenant · Rp38.240.000"],
  ),
  "/admin/payouts": simulationScreen(
    "Pantau payout tenant dan exception operasional.",
    "Proses payout",
    ["Cendana · Dijadwalkan", "Urban Athletic · Ditahan"],
  ),
  "/admin/reviews": screen(
    "Moderasi review dan laporan customer dengan alasan eksplisit.",
    "Tinjau laporan",
    "static",
    ["Laporan #218 · Bahasa tidak pantas", "Review #842 · Bukti diminta"],
    "Tidak ada laporan review.",
  ),
  "/admin/support": screen(
    "Kelola SLA dan eskalasi tiket bantuan platform.",
    "Assign tiket",
    "static",
    ["TKT-842 · Prioritas tinggi", "TKT-817 · Menunggu customer"],
    "Tidak ada tiket platform.",
  ),
  "/admin/audit": screen(
    "Telusuri perubahan state penting pada prototype.",
    "Ekspor tampilan",
    "static",
    [
      "Venue v6 diajukan",
      "Booking BK-0008 check-in",
      "Promo MAINTERUS diperbarui",
    ],
    "Belum ada audit event.",
  ),
  "/admin/config/notifications": screen(
    "Atur channel dan template notifikasi simulasi.",
    "Simpan konfigurasi",
    "notifications",
    [],
    "Konfigurasi notifikasi belum tersedia.",
  ),
  "/admin/system": screen(
    "Pantau fixture store, outbox, expiry, dan cron simulator.",
    "Jalankan pemeriksaan",
    "static",
    [
      "Fixture store · Healthy",
      "Notification outbox · Degraded",
      "Cron simulator · Healthy",
    ],
    "Status sistem belum tersedia.",
  ),
};

export const supportingDomainPaths = new Set(Object.keys(domainScreens));

function screen(
  description: string,
  action: string,
  source: DomainSource,
  items: string[],
  emptyDescription: string,
): DomainScreenDefinition {
  return { description, action, source, items, emptyDescription };
}

function simulationScreen(
  description: string,
  action: string,
  items: string[],
): DomainScreenDefinition {
  return {
    ...screen(description, action, "static", items, "Belum ada data simulasi."),
    simulation: true,
  };
}

const iconBySection = {
  Akun: Users,
  Komersial: Tag,
  Keuangan: CircleDollarSign,
  Sistem: Settings2,
  Moderasi: MessageSquareText,
  Pengaturan: Settings2,
  Pertumbuhan: Tag,
  Operasional: FileClock,
  Master: Settings2,
  Kebijakan: FileClock,
  Aktivitas: FileClock,
};

export function SupportingPage({ route }: { route: RouteDefinition }) {
  const { state } = usePrototype();
  const [query, setQuery] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const definition = domainScreens[route.path];
  if (!definition) {
    return (
      <EmptyState
        title="Konfigurasi domain belum tersedia"
        description={`Route ${route.path} tidak boleh menggunakan fallback generik.`}
      />
    );
  }
  const Icon =
    iconBySection[route.section as keyof typeof iconBySection] ?? Bell;
  const items = resolveItems(definition, state);
  const filteredItems = items.filter((item) =>
    item.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        eyebrow={route.section}
        title={route.title}
        description={definition.description}
        action={
          <Button
            onClick={() =>
              setActionMessage(`${definition.action} berhasil disimulasikan.`)
            }
          >
            <Plus /> {definition.action}
          </Button>
        }
      />
      {actionMessage && (
        <div className="inline-success" role="status">
          {actionMessage}
        </div>
      )}
      <ScenarioBoundary
        scenario={state.scenario}
        emptyTitle={`Belum ada ${route.title.toLowerCase()}`}
      >
        <div className="supporting-layout">
          <Card className="supporting-summary">
            <Icon />
            <div>
              <span>Total data</span>
              <strong>{items.length}</strong>
              <small>Fixture khusus {route.title.toLowerCase()}</small>
            </div>
            {definition.simulation && <SimulasiLabel />}
          </Card>
          <Card className="data-card">
            <div className="table-toolbar">
              <Input
                aria-label={`Cari ${route.title}`}
                placeholder={`Cari ${route.title.toLowerCase()}`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <Button variant="secondary">
                <Search /> Cari
              </Button>
            </div>
            {filteredItems.map((item, index) => (
              <div className="domain-row" key={item}>
                <span className="domain-icon">
                  <Icon />
                </span>
                <span>
                  <strong>{item}</strong>
                  <small>{route.section} · data lokal</small>
                </span>
                <Badge tone={index === 0 ? "warning" : "success"}>
                  {index === 0 ? "Perlu tinjauan" : "Aktif"}
                </Badge>
              </div>
            ))}
            {!filteredItems.length && (
              <EmptyState
                title={`Belum ada ${route.title.toLowerCase()}`}
                description={definition.emptyDescription}
              />
            )}
          </Card>
        </div>
      </ScenarioBoundary>
    </>
  );
}

function resolveItems(
  definition: DomainScreenDefinition,
  state: ReturnType<typeof usePrototype>["state"],
) {
  if (definition.source === "bookings")
    return state.bookings
      .slice(0, 6)
      .map((booking) => `${booking.id} · ${booking.date} · ${booking.status}`);
  if (definition.source === "venues")
    return state.venues
      .slice(0, 6)
      .map((venue) => `${venue.name} · ${venue.status}`);
  if (definition.source === "mabars")
    return state.mabars
      .slice(0, 6)
      .map((mabar) => `${mabar.title} · ${mabar.status}`);
  if (definition.source === "notifications")
    return state.notifications
      .slice(0, 6)
      .map(
        (notification) =>
          `${notification.title} · ${notification.read ? "Dibaca" : "Baru"}`,
      );
  return definition.items;
}
