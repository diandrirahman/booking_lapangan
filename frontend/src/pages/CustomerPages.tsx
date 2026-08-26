import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleCheck,
  CircleDot,
  Clock3,
  Goal,
  Heart,
  Layers3,
  type LucideIcon,
  MapPin,
  Maximize2,
  Search,
  ShieldCheck,
  Star,
  Swords,
  Table2,
  Target,
  Users,
  Volleyball,
  Wind,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { galleryImages, heroImage, sports } from "../data/fixtures";
import { usePrototype } from "../store/PrototypeStore";
import {
  formatRupiah,
  selectVenueBySlug,
  selectVenueCourts,
} from "../store/selectors";
import {
  Badge,
  Button,
  Card,
  Input,
  PageTitle,
  ScenarioBoundary,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui";
import { DatePicker } from "../components/DatePicker";
import { InteractiveGallery } from "../components/InteractiveGallery";
import { MabarFavoriteButton } from "../components/MabarFavoriteButton";
import { SelectField } from "../components/SelectField";

const locationOptions = [
  { value: "jakarta-selatan", label: "Jakarta Selatan" },
  { value: "jakarta-pusat", label: "Jakarta Pusat" },
  { value: "tangerang-selatan", label: "Tangerang Selatan" },
];

const sportIcons: Record<string, LucideIcon> = {
  Badminton: Activity,
  Futsal: Goal,
  Padel: Swords,
  Basket: CircleDot,
  Tenis: Target,
  "Mini Soccer": Goal,
  Voli: Volleyball,
  "Tenis Meja": Table2,
};

function VenueCard({
  venue,
  compact = false,
}: {
  venue: ReturnType<typeof usePrototype>["state"]["venues"][number];
  compact?: boolean;
}) {
  const { state, dispatch } = usePrototype();
  const isFavorite = state.favoriteVenueIds.includes(venue.id);
  return (
    <Card
      className={`venue-card ${compact ? "compact" : ""}`}
      onMouseEnter={() => dispatch({ type: "SELECT_VENUE", venueId: venue.id })}
    >
      <Link to={`/venues/${venue.slug}`}>
        <div className="venue-media">
          <img
            src={venue.image}
            alt={`${venue.name}, venue ${venue.sport} di ${venue.location}`}
            loading="lazy"
          />
          <button
            className={`favorite-button ${isFavorite ? "active" : ""}`}
            aria-label={
              isFavorite
                ? `Hapus ${venue.name} dari favorit`
                : `Simpan ${venue.name} ke favorit`
            }
            aria-pressed={isFavorite}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              dispatch({
                type: "TOGGLE_FAVORITE",
                resource: "venue",
                resourceId: venue.id,
              });
            }}
          >
            <Heart fill={isFavorite ? "currentColor" : "none"} />
          </button>
          <Badge tone="success">{venue.sport}</Badge>
        </div>
        <div className="venue-card-body">
          <div className="venue-title">
            <h3>{venue.name}</h3>
            <span>
              <Star />
              {venue.rating}
            </span>
          </div>
          <p className="muted">
            <MapPin />
            {venue.location} · {venue.distance}
          </p>
          <div className="venue-meta">
            <span>
              <Clock3 />
              {venue.nextSlot}
            </span>
            <strong>
              Mulai {formatRupiah(venue.priceFrom)}
              <small>/jam</small>
            </strong>
          </div>
        </div>
      </Link>
    </Card>
  );
}

export function LandingPage() {
  const { state } = usePrototype();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("jakarta-selatan");
  const [selectedDate, setSelectedDate] = useState(new Date(2026, 7, 27));
  return (
    <>
      <section className="hero-section hero-animated">
        <img
          className="hero-image"
          src={heroImage}
          alt="Komunitas olahraga tiba di kompleks lapangan modern Jakarta"
        />
        <div className="hero-overlay" />
        <div className="hero-content">
          <p className="hero-kicker">Booking lapangan olahraga</p>
          <h1>Main di mana hari ini?</h1>
          <p>
            Cek harga dan jadwal venue di sekitarmu, lalu pilih waktu bermain
            tanpa perlu chat admin.
          </p>
          <form
            className="hero-search"
            onSubmit={(event) => {
              event.preventDefault();
              navigate(`/venues?q=${encodeURIComponent(query)}`);
            }}
          >
            <label>
              <Search />
              <span>Cari olahraga atau venue</span>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Badminton, futsal, padel…"
              />
            </label>
            <div className="hero-select-field">
              <MapPin />
              <div>
                <span>Lokasi</span>
                <SelectField
                  ariaLabel="Lokasi"
                  options={locationOptions}
                  value={location}
                  onValueChange={setLocation}
                  variant="embedded"
                />
              </div>
            </div>
            <label className="hero-date-field">
              <span>Tanggal main</span>
              <DatePicker
                value={selectedDate}
                onChange={setSelectedDate}
                ariaLabel="Pilih tanggal main"
                className="hero-date-picker"
              />
            </label>
            <Button type="submit" size="lg">
              <Search />
              Cari venue
            </Button>
          </form>
          <div className="hero-proof">
            <span>
              <strong>6+</strong> venue terkurasi
            </span>
            <span>
              <strong>4,8</strong> rating rata-rata
            </span>
            <span>
              <strong>100%</strong> data lokal
            </span>
          </div>
        </div>
      </section>
      <div className="content-container">
        <section className="sport-strip" aria-label="Pilih olahraga">
          {sports.map((sport) => {
            const SportIcon = sportIcons[sport] ?? Activity;

            return (
              <Link key={sport} to={`/venues?sport=${sport}`}>
                <span>
                  <SportIcon aria-hidden="true" />
                </span>
                {sport}
              </Link>
            );
          })}
        </section>
        <section className="content-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Pilihan terdekat</p>
              <h2>Venue yang lagi ramai</h2>
              <p>Rekomendasi berdasarkan lokasi dan slot yang tersedia.</p>
            </div>
            <Link to="/venues">
              Lihat semua <ChevronRight />
            </Link>
          </div>
          <ScenarioBoundary
            scenario={state.scenario}
            emptyTitle="Belum ada rekomendasi"
          >
            <div className="venue-grid">
              {state.venues
                .filter((venue) => venue.status === "published")
                .slice(0, 3)
                .map((venue) => (
                  <VenueCard key={venue.id} venue={venue} />
                ))}
            </div>
          </ScenarioBoundary>
        </section>
        <section className="promo-banner">
          <div className="promo-copy">
            <p className="promo-label">Untuk pengguna baru</p>
            <h2>Potongan Rp20.000 untuk booking pertama</h2>
            <p>Minimum transaksi Rp100.000. Berlaku sampai 31 Agustus 2026.</p>
          </div>
          <div className="promo-action">
            <span>Kode promo</span>
            <strong>MAINTERUS</strong>
            <Link className="btn btn-secondary btn-md" to="/venues">
              Cari venue
            </Link>
          </div>
        </section>
        <MabarPreview />
      </div>
    </>
  );
}

function MabarPreview() {
  const { state } = usePrototype();
  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Komunitas</p>
          <h2>Belum punya teman main?</h2>
          <p>Gabung Mabar yang cocok dengan level dan jadwalmu.</p>
        </div>
        <Link to="/mabar">
          Jelajahi Mabar <ChevronRight />
        </Link>
      </div>
      <div className="mabar-preview">
        {state.mabars.slice(0, 2).map((mabar) => (
          <article key={mabar.id} className="mabar-card">
            <Link className="mabar-card-link" to={`/mabar/${mabar.id}`}>
              <img
                src={mabar.image}
                alt={`Komunitas ${mabar.sport}`}
                loading="lazy"
              />
              <div>
                <Badge tone="info">{mabar.level}</Badge>
                <h3>{mabar.title}</h3>
                <p>
                  <CalendarDays />
                  {mabar.startsAt}
                </p>
                <p>
                  <Users />
                  {mabar.participantIds.length}/{mabar.capacity} peserta
                </p>
              </div>
            </Link>
            <MabarFavoriteButton mabarId={mabar.id} title={mabar.title} />
          </article>
        ))}
      </div>
    </section>
  );
}

export function VenueSearchPage() {
  const { state, dispatch } = usePrototype();
  const [sport, setSport] = useState("Semua");
  const [sort, setSort] = useState("Terdekat");
  const filtered = state.venues
    .filter(
      (venue) =>
        venue.status === "published" &&
        (sport === "Semua" || venue.sport === sport),
    )
    .sort((a, b) =>
      sort === "Rating" ? b.rating - a.rating : a.priceFrom - b.priceFrom,
    );
  return (
    <div className="content-container search-page">
      <PageTitle
        eyebrow="Jelajahi venue"
        title="Temukan tempat mainmu"
        description="Bandingkan venue, harga, fasilitas, dan slot tanpa meninggalkan halaman."
      />
      <div className="search-toolbar">
        <div className="search-input">
          <Search />
          <Input
            aria-label="Cari venue"
            placeholder="Cari nama venue atau area"
          />
        </div>
        <SelectField
          ariaLabel="Filter olahraga"
          options={["Semua", ...sports].map((item) => ({
            value: item,
            label: item,
          }))}
          value={sport}
          onValueChange={setSport}
        />
        <SelectField
          ariaLabel="Urutkan"
          options={[
            { value: "Terdekat", label: "Terdekat" },
            { value: "Rating", label: "Rating tertinggi" },
          ]}
          value={sort}
          onValueChange={setSort}
        />
      </div>
      <ScenarioBoundary
        scenario={state.scenario}
        emptyTitle="Venue tidak ditemukan"
      >
        <div className="search-layout">
          <div>
            <p className="result-count">
              <strong>{filtered.length} venue</strong> ditemukan · data
              diperbarui barusan
            </p>
            <div className="venue-list">
              {filtered.map((venue) => (
                <VenueCard key={venue.id} venue={venue} compact />
              ))}
            </div>
          </div>
          <MockMap
            venues={filtered}
            selectedId={state.selectedVenueId}
            onSelect={(id) => dispatch({ type: "SELECT_VENUE", venueId: id })}
          />
        </div>
      </ScenarioBoundary>
    </div>
  );
}

function MockMap({
  venues,
  selectedId,
  onSelect,
}: {
  venues: ReturnType<typeof usePrototype>["state"]["venues"];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mock-map" aria-label="Peta venue simulasi lokal">
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label="Peta lokal Jakarta dengan marker venue"
      >
        <path d="M-10 18 C18 8 34 30 58 18 S95 15 112 5" />
        <path d="M-8 72 C20 50 42 76 68 55 S94 52 110 70" />
        <path d="M15 -10 C22 25 12 55 28 110" />
        <path d="M76 -10 C65 20 88 46 74 110" />
        <g className="map-blocks">
          <rect x="34" y="34" width="18" height="12" />
          <rect x="48" y="72" width="12" height="17" />
          <rect x="8" y="40" width="10" height="15" />
          <rect x="80" y="18" width="14" height="18" />
        </g>
      </svg>
      {venues.map((venue, index) => (
        <button
          key={venue.id}
          onClick={() => onSelect(venue.id)}
          style={{ left: `${venue.lat}%`, top: `${venue.lng}%` }}
          className={`map-marker ${selectedId === venue.id ? "selected" : ""}`}
          aria-label={`Pilih ${venue.name}`}
        >
          {index + 1}
        </button>
      ))}
      <div className="map-legend">Peta simulasi · tanpa layanan eksternal</div>
    </div>
  );
}

export function VenueDetailPage() {
  const { slug } = useParams();
  const { state } = usePrototype();
  const venue = selectVenueBySlug(state, slug);
  const [selectedDate, setSelectedDate] = useState(new Date(2026, 7, 27));
  return (
    <div className="content-container detail-page">
      <div className="back-row">
        <Link to="/venues">
          <ArrowLeft />
          Kembali ke hasil pencarian
        </Link>
        <button>
          <Heart />
          Simpan
        </button>
      </div>
      <InteractiveGallery
        images={[venue.image, ...galleryImages]}
        venueName={venue.name}
      />
      <div className="detail-layout">
        <div>
          <div className="venue-detail-heading">
            <div>
              <Badge tone="success">Terverifikasi</Badge>
              <h1>{venue.name}</h1>
              <p>
                <MapPin />
                {venue.location} · {venue.distance}
              </p>
            </div>
            <div className="rating-box">
              <Star />
              <strong>{venue.rating}</strong>
              <span>{venue.reviewCount} ulasan</span>
            </div>
          </div>
          <Tabs defaultValue="overview">
            <TabsList className="tabs-list">
              <TabsTrigger value="overview">Ringkasan</TabsTrigger>
              <TabsTrigger value="courts">Lapangan</TabsTrigger>
              <TabsTrigger value="reviews">Ulasan</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <section className="detail-section">
                <h2>Fasilitas venue</h2>
                <div className="facility-grid">
                  {venue.facilities.map((item) => (
                    <span key={item}>
                      <CheckCircle2 />
                      {item}
                    </span>
                  ))}
                </div>
              </section>
              <section className="detail-section">
                <h2>Kebijakan penting</h2>
                <p>
                  Reschedule maksimal 6 jam sebelum bermain. Pembatalan
                  mengikuti tier refund venue. Semua transaksi pada prototype
                  adalah simulasi.
                </p>
              </section>
            </TabsContent>
            <TabsContent value="courts">
              <section className="detail-section court-tab">
                <div className="court-tab-heading">
                  <div>
                    <p className="eyebrow">Pilih area bermain</p>
                    <h2>
                      {selectVenueCourts(state, venue.id).length} lapangan siap
                      dipesan
                    </h2>
                    <p>
                      Semua lapangan memakai jadwal dan harga yang transparan.
                    </p>
                  </div>
                  <Badge tone="success">
                    <CircleCheck />
                    Tersedia hari ini
                  </Badge>
                </div>
                <div className="court-card-grid">
                  {selectVenueCourts(state, venue.id).map((court, index) => (
                    <Card className="court-detail-card" key={court.id}>
                      <div className="court-visual">
                        <img
                          src={index === 0 ? venue.image : galleryImages[0]}
                          alt={`${court.name} di ${venue.name}`}
                          loading="lazy"
                        />
                        <span className="court-media-overlay" />
                        <Badge tone="neutral">
                          Court {String(index + 1).padStart(2, "0")}
                        </Badge>
                      </div>
                      <div className="court-detail-body">
                        <div className="court-name-row">
                          <div>
                            <p>{court.sport}</p>
                            <h3>{court.name}</h3>
                          </div>
                          <span className="court-status">
                            <CircleCheck /> Tersedia
                          </span>
                        </div>
                        <div className="court-specs">
                          <span>
                            <Layers3 />
                            {court.surface}
                          </span>
                          <span>
                            <Maximize2 />
                            Standar kompetisi
                          </span>
                          <span>
                            <Wind />
                            Ventilasi baik
                          </span>
                        </div>
                        <div className="court-book-row">
                          <div>
                            <small>Mulai dari</small>
                            <strong>
                              {formatRupiah(venue.priceFrom + index * 15000)}
                              <span>/jam</span>
                            </strong>
                          </div>
                          <Link
                            to={`/venues/${venue.slug}/book?court=${court.id}`}
                          >
                            Pilih jadwal <ArrowRight />
                          </Link>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            </TabsContent>
            <TabsContent value="reviews">
              <section className="detail-section">
                <h2>Ulasan pemain</h2>
                <p>
                  “Court terawat, staf sigap, dan proses check-in cepat.” —
                  Nadia
                </p>
              </section>
            </TabsContent>
          </Tabs>
        </div>
        <aside className="booking-card">
          <Badge tone="info">Slot cepat habis</Badge>
          <p>Mulai dari</p>
          <strong>
            {formatRupiah(venue.priceFrom)}
            <small>/jam</small>
          </strong>
          <label>
            Tanggal main
            <DatePicker
              value={selectedDate}
              onChange={setSelectedDate}
              ariaLabel="Pilih tanggal main untuk venue"
            />
          </label>
          <Link
            className="btn btn-primary btn-lg"
            to={`/venues/${venue.slug}/book`}
          >
            Lihat slot tersedia
          </Link>
          <small>
            <ShieldCheck />
            Harga transparan · konfirmasi instan
          </small>
        </aside>
      </div>
    </div>
  );
}
