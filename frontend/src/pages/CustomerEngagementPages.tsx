import {
  CalendarDays,
  CheckCheck,
  ChevronRight,
  Clock3,
  Eye,
  Heart,
  MapPin,
  MessageSquareText,
  Send,
  SlidersHorizontal,
  Star,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { NotificationIcon } from "../components/NotificationInbox";
import { StarRating } from "../components/VenueReviews";
import { serverStateEnabled } from "../api/apiClient";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "../api/notificationQueries";
import { useSession } from "../api/session";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageTitle,
  ScenarioBoundary,
} from "../components/ui";
import { usePrototype } from "../store/PrototypeStore";
import { formatRupiah } from "../store/selectors";
import { toNotificationPresentation } from "../domain/notificationPresentation";
import { reviewPresentations } from "../data/reviewPresentations";

type FavoriteFilter = "all" | "venue" | "mabar";
type NotificationFilter = "all" | "unread";

export function HistoryPage() {
  const { state } = usePrototype();
  const [cleared, setCleared] = useState(false);
  const recentlyViewedVenues = cleared ? [] : state.venues.slice(0, 4);

  return (
    <div className="content-container engagement-page">
      <PageTitle
        eyebrow="Aktivitas kamu"
        title="Riwayat dilihat"
        description="Buka kembali venue yang terakhir kamu lihat selama tab ini aktif."
        action={
          recentlyViewedVenues.length > 0 ? (
            <Button variant="secondary" onClick={() => setCleared(true)}>
              <Trash2 /> Bersihkan riwayat
            </Button>
          ) : undefined
        }
      />
      <div className="engagement-toolbar">
        <div>
          <Eye />
          <span>
            <strong>{recentlyViewedVenues.length} venue terakhir</strong>
            <small>Disimpan hanya pada tab aktif</small>
          </span>
        </div>
        <Link className="btn btn-secondary btn-md" to="/venues">
          Cari venue lain <ChevronRight />
        </Link>
      </div>
      {recentlyViewedVenues.length === 0 ? (
        <EmptyState
          title="Riwayat sudah kosong"
          description="Venue yang kamu buka berikutnya akan muncul di halaman ini."
          action={
            <Link className="btn btn-primary btn-md" to="/venues">
              Jelajahi venue
            </Link>
          }
        />
      ) : (
        <section className="favorite-sections" aria-label="Venue terakhir dilihat">
          <div className="favorite-section-heading">
            <div>
              <h2>Lanjutkan pencarian</h2>
              <p>Harga dan slot dapat berubah; periksa lagi sebelum booking.</p>
            </div>
          </div>
          <div className="favorite-grid">
            {recentlyViewedVenues.map((venue) => (
              <article className="favorite-listing-card" key={venue.id}>
                <div className="favorite-listing-media">
                  <Link to={`/venues/${venue.slug}`}>
                    <img src={venue.image} alt={venue.name} loading="lazy" />
                  </Link>
                  <Badge tone="success">{venue.sport}</Badge>
                </div>
                <Link className="favorite-listing-body" to={`/venues/${venue.slug}`}>
                  <div>
                    <h3>{venue.name}</h3>
                    <span>
                      <Star fill="currentColor" /> {venue.rating}
                    </span>
                  </div>
                  <p>
                    <MapPin /> {venue.location} · {venue.distance}
                  </p>
                  <div className="favorite-listing-meta">
                    <span>
                      <Clock3 /> Slot {venue.nextSlot}
                    </span>
                    <strong>
                      {formatRupiah(venue.priceFrom)}
                      <small>/jam</small>
                    </strong>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function FavoritesPage() {
  const { state, dispatch } = usePrototype();
  const [filter, setFilter] = useState<FavoriteFilter>("all");
  const favoriteVenues = state.venues.filter((venue) =>
    state.favoriteVenueIds.includes(venue.id),
  );
  const favoriteMabars = state.mabars.filter((mabar) =>
    state.favoriteMabarIds.includes(mabar.id),
  );
  const totalFavorites = favoriteVenues.length + favoriteMabars.length;

  return (
    <div className="content-container engagement-page">
      <PageTitle
        eyebrow="Koleksi kamu"
        title="Favorit"
        description="Simpan venue dan Mabar yang ingin kamu buka lagi nanti."
        action={
          <Link className="btn btn-secondary btn-md" to="/venues">
            Jelajahi venue
            <ChevronRight />
          </Link>
        }
      />
      <div className="engagement-toolbar">
        <div>
          <Heart />
          <span>
            <strong>{totalFavorites} tersimpan</strong>
            <small>Venue dan Mabar pilihanmu</small>
          </span>
        </div>
        <div className="segmented-filter" aria-label="Filter favorit">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            Semua <span>{totalFavorites}</span>
          </button>
          <button
            className={filter === "venue" ? "active" : ""}
            onClick={() => setFilter("venue")}
          >
            Venue <span>{favoriteVenues.length}</span>
          </button>
          <button
            className={filter === "mabar" ? "active" : ""}
            onClick={() => setFilter("mabar")}
          >
            Mabar <span>{favoriteMabars.length}</span>
          </button>
        </div>
      </div>
      <ScenarioBoundary scenario={state.scenario} emptyTitle="Belum ada favorit">
        {totalFavorites === 0 ? (
          <EmptyState
            title="Belum ada yang disimpan"
            description="Tekan ikon hati pada venue atau Mabar untuk menyimpannya di sini."
            action={
              <Link className="btn btn-primary btn-md" to="/venues">
                Cari venue
              </Link>
            }
          />
        ) : (
          <div className="favorite-sections">
            {(filter === "all" || filter === "venue") && favoriteVenues.length > 0 && (
              <section>
                <div className="favorite-section-heading">
                  <div>
                    <h2>Venue favorit</h2>
                    <p>Cek slot terbaru sebelum menentukan jadwal.</p>
                  </div>
                  <span>{favoriteVenues.length} venue</span>
                </div>
                <div className="favorite-grid">
                  {favoriteVenues.map((venue) => (
                    <article className="favorite-listing-card" key={venue.id}>
                      <div className="favorite-listing-media">
                        <Link to={`/venues/${venue.slug}`}>
                          <img src={venue.image} alt={venue.name} />
                        </Link>
                        <Badge tone="success">{venue.sport}</Badge>
                        <button
                          className="favorite-remove"
                          type="button"
                          aria-label={`Hapus ${venue.name} dari favorit`}
                          onClick={() =>
                            dispatch({
                              type: "TOGGLE_FAVORITE",
                              resource: "venue",
                              resourceId: venue.id,
                            })
                          }
                        >
                          <Heart fill="currentColor" />
                        </button>
                      </div>
                      <Link
                        className="favorite-listing-body"
                        to={`/venues/${venue.slug}`}
                      >
                        <div>
                          <h3>{venue.name}</h3>
                          <span>
                            <Star fill="currentColor" /> {venue.rating}
                          </span>
                        </div>
                        <p>
                          <MapPin /> {venue.location} · {venue.distance}
                        </p>
                        <div className="favorite-listing-meta">
                          <span>
                            <Clock3 /> Slot {venue.nextSlot}
                          </span>
                          <strong>
                            {formatRupiah(venue.priceFrom)}
                            <small>/jam</small>
                          </strong>
                        </div>
                      </Link>
                    </article>
                  ))}
                </div>
              </section>
            )}
            {(filter === "all" || filter === "mabar") && favoriteMabars.length > 0 && (
              <section>
                <div className="favorite-section-heading">
                  <div>
                    <h2>Mabar favorit</h2>
                    <p>Sesi komunitas yang ingin kamu ikuti.</p>
                  </div>
                  <span>{favoriteMabars.length} Mabar</span>
                </div>
                <div className="favorite-grid mabar-favorites">
                  {favoriteMabars.map((mabar) => (
                    <article className="favorite-listing-card" key={mabar.id}>
                      <div className="favorite-listing-media">
                        <Link to={`/mabar/${mabar.id}`}>
                          <img src={mabar.image} alt={mabar.title} />
                        </Link>
                        <Badge tone="info">{mabar.level}</Badge>
                        <button
                          className="favorite-remove"
                          type="button"
                          aria-label={`Hapus ${mabar.title} dari favorit`}
                          onClick={() =>
                            dispatch({
                              type: "TOGGLE_FAVORITE",
                              resource: "mabar",
                              resourceId: mabar.id,
                            })
                          }
                        >
                          <Heart fill="currentColor" />
                        </button>
                      </div>
                      <Link className="favorite-listing-body" to={`/mabar/${mabar.id}`}>
                        <div>
                          <h3>{mabar.title}</h3>
                          <strong>{formatRupiah(mabar.price)}</strong>
                        </div>
                        <p>
                          <CalendarDays /> {mabar.startsAt}
                        </p>
                        <div className="favorite-listing-meta">
                          <span>
                            <Users /> {mabar.participantIds.length}/{mabar.capacity}{" "}
                            peserta
                          </span>
                          <strong>{mabar.sport}</strong>
                        </div>
                      </Link>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </ScenarioBoundary>
    </div>
  );
}

export function NotificationsPage() {
  const { state, dispatch } = usePrototype();
  const session = useSession();
  const serverNotifications = useNotifications(false, Boolean(session.data));
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const notifications = serverStateEnabled
    ? (serverNotifications.data?.items.map(toNotificationPresentation) ?? [])
    : state.notifications;
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const visibleNotifications = notifications.filter(
    (notification) => filter === "all" || !notification.read,
  );

  if (serverStateEnabled && session.isPending) {
    return (
      <div className="content-container engagement-page notifications-page">
        <PageTitle
          eyebrow="Aktivitas akun"
          title="Notifikasi"
          description="Memuat notifikasi akun..."
        />
      </div>
    );
  }

  if (serverStateEnabled && !session.data) {
    return (
      <div className="content-container engagement-page notifications-page">
        <PageTitle
          eyebrow="Aktivitas akun"
          title="Notifikasi"
          description="Masuk untuk melihat update booking dan pembayaran akun Anda."
        />
        <EmptyState
          title="Masuk diperlukan"
          description="Notifikasi bersifat pribadi dan hanya tersedia untuk akun yang aktif."
          action={
            <Link className="btn btn-primary btn-md" to="/login">
              Masuk
            </Link>
          }
        />
      </div>
    );
  }

  if (serverStateEnabled && serverNotifications.isError) {
    return (
      <div className="content-container engagement-page notifications-page">
        <PageTitle
          eyebrow="Aktivitas akun"
          title="Notifikasi"
          description="Update booking dan pembayaran akun Anda."
        />
        <EmptyState
          title="Notifikasi belum dapat dimuat"
          description="Periksa koneksi API lalu coba lagi."
          action={
            <Button onClick={() => void serverNotifications.refetch()}>
              Coba lagi
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="content-container engagement-page notifications-page">
      <PageTitle
        eyebrow="Aktivitas akun"
        title="Notifikasi"
        description="Update booking, pembayaran, pengingat jadwal, dan aktivitas Mabar."
        action={
          <Button
            variant="secondary"
            disabled={unreadCount === 0}
            onClick={() => {
              if (serverStateEnabled) {
                markAllRead.mutate();
              } else {
                dispatch({ type: "MARK_ALL_NOTIFICATIONS_READ" });
              }
            }}
          >
            <CheckCheck /> Tandai semua dibaca
          </Button>
        }
      />
      <div className="notification-page-toolbar">
        <div className="segmented-filter" aria-label="Filter notifikasi">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            Semua <span>{notifications.length}</span>
          </button>
          <button
            className={filter === "unread" ? "active" : ""}
            onClick={() => setFilter("unread")}
          >
            Belum dibaca <span>{unreadCount}</span>
          </button>
        </div>
        <Link to="/profile">
          <SlidersHorizontal /> Atur preferensi
        </Link>
      </div>
      <ScenarioBoundary scenario={state.scenario} emptyTitle="Belum ada notifikasi">
        <section className="notification-feed" aria-label="Daftar notifikasi">
          {visibleNotifications.length > 0 ? (
            visibleNotifications.map((notification, index) => (
              <div key={notification.id}>
                {(index === 0 ||
                  visibleNotifications[index - 1].time.startsWith("Kemarin") !==
                    notification.time.startsWith("Kemarin")) && (
                  <h2>
                    {notification.time.startsWith("Kemarin") ? "Kemarin" : "Hari ini"}
                  </h2>
                )}
                <Link
                  className={`notification-feed-row ${notification.read ? "" : "unread"}`}
                  to={notification.actionHref}
                  onClick={() => {
                    if (serverStateEnabled) {
                      markRead.mutate(notification.id);
                    } else {
                      dispatch({
                        type: "MARK_NOTIFICATION_READ",
                        notificationId: notification.id,
                      });
                    }
                  }}
                >
                  <span className={`notification-kind ${notification.kind}`}>
                    <NotificationIcon kind={notification.kind} />
                  </span>
                  <span className="notification-feed-copy">
                    <span>
                      <strong>{notification.title}</strong>
                      <time>{notification.time}</time>
                    </span>
                    <p>{notification.body}</p>
                  </span>
                  {!notification.read && <i aria-label="Belum dibaca" />}
                  <ChevronRight aria-hidden="true" />
                </Link>
              </div>
            ))
          ) : (
            <EmptyState
              title="Tidak ada notifikasi belum dibaca"
              description="Semua update terbaru sudah kamu periksa."
            />
          )}
        </section>
      </ScenarioBoundary>
    </div>
  );
}

export function ReviewsPage() {
  const ownReviews = reviewPresentations.filter(
    (review) => review.author === "Nadia Putri",
  );

  return (
    <div className="content-container engagement-page">
      <PageTitle
        eyebrow="Aktivitas kamu"
        title="Review saya"
        description="Lihat penilaian yang sudah kamu kirim dari booking terverifikasi."
        action={
          <Link className="btn btn-secondary btn-md" to="/bookings">
            Lihat booking selesai <ChevronRight />
          </Link>
        }
      />
      <div className="engagement-toolbar">
        <div>
          <Star />
          <span>
            <strong>{ownReviews.length} review diterbitkan</strong>
            <small>Hanya booking selesai yang dapat dinilai</small>
          </span>
        </div>
        <Badge tone="info">Pembuatan review · Phase B2</Badge>
      </div>
      <div className="review-card-grid">
        {ownReviews.map((review) => (
          <article className="review-card" key={review.id}>
            <div className="review-card-header">
              <span className="review-avatar" aria-hidden="true">
                NP
              </span>
              <div>
                <strong>{review.author}</strong>
                <small>{review.court}</small>
              </div>
              <time>{review.date}</time>
            </div>
            <StarRating rating={review.rating} label={`${review.rating} dari 5`} />
            <p>“{review.comment}”</p>
            <div className="review-tags">
              {review.highlights.map((highlight) => (
                <span key={highlight}>{highlight}</span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function SupportPage() {
  const [tickets, setTickets] = useState([
    { id: "TKT-842", subject: "Perubahan jadwal", status: "Diproses" },
    { id: "TKT-817", subject: "Pembayaran tertunda", status: "Selesai" },
  ]);
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");

  function createTicket(): void {
    const trimmedSubject = subject.trim();
    if (!trimmedSubject) return;
    setTickets((currentTickets) => [
      {
        id: `TKT-${850 + currentTickets.length}`,
        subject: trimmedSubject,
        status: "Baru",
      },
      ...currentTickets,
    ]);
    setSubject("");
    setShowForm(false);
  }

  return (
    <div className="content-container engagement-page">
      <PageTitle
        eyebrow="Bantuan"
        title="Tiket bantuan"
        description="Pantau percakapan bantuan dan kirim masalah dengan konteks yang jelas."
        action={
          <Button onClick={() => setShowForm((visible) => !visible)}>
            <MessageSquareText /> Buat tiket
          </Button>
        }
      />
      {showForm && (
        <Card className="support-ticket-form">
          <label htmlFor="support-subject">Topik bantuan</label>
          <div>
            <Input
              id="support-subject"
              value={subject}
              placeholder="Contoh: Jadwal booking berubah"
              onChange={(event) => setSubject(event.target.value)}
            />
            <Button disabled={!subject.trim()} onClick={createTicket}>
              <Send /> Kirim tiket
            </Button>
          </div>
        </Card>
      )}
      <Card className="support-ticket-list">
        <div className="card-heading">
          <div>
            <h2>Percakapan terbaru</h2>
            <p>Nomor tiket, topik, dan status terakhir.</p>
          </div>
          <Badge tone="neutral">{tickets.length} tiket</Badge>
        </div>
        {tickets.map((ticket) => (
          <div className="support-ticket-row" key={ticket.id}>
            <MessageSquareText />
            <span>
              <strong>{ticket.subject}</strong>
              <small>{ticket.id}</small>
            </span>
            <Badge tone={ticket.status === "Selesai" ? "success" : "warning"}>
              {ticket.status}
            </Badge>
          </div>
        ))}
      </Card>
    </div>
  );
}

export function ProfilePage() {
  const [saved, setSaved] = useState(false);

  return (
    <div className="content-container engagement-page">
      <PageTitle
        eyebrow="Akun"
        title="Profil dan pengaturan"
        description="Kelola identitas yang digunakan untuk booking dan notifikasi."
      />
      <div className="profile-settings-grid">
        <Card className="profile-identity-card">
          <span className="profile-avatar-large" aria-hidden="true">
            NP
          </span>
          <div>
            <h2>Nadia Putri</h2>
            <p>nadia.putri@contoh.test</p>
            <Badge tone="success">Email terverifikasi</Badge>
          </div>
        </Card>
        <Card className="profile-form-card">
          <div className="card-heading">
            <div>
              <h2>Informasi pribadi</h2>
              <p>Digunakan saat membuat booking.</p>
            </div>
            <UserRound />
          </div>
          <div className="profile-form-grid">
            <label>
              Nama lengkap
              <Input defaultValue="Nadia Putri" />
            </label>
            <label>
              Nomor telepon
              <Input defaultValue="+628127000100" />
            </label>
            <label>
              Kota utama
              <Input defaultValue="Jakarta Selatan" />
            </label>
          </div>
          <Button onClick={() => setSaved(true)}>Simpan perubahan</Button>
          {saved && (
            <p className="inline-success" role="status">
              Profil tersimpan pada sesi ini.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
