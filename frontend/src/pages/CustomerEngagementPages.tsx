import {
  CalendarDays,
  CheckCheck,
  ChevronRight,
  Clock3,
  Heart,
  MapPin,
  SlidersHorizontal,
  Star,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { NotificationIcon } from "../components/NotificationInbox";
import {
  Badge,
  Button,
  EmptyState,
  PageTitle,
  ScenarioBoundary,
} from "../components/ui";
import { usePrototype } from "../store/PrototypeStore";
import { formatRupiah } from "../store/selectors";

type FavoriteFilter = "all" | "venue" | "mabar";
type NotificationFilter = "all" | "unread";

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
      <ScenarioBoundary
        scenario={state.scenario}
        emptyTitle="Belum ada favorit"
      >
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
            {(filter === "all" || filter === "venue") &&
              favoriteVenues.length > 0 && (
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
            {(filter === "all" || filter === "mabar") &&
              favoriteMabars.length > 0 && (
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
                        <Link
                          className="favorite-listing-body"
                          to={`/mabar/${mabar.id}`}
                        >
                          <div>
                            <h3>{mabar.title}</h3>
                            <strong>{formatRupiah(mabar.price)}</strong>
                          </div>
                          <p>
                            <CalendarDays /> {mabar.startsAt}
                          </p>
                          <div className="favorite-listing-meta">
                            <span>
                              <Users /> {mabar.participantIds.length}/
                              {mabar.capacity} peserta
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
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const unreadCount = state.notifications.filter(
    (notification) => !notification.read,
  ).length;
  const visibleNotifications = state.notifications.filter(
    (notification) => filter === "all" || !notification.read,
  );

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
            onClick={() => dispatch({ type: "MARK_ALL_NOTIFICATIONS_READ" })}
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
            Semua <span>{state.notifications.length}</span>
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
      <ScenarioBoundary
        scenario={state.scenario}
        emptyTitle="Belum ada notifikasi"
      >
        <section className="notification-feed" aria-label="Daftar notifikasi">
          {visibleNotifications.length > 0 ? (
            visibleNotifications.map((notification, index) => (
              <div key={notification.id}>
                {(index === 0 ||
                  visibleNotifications[index - 1].time.startsWith("Kemarin") !==
                    notification.time.startsWith("Kemarin")) && (
                  <h2>
                    {notification.time.startsWith("Kemarin")
                      ? "Kemarin"
                      : "Hari ini"}
                  </h2>
                )}
                <Link
                  className={`notification-feed-row ${notification.read ? "" : "unread"}`}
                  to={notification.actionHref}
                  onClick={() =>
                    dispatch({
                      type: "MARK_NOTIFICATION_READ",
                      notificationId: notification.id,
                    })
                  }
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
