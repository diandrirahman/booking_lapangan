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
  LocateFixed,
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
import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { galleryImages, heroImage, sports } from "../data/fixtures";
import { usePrototype } from "../store/PrototypeStore";
import { formatRupiah } from "../store/selectors";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Input,
  LoadingState,
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
import {
  useInfiniteVenueSearch,
  useVenueDetail,
  useVenueSearch,
  type VenueSearchInput,
} from "../api/venueQueries";
import { serverStateEnabled } from "../api/apiClient";
import { VenueMap } from "../components/VenueMap";
import { VenueReviews } from "../components/VenueReviews";

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
  const isSelected = state.selectedVenueId === venue.id;
  return (
    <Card
      id={`venue-card-${venue.id}`}
      className={`venue-card ${compact ? "compact" : ""} ${isSelected ? "selected" : ""}`}
      aria-current={isSelected ? "true" : undefined}
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
  const venueQuery = useVenueSearch();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("jakarta-selatan");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
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
            Cek harga dan jadwal venue di sekitarmu, lalu pilih waktu bermain tanpa
            perlu chat admin.
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
              {(venueQuery.data?.items ?? []).slice(0, 3).map((venue) => (
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
              <img src={mabar.image} alt={`Komunitas ${mabar.sport}`} loading="lazy" />
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
  const [searchParameters, setSearchParameters] = useSearchParams();
  const [query, setQuery] = useState(searchParameters.get("q") ?? "");
  const [sport, setSport] = useState("Semua");
  const [area, setArea] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const [searchTime, setSearchTime] = useState("");
  const [indoorOutdoorType, setIndoorOutdoorType] = useState("ALL");
  const [paymentMode, setPaymentMode] = useState("ALL");
  const [minimumRating, setMinimumRating] = useState("ALL");
  const [maximumPrice, setMaximumPrice] = useState("");
  const [hasPromo, setHasPromo] = useState(false);
  const [facilitySlugs, setFacilitySlugs] = useState<string[]>([]);
  const [coordinates, setCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationError, setLocationError] = useState("");
  const [sort, setSort] = useState<NonNullable<VenueSearchInput["sort"]>>("RELEVANT");
  const venueQuery = useInfiniteVenueSearch({
    query: searchParameters.get("q") || undefined,
    area: area || undefined,
    date: searchDate || undefined,
    time: searchDate && searchTime ? searchTime : undefined,
    sport: sport === "Semua" ? undefined : toSlug(sport),
    facilities: facilitySlugs.length > 0 ? facilitySlugs.join(",") : undefined,
    indoorOutdoorType:
      indoorOutdoorType === "ALL"
        ? undefined
        : (indoorOutdoorType as "INDOOR" | "OUTDOOR" | "MIXED"),
    paymentMode:
      paymentMode === "ALL"
        ? undefined
        : (paymentMode as "FULL" | "DP" | "PAY_AT_VENUE"),
    minimumRating: minimumRating === "ALL" ? undefined : Number(minimumRating),
    maximumPrice: maximumPrice ? Number(maximumPrice) : undefined,
    hasPromo: hasPromo || undefined,
    latitude: coordinates?.latitude,
    longitude: coordinates?.longitude,
    sort,
  });
  const filtered = venueQuery.data?.items ?? [];

  function requestCurrentLocation() {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError(
        "Browser ini tidak mendukung lokasi. Pencarian manual tetap tersedia.",
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCoordinates({ latitude: coords.latitude, longitude: coords.longitude });
        setSort("NEAREST");
      },
      () =>
        setLocationError(
          "Izin lokasi tidak diberikan. Kamu tetap dapat mencari berdasarkan area.",
        ),
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 300_000 },
    );
  }

  function toggleFacility(slug: string) {
    setFacilitySlugs((current) =>
      current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [...current, slug],
    );
  }
  function selectVenueFromMap(venueId: string) {
    dispatch({ type: "SELECT_VENUE", venueId });
    window.requestAnimationFrame(() => {
      document
        .getElementById(`venue-card-${venueId}`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }
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
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              const nextParameters = new URLSearchParams(searchParameters);
              if (query.trim()) nextParameters.set("q", query.trim());
              else nextParameters.delete("q");
              setSearchParameters(nextParameters);
            }}
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
            { value: "RELEVANT", label: "Paling relevan" },
            { value: "NEAREST", label: "Terdekat" },
            { value: "PRICE_LOWEST", label: "Harga terendah" },
            { value: "RATING_HIGHEST", label: "Rating tertinggi" },
            { value: "POPULAR", label: "Paling populer" },
            { value: "NEWEST", label: "Venue terbaru" },
          ]}
          value={sort}
          onValueChange={(value) =>
            setSort(value as NonNullable<VenueSearchInput["sort"]>)
          }
        />
        <Button variant="secondary" type="button" onClick={requestCurrentLocation}>
          <LocateFixed aria-hidden="true" />
          Dekat saya
        </Button>
      </div>
      <details className="search-filter-panel">
        <summary>Filter lainnya</summary>
        <div className="search-filter-grid">
          <label>
            Area
            <Input
              value={area}
              onChange={(event) => setArea(event.target.value)}
              placeholder="Contoh: Kemang"
            />
          </label>
          <label>
            Harga maksimum
            <Input
              inputMode="numeric"
              min="0"
              type="number"
              value={maximumPrice}
              onChange={(event) => setMaximumPrice(event.target.value)}
              placeholder="Contoh: 250000"
            />
          </label>
          <label>
            Tanggal main
            <Input
              type="date"
              value={searchDate}
              onChange={(event) => setSearchDate(event.target.value)}
            />
          </label>
          <label>
            Jam mulai
            <Input
              type="time"
              value={searchTime}
              disabled={!searchDate}
              onChange={(event) => setSearchTime(event.target.value)}
            />
          </label>
          <label>
            Jenis venue
            <SelectField
              ariaLabel="Filter jenis venue"
              options={[
                { value: "ALL", label: "Semua jenis" },
                { value: "INDOOR", label: "Indoor" },
                { value: "OUTDOOR", label: "Outdoor" },
                { value: "MIXED", label: "Indoor & outdoor" },
              ]}
              value={indoorOutdoorType}
              onValueChange={setIndoorOutdoorType}
            />
          </label>
          <label>
            Metode pembayaran
            <SelectField
              ariaLabel="Filter metode pembayaran"
              options={[
                { value: "ALL", label: "Semua metode" },
                { value: "FULL", label: "Bayar penuh" },
                { value: "DP", label: "DP" },
                { value: "PAY_AT_VENUE", label: "Bayar di venue" },
              ]}
              value={paymentMode}
              onValueChange={setPaymentMode}
            />
          </label>
          <label>
            Rating minimum
            <SelectField
              ariaLabel="Filter rating minimum"
              options={[
                { value: "ALL", label: "Semua rating" },
                { value: "4", label: "4,0 ke atas" },
                { value: "4.5", label: "4,5 ke atas" },
              ]}
              value={minimumRating}
              onValueChange={setMinimumRating}
            />
          </label>
          <label className="search-check-option">
            <input
              checked={hasPromo}
              onChange={(event) => setHasPromo(event.target.checked)}
              type="checkbox"
            />
            Promo tersedia
          </label>
        </div>
        <fieldset className="filter-chip-group">
          <legend>Fasilitas</legend>
          {[
            ["area-parkir", "Area parkir"],
            ["ruang-ganti", "Ruang ganti"],
            ["kamar-mandi", "Kamar mandi"],
            ["mushola", "Mushola"],
          ].map(([slug, label]) => (
            <button
              aria-pressed={facilitySlugs.includes(slug)}
              className={facilitySlugs.includes(slug) ? "active" : undefined}
              key={slug}
              onClick={() => toggleFacility(slug)}
              type="button"
            >
              {label}
            </button>
          ))}
        </fieldset>
      </details>
      {locationError && <p className="field-error">{locationError}</p>}
      <ScenarioBoundary scenario={state.scenario} emptyTitle="Venue tidak ditemukan">
        {venueQuery.isError ? (
          <div>
            <ErrorState onRetry={() => void venueQuery.refetch()} />
            <p className="field-error" data-testid="venue-query-error">
              {venueQuery.error instanceof Error
                ? venueQuery.error.message
                : "Respons katalog tidak dapat diproses."}
            </p>
          </div>
        ) : (
          <div className="search-layout" aria-busy={venueQuery.isLoading}>
            <div>
              <p className="result-count">
                <strong>{filtered.length} venue</strong> ditemukan · data diperbarui
                barusan
              </p>
              <div className="venue-list">
                {filtered.map((venue) => (
                  <VenueCard key={venue.id} venue={venue} compact />
                ))}
              </div>
              <InfiniteVenueLoader
                canLoad={Boolean(venueQuery.hasNextPage)}
                isLoading={venueQuery.isFetchingNextPage}
                onLoad={() => void venueQuery.fetchNextPage()}
              />
            </div>
            {serverStateEnabled ? (
              <VenueMap
                venues={filtered}
                selectedVenueId={state.selectedVenueId}
                onSelect={selectVenueFromMap}
                fallback={
                  <MockMap
                    venues={filtered}
                    selectedId={state.selectedVenueId}
                    onSelect={selectVenueFromMap}
                  />
                }
              />
            ) : (
              <MockMap
                venues={filtered}
                selectedId={state.selectedVenueId}
                onSelect={selectVenueFromMap}
              />
            )}
          </div>
        )}
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
          style={{
            left: `${mockMapPosition(venue).left}%`,
            top: `${mockMapPosition(venue).top}%`,
          }}
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

const fixtureMapPositions: Readonly<Record<string, { left: number; top: number }>> = {
  v1: { left: 28, top: 35 },
  v2: { left: 62, top: 56 },
  v3: { left: 46, top: 22 },
  v4: { left: 74, top: 31 },
  v5: { left: 30, top: 70 },
  v6: { left: 80, top: 74 },
};

function mockMapPosition(venue: { id: string; lat: number; lng: number }) {
  return (
    fixtureMapPositions[venue.id] ?? {
      left: longitudeToPercent(venue.lng),
      top: latitudeToPercent(venue.lat),
    }
  );
}

function longitudeToPercent(longitude: number): number {
  return clamp(((longitude - 106.62) / 0.24) * 100, 8, 92);
}

function latitudeToPercent(latitude: number): number {
  return clamp(((-6.16 - latitude) / 0.17) * 100, 8, 92);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function InfiniteVenueLoader({
  canLoad,
  isLoading,
  onLoad,
}: {
  canLoad: boolean;
  isLoading: boolean;
  onLoad: () => void;
}) {
  const trigger = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!canLoad || isLoading || !trigger.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) onLoad();
      },
      { rootMargin: "240px" },
    );
    observer.observe(trigger.current);
    return () => observer.disconnect();
  }, [canLoad, isLoading, onLoad]);

  if (!canLoad) return null;
  return (
    <div ref={trigger}>
      <Button
        className="load-more-button"
        disabled={isLoading}
        onClick={onLoad}
        variant="secondary"
      >
        {isLoading ? "Memuat venue…" : "Muat venue lainnya"}
      </Button>
    </div>
  );
}

export function VenueDetailPage() {
  const { slug } = useParams();
  const { state, dispatch } = usePrototype();
  const venueQuery = useVenueDetail(slug);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  if (venueQuery.isError) {
    return (
      <div className="content-container">
        <ErrorState onRetry={() => void venueQuery.refetch()} />
      </div>
    );
  }
  if (!venueQuery.data) {
    return (
      <div className="content-container">
        <LoadingState
          title="Memuat detail venue…"
          description="Menyiapkan informasi, lapangan, dan jadwal venue."
        />
      </div>
    );
  }
  const {
    venue,
    courts: venueCourts,
    description,
    galleryUrls,
    parkingInfo,
    houseRules,
  } = venueQuery.data;
  const isFavorite = state.favoriteVenueIds.includes(venue.id);
  const detailGallery = [...new Set([venue.image, ...galleryUrls, ...galleryImages])];
  return (
    <div className="content-container detail-page">
      <div className="back-row">
        <Link to="/venues">
          <ArrowLeft />
          Kembali ke hasil pencarian
        </Link>
        <button
          aria-pressed={isFavorite}
          onClick={() =>
            dispatch({
              type: "TOGGLE_FAVORITE",
              resource: "venue",
              resourceId: venue.id,
            })
          }
        >
          <Heart fill={isFavorite ? "currentColor" : "none"} />
          {isFavorite ? "Tersimpan" : "Simpan"}
        </button>
      </div>
      <InteractiveGallery images={detailGallery} venueName={venue.name} />
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
                <h2>Tentang venue</h2>
                <p>
                  {description ||
                    `${venue.name} menyediakan area olahraga yang dapat dipesan secara online.`}
                </p>
              </section>
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
                <p>{houseRules || "Kebijakan venue belum ditambahkan."}</p>
                {parkingInfo && <p>Parkir: {parkingInfo}</p>}
                <small>Pembayaran pada Phase B1 menggunakan Midtrans Sandbox.</small>
              </section>
            </TabsContent>
            <TabsContent value="courts">
              <section className="detail-section court-tab">
                <div className="court-tab-heading">
                  <div>
                    <p className="eyebrow">Pilih area bermain</p>
                    <h2>{venueCourts.length} lapangan siap dipesan</h2>
                    <p>Semua lapangan memakai jadwal dan harga yang transparan.</p>
                  </div>
                  <Badge tone="success">
                    <CircleCheck />
                    Tersedia hari ini
                  </Badge>
                </div>
                <div className="court-card-grid">
                  {venueCourts.map((court, index) => (
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
                            to={`/venues/${venue.slug}/book?court=${court.id}&date=${format(selectedDate, "yyyy-MM-dd")}`}
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
              <VenueReviews
                venueName={venue.name}
                rating={venue.rating}
                reviewCount={venue.reviewCount}
              />
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
            to={`/venues/${venue.slug}/book?date=${format(selectedDate, "yyyy-MM-dd")}`}
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

function toSlug(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}
