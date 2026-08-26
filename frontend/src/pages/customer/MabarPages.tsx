import {
  CalendarDays,
  ChevronRight,
  MapPin,
  Minus,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { SelectField } from "../../components/SelectField";
import { MabarFavoriteButton } from "../../components/MabarFavoriteButton";
import {
  Badge,
  Button,
  Card,
  Dialog,
  ErrorState,
  Input,
  PageTitle,
} from "../../components/ui";
import { sports } from "../../data/fixtures";
import { usePrototype } from "../../store/PrototypeStore";
import { formatRupiah, statusLabel } from "../../store/selectors";

export function MabarListPage() {
  const { state } = usePrototype();
  const eligibleBookings = state.bookings.filter(
    (booking) =>
      booking.status === "confirmed" &&
      !state.mabars.some(
        (mabar) =>
          mabar.bookingId === booking.id && mabar.status !== "cancelled",
      ),
  );
  return (
    <div className="content-container">
      <PageTitle
        eyebrow="Komunitas LapanganGo"
        title="Cari teman, lanjut main"
        description="Temukan sesi yang cocok dengan olahraga, level, dan jadwalmu."
        action={
          <Dialog
            title="Pilih booking terkonfirmasi"
            description="Satu booking hanya dapat menjadi sumber satu Mabar aktif."
            trigger={
              <Button>
                <Plus />
                Buat dari booking
              </Button>
            }
          >
            <div className="data-card">
              {eligibleBookings.slice(0, 6).map((booking) => (
                <Link
                  className="list-item"
                  key={booking.id}
                  to={`/mabar/create/${booking.id}`}
                >
                  <div>
                    <strong>{booking.id}</strong>
                    <small>
                      {booking.date} · {booking.slots.join(", ")}
                    </small>
                  </div>
                  <ChevronRight />
                </Link>
              ))}
              {!eligibleBookings.length && (
                <p>Tidak ada booking confirmed yang masih tersedia.</p>
              )}
            </div>
          </Dialog>
        }
      />
      <div className="search-toolbar">
        <div className="search-input">
          <Search />
          <Input aria-label="Cari Mabar" placeholder="Cari Mabar atau venue" />
        </div>
        <SelectField
          ariaLabel="Filter olahraga Mabar"
          defaultValue="all"
          options={[
            { value: "all", label: "Semua olahraga" },
            ...sports.map((sport) => ({ value: sport, label: sport })),
          ]}
        />
        <SelectField
          ariaLabel="Filter level Mabar"
          defaultValue="all"
          options={[
            { value: "all", label: "Semua level" },
            { value: "beginner", label: "Pemula" },
            { value: "intermediate", label: "Menengah" },
          ]}
        />
      </div>
      <div className="mabar-grid">
        {state.mabars.map((mabar) => (
          <article key={mabar.id} className="mabar-tile">
            <Link className="mabar-tile-link" to={`/mabar/${mabar.id}`}>
              <img src={mabar.image} alt={`Peserta ${mabar.title}`} />
              <div>
                <Badge tone="info">{mabar.level}</Badge>
                <h2>{mabar.title}</h2>
                <p>
                  <MapPin />
                  {
                    state.venues.find((venue) => venue.id === mabar.venueId)
                      ?.name
                  }
                </p>
                <p>
                  <CalendarDays />
                  {mabar.startsAt}
                </p>
                <div>
                  <span className="avatar-stack">
                    {mabar.participantIds.slice(0, 3).map((id) => (
                      <i key={id}>{id.slice(-1)}</i>
                    ))}
                  </span>
                  <strong>
                    {mabar.participantIds.length}/{mabar.capacity} kursi
                  </strong>
                  <span>{formatRupiah(mabar.price)}</span>
                </div>
              </div>
            </Link>
            <MabarFavoriteButton mabarId={mabar.id} title={mabar.title} />
          </article>
        ))}
      </div>
    </div>
  );
}

export function MabarDetailPage() {
  const { id } = useParams();
  const { state, dispatch } = usePrototype();
  const mabar = state.mabars.find((item) => item.id === id) ?? state.mabars[0];
  const venue = state.venues.find((item) => item.id === mabar.venueId)!;
  const full = mabar.participantIds.length >= mabar.capacity;
  return (
    <div className="content-container mabar-detail">
      <div className="mabar-hero">
        <img src={mabar.image} alt={`Komunitas ${mabar.sport}`} />
        <div>
          <Badge tone="info">{mabar.level}</Badge>
          <h1>{mabar.title}</h1>
          <p>Dihost oleh {mabar.host}</p>
        </div>
      </div>
      <div className="detail-layout">
        <div>
          <Card className="detail-section">
            <h2>Detail sesi</h2>
            <p>
              <CalendarDays />
              {mabar.startsAt}
            </p>
            <p>
              <MapPin />
              {venue.name}, {venue.location}
            </p>
            <p>
              <Users />
              {mabar.participantIds.length} dari {mabar.capacity} peserta
            </p>
          </Card>
          <Card className="detail-section">
            <h2>Tentang permainan</h2>
            <p>
              Fun match dengan rotasi pemain. Datang 15 menit lebih awal untuk
              pemanasan dan briefing.
            </p>
          </Card>
        </div>
        <aside className="summary-panel">
          <Badge tone={full ? "warning" : "success"}>
            {full
              ? "Waitlist dibuka"
              : `${mabar.capacity - mabar.participantIds.length} kursi tersisa`}
          </Badge>
          <strong className="mabar-price">
            {formatRupiah(mabar.price)}
            <small>/orang</small>
          </strong>
          <Button
            size="lg"
            disabled={mabar.status !== "published"}
            onClick={() =>
              dispatch({
                type: "JOIN_MABAR",
                mabarId: mabar.id,
                customerId: "u30",
              })
            }
          >
            {mabar.status === "cancelled"
              ? "Mabar dibatalkan"
              : mabar.requireApproval
                ? "Minta bergabung"
                : full
                  ? "Gabung waitlist"
                  : "Gabung sekarang"}
          </Button>
          <p>Tanpa pembayaran nyata · kursi ditahan secara simulasi.</p>
        </aside>
      </div>
    </div>
  );
}

export function MabarCreatePage() {
  const { bookingId } = useParams();
  const { state, dispatch } = usePrototype();
  const navigate = useNavigate();
  const booking = state.bookings.find((item) => item.id === bookingId);
  const existingMabar = state.mabars.find(
    (mabar) => mabar.bookingId === bookingId && mabar.status !== "cancelled",
  );
  const [capacity, setCapacity] = useState(6);
  function create() {
    if (!booking || booking.status !== "confirmed" || existingMabar) return;
    const mabar = {
      id: `MB-${String(state.mabars.length + 1).padStart(3, "0")}`,
      bookingId: booking.id,
      host: "Raka",
      title: "Mabar Baru dari Booking",
      sport: "Badminton",
      venueId: booking.venueId,
      startsAt: "Kamis, 19.00",
      capacity,
      participantIds: ["u1"],
      pendingApprovalIds: [],
      waitlistIds: [],
      status: "draft" as const,
      image: state.mabars[0].image,
      level: "Semua level",
      price: Math.ceil(booking.amount / capacity),
      requireApproval: true,
      announcements: [],
    };
    dispatch({ type: "CREATE_MABAR", mabar });
    navigate(`/mabar/${mabar.id}/manage`);
  }
  if (!booking)
    return (
      <div className="content-container">
        <PageTitle
          eyebrow="Buat Mabar"
          title="Booking tidak ditemukan"
          description="Pilih booking terkonfirmasi dari daftar Mabar."
        />
        <ErrorState />
      </div>
    );
  if (booking.status !== "confirmed" || existingMabar)
    return (
      <div className="content-container">
        <PageTitle
          eyebrow="Buat Mabar"
          title="Booking belum dapat digunakan"
          description={
            existingMabar
              ? "Booking ini sudah mempunyai Mabar aktif."
              : "Hanya booking terkonfirmasi yang dapat menjadi sumber Mabar."
          }
        />
        <ErrorState />
      </div>
    );
  return (
    <div className="content-container">
      <PageTitle
        eyebrow="Buat Mabar"
        title="Ubah booking jadi sesi komunitas"
        description={`Sumber: ${booking.id} · hanya booking terkonfirmasi yang dapat dipublikasikan.`}
      />
      <Card className="form-card">
        <label>
          Judul sesi
          <Input defaultValue="Mabar Baru dari Booking" />
        </label>
        <label>
          Level
          <SelectField
            ariaLabel="Level permainan"
            defaultValue="all"
            options={[
              { value: "all", label: "Semua level" },
              { value: "beginner", label: "Pemula" },
              { value: "intermediate", label: "Menengah" },
            ]}
          />
        </label>
        <label>
          Jumlah peserta
          <div className="stepper">
            <button onClick={() => setCapacity(Math.max(2, capacity - 1))}>
              <Minus />
            </button>
            <strong>{capacity}</strong>
            <button onClick={() => setCapacity(capacity + 1)}>
              <Plus />
            </button>
          </div>
        </label>
        <Button onClick={create}>Simpan draft</Button>
      </Card>
    </div>
  );
}

export function MabarManagePage() {
  const { id } = useParams();
  const { state, dispatch } = usePrototype();
  const [announcement, setAnnouncement] = useState("");
  const mabar = state.mabars.find((item) => item.id === id) ?? state.mabars[0];
  return (
    <div className="content-container">
      <PageTitle
        eyebrow="Host controls"
        title={mabar.title}
        description="Kelola publikasi, peserta, waitlist FIFO, dan pengumuman."
        action={
          <Button
            disabled={
              mabar.status === "published" || mabar.status === "cancelled"
            }
            onClick={() =>
              dispatch({ type: "PUBLISH_MABAR", mabarId: mabar.id })
            }
          >
            {mabar.status === "published" ? "Sudah tayang" : "Publikasikan"}
          </Button>
        }
      />
      <div className="metric-grid">
        <Card>
          <span>Status</span>
          <strong>{statusLabel(mabar.status)}</strong>
        </Card>
        <Card>
          <span>Peserta</span>
          <strong>
            {mabar.participantIds.length}/{mabar.capacity}
          </strong>
        </Card>
        <Card>
          <span>Waitlist</span>
          <strong>{mabar.waitlistIds.length}</strong>
        </Card>
      </div>
      <Card className="data-card">
        <h2>Menunggu persetujuan</h2>
        {mabar.pendingApprovalIds.map((participant) => (
          <div className="list-item" key={participant}>
            <div>
              <strong>Peserta {participant}</strong>
              <small>Permintaan baru</small>
            </div>
            <Button
              size="sm"
              onClick={() =>
                dispatch({
                  type: "APPROVE_MABAR_PARTICIPANT",
                  mabarId: mabar.id,
                  customerId: participant,
                })
              }
            >
              Setujui
            </Button>
          </div>
        ))}
        {!mabar.pendingApprovalIds.length && <p>Tidak ada permintaan baru.</p>}
      </Card>
      <Card className="data-card">
        <h2>Peserta terdaftar</h2>
        {mabar.participantIds.map((participant, index) => (
          <div className="list-item" key={participant}>
            <span className="avatar">{index + 1}</span>
            <div>
              <strong>Peserta {participant}</strong>
              <small>{index === 0 ? "Host" : "Terkonfirmasi"}</small>
            </div>
            {index === 0 ? (
              <Badge tone="success">Host</Badge>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  dispatch({
                    type: "REMOVE_MABAR_PARTICIPANT",
                    mabarId: mabar.id,
                    customerId: participant,
                  })
                }
              >
                Keluarkan
              </Button>
            )}
          </div>
        ))}
      </Card>
      <Card className="data-card">
        <h2>Waitlist FIFO</h2>
        {mabar.waitlistIds.map((participant, index) => (
          <div className="list-item" key={participant}>
            <span className="avatar">{index + 1}</span>
            <strong>Peserta {participant}</strong>
            <Badge>Menunggu kursi</Badge>
          </div>
        ))}
        {!mabar.waitlistIds.length && <p>Waitlist masih kosong.</p>}
      </Card>
      <Card className="data-card">
        <h2>Pengumuman</h2>
        <div className="promo-input">
          <Input
            aria-label="Pesan pengumuman"
            placeholder="Tulis informasi untuk peserta"
            value={announcement}
            onChange={(event) => setAnnouncement(event.target.value)}
          />
          <Button
            disabled={!announcement.trim()}
            onClick={() => {
              dispatch({
                type: "ANNOUNCE_MABAR",
                mabarId: mabar.id,
                message: announcement,
              });
              setAnnouncement("");
            }}
          >
            Kirim
          </Button>
        </div>
        {mabar.announcements.map((item) => (
          <div className="list-item" key={item.id}>
            <div>
              <strong>{item.message}</strong>
              <small>{item.createdAt}</small>
            </div>
          </div>
        ))}
      </Card>
      <Button
        variant="danger"
        disabled={mabar.status === "cancelled"}
        onClick={() => dispatch({ type: "CANCEL_MABAR", mabarId: mabar.id })}
      >
        Batalkan Mabar
      </Button>
    </div>
  );
}
