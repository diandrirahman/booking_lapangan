import type { BusinessBooking } from "@lapangango/api-client";
import { CheckCircle2, Plus, QrCode } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useBusinessBookingAction,
  useBusinessBookings,
  useBusinessCalendar,
  useBusinessVenue,
  useBusinessVenues,
  useCourtAvailability,
  useClosureBookingAction,
  useCreateBusinessClosure,
  useCreateOfflineBooking,
} from "../../api/businessQueries";
import { DataTable, type DataTableColumnDef } from "../../components/DataTable";
import {
  OperationsCalendar,
  type OperationsCalendarEvent,
} from "../../components/OperationsCalendar";
import { SelectField } from "../../components/SelectField";
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Input,
  PageTitle,
  SimulasiLabel,
} from "../../components/ui";

export function IntegratedOperationsBookingsPage() {
  const { tenant } = useParams();
  const navigate = useNavigate();
  const bookings = useBusinessBookings(tenant);
  const columns = useMemo<DataTableColumnDef<BusinessBooking>[]>(
    () => businessBookingColumns(tenant ?? ""),
    [tenant],
  );

  if (!tenant) return <InvalidWorkspace />;
  if (bookings.isLoading) return <LoadingCard />;
  if (bookings.isError || !bookings.data)
    return <LoadError onRetry={() => void bookings.refetch()} />;
  return (
    <>
      <PageTitle
        eyebrow="Operasional"
        title="Semua booking"
        description="Daftar booking online dan offline dari API B1."
        action={
          <Button
            onClick={() =>
              navigate(`/business/${tenant}/operations/bookings/new-offline`)
            }
          >
            <Plus /> Booking offline
          </Button>
        }
      />
      <DataTable
        data={bookings.data.items}
        columns={columns}
        searchPlaceholder="Cari booking, customer, atau venue"
      />
    </>
  );
}

export function IntegratedOperationsCalendarPage() {
  const { tenant } = useParams();
  const [monthOffset, setMonthOffset] = useState(0);
  const range = monthRange(monthOffset);
  const calendar = useBusinessCalendar(tenant, range);
  const venues = useBusinessVenues(tenant);
  const createClosure = useCreateBusinessClosure(tenant ?? "");
  const [closureVenueId, setClosureVenueId] = useState("");
  const [closureStartsAt, setClosureStartsAt] = useState(localDateTime(1));
  const [closureEndsAt, setClosureEndsAt] = useState(localDateTime(2));
  const [closureReason, setClosureReason] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const navigate = useNavigate();
  if (!tenant) return <InvalidWorkspace />;
  if (calendar.isLoading) return <LoadingCard />;
  if (calendar.isError || !calendar.data)
    return <LoadError onRetry={() => void calendar.refetch()} />;
  const calendarEvents: Array<
    OperationsCalendarEvent & { booking: BusinessBooking | null }
  > = [
    ...calendar.data.bookings.map((booking) => ({
      id: booking.id,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      venueId: booking.venueId,
      title: `${booking.venueName} · ${booking.courtName}`,
      detail: `${booking.customerName} · ${booking.status.replaceAll("_", " ")}`,
      kind: "booking" as const,
      tone: bookingCalendarTone(booking),
      booking,
    })),
    ...calendar.data.blocks.map((block) => ({
      id: block.id,
      startsAt: block.startsAt,
      endsAt: block.endsAt,
      venueId: block.venueId,
      title: block.kind.replaceAll("_", " "),
      detail: block.reason,
      kind: "block" as const,
      tone: "block" as const,
      booking: null,
    })),
  ].sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  const selectedEvent = calendarEvents.find((event) => event.id === selectedEventId);
  return (
    <>
      <PageTitle
        eyebrow="Operasional"
        title="Kalender venue"
        description="Booking, hold, block, dan maintenance berasal dari read model server."
      />
      <OperationsCalendar
        month={new Date(range.startsAfter)}
        events={calendarEvents}
        venues={(venues.data?.items ?? []).map((venue) => ({
          id: venue.id,
          name: venue.name,
        }))}
        onPreviousMonth={() => setMonthOffset((value) => value - 1)}
        onNextMonth={() => setMonthOffset((value) => value + 1)}
        onToday={() => setMonthOffset(0)}
        onSelectEvent={(event) => setSelectedEventId(event.id)}
        actions={
          <>
            <Dialog
              title="Tambah closure atau maintenance"
              description="Booking yang terdampak akan dikembalikan oleh server."
              trigger={<Button variant="secondary">Tambah block</Button>}
            >
              <label>
                Venue
                <SelectField
                  ariaLabel="Venue closure"
                  value={closureVenueId}
                  options={(venues.data?.items ?? []).map((venue) => ({
                    value: venue.id,
                    label: venue.name,
                  }))}
                  onValueChange={setClosureVenueId}
                />
              </label>
              <label>
                Mulai
                <Input
                  type="datetime-local"
                  value={closureStartsAt}
                  onChange={(event) => setClosureStartsAt(event.target.value)}
                />
              </label>
              <label>
                Selesai
                <Input
                  type="datetime-local"
                  value={closureEndsAt}
                  onChange={(event) => setClosureEndsAt(event.target.value)}
                />
              </label>
              <label>
                Alasan
                <textarea
                  className="input"
                  value={closureReason}
                  onChange={(event) => setClosureReason(event.target.value)}
                />
              </label>
              <Button
                disabled={
                  !closureVenueId ||
                  closureReason.trim().length < 5 ||
                  createClosure.isPending
                }
                onClick={() =>
                  createClosure.mutate({
                    venueId: closureVenueId,
                    startsAt: new Date(closureStartsAt).toISOString(),
                    endsAt: new Date(closureEndsAt).toISOString(),
                    kind: "CLOSURE",
                    reason: closureReason.trim(),
                  })
                }
              >
                Simpan closure
              </Button>
              {createClosure.data && (
                <p className="inline-success">
                  {createClosure.data.impactedBookingIds.length} booking terdampak.
                </p>
              )}
              {createClosure.error && (
                <p className="field-error">{createClosure.error.message}</p>
              )}
            </Dialog>
            <Button
              onClick={() =>
                navigate(`/business/${tenant}/operations/bookings/new-offline`)
              }
            >
              <Plus /> Booking offline
            </Button>
          </>
        }
      />
      {selectedEvent?.booking && (
        <BookingDetailDialog
          tenantId={tenant}
          booking={selectedEvent.booking}
          open
          onOpenChange={(open) => !open && setSelectedEventId(null)}
        />
      )}
      {selectedEvent && !selectedEvent.booking && (
        <Dialog
          open
          onOpenChange={(open) => !open && setSelectedEventId(null)}
          title={selectedEvent.title}
          description="Block operasional dari read model server."
        >
          <dl className="booking-operations-panel">
            <div>
              <dt>Mulai</dt>
              <dd>{formatDateTime(selectedEvent.startsAt)}</dd>
            </div>
            <div>
              <dt>Selesai</dt>
              <dd>{formatDateTime(selectedEvent.endsAt)}</dd>
            </div>
            <div>
              <dt>Alasan</dt>
              <dd>{selectedEvent.detail}</dd>
            </div>
          </dl>
        </Dialog>
      )}
    </>
  );
}

export function IntegratedOfflineBookingPage() {
  const { tenant } = useParams();
  const navigate = useNavigate();
  const venues = useBusinessVenues(tenant);
  const [venueId, setVenueId] = useState("");
  const venue = useBusinessVenue(tenant, venueId || undefined);
  const [courtId, setCourtId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const slots = useCourtAvailability(courtId || undefined, date);
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [channel, setChannel] = useState("WALK_IN");
  const createBooking = useCreateOfflineBooking(tenant ?? "");

  if (!tenant) return <InvalidWorkspace />;
  const activeTenantId = tenant;
  const venueOptions =
    venues.data?.items.map((item) => ({ value: item.id, label: item.name })) ?? [];
  const courtOptions =
    venue.data?.courts.map((court) => ({ value: court.id, label: court.name })) ?? [];
  const availableSlots = slots.data?.items ?? [];
  const selectedSlots = availableSlots.filter((slot) =>
    selectedSlotIds.includes(slot.id),
  );
  const selectedTotal = selectedSlots.reduce((total, slot) => total + slot.price, 0);

  function selectVenue(value: string) {
    setVenueId(value);
    setCourtId("");
    setSelectedSlotIds([]);
  }
  function toggleSlot(slotId: string) {
    const index = availableSlots.findIndex((slot) => slot.id === slotId);
    const selectedIndexes = selectedSlotIds
      .map((id) => availableSlots.findIndex((slot) => slot.id === id))
      .sort((left, right) => left - right);
    if (selectedSlotIds.includes(slotId)) {
      setSelectedSlotIds(selectedSlotIds.filter((id) => id !== slotId));
      return;
    }
    const canExtend =
      selectedIndexes.length === 0 ||
      index === selectedIndexes[0] - 1 ||
      index === selectedIndexes.at(-1)! + 1;
    if (canExtend && selectedSlotIds.length < 3)
      setSelectedSlotIds([...selectedSlotIds, slotId]);
  }
  async function submit() {
    if (!venueId || !courtId || !customerName.trim() || selectedSlotIds.length === 0)
      return;
    const phone = customerPhone.trim();
    await createBooking.mutateAsync({
      tenantId: activeTenantId,
      venueId,
      courtId,
      slotIds: selectedSlotIds,
      paymentMode: "PAY_AT_VENUE",
      customer: {
        name: customerName.trim(),
        channel,
        ...(phone ? { phone } : {}),
      },
    });
    navigate(`/business/${activeTenantId}/operations/bookings`);
  }
  return (
    <>
      <PageTitle
        eyebrow="Booking offline"
        title="Catat booking dari luar platform"
        description="Menggunakan transaksi reservasi yang sama dengan booking online."
      />
      <div className="offline-booking-layout">
        <Card className="form-card wide offline-booking-card">
          <section className="offline-form-section">
            <div className="offline-section-heading">
              <span>1</span>
              <div>
                <h2>Data pemesan</h2>
                <p>Catat kontak dan sumber booking.</p>
              </div>
            </div>
            <div className="form-grid">
              <label>
                Nama customer
                <Input
                  value={customerName}
                  maxLength={50}
                  placeholder="Contoh: Nadia Putri"
                  onChange={(event) => setCustomerName(event.target.value)}
                />
              </label>
              <label>
                Nomor telepon
                <Input
                  value={customerPhone}
                  maxLength={16}
                  placeholder="+62812..."
                  onChange={(event) => setCustomerPhone(event.target.value)}
                />
              </label>
              <label>
                Sumber
                <SelectField
                  ariaLabel="Sumber booking"
                  value={channel}
                  options={[
                    { value: "WALK_IN", label: "Walk-in" },
                    { value: "WHATSAPP", label: "WhatsApp" },
                    { value: "PHONE", label: "Telepon" },
                  ]}
                  onValueChange={setChannel}
                />
              </label>
            </div>
          </section>
          <section className="offline-form-section">
            <div className="offline-section-heading">
              <span>2</span>
              <div>
                <h2>Jadwal bermain</h2>
                <p>Pilih venue, lapangan, dan tanggal.</p>
              </div>
            </div>
            <div className="form-grid">
              <label>
                Venue
                <SelectField
                  ariaLabel="Pilih venue"
                  value={venueId}
                  options={venueOptions}
                  placeholder="Pilih venue"
                  onValueChange={selectVenue}
                />
              </label>
              <label>
                Lapangan
                <SelectField
                  ariaLabel="Pilih lapangan"
                  value={courtId}
                  options={courtOptions}
                  placeholder="Pilih lapangan"
                  onValueChange={(value) => {
                    setCourtId(value);
                    setSelectedSlotIds([]);
                  }}
                />
              </label>
              <label>
                Tanggal
                <Input
                  type="date"
                  value={date}
                  onChange={(event) => {
                    setDate(event.target.value);
                    setSelectedSlotIds([]);
                  }}
                />
              </label>
            </div>
          </section>
          <fieldset>
            <div className="fieldset-heading">
              <div>
                <legend>Pilih slot berurutan</legend>
                <p>Maksimal tiga slot; pilihan tidak dapat melompati slot lain.</p>
              </div>
              <Badge tone={selectedSlotIds.length > 0 ? "success" : "neutral"}>
                {selectedSlotIds.length} dipilih
              </Badge>
            </div>
            <div className="slot-grid small">
              {availableSlots.map((slot, index) => {
                const selected = selectedSlotIds.includes(slot.id);
                const selectedIndexes = selectedSlotIds.map((id) =>
                  availableSlots.findIndex((item) => item.id === id),
                );
                const canExtend =
                  selected ||
                  selectedIndexes.length === 0 ||
                  index === Math.min(...selectedIndexes) - 1 ||
                  index === Math.max(...selectedIndexes) + 1;
                const disabled =
                  slot.status !== "AVAILABLE" ||
                  !canExtend ||
                  (!selected && selectedSlotIds.length >= 3);
                return (
                  <button
                    type="button"
                    key={slot.id}
                    className={`${slot.status.toLowerCase()} ${selected ? "selected" : ""}`}
                    disabled={disabled}
                    onClick={() => toggleSlot(slot.id)}
                  >
                    <strong>{formatTime(slot.startsAt)}</strong>
                    <span>{formatCurrency(slot.price)}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          {createBooking.error && (
            <p className="field-error" role="alert">
              {createBooking.error.message}
            </p>
          )}
        </Card>
        <Card className="offline-booking-summary">
          <p className="dashboard-card-kicker">Ringkasan booking</p>
          <h2>Periksa pilihan</h2>
          <dl>
            <div>
              <dt>Venue</dt>
              <dd>{venue.data?.name ?? "Belum dipilih"}</dd>
            </div>
            <div>
              <dt>Lapangan</dt>
              <dd>
                {venue.data?.courts.find((court) => court.id === courtId)?.name ??
                  "Belum dipilih"}
              </dd>
            </div>
            <div>
              <dt>Tanggal</dt>
              <dd>{formatLocalDate(date)}</dd>
            </div>
            <div>
              <dt>Durasi</dt>
              <dd>{selectedSlotIds.length} jam</dd>
            </div>
          </dl>
          <div className="offline-summary-total">
            <span>Estimasi total</span>
            <strong>{formatCurrency(selectedTotal)}</strong>
          </div>
          <div className="offline-summary-actions">
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Batal
            </Button>
            <Button
              disabled={
                !customerName.trim() ||
                !venueId ||
                !courtId ||
                selectedSlotIds.length === 0 ||
                createBooking.isPending
              }
              onClick={() => void submit()}
            >
              {createBooking.isPending ? "Menyimpan..." : "Simpan booking"}
            </Button>
          </div>
          <small>Slot divalidasi ulang oleh server sebelum booking dibuat.</small>
        </Card>
      </div>
    </>
  );
}

export function IntegratedCheckInPage() {
  const { tenant } = useParams();
  const [bookingCode, setBookingCode] = useState("");
  const [attendanceMessage, setAttendanceMessage] = useState<string | null>(null);
  const bookings = useBusinessBookings(tenant);
  const booking = bookings.data?.items.find(
    (item) => item.id.toLowerCase() === bookingCode.trim().toLowerCase(),
  );
  if (!tenant) return <InvalidWorkspace />;
  return (
    <>
      <PageTitle
        eyebrow="Operasional"
        title="Check-in pemain"
        description="Masukkan referensi booking publik atau gunakan daftar kedatangan."
      />
      {attendanceMessage && (
        <div className="booking-attendance-status" role="status">
          <CheckCircle2 />
          <span>{attendanceMessage}</span>
        </div>
      )}
      <div className="checkin-layout">
        <Card className="scanner-card">
          <QrCode />
          <h2>Referensi booking</h2>
          <Input
            value={bookingCode}
            onChange={(event) => setBookingCode(event.target.value)}
            placeholder="LG-..."
          />
          {booking && (
            <BookingActionButtons
              tenantId={tenant}
              booking={booking}
              onAttendanceRecorded={setAttendanceMessage}
            />
          )}
          {bookingCode && !booking && !bookings.isLoading && (
            <p className="field-error">
              Booking tidak ditemukan pada venue yang dapat Anda akses.
            </p>
          )}
        </Card>
        <Card className="data-card">
          <h2>Kedatangan berikutnya</h2>
          {bookings.data?.items
            .filter(
              (item) => item.status === "CONFIRMED" && item.attendanceStatus === null,
            )
            .slice(0, 8)
            .map((item) => (
              <div className="list-item" key={item.id}>
                <div>
                  <strong>{item.customerName}</strong>
                  <small>
                    {formatDateTime(item.startsAt)} · {item.courtName}
                  </small>
                </div>
                <BookingDetailDialog
                  tenantId={tenant}
                  booking={item}
                  onAttendanceRecorded={setAttendanceMessage}
                />
              </div>
            ))}
        </Card>
      </div>
    </>
  );
}

export function IntegratedOutstandingPage() {
  const { tenant } = useParams();
  const bookings = useBusinessBookings(tenant, { outstandingOnly: true });
  if (!tenant) return <InvalidWorkspace />;
  if (!bookings.data)
    return bookings.isError ? (
      <LoadError onRetry={() => void bookings.refetch()} />
    ) : (
      <LoadingCard />
    );
  const outstanding = bookings.data.items;
  return (
    <>
      <PageTitle
        eyebrow="Operasional"
        title="Outstanding payment"
        description="Sisa pembayaran full, DP, dan bayar-di-venue dari server."
        action={<SimulasiLabel />}
      />
      <div className="metric-grid">
        <Card>
          <span>Total outstanding</span>
          <strong>
            {formatCurrency(
              outstanding.reduce((sum, item) => sum + item.balanceDue, 0),
            )}
          </strong>
        </Card>
        <Card>
          <span>Booking belum lunas</span>
          <strong>{outstanding.length}</strong>
        </Card>
      </div>
      <DataTable
        data={outstanding}
        columns={businessBookingColumns(tenant)}
        searchPlaceholder="Cari outstanding"
      />
    </>
  );
}

function businessBookingColumns(
  tenantId: string,
): DataTableColumnDef<BusinessBooking>[] {
  return [
    {
      accessorKey: "id",
      header: "Booking",
      cell: ({ row }) => (
        <div className="table-primary-cell">
          <strong>{row.original.id}</strong>
          <small>{row.original.customerName}</small>
        </div>
      ),
    },
    {
      accessorKey: "startsAt",
      header: "Jadwal",
      cell: ({ row }) => (
        <div className="table-primary-cell">
          <span>{formatDateTime(row.original.startsAt)}</span>
          <small>
            {row.original.venueName} · {row.original.courtName}
          </small>
        </div>
      ),
    },
    {
      accessorKey: "paymentStatus",
      header: "Pembayaran",
      cell: ({ row }) => (
        <Badge tone={row.original.paymentStatus === "PAID" ? "success" : "warning"}>
          {row.original.paymentStatus}
        </Badge>
      ),
    },
    { accessorKey: "status", header: "Status" },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <BookingDetailDialog tenantId={tenantId} booking={row.original} />
      ),
    },
  ];
}

function BookingDetailDialog({
  tenantId,
  booking,
  open,
  onOpenChange,
  onAttendanceRecorded,
}: {
  tenantId: string;
  booking: BusinessBooking;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onAttendanceRecorded?: (message: string) => void;
}) {
  return (
    <Dialog
      title="Detail booking"
      description={`${booking.id} · Aksi tersedia sesuai status booking.`}
      contentClassName="booking-detail-dialog"
      open={open}
      onOpenChange={onOpenChange}
      trigger={
        open === undefined ? (
          <Button variant="ghost" size="sm">
            Detail
          </Button>
        ) : undefined
      }
    >
      <div className="booking-operations-panel">
        <dl>
          <div>
            <dt>Customer</dt>
            <dd>{booking.customerName}</dd>
          </div>
          <div>
            <dt>Jadwal</dt>
            <dd>{formatDateTime(booking.startsAt)}</dd>
          </div>
          <div>
            <dt>Sumber</dt>
            <dd>{booking.source}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{formatCurrency(booking.totalAmount)}</dd>
          </div>
          <div>
            <dt>Sisa</dt>
            <dd>{formatCurrency(booking.balanceDue)}</dd>
          </div>
        </dl>
        {booking.attendanceStatus && (
          <div className="booking-attendance-status" role="status">
            <CheckCircle2 />
            <span>
              {booking.attendanceStatus === "NO_SHOW"
                ? "No-show tercatat"
                : "Check-in tercatat"}
            </span>
          </div>
        )}
        <BookingActionButtons
          tenantId={tenantId}
          booking={booking}
          onAttendanceRecorded={onAttendanceRecorded}
        />
        {booking.status === "CONFIRMED" && (
          <RescheduleBookingForm tenantId={tenantId} booking={booking} />
        )}
      </div>
    </Dialog>
  );
}

function BookingActionButtons({
  tenantId,
  booking,
  onAttendanceRecorded,
}: {
  tenantId: string;
  booking: BusinessBooking;
  onAttendanceRecorded?: (message: string) => void;
}) {
  const action = useBusinessBookingAction(tenantId);
  const closureAction = useClosureBookingAction(tenantId);
  const scope = { tenantId, venueId: booking.venueId };
  function recordAttendance(attendance: "CHECKED_IN" | "NO_SHOW", reason?: string) {
    action.mutate(
      {
        bookingId: booking.id,
        scope,
        action: { kind: "attendance", attendance, reason },
      },
      {
        onSuccess: () =>
          onAttendanceRecorded?.(
            attendance === "NO_SHOW" ? "No-show tercatat" : "Check-in tercatat",
          ),
      },
    );
  }
  return (
    <div className="form-actions">
      {booking.status === "PENDING_CONFIRMATION" && (
        <>
          <Button
            variant="danger"
            disabled={action.isPending}
            onClick={() =>
              action.mutate({
                bookingId: booking.id,
                scope,
                action: {
                  kind: "transition",
                  status: "CANCELLED",
                  reason: "Ditolak oleh operator venue",
                },
              })
            }
          >
            Tolak
          </Button>
          <Button
            disabled={action.isPending}
            onClick={() =>
              action.mutate({
                bookingId: booking.id,
                scope,
                action: {
                  kind: "transition",
                  status: "CONFIRMED",
                  reason: "Dikonfirmasi oleh operator venue",
                },
              })
            }
          >
            Konfirmasi
          </Button>
        </>
      )}
      {booking.status === "CONFIRMED" && booking.attendanceStatus === null && (
        <Button
          disabled={action.isPending}
          onClick={() => recordAttendance("CHECKED_IN")}
        >
          <CheckCircle2 /> Check-in
        </Button>
      )}
      {booking.status === "CONFIRMED" &&
        booking.attendanceStatus === null &&
        canMarkNoShow(booking.startsAt) && (
          <Button
            variant="danger"
            disabled={action.isPending}
            onClick={() =>
              recordAttendance("NO_SHOW", "Pemain tidak hadir setelah grace period")
            }
          >
            Tandai no-show
          </Button>
        )}
      {booking.balanceDue > 0 && !["CANCELLED", "EXPIRED"].includes(booking.status) && (
        <Button
          variant="secondary"
          disabled={action.isPending}
          onClick={() =>
            action.mutate({ bookingId: booking.id, scope, action: { kind: "settle" } })
          }
        >
          Catat pelunasan <SimulasiLabel />
        </Button>
      )}
      {booking.status === "CONFIRMED" && (
        <Button
          variant="danger"
          disabled={closureAction.isPending}
          onClick={() =>
            closureAction.mutate({
              kind: "cancel",
              bookingId: booking.id,
              venueId: booking.venueId,
              reason: "Pembatalan akibat penutupan operasional venue",
            })
          }
        >
          Batalkan karena closure
        </Button>
      )}
      {action.error && (
        <p className="field-error" role="alert">
          {action.error.message}
        </p>
      )}
    </div>
  );
}

function RescheduleBookingForm({
  tenantId,
  booking,
}: {
  tenantId: string;
  booking: BusinessBooking;
}) {
  const [date, setDate] = useState(booking.startsAt.slice(0, 10));
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const slots = useCourtAvailability(booking.courtId, date);
  const action = useClosureBookingAction(tenantId);
  const available = slots.data?.items ?? [];
  function toggle(slotId: string) {
    if (selectedSlotIds.includes(slotId)) {
      setSelectedSlotIds(selectedSlotIds.filter((id) => id !== slotId));
      return;
    }
    const index = available.findIndex((slot) => slot.id === slotId);
    const indexes = selectedSlotIds.map((id) =>
      available.findIndex((slot) => slot.id === id),
    );
    if (
      indexes.length === 0 ||
      index === Math.min(...indexes) - 1 ||
      index === Math.max(...indexes) + 1
    )
      setSelectedSlotIds([...selectedSlotIds, slotId]);
  }
  return (
    <details className="booking-reschedule">
      <summary>Reschedule akibat closure</summary>
      <label>
        Tanggal baru
        <Input
          type="date"
          value={date}
          onChange={(event) => {
            setDate(event.target.value);
            setSelectedSlotIds([]);
          }}
        />
      </label>
      <div className="slot-grid small">
        {available.map((slot) => (
          <button
            type="button"
            key={slot.id}
            disabled={slot.status !== "AVAILABLE"}
            className={selectedSlotIds.includes(slot.id) ? "selected" : ""}
            onClick={() => toggle(slot.id)}
          >
            {formatTime(slot.startsAt)}
          </button>
        ))}
      </div>
      <Button
        disabled={selectedSlotIds.length === 0 || action.isPending}
        onClick={() =>
          action.mutate({
            kind: "reschedule",
            bookingId: booking.id,
            venueId: booking.venueId,
            newSlotIds: selectedSlotIds,
            reason: "Reschedule akibat penutupan operasional venue",
          })
        }
      >
        Simpan jadwal baru
      </Button>
      {action.error && <p className="field-error">{action.error.message}</p>}
    </details>
  );
}

function monthRange(offset: number) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return { startsAfter: start.toISOString(), startsBefore: end.toISOString() };
}
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
function formatTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
function bookingCalendarTone(
  booking: BusinessBooking,
): OperationsCalendarEvent["tone"] {
  if (["CANCELLED", "COMPLETED", "EXPIRED"].includes(booking.status)) return "muted";
  if (booking.source === "OFFLINE") return "offline";
  if (["HOLD", "PENDING_CONFIRMATION"].includes(booking.status)) return "pending";
  return "confirmed";
}
function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}
function formatLocalDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}
function canMarkNoShow(startsAt: string): boolean {
  return Date.now() >= new Date(startsAt).getTime() + 15 * 60_000;
}
function localDateTime(hoursFromNow: number): string {
  const date = new Date(Date.now() + hoursFromNow * 60 * 60_000);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
function LoadingCard() {
  return (
    <Card className="state-card" aria-busy="true">
      Memuat data operasional...
    </Card>
  );
}
function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      title="Data operasional belum dapat dimuat"
      description="Periksa koneksi API lalu coba lagi."
      action={<Button onClick={onRetry}>Coba lagi</Button>}
    />
  );
}
function InvalidWorkspace() {
  return (
    <EmptyState
      title="Workspace tidak valid"
      description="Pilih workspace bisnis dari menu akun."
    />
  );
}
