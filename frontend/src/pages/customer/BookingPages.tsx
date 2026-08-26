import { zodResolver } from "@hookform/resolvers/zod";
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  MapPin,
  QrCode,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { z } from "zod";
import {
  Badge,
  Button,
  Card,
  Dialog,
  Input,
  PageTitle,
  ScenarioBoundary,
  SimulasiLabel,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui";
import { calculateCheckoutTotals } from "../../domain/checkout";
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
  const [date, setDate] = useState("2026-08-27");
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
          <main>
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
                  const selectable = canToggleSlot(
                    slots,
                    state.selectedSlots,
                    slot.id,
                  );
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      className={`slot-button ${selectedNow ? "selected" : ""}`}
                      disabled={!available || (!selectedNow && !selectable)}
                      aria-pressed={selectedNow}
                      aria-label={`${slot.time} ${statusLabel(slot.status)}`}
                      onClick={() =>
                        dispatch({ type: "TOGGLE_SLOT", slotId: slot.id })
                      }
                    >
                      <strong>{slot.time}</strong>
                      <small>{formatRupiah(slot.price)}</small>
                      {!available && <span>{statusLabel(slot.status)}</span>}
                    </button>
                  );
                })}
              </div>
            </Card>
          </main>
          <aside className="summary-card">
            <h2>Ringkasan pilihan</h2>
            <p>{venue.name}</p>
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

const checkoutSchema = z.object({
  agreement: z.boolean().refine(Boolean, {
    message: "Persetujuan kebijakan wajib dicentang.",
  }),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

export function CheckoutPage() {
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
            <Card className="checkout-card">
              <h2>Detail booking</h2>
              <h3>{venue.name}</h3>
              <p>
                {booking.date} · {booking.slots.join(", ")}
              </p>
            </Card>
            <Card className="checkout-card">
              <h2>Metode pembayaran</h2>
              <div className="payment-options">
                {[
                  ["full", "Bayar penuh"],
                  ["dp", "DP 30%"],
                  ["venue", "Bayar di venue"],
                ].map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={method === value}
                      onChange={() => setMethod(value as typeof method)}
                    />
                    <CreditCard /> {label}
                  </label>
                ))}
              </div>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={addOn}
                  onChange={(event) => setAddOn(event.target.checked)}
                />
                Sewa perlengkapan · {formatRupiah(25_000)}
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
          <aside className="summary-card">
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
              <div>
                <dt>Total</dt>
                <dd>{formatRupiah(totals.total)}</dd>
              </div>
              <div>
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
            <Button type="submit">Lanjut pembayaran</Button>
          </aside>
        </form>
      </div>
    </ScenarioBoundary>
  );
}

function bookingIdFromAttempt(
  attemptId: string | undefined,
  state: PrototypeState,
) {
  return attemptId?.replace(/^PAY-/, "") ?? state.bookings[0].id;
}

export function PaymentPage() {
  const { attemptId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { state, dispatch } = usePrototype();
  const method = (searchParams.get("method") ?? "full") as
    "full" | "dp" | "venue";
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
    const timer = window.setTimeout(
      () => setSeconds((value) => value - 1),
      1_000,
    );
    return () => window.clearTimeout(timer);
  }, [attemptId, bookingId, dispatch, method, navigate, seconds]);

  function finish(result: "success" | "pending" | "failed") {
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
      <Card className="payment-sandbox">
        <Clock3 />
        <p>Selesaikan simulasi sebelum waktu habis</p>
        <strong>
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </strong>
        <div className="detail-actions">
          <Button onClick={() => finish("success")}>
            Simulasikan berhasil
          </Button>
          <Button variant="secondary" onClick={() => finish("pending")}>
            Simulasikan pending
          </Button>
          <Button variant="danger" onClick={() => finish("failed")}>
            Simulasikan gagal
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function PaymentResultPage() {
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
    expired: [
      "Waktu pembayaran habis",
      "Pilih ulang slot untuk membuat booking baru.",
    ],
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
          <Link
            className="btn btn-primary btn-md"
            to={`/bookings/${bookingId}`}
          >
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

export function BookingsPage() {
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
              const venue = state.venues.find(
                (item) => item.id === booking.venueId,
              )!;
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
                      tone={
                        booking.status === "confirmed" ? "success" : "warning"
                      }
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
  const { id } = useParams();
  const { state, dispatch } = usePrototype();
  const [newDate, setNewDate] = useState("2026-08-29");
  const booking =
    state.bookings.find((item) => item.id === id) ?? state.bookings[0];
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
              {booking.status === "cancelled" &&
                booking.paymentStatus === "paid" && (
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
