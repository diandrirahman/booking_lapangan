import { Activity, Clock3, Plus, TrendingUp, Users, WalletCards } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useBusinessDashboard } from "../api/businessQueries";
import { serverStateEnabled } from "../api/apiClient";
import { AttentionCard } from "../components/DashboardInsightCards";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageTitle,
  SimulasiLabel,
} from "../components/ui";
import { usePrototype } from "../store/PrototypeStore";
import { formatRupiah, statusLabel } from "../store/selectors";

export function BusinessOverviewPage() {
  return serverStateEnabled ? (
    <IntegratedBusinessOverviewPage />
  ) : (
    <PrototypeBusinessOverviewPage />
  );
}

function IntegratedBusinessOverviewPage() {
  const { tenant } = useParams();
  const dashboard = useBusinessDashboard(tenant);
  const navigate = useNavigate();
  const businessPath = (suffix: string) => `/business/${tenant}/${suffix}`;

  if (dashboard.isLoading) {
    return (
      <Card className="state-card" aria-busy="true">
        Memuat dashboard...
      </Card>
    );
  }
  if (dashboard.isError || !dashboard.data) {
    return (
      <EmptyState
        title="Dashboard belum dapat dimuat"
        description="Periksa koneksi API, lalu coba lagi."
        action={<Button onClick={() => void dashboard.refetch()}>Coba lagi</Button>}
      />
    );
  }

  const data = dashboard.data;
  return (
    <>
      <PageTitle
        eyebrow={new Intl.DateTimeFormat("id-ID", { dateStyle: "full" }).format(
          new Date(),
        )}
        title="Ringkasan operasional"
        description="Data booking, pembayaran, dan venue berasal dari server B1."
        action={
          <Button
            onClick={() => navigate(businessPath("operations/bookings/new-offline"))}
          >
            <Plus /> Booking offline
          </Button>
        }
      />
      <div className="metric-grid four">
        <Card>
          <span>Booking hari ini</span>
          <strong>{data.bookingToday}</strong>
        </Card>
        <Card>
          <span>Menunggu konfirmasi</span>
          <strong>{data.pendingConfirmation}</strong>
          <small>Perlu ditinjau</small>
        </Card>
        <Card>
          <span>Outstanding</span>
          <strong>{formatRupiah(data.outstandingAmount)}</strong>
          <small>
            <SimulasiLabel />
          </small>
        </Card>
        <Card>
          <span>Slot tersedia hari ini</span>
          <strong>{data.availableSlotsToday}</strong>
          <small>{data.activeVenues} venue aktif</small>
        </Card>
      </div>
      <div className="dashboard-grid">
        <Card className="schedule-card">
          <div className="card-heading">
            <div>
              <h2>Jadwal terdekat</h2>
              <p>Booking lintas venue yang dapat Anda akses</p>
            </div>
            <Button
              variant="ghost"
              onClick={() => navigate(businessPath("operations/calendar"))}
            >
              Lihat kalender
            </Button>
          </div>
          {data.upcoming.length === 0 ? (
            <EmptyState
              title="Belum ada jadwal"
              description="Booking baru akan muncul di sini."
            />
          ) : (
            <div className="timeline-list">
              {data.upcoming.map((booking) => (
                <div key={booking.id}>
                  <time>{formatTime(booking.startsAt)}</time>
                  <i className={booking.source.toLowerCase()} />
                  <div>
                    <strong>
                      {booking.venueName} · {booking.courtName}
                    </strong>
                    <span>
                      {booking.customerName} · {booking.id}
                    </span>
                  </div>
                  <Badge
                    tone={booking.paymentStatus === "PAID" ? "success" : "warning"}
                  >
                    {booking.paymentStatus}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
        <AttentionCard
          description="Prioritas yang memerlukan keputusan operasional."
          items={[
            {
              icon: Clock3,
              value: `${data.pendingConfirmation} booking`,
              label: "menunggu konfirmasi",
              status: "Tinjau",
              tone: "warning",
              onClick: () => navigate(businessPath("operations/bookings")),
            },
            {
              icon: WalletCards,
              value: formatRupiah(data.outstandingAmount),
              label: "saldo booking belum lunas",
              status: "Tagih",
              tone: "danger",
              onClick: () => navigate(businessPath("operations/outstanding")),
            },
          ]}
        />
      </div>
      <Card className="dashboard-activity-card">
        <div className="card-heading">
          <div>
            <h2>Aktivitas terbaru</h2>
            <p>Perubahan status booking dengan actor dan alasan tersimpan di server.</p>
          </div>
        </div>
        {data.recentActivity.length === 0 ? (
          <EmptyState
            title="Belum ada aktivitas"
            description="Perubahan operasional akan muncul di sini."
          />
        ) : (
          <div className="activity-feed">
            {data.recentActivity.map((activity) => (
              <div
                className="activity-feed-item"
                key={`${activity.bookingId}-${activity.occurredAt}`}
              >
                <span className="activity-feed-icon" aria-hidden="true">
                  <Activity />
                </span>
                <div className="activity-feed-copy">
                  <div>
                    <strong>{statusLabel(activity.status)}</strong>
                  </div>
                  <p>{activity.reason ?? "Perubahan status booking"}</p>
                  <small>{activity.bookingId}</small>
                </div>
                <time dateTime={activity.occurredAt}>
                  {formatTime(activity.occurredAt)}
                </time>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function PrototypeBusinessOverviewPage() {
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
                    {state.venues.find((venue) => venue.id === booking.venueId)?.name}
                  </strong>
                  <span>
                    {booking.source === "online" ? "Booking online" : "Booking offline"}{" "}
                    · {booking.id}
                  </span>
                </div>
                <Badge tone={booking.paymentStatus === "paid" ? "success" : "warning"}>
                  {statusLabel(booking.paymentStatus)}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
        <div>
          <Card className="attention-card">
            <h2>Butuh perhatian</h2>
            <button onClick={() => navigate("/business/cendana/operations/bookings")}>
              <Clock3 />
              <span>
                <strong>4 booking</strong> menunggu konfirmasi
              </span>
            </button>
            <button
              onClick={() => navigate("/business/cendana/operations/outstanding")}
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

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
