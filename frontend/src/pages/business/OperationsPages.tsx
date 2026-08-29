import {
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Plus,
  QrCode,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable, type DataTableColumnDef } from "../../components/DataTable";
import { OperationsMonthCalendar } from "../../components/OperationsMonthCalendar";
import { SelectField } from "../../components/SelectField";
import type { Booking } from "../../domain/types";
import {
  Badge,
  Button,
  Card,
  Dialog,
  Input,
  PageTitle,
  SimulasiLabel,
} from "../../components/ui";
import { usePrototype } from "../../store/PrototypeStore";
import { formatRupiah, statusLabel } from "../../store/selectors";
import {
  canToggleSlot,
  contiguousSelectionLabel,
  selectedSlotEntities,
} from "../../domain/slotSelection";
import { serverStateEnabled } from "../../api/apiClient";
import {
  IntegratedCheckInPage,
  IntegratedOfflineBookingPage,
  IntegratedOperationsBookingsPage,
  IntegratedOperationsCalendarPage,
  IntegratedOutstandingPage,
} from "./IntegratedOperationsPages";

export function OperationsCalendarPage() {
  return serverStateEnabled ? (
    <IntegratedOperationsCalendarPage />
  ) : (
    <PrototypeOperationsCalendarPage />
  );
}

function PrototypeOperationsCalendarPage() {
  const { state } = usePrototype();
  const [view, setView] = useState<"day" | "month">("day");
  const [periodIndex, setPeriodIndex] = useState(1);
  const [blockLabel, setBlockLabel] = useState("Maintenance Lapangan 2");
  const [savedBlock, setSavedBlock] = useState("");
  const navigate = useNavigate();
  const periods = ["Juli 2026", "Agustus 2026", "September 2026"];
  return (
    <>
      <PageTitle
        eyebrow="Operasional"
        title="Kalender venue"
        description="Booking online, offline, hold, block, dan maintenance dalam satu tampilan."
        action={
          <div className="page-action-group">
            <Dialog
              title="Tambah block atau maintenance"
              description="Block tersimpan pada kalender prototype tanpa request jaringan."
              trigger={<Button variant="secondary">Tambah block</Button>}
            >
              <label>
                Keterangan
                <Input
                  value={blockLabel}
                  onChange={(event) => setBlockLabel(event.target.value)}
                />
              </label>
              <Button
                disabled={!blockLabel.trim()}
                onClick={() => setSavedBlock(blockLabel)}
              >
                Simpan block
              </Button>
            </Dialog>
            <Button
              onClick={() =>
                navigate("/business/cendana/operations/bookings/new-offline")
              }
            >
              <Plus />
              Booking offline
            </Button>
          </div>
        }
      />
      {savedBlock && (
        <div className="inline-success" role="status">
          Block “{savedBlock}” ditambahkan ke kalender.
        </div>
      )}
      <div className="calendar-toolbar">
        <label className="calendar-filter">
          <span>Venue</span>
          <SelectField
            ariaLabel="Filter venue kalender"
            defaultValue="all"
            options={[
              { value: "all", label: "Semua venue" },
              ...state.venues.slice(0, 3).map((venue) => ({
                value: venue.id,
                label: venue.name,
              })),
            ]}
          />
        </label>
        <div className="calendar-navigation">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Bulan sebelumnya"
            disabled={periodIndex === 0}
            onClick={() => setPeriodIndex((value) => Math.max(0, value - 1))}
          >
            <ChevronLeft />
          </Button>
          <div>
            <small>Periode</small>
            <strong>{periods[periodIndex]}</strong>
          </div>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Bulan berikutnya"
            disabled={periodIndex === 2}
            onClick={() => setPeriodIndex((value) => Math.min(2, value + 1))}
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="calendar-view-switch" aria-label="Pilih tampilan kalender">
          <Button
            variant={view === "day" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setView("day")}
          >
            Hari
          </Button>
          <Button
            variant={view === "month" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setView("month")}
          >
            <CalendarRange /> Bulan
          </Button>
          <Button variant="secondary" onClick={() => setPeriodIndex(1)}>
            Hari ini
          </Button>
        </div>
      </div>
      {view === "day" ? (
        <Card className="calendar-grid">
          <div className="calendar-times">
            {[
              "07.00",
              "09.00",
              "11.00",
              "13.00",
              "15.00",
              "17.00",
              "19.00",
              "21.00",
            ].map((time) => (
              <span key={time}>{time}</span>
            ))}
          </div>
          {["Lapangan 1", "Lapangan 2", "Lapangan 3", "Lapangan 4"].map(
            (court, index) => (
              <div className="calendar-column" key={court}>
                <strong>{court}</strong>
                <Dialog
                  title={`Detail ${state.bookings[index].id}`}
                  description="Kelola booking tanpa meninggalkan kalender."
                  trigger={
                    <button
                      className={`calendar-event event-${index % 3}`}
                      style={{
                        top: `${60 + index * 54}px`,
                        height: `${74 + index * 10}px`,
                      }}
                    >
                      <small>
                        {9 + index}.00–{10 + index}.00
                      </small>
                      <b>{state.bookings[index].id}</b>
                      <span>{index === 2 ? "Maintenance" : "Booking online"}</span>
                    </button>
                  }
                >
                  <BookingOperationsPanel booking={state.bookings[index]} />
                </Dialog>
                <div
                  className="calendar-event offline"
                  style={{ top: `${270 + index * 38}px`, height: "64px" }}
                >
                  <small>{16 + index}.00</small>
                  <b>Walk-in</b>
                </div>
              </div>
            ),
          )}
        </Card>
      ) : (
        <Card className="month-calendar-card">
          <OperationsMonthCalendar bookings={state.bookings} />
        </Card>
      )}
    </>
  );
}

export function OperationsBookingsPage() {
  return serverStateEnabled ? (
    <IntegratedOperationsBookingsPage />
  ) : (
    <PrototypeOperationsBookingsPage />
  );
}

function PrototypeOperationsBookingsPage() {
  const { state } = usePrototype();
  const navigate = useNavigate();
  const columns = useMemo<DataTableColumnDef<Booking>[]>(
    () => [
      {
        accessorKey: "id",
        header: "Booking",
        cell: ({ row }) => (
          <div className="table-primary-cell">
            <strong>{row.original.id}</strong>
            <small>Customer {row.original.customerId}</small>
          </div>
        ),
      },
      {
        accessorKey: "date",
        header: "Jadwal",
        cell: ({ row }) => (
          <div className="table-primary-cell">
            <span>{row.original.date}</span>
            <small>{row.original.slots.join(", ")}</small>
          </div>
        ),
      },
      {
        id: "venue",
        header: "Venue",
        accessorFn: (booking) =>
          state.venues.find((venue) => venue.id === booking.venueId)?.name ?? "-",
      },
      {
        accessorKey: "paymentStatus",
        header: "Pembayaran",
        cell: ({ row }) => (
          <Badge tone={row.original.paymentStatus === "paid" ? "success" : "warning"}>
            {statusLabel(row.original.paymentStatus)}
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => statusLabel(row.original.status),
      },
      {
        id: "actions",
        enableSorting: false,
        header: "",
        cell: ({ row }) => (
          <Dialog
            title={`Detail ${row.original.id}`}
            description="Konfirmasi, check-in, dan pembayaran tersimpan pada fixture yang sama."
            trigger={
              <Button variant="ghost" size="sm">
                Detail
              </Button>
            }
          >
            <BookingOperationsPanel booking={row.original} />
          </Dialog>
        ),
      },
    ],
    [state.venues],
  );
  return (
    <>
      <PageTitle
        eyebrow="Operasional"
        title="Semua booking"
        description="Kelola lifecycle booking online dan offline secara konsisten."
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
      <DataTable
        data={state.bookings}
        columns={columns}
        searchPlaceholder="Cari ID, customer, atau venue"
      />
    </>
  );
}

function BookingOperationsPanel({ booking }: { booking: Booking }) {
  const { state, dispatch } = usePrototype();
  const venue = state.venues.find((item) => item.id === booking.venueId);
  return (
    <div className="booking-operations-panel">
      <dl>
        <div>
          <dt>Venue</dt>
          <dd>{venue?.name ?? "Venue tidak ditemukan"}</dd>
        </div>
        <div>
          <dt>Jadwal</dt>
          <dd>
            {booking.date} · {booking.slots.join(", ")}
          </dd>
        </div>
        <div>
          <dt>Sumber</dt>
          <dd>{booking.source === "online" ? "Online" : "Offline"}</dd>
        </div>
        <div>
          <dt>Pembayaran</dt>
          <dd>
            {statusLabel(booking.paymentStatus)} <SimulasiLabel />
          </dd>
        </div>
      </dl>
      <div className="form-actions">
        {booking.status === "pending" && (
          <>
            <Button
              variant="secondary"
              onClick={() =>
                dispatch({
                  type: "CONFIRM_BOOKING",
                  bookingId: booking.id,
                  decision: "reject",
                })
              }
            >
              Tolak
            </Button>
            <Button
              onClick={() =>
                dispatch({
                  type: "CONFIRM_BOOKING",
                  bookingId: booking.id,
                  decision: "accept",
                })
              }
            >
              Konfirmasi
            </Button>
          </>
        )}
        {booking.status === "confirmed" && !booking.checkedInAt && (
          <Button
            onClick={() =>
              dispatch({ type: "CHECK_IN_BOOKING", bookingId: booking.id })
            }
          >
            Check-in
          </Button>
        )}
        {booking.paymentStatus !== "paid" && booking.paymentStatus !== "refunded" && (
          <Button
            variant="secondary"
            onClick={() => dispatch({ type: "SETTLE_BOOKING", bookingId: booking.id })}
          >
            Catat pelunasan
          </Button>
        )}
      </div>
      {booking.checkedInAt && <Badge tone="success">Sudah check-in</Badge>}
    </div>
  );
}

export function OfflineBookingPage() {
  return serverStateEnabled ? (
    <IntegratedOfflineBookingPage />
  ) : (
    <PrototypeOfflineBookingPage />
  );
}

function PrototypeOfflineBookingPage() {
  const { state, dispatch } = usePrototype();
  const navigate = useNavigate();
  const [error, setError] = useState(false);
  const offlineSlots = state.slots.filter((slot) => slot.courtId === "c1");
  const selected = selectedSlotEntities(offlineSlots, state.selectedSlots);
  const selectedRange = contiguousSelectionLabel(offlineSlots, state.selectedSlots);
  useEffect(() => {
    dispatch({ type: "CLEAR_SLOTS" });
  }, [dispatch]);
  function submit() {
    if (!selected.length) {
      setError(true);
      return;
    }
    dispatch({
      type: "CREATE_BOOKING",
      booking: {
        id: `OFF-${String(state.bookings.length + 1).padStart(4, "0")}`,
        customerId: "walk-in",
        venueId: "v1",
        courtId: "c1",
        date: "2026-08-27",
        slots: selected.map((slot) => slot.time),
        amount: selected.reduce((sum, slot) => sum + slot.price, 0),
        paymentStatus: "unpaid",
        status: "confirmed",
        source: "offline",
      },
    });
    navigate("/business/cendana/operations/bookings");
  }
  return (
    <>
      <PageTitle
        eyebrow="Booking offline"
        title="Catat booking dari luar platform"
        description="Untuk walk-in, WhatsApp, telepon, atau media sosial."
      />
      <Card className="form-card wide">
        <div className="form-grid">
          <label>
            Sumber
            <SelectField
              ariaLabel="Sumber booking"
              defaultValue="walk-in"
              options={[
                { value: "walk-in", label: "Walk-in" },
                { value: "whatsapp", label: "WhatsApp" },
                { value: "phone", label: "Telepon" },
              ]}
            />
          </label>
          <label>
            Nama customer
            <Input placeholder="Nama lengkap" />
          </label>
          <label>
            Nomor telepon
            <Input placeholder="08xx xxxx xxxx" />
          </label>
          <label>
            Venue
            <SelectField
              ariaLabel="Pilih venue"
              defaultValue={state.venues[0]?.id}
              options={state.venues.slice(0, 3).map((venue) => ({
                value: venue.id,
                label: venue.name,
              }))}
            />
          </label>
        </div>
        <fieldset>
          <div className="fieldset-heading">
            <div>
              <legend>Pilih waktu berurutan</legend>
              <p>Slot tambahan harus tepat sebelum atau sesudah pilihan aktif.</p>
            </div>
            {selected.length > 0 && (
              <Badge tone="success">
                {selectedRange} · {selected.length} jam
              </Badge>
            )}
          </div>
          <div className="slot-grid small">
            {offlineSlots.map((slot) => {
              const isSelected = state.selectedSlots.includes(slot.id);
              const canToggle = canToggleSlot(
                offlineSlots,
                state.selectedSlots,
                slot.id,
              );
              const locked = slot.status === "available" && !isSelected && !canToggle;
              return (
                <button
                  key={slot.id}
                  disabled={slot.status !== "available" || locked}
                  title={
                    locked ? "Slot tidak bersebelahan dengan pilihan aktif" : undefined
                  }
                  className={`${slot.status} ${isSelected ? "selected" : ""} ${locked ? "selection-locked" : ""} ${canToggle && state.selectedSlots.length && !isSelected ? "extendable" : ""}`}
                  onClick={() => {
                    setError(false);
                    dispatch({ type: "TOGGLE_SLOT", slotId: slot.id });
                  }}
                >
                  <strong>{slot.time}</strong>
                  <span>{formatRupiah(slot.price)}</span>
                  {locked && <small>Tidak berurutan</small>}
                </button>
              );
            })}
          </div>
          {error && (
            <p className="field-error">Pilih minimal satu slot yang tersedia.</p>
          )}
        </fieldset>
        <div className="form-actions">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Batal
          </Button>
          <Button onClick={submit}>Simpan booking</Button>
        </div>
      </Card>
    </>
  );
}

export function CheckInPage() {
  return serverStateEnabled ? <IntegratedCheckInPage /> : <PrototypeCheckInPage />;
}

function PrototypeCheckInPage() {
  const { state, dispatch } = usePrototype();
  const [bookingCode, setBookingCode] = useState("");
  const [foundBookingId, setFoundBookingId] = useState<string>();
  function findBooking() {
    const found = state.bookings.find(
      (booking) => booking.id.toLowerCase() === bookingCode.toLowerCase(),
    );
    setFoundBookingId(found?.id);
  }
  return (
    <>
      <PageTitle
        eyebrow="Operasional"
        title="Check-in pemain"
        description="Scan QR atau masukkan kode booking simulasi."
      />
      <div className="checkin-layout">
        <Card className="scanner-card">
          <QrCode />
          <h2>Arahkan QR ke area ini</h2>
          <p>Kamera tidak diakses pada Phase A.</p>
          <div className="or-divider">atau</div>
          <Input
            aria-label="ID booking"
            placeholder="Masukkan ID booking"
            value={bookingCode}
            onChange={(event) => setBookingCode(event.target.value)}
          />
          <Button onClick={findBooking}>Temukan booking</Button>
          {bookingCode && !foundBookingId && (
            <p className="field-error">Booking tidak ditemukan.</p>
          )}
          {foundBookingId && (
            <Button
              variant="secondary"
              onClick={() =>
                dispatch({
                  type: "CHECK_IN_BOOKING",
                  bookingId: foundBookingId,
                })
              }
            >
              Check-in {foundBookingId}
            </Button>
          )}
        </Card>
        <Card className="data-card">
          <h2>Kedatangan berikutnya</h2>
          {state.bookings.slice(0, 5).map((booking) => (
            <div className="list-item" key={booking.id}>
              <span className="avatar">{booking.customerId.slice(-1)}</span>
              <div>
                <strong>{booking.id}</strong>
                <small>{booking.slots[0]} · Lapangan 1</small>
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled={Boolean(booking.checkedInAt)}
                onClick={() =>
                  dispatch({
                    type: "CHECK_IN_BOOKING",
                    bookingId: booking.id,
                  })
                }
              >
                <CheckCircle2 />
                {booking.checkedInAt ? "Sudah check-in" : "Check-in"}
              </Button>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}

export function OutstandingPage() {
  return serverStateEnabled ? (
    <IntegratedOutstandingPage />
  ) : (
    <PrototypeOutstandingPage />
  );
}

function PrototypeOutstandingPage() {
  const { state } = usePrototype();
  const outstanding = state.bookings
    .filter((booking) => booking.paymentStatus !== "paid")
    .slice(0, 8);
  return (
    <>
      <PageTitle
        eyebrow="Operasional"
        title="Outstanding payment"
        description="Pantau sisa DP dan bayar-di-venue. Seluruh nilai adalah simulasi."
        action={<SimulasiLabel />}
      />
      <div className="metric-grid">
        <Card>
          <span>Total outstanding</span>
          <strong>
            {formatRupiah(
              outstanding.reduce((sum, booking) => sum + booking.amount, 0),
            )}
          </strong>
        </Card>
        <Card>
          <span>Jatuh tempo hari ini</span>
          <strong>{outstanding.length}</strong>
        </Card>
        <Card>
          <span>Perlu tindak lanjut</span>
          <strong>3</strong>
        </Card>
      </div>
      <PrototypeOperationsBookingsPage />
    </>
  );
}
