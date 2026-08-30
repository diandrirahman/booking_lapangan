import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotificationPreferenceUpdate } from "@lapangango/api-client";
import {
  BellRing,
  CalendarClock,
  LockKeyhole,
  Mail,
  Plus,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { apiClient } from "../api/apiClient";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  LoadingState,
  PageTitle,
  SimulasiLabel,
} from "../components/ui";

const notificationEvents = [
  "booking.status_changed",
  "payment.verified",
  "refund.result",
  "transaction.dispute",
  "booking.reminder",
] as const;
const criticalEvents = new Set(notificationEvents.slice(0, 4));

const notificationEventDetails = {
  "booking.status_changed": {
    title: "Status booking",
    description: "Perubahan konfirmasi, pembatalan, atau jadwal booking.",
  },
  "payment.verified": {
    title: "Pembayaran terverifikasi",
    description: "Konfirmasi saat pembayaran berhasil diverifikasi.",
  },
  "refund.result": {
    title: "Hasil refund",
    description: "Keputusan dan perkembangan pengembalian dana.",
  },
  "transaction.dispute": {
    title: "Dispute transaksi",
    description: "Perubahan penting pada sengketa transaksi.",
  },
  "booking.reminder": {
    title: "Reminder bermain",
    description: "Pengingat sebelum jadwal bermain dimulai.",
  },
} satisfies Record<
  (typeof notificationEvents)[number],
  { title: string; description: string }
>;

export function formatReminderLeadTime(minutes: number) {
  if (minutes < 60) return `${minutes} menit sebelum`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0
    ? `${hours} jam sebelum`
    : `${hours} jam ${remainingMinutes} menit sebelum`;
}

export function NotificationPreferencesPage() {
  return (
    <>
      <PageTitle
        eyebrow="Preferensi"
        title="Pengaturan notifikasi"
        description="Email lokal disimpan sebagai capture. Notifikasi kritis selalu aktif."
      />
      <NotificationPreferencesCard />
    </>
  );
}

export function NotificationPreferencesCard() {
  const queryClient = useQueryClient();
  const preferences = useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: () => apiClient.listNotificationPreferences(),
  });
  const update = useMutation({
    mutationFn: (input: NotificationPreferenceUpdate) =>
      apiClient.updateNotificationPreference(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["notifications", "preferences"],
      });
    },
  });
  const enabled = (eventType: string, channel: string) =>
    preferences.data?.items.find(
      (item) => item.eventType === eventType && item.channel === channel,
    )?.enabled ?? true;
  if (preferences.isError) {
    return (
      <EmptyState
        title="Preferensi belum dapat dimuat"
        description="Periksa koneksi API lalu coba lagi."
      />
    );
  }
  return (
    <Card className="notification-preference-card" aria-busy={preferences.isPending}>
      <div className="notification-preference-header" aria-hidden="true">
        <span>Jenis notifikasi</span>
        <span>
          <Smartphone /> Dalam aplikasi
        </span>
        <span>
          <Mail /> Email
        </span>
      </div>
      <div className="notification-preference-list">
        {notificationEvents.map((eventType) => {
          const details = notificationEventDetails[eventType];
          return (
            <div className="notification-preference-row" key={eventType}>
              <div className="notification-preference-copy">
                <span className="notification-preference-icon">
                  <BellRing />
                </span>
                <span>
                  <strong>{details.title}</strong>
                  <small>{details.description}</small>
                  <Badge tone={criticalEvents.has(eventType) ? "neutral" : "info"}>
                    {criticalEvents.has(eventType) ? "Wajib aktif" : "Dapat diatur"}
                  </Badge>
                </span>
              </div>
              {(["IN_APP", "EMAIL"] as const).map((channel) => (
                <label className="notification-channel-toggle" key={channel}>
                  <input
                    type="checkbox"
                    aria-label={`${details.title} melalui ${
                      channel === "IN_APP" ? "aplikasi" : "email"
                    }`}
                    checked={enabled(eventType, channel)}
                    disabled={criticalEvents.has(eventType) || update.isPending}
                    onChange={(event) => {
                      update.reset();
                      update.mutate({
                        eventType,
                        channel,
                        enabled: event.target.checked,
                      });
                    }}
                  />
                  <span aria-hidden="true" />
                  <small>{channel === "IN_APP" ? "Dalam aplikasi" : "Email"}</small>
                </label>
              ))}
            </div>
          );
        })}
      </div>
      {update.isPending && <p role="status">Menyimpan preferensi…</p>}
      {update.isSuccess && (
        <p className="inline-success" role="status">
          Preferensi berhasil disimpan.
        </p>
      )}
      {update.isError && (
        <p className="field-error" role="alert">
          {update.error.message}
        </p>
      )}
      <p className="notification-preference-note">
        <LockKeyhole /> Notifikasi kritis selalu aktif untuk keamanan transaksi.
      </p>
    </Card>
  );
}

export function AdminReminderOptionsPage() {
  const queryClient = useQueryClient();
  const [minutes, setMinutes] = useState(60);
  const options = useQuery({
    queryKey: ["reminder-options"],
    queryFn: () => apiClient.listReminderOptions(),
  });
  const create = useMutation({
    mutationFn: () => apiClient.createReminderOption(minutes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reminder-options"] }),
  });
  return (
    <>
      <PageTitle
        eyebrow="Notifikasi"
        title="Opsi reminder"
        description="Default 24 jam dan 2 jam tersedia dari seed lokal."
        action={<SimulasiLabel />}
      />
      <div className="reminder-settings-layout">
        <Card className="reminder-create-card">
          <span className="reminder-card-icon">
            <CalendarClock />
          </span>
          <div>
            <h2>Tambah waktu reminder</h2>
            <p>Tentukan kapan pengguna menerima pengingat sebelum jadwal.</p>
          </div>
          <label>
            Menit sebelum jadwal
            <div className="reminder-minute-input">
              <Input
                type="number"
                min={1}
                value={minutes}
                onChange={(event) => setMinutes(Number(event.target.value))}
              />
              <span>menit</span>
            </div>
          </label>
          <p className="reminder-preview">
            Preview: <strong>{formatReminderLeadTime(minutes)}</strong>
          </p>
          <Button
            disabled={minutes < 1 || create.isPending}
            onClick={() => create.mutate()}
          >
            <Plus /> {create.isPending ? "Menambahkan..." : "Tambah opsi"}
          </Button>
        </Card>
        <Card className="reminder-options-card" aria-busy={options.isPending}>
          <div className="reminder-options-heading">
            <div>
              <h2>Opsi aktif</h2>
              <p>Venue dapat memilih satu atau beberapa opsi ini.</p>
            </div>
            <Badge tone="success">{options.data?.items.length ?? 0} aktif</Badge>
          </div>
          <div className="reminder-option-grid">
            {options.data?.items.map((item) => (
              <div className="reminder-option" key={String(item.id)}>
                <span className="reminder-option-icon">
                  <BellRing />
                </span>
                <span>
                  <strong>{formatReminderLeadTime(Number(item.minutesBefore))}</strong>
                  <small>{Number(item.minutesBefore)} menit sebelum jadwal</small>
                </span>
                <Badge tone="success">Aktif</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

export function BusinessReminderSettingsPage() {
  const { tenant } = useParams();
  const [venueId, setVenueId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const venues = useQuery({
    queryKey: ["business", tenant, "venues"],
    queryFn: () => apiClient.listBusinessVenues(tenant!),
    enabled: Boolean(tenant),
  });
  const options = useQuery({
    queryKey: ["reminder-options"],
    queryFn: () => apiClient.listReminderOptions(),
  });
  const save = useMutation({
    mutationFn: () => apiClient.setVenueReminders(venueId, tenant!, selected),
  });
  if (!tenant)
    return (
      <EmptyState title="Workspace tidak valid" description="Pilih workspace aktif." />
    );
  if (!venues.data || !options.data) {
    return venues.isError || options.isError ? (
      <EmptyState
        title="Reminder belum dapat dimuat"
        description="Periksa koneksi API lalu muat ulang halaman."
      />
    ) : (
      <LoadingState
        title="Memuat pengaturan reminder…"
        description="Menyiapkan venue dan pilihan waktu reminder."
        variant="panel"
      />
    );
  }
  return (
    <>
      <PageTitle
        eyebrow="Notifikasi workspace"
        title="Reminder booking"
        description="Pilih reminder per venue; delivery lokal ditangkap tanpa provider email."
        action={<SimulasiLabel />}
      />
      <Card className="owner-reminder-card">
        <div className="owner-section-heading">
          <div className="owner-reminder-heading-copy">
            <span className="reminder-card-icon" aria-hidden="true">
              <BellRing />
            </span>
            <span>
              <h2>Jadwal pengingat</h2>
              <p>Pilih venue, lalu aktifkan waktu pengingat yang dibutuhkan.</p>
            </span>
          </div>
          <Badge tone="info">Email lokal</Badge>
        </div>
        <label className="owner-reminder-venue">
          Venue
          <select
            className="input"
            value={venueId}
            onChange={(event) => {
              setVenueId(event.target.value);
              setSelected([]);
            }}
          >
            <option value="">Pilih venue</option>
            {venues.data.items.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="owner-reminder-options" disabled={!venueId}>
          <legend>Waktu pengingat</legend>
          <div>
            {options.data.items.map((option) => {
              const checked = selected.includes(option.id);
              return (
                <label
                  className={`owner-reminder-option ${checked ? "selected" : ""}`}
                  key={option.id}
                >
                  <span className="reminder-option-icon" aria-hidden="true">
                    <CalendarClock />
                  </span>
                  <span>
                    <strong>
                      {formatReminderLeadTime(Number(option.minutesBefore))}
                    </strong>
                    <small>Customer menerima pengingat sebelum jadwal bermain.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, option.id]
                          : current.filter((id) => id !== option.id),
                      )
                    }
                  />
                </label>
              );
            })}
          </div>
        </fieldset>
        <div className="owner-reminder-footer">
          <p>
            {selected.length} opsi dipilih
            {venueId ? " untuk venue ini." : ". Pilih venue terlebih dahulu."}
          </p>
          <Button disabled={!venueId || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Menyimpan…" : "Simpan reminder"}
          </Button>
        </div>
        {save.isSuccess && (
          <p className="owner-reminder-success" role="status">
            <ShieldCheck aria-hidden="true" /> Pengaturan reminder berhasil disimpan.
          </p>
        )}
      </Card>
    </>
  );
}

export function AdminCancellationPoliciesPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const policies = useQuery({
    queryKey: ["cancellation-policies"],
    queryFn: () => apiClient.listCancellationPolicies(),
  });
  const create = useMutation({
    mutationFn: () =>
      apiClient.createCancellationPolicy({
        name,
        tiers: [
          { minimumHoursBefore: 24, refundBasisPoints: 10_000 },
          { minimumHoursBefore: 6, maximumHoursBefore: 24, refundBasisPoints: 5_000 },
          { minimumHoursBefore: 0, maximumHoursBefore: 6, refundBasisPoints: 0 },
        ],
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["cancellation-policies"] }),
  });
  return (
    <>
      <PageTitle
        eyebrow="Kebijakan refund"
        title="Template pembatalan"
        description="Owner memilih template; tier tidak dibuat bebas pada venue."
      />
      <Card>
        <label>
          Nama template
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <Button
          disabled={name.trim().length < 3 || create.isPending}
          onClick={() => create.mutate()}
        >
          Buat template baseline
        </Button>
      </Card>
      <Card className="data-card">
        {policies.data?.items.map((policy) => (
          <div className="domain-row" key={policy.id}>
            <strong>{String(policy.name)}</strong>
            <Badge tone="neutral">
              {Array.isArray(policy.tiers) ? policy.tiers.length : 0} tier
            </Badge>
          </div>
        ))}
      </Card>
    </>
  );
}

export function BusinessCancellationPolicyPage() {
  const { tenant, venueId: routeVenueId } = useParams();
  const [venueId, setVenueId] = useState(routeVenueId ?? "");
  const [templateId, setTemplateId] = useState("");
  const [reason, setReason] = useState("Menetapkan kebijakan pembatalan venue");
  const venues = useQuery({
    queryKey: ["business", tenant, "venues"],
    queryFn: () => apiClient.listBusinessVenues(tenant!),
    enabled: Boolean(tenant),
  });
  const policies = useQuery({
    queryKey: ["cancellation-policies"],
    queryFn: () => apiClient.listCancellationPolicies(),
  });
  const assign = useMutation({
    mutationFn: () =>
      apiClient.assignCancellationPolicy(venueId, tenant!, templateId, reason),
  });
  if (!tenant)
    return (
      <EmptyState title="Workspace tidak valid" description="Pilih workspace aktif." />
    );
  return (
    <>
      <PageTitle
        eyebrow="Kebijakan venue"
        title="Pembatalan dan refund"
        description="Snapshot template tersimpan saat booking dibuat."
      />
      <Card>
        <label>
          Venue
          <select
            className="input"
            value={venueId}
            onChange={(event) => setVenueId(event.target.value)}
          >
            <option value="">Pilih venue</option>
            {venues.data?.items.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Template
          <select
            className="input"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
          >
            <option value="">Pilih template</option>
            {policies.data?.items.map((policy) => (
              <option key={policy.id} value={policy.id}>
                {String(policy.name)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Alasan
          <Input value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <Button
          disabled={
            !venueId || !templateId || reason.trim().length < 3 || assign.isPending
          }
          onClick={() => assign.mutate()}
        >
          Terapkan kebijakan
        </Button>
      </Card>
    </>
  );
}
