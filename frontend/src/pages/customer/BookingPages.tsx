import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { AvailabilitySlot } from "@lapangango/api-client";
import { format } from "date-fns";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MapPin,
  PencilLine,
  QrCode,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { apiClient, serverStateEnabled } from "../../api/apiClient";
import {
  clearCheckoutDraft,
  readCheckoutDraft,
  saveCheckoutDraft,
} from "../../api/bookingDraft";
import { isAuthenticationRequired, useSession } from "../../api/session";
import { useVenueDetail, useVenueSearch } from "../../api/venueQueries";
import { BookingDetailPanel } from "../../components/BookingDetailPanel";
import {
  PaymentMethodSelector,
  type PaymentMethodOption,
} from "../../components/PaymentMethodSelector";
import {
  PaymentStatusPanel,
  type SandboxPaymentResult,
} from "../../components/PaymentStatusPanel";
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Input,
  LoadingState,
  PageTitle,
  ScenarioBoundary,
  SimulasiLabel,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui";

const DEFAULT_RESCHEDULE_DATE = format(
  new Date(Date.now() + 2 * 86_400_000),
  "yyyy-MM-dd",
);
import {
  calculateCheckoutTotals,
  calculateServerCheckoutPreview,
} from "../../domain/checkout";
import {
  canToggleSlot,
  contiguousSelectionLabel,
  selectedSlotEntities,
} from "../../domain/slotSelection";
import type { Booking, PrototypeState } from "../../domain/types";
import { usePrototype } from "../../store/PrototypeStore";
import {
  formatRupiah,
  selectCourtSlots,
  selectVenueBySlug,
  selectVenueCourts,
  statusLabel,
} from "../../store/selectors";

export function BookingPage() {
  return serverStateEnabled ? <IntegratedBookingPage /> : <PrototypeBookingPage />;
}

function initialBookingDate(searchParameters: URLSearchParams): string {
  const requestedDate = z.iso.date().safeParse(searchParameters.get("date"));
  return requestedDate.success ? requestedDate.data : format(new Date(), "yyyy-MM-dd");
}

function PrototypeBookingPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state, dispatch } = usePrototype();
  const venue = selectVenueBySlug(state, slug);
  const courts = selectVenueCourts(state, venue.id);
  const requestedCourt = searchParams.get("court");
  const [courtId, setCourtId] = useState(
    courts.some((court) => court.id === requestedCourt)
      ? requestedCourt!
      : (courts[0]?.id ?? ""),
  );
  const [date, setDate] = useState(() => initialBookingDate(searchParams));
  const slots = selectCourtSlots(state, courtId);
  const selected = selectedSlotEntities(slots, state.selectedSlots);
  const subtotal = selected.reduce((sum, slot) => sum + slot.price, 0);

  useEffect(() => {
    dispatch({ type: "CLEAR_SLOTS" });
  }, [courtId, dispatch]);

  function continueToCheckout() {
    if (!selected.length) return;
    const booking: Booking = {
      id: `BK-DEMO-${String(state.bookings.length + 1).padStart(3, "0")}`,
      customerId: "u1",
      venueId: venue.id,
      courtId,
      date,
      slots: selected.map((slot) => slot.time),
      amount: subtotal,
      paymentStatus: "unpaid",
      status: "draft",
      source: "online",
    };
    dispatch({ type: "CREATE_BOOKING", booking });
    navigate(`/checkout/${booking.id}`);
  }

  return (
    <ScenarioBoundary scenario={state.scenario}>
      <div className="content-container booking-page">
        <PageTitle
          eyebrow="Langkah 1 dari 3"
          title="Pilih jadwal bermain"
          description={`${venue.name} · pilih maksimal tiga slot berurutan.`}
        />
        <div className="booking-layout">
          <main className="booking-main-stack">
            <label>
              Tanggal bermain
              <Input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <section className="detail-section">
              <h2>Pilih lapangan</h2>
              <div className="court-pills">
                {courts.map((court) => (
                  <Button
                    key={court.id}
                    className={court.id === courtId ? "active" : undefined}
                    variant={court.id === courtId ? "primary" : "secondary"}
                    onClick={() => setCourtId(court.id)}
                  >
                    {court.name}
                  </Button>
                ))}
              </div>
            </section>
            <Card className="slot-panel">
              <div className="section-heading">
                <div>
                  <h2>Pilih slot berurutan</h2>
                  <p>Slot harus berdampingan dan maksimal tiga jam.</p>
                </div>
                {selected.length > 0 && (
                  <Badge tone="success">
                    {contiguousSelectionLabel(slots, state.selectedSlots)}
                  </Badge>
                )}
              </div>
              <div className="slot-grid">
                {slots.map((slot) => {
                  const selectedNow = state.selectedSlots.includes(slot.id);
                  const available = slot.status === "available";
                  const selectable = canToggleSlot(slots, state.selectedSlots, slot.id);
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      className={`slot-button ${selectedNow ? "selected" : ""} ${slot.status === "booked" ? "booked" : ""} ${slot.status === "held" ? "held" : ""} ${available && !selectedNow && !selectable ? "selection-locked" : ""}`}
                      disabled={!available || (!selectedNow && !selectable)}
                      aria-pressed={selectedNow}
                      aria-label={`${slot.time} ${statusLabel(slot.status)}`}
                      onClick={() => dispatch({ type: "TOGGLE_SLOT", slotId: slot.id })}
                    >
                      <strong>{slot.time}</strong>
                      <small>{formatRupiah(slot.price)}</small>
                      {!available && <span>{statusLabel(slot.status)}</span>}
                      {available && !selectedNow && !selectable && (
                        <span>Pilih slot sebelahnya dahulu</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </Card>
          </main>
          <aside className="summary-panel booking-summary-panel">
            <h2>Ringkasan pilihan</h2>
            <div className="summary-venue">
              <img src={venue.image} alt="" />
              <div>
                <strong>{venue.name}</strong>
                <span>{courts.find((court) => court.id === courtId)?.name}</span>
              </div>
            </div>
            <dl>
              <div>
                <dt>Tanggal</dt>
                <dd>{date}</dd>
              </div>
              <div>
                <dt>Durasi</dt>
                <dd>{selected.length} jam</dd>
              </div>
              <div>
                <dt>Subtotal</dt>
                <dd>{formatRupiah(subtotal)}</dd>
              </div>
            </dl>
            <Button disabled={!selected.length} onClick={continueToCheckout}>
              Lanjut ke checkout <ChevronRight />
            </Button>
          </aside>
        </div>
      </div>
    </ScenarioBoundary>
  );
}

function IntegratedBookingPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParameters] = useSearchParams();
  const venueQuery = useVenueDetail(slug);
  const requestedCourtId = searchParameters.get("court");
  const [selectedCourtId, setSelectedCourtId] = useState(requestedCourtId ?? "");
  const [date, setDate] = useState(() => initialBookingDate(searchParameters));
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const courts = venueQuery.data?.courts ?? [];
  const courtId = selectedCourtId || courts[0]?.id || "";

  const availabilityQuery = useQuery({
    queryKey: ["availability", courtId, date],
    queryFn: () => apiClient.getAvailability(courtId, date),
    enabled: Boolean(courtId && date),
  });
  const slots = availabilityQuery.data?.items ?? [];
  const selectedSlots = slots.filter((slot) => selectedSlotIds.includes(slot.id));
  const subtotal = selectedSlots.reduce((total, slot) => total + slot.price, 0);

  if (venueQuery.isError) {
    return (
      <div className="content-container">
        <p>Detail venue tidak dapat dimuat dari API.</p>
      </div>
    );
  }
  if (!venueQuery.data) {
    return (
      <div className="content-container">
        <LoadingState
          title="Memuat pilihan jadwal…"
          description="Menyiapkan lapangan dan ketersediaan terbaru."
        />
      </div>
    );
  }
  const { venue } = venueQuery.data;
  const selectedCourt = courts.find((court) => court.id === courtId);

  function toggleSlot(slot: AvailabilitySlot) {
    setSelectedSlotIds((current) => toggleContiguousSlot(slots, current, slot));
  }

  function continueToCheckout() {
    if (!selectedCourt || selectedSlots.length === 0) return;
    const draftId = `draft-${crypto.randomUUID()}`;
    saveCheckoutDraft({
      id: draftId,
      idempotencyKey: crypto.randomUUID(),
      venueId: venue.id,
      venueName: venue.name,
      venueSlug: venue.slug,
      venueImage: venue.image,
      courtId: selectedCourt.id,
      courtName: selectedCourt.name,
      date,
      slots: selectedSlots,
    });
    navigate(`/checkout/${draftId}`);
  }

  return (
    <div className="content-container booking-page">
      <PageTitle
        eyebrow="Langkah 1 dari 3"
        title="Pilih jadwal bermain"
        description={`${venue.name} · harga dan ketersediaan langsung dari server.`}
      />
      <div className="booking-layout">
        <main className="booking-main-stack">
          <label>
            Tanggal bermain
            <Input
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setSelectedSlotIds([]);
              }}
            />
          </label>
          <section className="detail-section">
            <h2>Pilih lapangan</h2>
            <div className="court-pills" role="group" aria-label="Pilih lapangan">
              {courts.map((court) => (
                <Button
                  key={court.id}
                  variant={court.id === courtId ? "primary" : "secondary"}
                  onClick={() => {
                    setSelectedCourtId(court.id);
                    setSelectedSlotIds([]);
                  }}
                >
                  {court.name}
                </Button>
              ))}
            </div>
          </section>
          <Card className="slot-panel" aria-busy={availabilityQuery.isLoading}>
            <div className="section-heading">
              <div>
                <h2>Pilih slot berurutan</h2>
                <p>Maksimal tiga jam; slot tidak tersedia tidak dapat dilewati.</p>
              </div>
              <Badge tone="info">Harga authoritative API</Badge>
            </div>
            <div className="slot-status-legend" aria-label="Keterangan status slot">
              <span>
                <i className="available" />
                Tersedia
              </span>
              <span>
                <i className="selected" />
                Dipilih
              </span>
              <span>
                <i className="booked" />
                Sudah dipesan
              </span>
              <span>
                <i className="locked" />
                Belum berurutan
              </span>
            </div>
            {availabilityQuery.isLoading ? (
              <LoadingState
                compact
                title="Memuat slot tersedia…"
                description="Memeriksa jadwal dan harga terbaru dari server."
              />
            ) : availabilityQuery.isError ? (
              <p>Slot tidak dapat dimuat. Coba kembali beberapa saat lagi.</p>
            ) : (
              <div className="slot-grid">
                {slots.map((slot) => {
                  const selected = selectedSlotIds.includes(slot.id);
                  const selectable = canSelectApiSlot(slots, selectedSlotIds, slot);
                  const selectionLocked =
                    slot.status === "AVAILABLE" && !selected && !selectable;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      className={`slot-button ${selected ? "selected" : ""} ${slot.status === "BOOKED" ? "booked" : ""} ${slot.status === "HELD" ? "held" : ""} ${selectionLocked ? "selection-locked" : ""}`}
                      disabled={
                        slot.status !== "AVAILABLE" || (!selected && !selectable)
                      }
                      aria-pressed={selected}
                      onClick={() => toggleSlot(slot)}
                    >
                      <strong>{formatApiSlotTime(slot.startsAt)}</strong>
                      <small>{formatRupiah(slot.price)}</small>
                      {slot.status !== "AVAILABLE" && (
                        <span>{apiSlotStatusLabel(slot.status)}</span>
                      )}
                      {selectionLocked && <span>Pilih slot sebelahnya dahulu</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </main>
        <aside className="summary-panel booking-summary-panel">
          <h2>Ringkasan pilihan</h2>
          <div className="summary-venue">
            <img src={venue.image} alt="" />
            <div>
              <strong>{venue.name}</strong>
              <span>{selectedCourt?.name ?? "Pilih lapangan"}</span>
            </div>
          </div>
          <dl>
            <div>
              <dt>Tanggal</dt>
              <dd>{date}</dd>
            </div>
            <div>
              <dt>Durasi</dt>
              <dd>{selectedSlots.length} jam</dd>
            </div>
            <div>
              <dt>Subtotal preview</dt>
              <dd>{formatRupiah(subtotal)}</dd>
            </div>
          </dl>
          <Button disabled={!selectedSlots.length} onClick={continueToCheckout}>
            Lanjut ke checkout <ChevronRight />
          </Button>
        </aside>
      </div>
    </div>
  );
}

function toggleContiguousSlot(
  slots: AvailabilitySlot[],
  selectedIds: string[],
  candidate: AvailabilitySlot,
): string[] {
  if (selectedIds.includes(candidate.id)) {
    const orderedSelection = slots.filter((slot) => selectedIds.includes(slot.id));
    const isEdge =
      orderedSelection[0]?.id === candidate.id ||
      orderedSelection.at(-1)?.id === candidate.id;
    return isEdge ? selectedIds.filter((id) => id !== candidate.id) : selectedIds;
  }
  if (!canSelectApiSlot(slots, selectedIds, candidate)) return selectedIds;
  return [...selectedIds, candidate.id];
}

function canSelectApiSlot(
  slots: AvailabilitySlot[],
  selectedIds: string[],
  candidate: AvailabilitySlot,
): boolean {
  if (candidate.status !== "AVAILABLE" || selectedIds.length >= 3) return false;
  if (selectedIds.length === 0) return true;
  const selected = slots.filter((slot) => selectedIds.includes(slot.id));
  const first = selected[0]!;
  const last = selected.at(-1)!;
  return candidate.endsAt === first.startsAt || candidate.startsAt === last.endsAt;
}

function formatApiSlotTime(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
    hourCycle: "h23",
  }).format(new Date(value));
}

function formatCheckoutDate(value: string): string {
  const date = new Date(`${value}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function apiSlotStatusLabel(status: AvailabilitySlot["status"]): string {
  if (status === "BOOKED") return "Sudah dipesan";
  if (status === "HELD") return "Sedang ditahan";
  if (status === "BLOCKED") return "Tidak tersedia";
  return "Tersedia";
}

const checkoutSchema = z.object({
  agreement: z.boolean().refine(Boolean, {
    message: "Persetujuan kebijakan wajib dicentang.",
  }),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

export function CheckoutPage() {
  return serverStateEnabled ? <IntegratedCheckoutPage /> : <PrototypeCheckoutPage />;
}

function CheckoutBookingCard({
  venueName,
  courtName,
  date,
  slotLabel,
  image,
  editHref,
}: {
  venueName: string;
  courtName: string;
  date: string;
  slotLabel: string;
  image?: string;
  editHref: string;
}) {
  return (
    <Card className="checkout-card checkout-booking-card">
      {image && <img src={image} alt={`Foto ${venueName}`} />}
      <div className="checkout-booking-copy">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Detail booking</p>
            <h2>{venueName}</h2>
          </div>
          <Link to={editHref} className="checkout-edit-link">
            <PencilLine /> Ubah
          </Link>
        </div>
        <strong>{courtName}</strong>
        <div className="checkout-booking-meta">
          <span>
            <CalendarDays /> {formatCheckoutDate(date)}
          </span>
          <span>
            <Clock3 /> {slotLabel}
          </span>
        </div>
      </div>
    </Card>
  );
}

function prototypePaymentOptions({
  amount,
  addOnSelected,
  promoApplied,
}: {
  amount: number;
  addOnSelected: boolean;
  promoApplied: boolean;
}): PaymentMethodOption[] {
  const dueNow = (method: "full" | "dp" | "venue") =>
    calculateCheckoutTotals({
      amount,
      paymentMethod: method,
      addOnSelected,
      promoApplied,
    }).dueNow;
  return [
    {
      value: "full",
      label: "Bayar penuh",
      description: "Selesaikan seluruh pembayaran sekarang.",
      amount: formatRupiah(dueNow("full")),
      badge: "Direkomendasikan",
      icon: "card",
    },
    {
      value: "dp",
      label: "DP 30%",
      description: "Bayar sebagian dan lunasi sebelum bermain.",
      amount: formatRupiah(dueNow("dp")),
      icon: "deposit",
    },
    {
      value: "venue",
      label: "Bayar di venue",
      description: "Konfirmasi sekarang, bayar saat tiba.",
      amount: formatRupiah(0),
      icon: "venue",
    },
  ];
}

function serverPaymentOptions(total: number): PaymentMethodOption[] {
  const dueNow = (mode: "FULL" | "DP" | "PAY_AT_VENUE") =>
    calculateServerCheckoutPreview(total, mode).dueNow;
  return [
    {
      value: "FULL",
      label: "Bayar penuh",
      description: "Booking dikonfirmasi setelah pembayaran berhasil.",
      amount: formatRupiah(dueNow("FULL")),
      badge: "Direkomendasikan",
      icon: "card",
    },
    {
      value: "DP",
      label: "DP 50%",
      description: "Bayar setengah sekarang, sisanya sebelum bermain.",
      amount: formatRupiah(dueNow("DP")),
      icon: "deposit",
    },
    {
      value: "PAY_AT_VENUE",
      label: "Bayar di venue",
      description: "Pembayaran dicatat saat kamu tiba di lokasi.",
      amount: formatRupiah(0),
      icon: "venue",
    },
  ];
}

function PrototypeCheckoutPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { state } = usePrototype();
  const booking =
    state.bookings.find((item) => item.id === bookingId) ?? state.bookings[0];
  const venue = state.venues.find((item) => item.id === booking.venueId)!;
  const [method, setMethod] = useState<"full" | "dp" | "venue">("full");
  const [addOn, setAddOn] = useState(false);
  const [promo, setPromo] = useState(false);
  const totals = calculateCheckoutTotals({
    amount: booking.amount,
    paymentMethod: method,
    addOnSelected: addOn,
    promoApplied: promo,
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { agreement: false },
  });

  return (
    <ScenarioBoundary scenario={state.scenario}>
      <div className="content-container checkout-page">
        <PageTitle
          eyebrow="Langkah 2 dari 3"
          title="Periksa dan bayar"
          description="Semua pembayaran pada prototype ini adalah simulasi."
          action={<SimulasiLabel />}
        />
        <form
          className="checkout-layout"
          onSubmit={handleSubmit(() =>
            navigate(`/payments/PAY-${booking.id}?method=${method}`),
          )}
        >
          <div className="checkout-stack">
            <CheckoutBookingCard
              venueName={venue.name}
              courtName={
                state.courts.find((court) => court.id === booking.courtId)?.name ??
                "Lapangan"
              }
              date={booking.date}
              slotLabel={booking.slots.join(", ")}
              image={venue.image}
              editHref={`/venues/${venue.slug}/book`}
            />
            <Card className="checkout-card">
              <PaymentMethodSelector
                value={method}
                options={prototypePaymentOptions({
                  amount: booking.amount,
                  addOnSelected: addOn,
                  promoApplied: promo,
                })}
                onChange={(value) => setMethod(value as typeof method)}
              />
              <label className="checkout-addon-row">
                <input
                  type="checkbox"
                  checked={addOn}
                  onChange={(event) => setAddOn(event.target.checked)}
                />
                <span>
                  <strong>Sewa perlengkapan</strong>
                  <small>Raket atau bola disiapkan di venue.</small>
                </span>
                <strong>{formatRupiah(25_000)}</strong>
              </label>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPromo(!promo)}
              >
                {promo ? "Promo LAPANGAN20 aktif" : "Pakai promo LAPANGAN20"}
              </Button>
            </Card>
          </div>
          <aside className="summary-card checkout-summary-card">
            <p className="eyebrow">Ringkasan pembayaran</p>
            <h2>Rincian harga</h2>
            <dl>
              <div>
                <dt>Subtotal</dt>
                <dd>{formatRupiah(totals.subtotal)}</dd>
              </div>
              <div>
                <dt>Diskon</dt>
                <dd>-{formatRupiah(totals.discount)}</dd>
              </div>
              <div className="checkout-summary-total">
                <dt>Total</dt>
                <dd>{formatRupiah(totals.total)}</dd>
              </div>
              <div className="checkout-summary-due">
                <dt>Dibayar sekarang</dt>
                <dd>{formatRupiah(totals.dueNow)}</dd>
              </div>
            </dl>
            <label className="check-row">
              <input type="checkbox" {...register("agreement")} />
              Saya menyetujui kebijakan venue.
            </label>
            {errors.agreement && (
              <p className="field-error">{errors.agreement.message}</p>
            )}
            <Button type="submit" size="lg">
              Lanjut pembayaran
            </Button>
            <p className="checkout-secure-note">
              <ShieldCheck /> Pembayaran sandbox diamankan oleh server LapanganGo.
            </p>
          </aside>
        </form>
      </div>
    </ScenarioBoundary>
  );
}

function IntegratedCheckoutPage() {
  const { bookingId: draftId } = useParams();
  const navigate = useNavigate();
  const session = useSession();
  const draft = readCheckoutDraft(draftId);
  const venueDetail = useVenueDetail(draft?.venueSlug);
  const [paymentMode, setPaymentMode] = useState<"FULL" | "DP" | "PAY_AT_VENUE">(
    "FULL",
  );
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [agreement, setAgreement] = useState(false);
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error("Draft checkout tidak ditemukan.");
      const booking = await apiClient.createBooking(
        {
          venueId: draft.venueId,
          courtId: draft.courtId,
          slotIds: draft.slots.map((slot) => slot.id),
          addonIds: selectedAddonIds,
          paymentMode,
        },
        draft.idempotencyKey,
      );
      const attemptKind = paymentMode === "PAY_AT_VENUE" ? "RESERVATION" : paymentMode;
      const attempt = await apiClient.createPaymentAttempt(
        booking.id,
        attemptKind,
        crypto.randomUUID(),
      );
      return { booking, attempt };
    },
    onSuccess: ({ booking, attempt }) => {
      clearCheckoutDraft();
      if (attempt) navigate(`/payments/${attempt.id}`);
      else navigate(`/bookings/${booking.id}`);
    },
    onError: (error) => {
      if (isAuthenticationRequired(error)) navigateToLogin();
    },
  });

  function navigateToLogin() {
    navigate("/login", {
      state: { from: `/checkout/${draftId ?? ""}` },
    });
  }

  function submitCheckout() {
    if (!session.data) {
      navigateToLogin();
      return;
    }
    checkoutMutation.mutate();
  }

  if (!draft) {
    return (
      <div className="content-container">
        <PageTitle
          eyebrow="Checkout"
          title="Draft checkout tidak ditemukan"
          description="Pilih ulang jadwal agar harga dan slot dapat divalidasi server."
        />
        <Link className="btn btn-primary" to="/venues">
          Cari venue
        </Link>
      </div>
    );
  }
  const addons = venueDetail.data?.addons ?? [];
  const selectedAddonTotal = addons
    .filter((addon) => selectedAddonIds.includes(addon.id))
    .reduce((total, addon) => total + addon.price, 0);
  const slotSubtotal = draft.slots.reduce((total, slot) => total + slot.price, 0);
  const previewTotal = slotSubtotal + selectedAddonTotal;
  const previewTotals = calculateServerCheckoutPreview(previewTotal, paymentMode);

  return (
    <div className="content-container checkout-page">
      <PageTitle
        eyebrow="Langkah 2 dari 3"
        title="Periksa dan bayar"
        description="Server akan menghitung ulang slot dan harga saat booking dibuat."
        action={<SimulasiLabel />}
      />
      <div className="checkout-layout">
        <div className="checkout-stack">
          <CheckoutBookingCard
            venueName={draft.venueName}
            courtName={draft.courtName}
            date={draft.date}
            slotLabel={draft.slots
              .map((slot) => formatApiSlotTime(slot.startsAt))
              .join(", ")}
            image={draft.venueImage}
            editHref={`/venues/${draft.venueSlug}/book?court=${draft.courtId}`}
          />
          <Card className="checkout-card">
            <PaymentMethodSelector
              value={paymentMode}
              options={serverPaymentOptions(previewTotal)}
              onChange={(value) => setPaymentMode(value as typeof paymentMode)}
            />
            {addons.length > 0 && (
              <fieldset className="checkout-addon-list">
                <legend>Tambahan venue</legend>
                {addons.map((addon) => {
                  const selected = selectedAddonIds.includes(addon.id);
                  return (
                    <label className="checkout-addon-row" key={addon.id}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(event) =>
                          setSelectedAddonIds((current) =>
                            event.target.checked
                              ? [...current, addon.id]
                              : current.filter((id) => id !== addon.id),
                          )
                        }
                      />
                      <span>
                        <strong>{addon.name}</strong>
                        <small>Harga dikunci sebagai snapshot booking.</small>
                      </span>
                      <strong>{formatRupiah(addon.price)}</strong>
                    </label>
                  );
                })}
              </fieldset>
            )}
            <div className="checkout-promo-notice">
              <Badge tone="info">Promo tersedia</Badge>
              <span>Promo discovery belum mengurangi checkout pada Phase B1.</span>
            </div>
          </Card>
        </div>
        <aside className="summary-card checkout-summary-card">
          <p className="eyebrow">Ringkasan pembayaran</p>
          <h2>Rincian harga</h2>
          <dl>
            <div>
              <dt>Sewa lapangan</dt>
              <dd>{formatRupiah(slotSubtotal)}</dd>
            </div>
            {selectedAddonTotal > 0 && (
              <div>
                <dt>Add-on</dt>
                <dd>{formatRupiah(selectedAddonTotal)}</dd>
              </div>
            )}
            <div>
              <dt>Diskon promo</dt>
              <dd>{formatRupiah(previewTotals.discount)}</dd>
            </div>
            <div className="checkout-summary-total">
              <dt>Total</dt>
              <dd>{formatRupiah(previewTotals.total)}</dd>
            </div>
            <div className="checkout-summary-due">
              <dt>Dibayar sekarang</dt>
              <dd>{formatRupiah(previewTotals.dueNow)}</dd>
            </div>
          </dl>
          <label className="check-row">
            <input
              type="checkbox"
              checked={agreement}
              onChange={(event) => setAgreement(event.target.checked)}
            />
            Saya menyetujui kebijakan venue.
          </label>
          {checkoutMutation.isError &&
            !isAuthenticationRequired(checkoutMutation.error) && (
              <p className="field-error">
                {checkoutMutation.error instanceof Error
                  ? checkoutMutation.error.message
                  : "Checkout gagal."}
              </p>
            )}
          <Button
            type="button"
            size="lg"
            disabled={!agreement || checkoutMutation.isPending || session.isPending}
            onClick={submitCheckout}
          >
            {session.isPending
              ? "Memeriksa akun…"
              : !session.data
                ? "Masuk untuk lanjut"
                : checkoutMutation.isPending
                  ? "Memvalidasi slot…"
                  : "Buat booking dan lanjut"}
          </Button>
          <p className="checkout-secure-note">
            <ShieldCheck /> Harga dan slot divalidasi ulang sebelum booking dibuat.
          </p>
        </aside>
      </div>
    </div>
  );
}

function bookingIdFromAttempt(attemptId: string | undefined, state: PrototypeState) {
  return attemptId?.replace(/^PAY-/, "") ?? state.bookings[0].id;
}

export function PaymentPage() {
  return serverStateEnabled ? <IntegratedPaymentPage /> : <PrototypePaymentPage />;
}

function PrototypePaymentPage() {
  const { attemptId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { state, dispatch } = usePrototype();
  const method = (searchParams.get("method") ?? "full") as "full" | "dp" | "venue";
  const bookingId = bookingIdFromAttempt(attemptId, state);
  const booking = state.bookings.find((item) => item.id === bookingId)!;
  const [seconds, setSeconds] = useState(300);

  useEffect(() => {
    if (seconds <= 0) {
      dispatch({
        type: "PAYMENT_RESULT",
        bookingId,
        result: "expired",
        method,
      });
      navigate(`/payments/${attemptId}/result?status=expired&method=${method}`);
      return;
    }
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1_000);
    return () => window.clearTimeout(timer);
  }, [attemptId, bookingId, dispatch, method, navigate, seconds]);

  function finish(result: SandboxPaymentResult) {
    dispatch({ type: "PAYMENT_RESULT", bookingId, result, method });
    navigate(`/payments/${attemptId}/result?status=${result}&method=${method}`);
  }

  return (
    <div className="content-container payment-page">
      <PageTitle
        eyebrow="Langkah 3 dari 3"
        title="Selesaikan pembayaran"
        description={`Booking ${booking.id} · metode ${method}`}
        action={<SimulasiLabel />}
      />
      <PaymentStatusPanel
        attemptId={attemptId ?? "PAY-DEMO"}
        bookingId={booking.id}
        amount={formatRupiah(booking.amount)}
        kind={method === "full" ? "FULL" : method === "dp" ? "DP" : "RESERVATION"}
        status="PENDING"
        countdown={`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}
        onSimulate={finish}
      />
    </div>
  );
}

function IntegratedPaymentPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const attemptQuery = useQuery({
    queryKey: ["payment-attempt", attemptId],
    queryFn: () => apiClient.getPaymentAttempt(attemptId!),
    enabled: Boolean(attemptId),
    refetchInterval: 5_000,
  });
  const simulation = useMutation({
    mutationFn: (result: "success" | "pending" | "failed" | "expired") =>
      apiClient.simulatePaymentAttempt(attemptId!, result),
    onSuccess: (_data, result) => {
      void attemptQuery.refetch();
      navigate(`/payments/${attemptId}/result?status=${result}`);
    },
  });
  if (!attemptQuery.data) {
    return (
      <div className="content-container" aria-busy="true">
        Memuat pembayaran…
      </div>
    );
  }
  const attempt = attemptQuery.data;
  return (
    <div className="content-container payment-page">
      <PageTitle
        eyebrow="Langkah 3 dari 3"
        title="Selesaikan pembayaran"
        description={`Transaksi #${attempt.id} · ${formatRupiah(attempt.amount)}`}
        action={<SimulasiLabel />}
      />
      <PaymentStatusPanel
        attemptId={attempt.id}
        bookingId={attempt.bookingId}
        amount={formatRupiah(attempt.amount)}
        kind={attempt.kind}
        status={attempt.status}
        isSubmitting={simulation.isPending}
        errorMessage={
          simulation.isError ? "Hasil sandbox tidak dapat diproses." : undefined
        }
        onSimulate={(result) => simulation.mutate(result)}
      />
    </div>
  );
}

export function PaymentResultPage() {
  return serverStateEnabled ? (
    <IntegratedPaymentResultPage />
  ) : (
    <PrototypePaymentResultPage />
  );
}

function PrototypePaymentResultPage() {
  const { attemptId } = useParams();
  const [searchParams] = useSearchParams();
  const { state } = usePrototype();
  const status = searchParams.get("status") ?? "pending";
  const bookingId = bookingIdFromAttempt(attemptId, state);
  const copy: Record<string, [string, string]> = {
    success: ["Booking berhasil!", "Jadwalmu telah dikonfirmasi."],
    pending: [
      "Pembayaran sedang diproses",
      "Periksa kembali status beberapa saat lagi.",
    ],
    failed: ["Pembayaran belum berhasil", "Coba metode pembayaran lain."],
    expired: ["Waktu pembayaran habis", "Pilih ulang slot untuk membuat booking baru."],
  };
  const [title, description] = copy[status] ?? [
    "Status tidak dikenali",
    "Periksa daftar booking.",
  ];
  return (
    <div className="content-container result-page">
      <Card className="result-card">
        {status === "success" ? <CheckCircle2 /> : <Clock3 />}
        <SimulasiLabel />
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="detail-actions">
          <Link className="btn btn-primary btn-md" to={`/bookings/${bookingId}`}>
            Lihat detail booking
          </Link>
          <Link className="btn btn-secondary btn-md" to="/bookings">
            Booking Saya
          </Link>
        </div>
      </Card>
    </div>
  );
}

function IntegratedPaymentResultPage() {
  const { attemptId } = useParams();
  const [searchParameters] = useSearchParams();
  const navigate = useNavigate();
  const attemptQuery = useQuery({
    queryKey: ["payment-attempt", attemptId],
    queryFn: () => apiClient.getPaymentAttempt(attemptId!),
    enabled: Boolean(attemptId),
  });
  const retryAttempt = useMutation({
    mutationFn: () => {
      if (!attemptQuery.data) throw new Error("Payment attempt belum tersedia.");
      return apiClient.createPaymentAttempt(
        attemptQuery.data.bookingId,
        "RETRY",
        crypto.randomUUID(),
      );
    },
    onSuccess: (attempt) => navigate(`/payments/${attempt.id}`),
  });
  const requestedStatus = searchParameters.get("status") ?? "pending";
  const status = attemptQuery.data?.status.toLowerCase() ?? requestedStatus;
  const copy: Record<string, [string, string]> = {
    paid: [
      "Booking berhasil!",
      "Pembayaran sandbox diterima dan booking dikonfirmasi.",
    ],
    success: [
      "Booking berhasil!",
      "Pembayaran sandbox diterima dan booking dikonfirmasi.",
    ],
    pending: [
      "Pembayaran sedang diproses",
      "Status akan disinkronkan melalui REST dan sinyal realtime.",
    ],
    failed: [
      "Pembayaran belum berhasil",
      "Booking dapat membuat payment attempt retry selama hold aktif.",
    ],
    expired: [
      "Waktu pembayaran habis",
      "Slot dilepas dan pembayaran terlambat tidak mengaktifkan booking.",
    ],
  };
  const [title, description] = copy[status] ?? [
    "Status pembayaran diperbarui",
    "Periksa kembali detail booking.",
  ];
  return (
    <div className="content-container result-page">
      <Card className="result-card" aria-busy={attemptQuery.isLoading}>
        {status === "paid" || status === "success" ? <CheckCircle2 /> : <Clock3 />}
        <SimulasiLabel />
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="detail-actions">
          {status === "failed" && attemptQuery.data && (
            <Button
              type="button"
              disabled={retryAttempt.isPending}
              onClick={() => retryAttempt.mutate()}
            >
              {retryAttempt.isPending ? "Membuat percobaan…" : "Coba bayar lagi"}
            </Button>
          )}
          {attemptQuery.data && (
            <Link
              className="btn btn-primary btn-md"
              to={`/bookings/${attemptQuery.data.bookingId}`}
            >
              Lihat detail booking
            </Link>
          )}
          <Link className="btn btn-secondary btn-md" to="/venues">
            Cari venue lain
          </Link>
        </div>
        {retryAttempt.isError && (
          <p className="field-error" role="alert">
            Payment attempt baru tidak dapat dibuat. Periksa masa berlaku booking.
          </p>
        )}
      </Card>
    </div>
  );
}

export function BookingsPage() {
  return serverStateEnabled ? <IntegratedBookingsPage /> : <PrototypeBookingsPage />;
}

function IntegratedBookingsPage() {
  const session = useSession();
  const bookings = useQuery({
    queryKey: ["customer", "bookings"],
    queryFn: () => apiClient.listCustomerBookings(),
    enabled: Boolean(session.data),
  });
  if (session.isPending) {
    return (
      <div className="content-container">
        <LoadingState
          title="Memeriksa akun…"
          description="Menyiapkan daftar booking Anda."
        />
      </div>
    );
  }
  if (session.isError && !isAuthenticationRequired(session.error)) {
    return (
      <div className="content-container">
        <EmptyState
          title="Akun belum dapat diperiksa"
          description="Terjadi gangguan saat memeriksa sesi Anda. Silakan coba kembali."
          action={<Button onClick={() => void session.refetch()}>Coba lagi</Button>}
        />
      </div>
    );
  }
  if (!session.data) {
    return (
      <div className="content-container">
        <PageTitle
          eyebrow="Aktivitas"
          title="Booking Saya"
          description="Masuk untuk melihat jadwal, pembayaran, dan status booking Anda."
        />
        <EmptyState
          title="Masuk untuk melihat booking"
          description="Daftar booking tersimpan secara pribadi di akun LapanganGo Anda."
          action={
            <Link
              className="btn btn-primary btn-md"
              to="/login"
              state={{ from: "/bookings" }}
            >
              Masuk ke akun
            </Link>
          }
        />
      </div>
    );
  }
  if (bookings.isLoading) {
    return (
      <div className="content-container">
        <LoadingState
          title="Memuat Booking Saya…"
          description="Mengambil jadwal dan status pembayaran terbaru."
        />
      </div>
    );
  }
  if (bookings.isError || !bookings.data) {
    return (
      <div className="content-container">
        <EmptyState
          title="Booking belum dapat dimuat"
          description="Terjadi gangguan saat mengambil booking Anda. Silakan coba kembali."
          action={<Button onClick={() => void bookings.refetch()}>Coba lagi</Button>}
        />
      </div>
    );
  }
  const upcoming = bookings.data.items.filter(
    (booking) => !["COMPLETED", "CANCELLED", "EXPIRED"].includes(booking.status),
  );
  const history = bookings.data.items.filter(
    (booking) => booking.status === "COMPLETED",
  );
  const cancelled = bookings.data.items.filter((booking) =>
    ["CANCELLED", "EXPIRED"].includes(booking.status),
  );
  return (
    <div className="content-container">
      <PageTitle
        eyebrow="Aktivitas"
        title="Booking Saya"
        description="Pantau jadwal, pembayaran, dan status booking dalam satu tempat."
      />
      <Tabs defaultValue="upcoming">
        <TabsList className="tabs-list">
          <TabsTrigger value="upcoming">Akan datang ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="history">Riwayat ({history.length})</TabsTrigger>
          <TabsTrigger value="cancelled">Dibatalkan ({cancelled.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming">
          <CustomerBookingRows bookings={upcoming} />
        </TabsContent>
        <TabsContent value="history">
          <CustomerBookingRows bookings={history} />
        </TabsContent>
        <TabsContent value="cancelled">
          <CustomerBookingRows bookings={cancelled} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CustomerBookingRows({
  bookings,
}: {
  bookings: Awaited<ReturnType<typeof apiClient.listCustomerBookings>>["items"];
}) {
  if (bookings.length === 0)
    return (
      <EmptyState
        title="Belum ada booking"
        description="Booking pada kategori ini akan muncul di sini."
        action={
          <Link className="btn btn-primary btn-md" to="/venues">
            Cari venue
          </Link>
        }
      />
    );
  return (
    <div className="booking-list customer-booking-list">
      {bookings.map((booking) => (
        <Link
          className="customer-booking-card"
          key={booking.id}
          to={`/bookings/${booking.id}`}
        >
          <div className="date-tile">
            <strong>{new Date(booking.startsAt).getDate()}</strong>
            <span>
              {new Intl.DateTimeFormat("id-ID", { month: "short" }).format(
                new Date(booking.startsAt),
              )}
            </span>
          </div>
          <div className="customer-booking-copy">
            <Badge tone={customerBookingStatusTone(booking.status)}>
              {customerBookingStatusLabel(booking.status)}
            </Badge>
            <h3>{booking.venueName}</h3>
            <p>
              <MapPin /> {booking.courtName}
            </p>
            <p>
              <Clock3 />
              {new Intl.DateTimeFormat("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(booking.startsAt))}{" "}
              –{" "}
              {new Intl.DateTimeFormat("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(booking.endsAt))}
            </p>
          </div>
          <div className="customer-booking-payment">
            <span>Total booking</span>
            <strong>{formatRupiah(booking.totalAmount)}</strong>
            {booking.balanceDue > 0 && (
              <small>Sisa {formatRupiah(booking.balanceDue)}</small>
            )}
          </div>
          <span className="customer-booking-chevron" aria-hidden="true">
            <ChevronRight />
          </span>
        </Link>
      ))}
    </div>
  );
}

function customerBookingStatusLabel(status: string) {
  return (
    (
      {
        HOLD: "Menunggu pembayaran",
        PENDING_CONFIRMATION: "Menunggu konfirmasi",
        CONFIRMED: "Terkonfirmasi",
        COMPLETED: "Selesai",
        CANCELLED: "Dibatalkan",
        EXPIRED: "Kedaluwarsa",
      } as Record<string, string>
    )[status] ?? status
  );
}

function customerBookingStatusTone(status: string): "success" | "warning" | "danger" {
  if (["CONFIRMED", "COMPLETED"].includes(status)) return "success";
  if (["CANCELLED", "EXPIRED"].includes(status)) return "danger";
  return "warning";
}

function PrototypeBookingsPage() {
  const { state } = usePrototype();
  return (
    <div className="content-container">
      <PageTitle
        eyebrow="Aktivitas"
        title="Booking Saya"
        description="Pantau jadwal, pembayaran, dan status booking dalam satu tempat."
      />
      <Tabs defaultValue="upcoming">
        <TabsList className="tabs-list">
          <TabsTrigger value="upcoming">Akan datang</TabsTrigger>
          <TabsTrigger value="history">Riwayat</TabsTrigger>
          <TabsTrigger value="cancelled">Dibatalkan</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming">
          <div className="booking-list">
            {state.bookings.slice(0, 6).map((booking) => {
              const venue = state.venues.find((item) => item.id === booking.venueId)!;
              return (
                <Link
                  className="booking-row"
                  key={booking.id}
                  to={`/bookings/${booking.id}`}
                >
                  <div className="date-tile">
                    <strong>{booking.date.slice(-2)}</strong>
                    <span>AGS</span>
                  </div>
                  <img src={venue.image} alt="" />
                  <div>
                    <Badge
                      tone={booking.status === "confirmed" ? "success" : "warning"}
                    >
                      {statusLabel(booking.status)}
                    </Badge>
                    <h3>{venue.name}</h3>
                    <p>
                      {booking.slots.join(", ")} · {booking.id}
                    </p>
                  </div>
                  <strong>{formatRupiah(booking.amount)}</strong>
                  <ChevronRight />
                </Link>
              );
            })}
          </div>
        </TabsContent>
        <TabsContent value="history">
          <p className="tab-message">
            Riwayat booking selesai menggunakan fixture yang sama.
          </p>
        </TabsContent>
        <TabsContent value="cancelled">
          <p className="tab-message">Tidak ada booking yang dibatalkan.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function BookingDetailPage() {
  return serverStateEnabled ? (
    <IntegratedBookingDetailPage />
  ) : (
    <PrototypeBookingDetailPage />
  );
}

function PrototypeBookingDetailPage() {
  const { id } = useParams();
  const { state, dispatch } = usePrototype();
  const [newDate, setNewDate] = useState("2026-08-29");
  const booking = state.bookings.find((item) => item.id === id) ?? state.bookings[0];
  const venue = state.venues.find((item) => item.id === booking.venueId)!;
  return (
    <div className="content-container">
      <PageTitle
        eyebrow={`Booking ${booking.id}`}
        title={venue.name}
        description="Tunjukkan QR simulasi ini kepada staff saat check-in."
        action={<Badge tone="success">{statusLabel(booking.status)}</Badge>}
      />
      <div className="detail-layout">
        <main>
          <Card className="booking-detail-card">
            <div className="booking-hero">
              <img src={venue.image} alt={venue.name} />
              <div>
                <h2>{booking.date}</h2>
                <p>{booking.slots.join(", ")} · Lapangan 1</p>
                <p>
                  <MapPin />
                  {venue.location}
                </p>
              </div>
            </div>
            <div className="detail-actions">
              <Dialog
                title="Jadwalkan ulang"
                description="Tanggal baru memakai slot venue yang sama pada prototype."
                trigger={<Button variant="secondary">Jadwalkan ulang</Button>}
              >
                <label>
                  Tanggal baru
                  <Input
                    type="date"
                    value={newDate}
                    onChange={(event) => setNewDate(event.target.value)}
                  />
                </label>
                <Button
                  onClick={() =>
                    dispatch({
                      type: "RESCHEDULE_BOOKING",
                      bookingId: booking.id,
                      date: newDate,
                    })
                  }
                >
                  Simpan jadwal baru
                </Button>
              </Dialog>
              <Button
                variant="ghost"
                disabled={booking.status === "cancelled"}
                onClick={() =>
                  dispatch({ type: "CANCEL_BOOKING", bookingId: booking.id })
                }
              >
                {booking.status === "cancelled"
                  ? "Sudah dibatalkan"
                  : "Ajukan pembatalan"}
              </Button>
              <Link
                className="btn btn-secondary btn-md"
                to={`/mabar/create/${booking.id}`}
              >
                <Users />
                Buat Mabar
              </Link>
            </div>
          </Card>
          <Card className="checkout-card">
            <h2>
              Status pembayaran <SimulasiLabel />
            </h2>
            <p>
              {statusLabel(booking.paymentStatus)} · saldo tersisa{" "}
              {booking.paymentStatus === "dp"
                ? formatRupiah(booking.amount * 0.7)
                : "Rp0"}
            </p>
            <div className="detail-actions">
              {booking.paymentStatus === "dp" && (
                <Button
                  onClick={() =>
                    dispatch({ type: "SETTLE_BOOKING", bookingId: booking.id })
                  }
                >
                  Lunasi sisa pembayaran
                </Button>
              )}
              {booking.status === "cancelled" && booking.paymentStatus === "paid" && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    dispatch({
                      type: "REQUEST_REFUND",
                      bookingId: booking.id,
                    })
                  }
                >
                  Proses refund simulasi
                </Button>
              )}
            </div>
          </Card>
        </main>
        <aside className="qr-card">
          <QrCode />
          <h2>QR Check-in Simulasi</h2>
          <code>{booking.id}</code>
          <small>QR berubah setiap 60 detik pada produk final.</small>
        </aside>
      </div>
    </div>
  );
}

function IntegratedBookingDetailPage() {
  const { id } = useParams();
  const venuesQuery = useVenueSearch();
  const bookingsQuery = useQuery({
    queryKey: ["customer", "bookings"],
    queryFn: () => apiClient.listCustomerBookings(),
  });
  const [cancelReason, setCancelReason] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState(DEFAULT_RESCHEDULE_DATE);
  const [replacementSlots, setReplacementSlots] = useState<string[]>([]);
  const bookingQuery = useQuery({
    queryKey: ["booking", id],
    queryFn: () => apiClient.getBooking(id!),
    enabled: Boolean(id),
  });
  const summary = bookingsQuery.data?.items.find((item) => item.id === id);
  const availability = useQuery({
    queryKey: ["availability", summary?.courtId, rescheduleDate],
    queryFn: () => apiClient.getAvailability(summary!.courtId, rescheduleDate),
    enabled: Boolean(summary?.courtId && rescheduleDate),
  });
  const cancel = useMutation({
    mutationFn: () => apiClient.cancelBooking(id!, cancelReason, crypto.randomUUID()),
    onSuccess: () => Promise.all([bookingQuery.refetch(), bookingsQuery.refetch()]),
  });
  const reschedule = useMutation({
    mutationFn: () =>
      apiClient.rescheduleBooking(id!, replacementSlots, crypto.randomUUID()),
    onSuccess: () => Promise.all([bookingQuery.refetch(), bookingsQuery.refetch()]),
  });
  if (bookingQuery.isError) {
    return (
      <div className="content-container">
        <PageTitle
          eyebrow="Booking"
          title="Booking tidak dapat dibuka"
          description="Pastikan Anda masuk dengan akun pemilik booking ini."
        />
      </div>
    );
  }
  if (!bookingQuery.data) {
    return (
      <div className="content-container" aria-busy="true">
        Memuat booking…
      </div>
    );
  }
  const booking = bookingQuery.data;
  const venue = venuesQuery.data?.items.find((item) => item.id === booking.venueId);
  return (
    <div className="content-container">
      <PageTitle
        eyebrow={`Booking ${booking.id}`}
        title="Detail booking"
        description="Periksa status reservasi dan tunjukkan pass saat tiba di venue."
      />
      <BookingDetailPanel
        bookingCode={booking.id}
        title={venue?.name ?? `Reservasi #${booking.id}`}
        subtitle={venue?.sport}
        imageUrl={venue?.image}
        location={venue?.location}
        status={{
          label: integratedBookingStatusLabel(booking.status),
          tone: bookingStatusTone(booking.status),
        }}
        payment={{
          method: paymentModeLabel(booking.paymentMode),
          status: integratedPaymentStatusLabel(booking.paymentStatus),
          total: formatRupiah(booking.totalAmount),
          balance: formatRupiah(booking.balanceDue),
        }}
        actions={
          <>
            {booking.status === "CONFIRMED" && (
              <Dialog
                title="Jadwalkan ulang"
                description="Satu kali, minimal 24 jam sebelum jadwal. Slot lama tetap aman sampai proses berhasil."
                trigger={
                  <Button variant="secondary">
                    <CalendarDays /> Jadwalkan ulang
                  </Button>
                }
              >
                <label>
                  Tanggal baru
                  <Input
                    type="date"
                    value={rescheduleDate}
                    onChange={(event) => {
                      setRescheduleDate(event.target.value);
                      setReplacementSlots([]);
                    }}
                  />
                </label>
                <div className="slot-grid">
                  {availability.data?.items
                    .filter((slot) => slot.status === "AVAILABLE")
                    .map((slot) => (
                      <button
                        type="button"
                        className={replacementSlots.includes(slot.id) ? "selected" : ""}
                        key={slot.id}
                        onClick={() =>
                          setReplacementSlots((current) =>
                            current.includes(slot.id)
                              ? current.filter((item) => item !== slot.id)
                              : [...current, slot.id],
                          )
                        }
                      >
                        {new Date(slot.startsAt).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </button>
                    ))}
                </div>
                <Button
                  disabled={replacementSlots.length === 0 || reschedule.isPending}
                  onClick={() => reschedule.mutate()}
                >
                  Simpan jadwal baru
                </Button>
                {reschedule.error && (
                  <p className="field-error" role="alert">
                    {reschedule.error.message}
                  </p>
                )}
              </Dialog>
            )}
            {["HOLD", "PENDING_CONFIRMATION", "CONFIRMED"].includes(booking.status) && (
              <Dialog
                title="Batalkan booking"
                description="Nilai refund dihitung server dari policy snapshot booking."
                trigger={<Button variant="ghost">Ajukan pembatalan</Button>}
              >
                <label>
                  Alasan
                  <textarea
                    className="input"
                    value={cancelReason}
                    onChange={(event) => setCancelReason(event.target.value)}
                  />
                </label>
                <Button
                  disabled={cancelReason.trim().length < 3 || cancel.isPending}
                  onClick={() => cancel.mutate()}
                >
                  Konfirmasi pembatalan
                </Button>
                {cancel.error && (
                  <p className="field-error" role="alert">
                    {cancel.error.message}
                  </p>
                )}
              </Dialog>
            )}
            <Link className="btn btn-secondary btn-md" to="/bookings">
              Kembali ke Booking Saya
            </Link>
          </>
        }
      />
    </div>
  );
}

function bookingStatusTone(
  status: string,
): "neutral" | "success" | "warning" | "danger" {
  if (["confirmed", "completed", "CONFIRMED", "COMPLETED"].includes(status)) {
    return "success";
  }
  if (["cancelled", "expired", "CANCELLED", "EXPIRED"].includes(status)) {
    return "danger";
  }
  if (["pending", "HOLD", "PENDING_CONFIRMATION", "IN_PROGRESS"].includes(status)) {
    return "warning";
  }
  return "neutral";
}

function integratedBookingStatusLabel(status: string): string {
  return (
    {
      HOLD: "Slot ditahan",
      PENDING_CONFIRMATION: "Menunggu konfirmasi",
      CONFIRMED: "Terkonfirmasi",
      IN_PROGRESS: "Sedang berlangsung",
      COMPLETED: "Selesai",
      CANCELLED: "Dibatalkan",
      EXPIRED: "Kedaluwarsa",
    }[status] ?? status
  );
}

function integratedPaymentStatusLabel(status: string): string {
  return (
    {
      UNPAID: "Belum dibayar",
      PARTIALLY_PAID: "Dibayar sebagian",
      PAID: "Lunas",
      PARTIALLY_REFUNDED: "Refund sebagian",
      REFUNDED: "Sudah direfund",
    }[status] ?? status
  );
}

function paymentModeLabel(mode: string): string {
  return (
    {
      FULL: "Bayar penuh",
      DP: "DP 50%",
      PAY_AT_VENUE: "Bayar di venue",
    }[mode] ?? mode
  );
}
