import { Clock3, Plus, TrendingUp, Users, WalletCards } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  PageTitle,
  SimulasiLabel,
} from "../components/ui";
import { usePrototype } from "../store/PrototypeStore";
import { formatRupiah, statusLabel } from "../store/selectors";

export function BusinessOverviewPage() {
  const { state } = usePrototype();
  const navigate = useNavigate();
  const today = state.bookings.slice(0, 5);
  return (
    <>
      <PageTitle
        eyebrow="Rabu, 26 Agustus 2026"
        title="Selamat datang, Andika"
        description="Berikut hal yang perlu perhatianmu hari ini."
        action={
          <Button
            onClick={() =>
              navigate("/business/cendana/operations/bookings/new-offline")
            }
          >
            <Plus />
            Booking offline
          </Button>
        }
      />
      <div className="metric-grid four">
        <Card>
          <span>Booking hari ini</span>
          <strong>12</strong>
          <small>
            <TrendingUp />
            +18% dari pekan lalu
          </small>
        </Card>
        <Card>
          <span>Menunggu konfirmasi</span>
          <strong>4</strong>
          <small>Perlu ditinjau</small>
        </Card>
        <Card>
          <span>Outstanding</span>
          <strong>{formatRupiah(1_270_000)}</strong>
          <small>
            <SimulasiLabel />
          </small>
        </Card>
        <Card>
          <span>Okupansi</span>
          <strong>76%</strong>
          <small>Target 70%</small>
        </Card>
      </div>
      <div className="dashboard-grid">
        <Card className="schedule-card">
          <div className="card-heading">
            <div>
              <h2>Jadwal hari ini</h2>
              <p>Lintas 4 lapangan aktif</p>
            </div>
            <Button
              variant="ghost"
              onClick={() => navigate("/business/cendana/operations/calendar")}
            >
              Lihat kalender
            </Button>
          </div>
          <div className="timeline-list">
            {today.map((booking, index) => (
              <div key={booking.id}>
                <time>{17 + index}.00</time>
                <i className={booking.source} />
                <div>
                  <strong>
                    {
                      state.venues.find((venue) => venue.id === booking.venueId)
                        ?.name
                    }
                  </strong>
                  <span>
                    {booking.source === "online"
                      ? "Booking online"
                      : "Booking offline"}{" "}
                    · {booking.id}
                  </span>
                </div>
                <Badge
                  tone={
                    booking.paymentStatus === "paid" ? "success" : "warning"
                  }
                >
                  {statusLabel(booking.paymentStatus)}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
        <div>
          <Card className="attention-card">
            <h2>Butuh perhatian</h2>
            <button
              onClick={() => navigate("/business/cendana/operations/bookings")}
            >
              <Clock3 />
              <span>
                <strong>4 booking</strong> menunggu konfirmasi
              </span>
            </button>
            <button
              onClick={() =>
                navigate("/business/cendana/operations/outstanding")
              }
            >
              <WalletCards />
              <span>
                <strong>3 pembayaran</strong> belum lunas
              </span>
            </button>
            <button onClick={() => navigate("/business/cendana/team")}>
              <Users />
              <span>
                <strong>2 staff</strong> belum mendapat assignment
              </span>
            </button>
          </Card>
          <Card className="activity-card">
            <h2>Aktivitas terbaru</h2>
            <p>
              <span className="activity-dot" /> Sinta check-in booking BK-0008{" "}
              <small>8 menit lalu</small>
            </p>
            <p>
              <span className="activity-dot" /> Venue Urban Kick diajukan{" "}
              <small>32 menit lalu</small>
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}

export function ForbiddenPage() {
  const { state } = usePrototype();
  const navigate = useNavigate();
  const workspacePath =
    state.role === "customer"
      ? "/"
      : state.role === "admin"
        ? "/admin"
        : "/business/cendana/overview";
  return (
    <div className="forbidden">
      <span>403</span>
      <h1>Akses dibatasi</h1>
      <p>Role aktif tidak memiliki izin untuk membuka workspace ini.</p>
      <Button variant="secondary" onClick={() => navigate(workspacePath)}>
        Ke workspace aktif
      </Button>
    </div>
  );
}
