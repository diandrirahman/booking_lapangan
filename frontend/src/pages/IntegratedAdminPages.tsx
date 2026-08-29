import { AlertTriangle, CheckCircle2, Search, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useAdminAudit,
  useAdminDashboard,
  useAdminMasters,
  useAdminTenants,
  useAdminVenues,
  useAdminVerifications,
  useCreateAdminMaster,
  useCreateAdminDuration,
  useCreateAdminPaymentOption,
  useDecideAdminVerification,
  useToggleAdminMaster,
  useToggleAdminPaymentOption,
  useUpdateAdminTenantStatus,
  useUpdateAdminVenueStatus,
} from "../api/adminQueries";
import type { AdminAuditEntry } from "@lapangango/api-client";
import { SelectField } from "../components/SelectField";
import { AttentionCard, SandboxVolumeCard } from "../components/DashboardInsightCards";
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Input,
  PageTitle,
  SimulasiLabel,
} from "../components/ui";

export function IntegratedAdminDashboardPage() {
  const dashboard = useAdminDashboard();
  const navigate = useNavigate();
  if (!dashboard.data)
    return dashboard.isError ? (
      <LoadError onRetry={() => void dashboard.refetch()} />
    ) : (
      <LoadingCard />
    );
  const data = dashboard.data;
  return (
    <>
      <PageTitle
        eyebrow="Admin platform"
        title="Kendali operasional LapanganGo"
        description="Ringkasan lintas tenant dari API B1."
      />
      <div className="metric-grid four">
        <Metric label="Pengguna" value={data.users} />
        <Metric label="Tenant" value={data.tenants} />
        <Metric label="Venue aktif" value={data.activeVenues} />
        <Metric label="Booking" value={data.bookings} />
      </div>
      <div className="admin-dashboard-grid">
        <AttentionCard
          description="Antrian platform yang membutuhkan pemeriksaan Admin."
          items={[
            {
              icon: ShieldCheck,
              value: `${data.pendingVerifications} verifikasi`,
              label: "menunggu keputusan Admin",
              status: "Review",
              tone: "warning",
              onClick: () => navigate("/admin/verifications"),
            },
            {
              icon: AlertTriangle,
              value: `${data.pendingOutbox} event`,
              label: "outbox belum diproses",
              status: "Periksa",
              tone: data.pendingOutbox > 0 ? "danger" : "info",
              onClick: () => navigate("/admin/system"),
            },
          ]}
        />
        <SandboxVolumeCard amount={formatCurrency(data.sandboxVolume)} />
      </div>
    </>
  );
}

export function IntegratedAdminAuditPage() {
  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const audit = useAdminAudit({
    ...(action.trim() ? { action: action.trim() } : {}),
    ...(resourceType ? { resourceType } : {}),
    ...(fromDate ? { from: localDateBoundary(fromDate, false) } : {}),
    ...(toDate ? { to: localDateBoundary(toDate, true) } : {}),
  });
  const items = audit.data?.pages.flatMap((page) => page.items) ?? [];
  if (!audit.data)
    return audit.isError ? (
      <LoadError onRetry={() => void audit.refetch()} />
    ) : (
      <LoadingCard />
    );
  return (
    <>
      <PageTitle
        eyebrow="Sistem platform"
        title="Audit log"
        description="Perubahan sensitif dari server, lengkap dengan actor, alasan, dan waktu."
      />
      <Card className="audit-toolbar">
        <label>
          Action
          <Input
            value={action}
            maxLength={64}
            placeholder="Contoh: booking.status_changed"
            onChange={(event) => setAction(event.target.value)}
          />
        </label>
        <label>
          Resource
          <SelectField
            ariaLabel="Filter jenis resource audit"
            value={resourceType || "ALL"}
            options={[
              { value: "ALL", label: "Semua resource" },
              { value: "tenant", label: "Tenant" },
              { value: "venue", label: "Venue" },
              { value: "booking", label: "Booking" },
              { value: "payment", label: "Payment" },
              { value: "attendance", label: "Attendance" },
            ]}
            onValueChange={(value) => setResourceType(value === "ALL" ? "" : value)}
          />
        </label>
        <label>
          Dari tanggal
          <Input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </label>
        <label>
          Sampai tanggal
          <Input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(event) => setToDate(event.target.value)}
          />
        </label>
      </Card>
      {items.length ? (
        <Card className="data-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Scope</th>
                <th>Alasan</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatAuditTime(entry.createdAt)}</td>
                  <td>
                    <strong>{entry.action}</strong>
                    <small>{entry.resourceType}</small>
                  </td>
                  <td>
                    {entry.actor?.name ?? "Sistem"}
                    <small>{entry.actor?.email ?? "Automatis"}</small>
                  </td>
                  <td>
                    {entry.venue?.name ?? entry.tenant?.name ?? "Platform"}
                    <small>{entry.resourceId ?? "-"}</small>
                  </td>
                  <td>{entry.reason ?? "-"}</td>
                  <td>
                    <AuditDetailDialog entry={entry} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState
          title="Belum ada audit event"
          description="Ubah filter atau lakukan operasi sensitif untuk membuat event baru."
        />
      )}
      {audit.hasNextPage && (
        <div className="audit-load-more">
          <Button
            variant="secondary"
            disabled={audit.isFetchingNextPage}
            onClick={() => void audit.fetchNextPage()}
          >
            {audit.isFetchingNextPage ? "Memuat..." : "Muat berikutnya"}
          </Button>
        </div>
      )}
    </>
  );
}

function AuditDetailDialog({ entry }: { entry: AdminAuditEntry }) {
  return (
    <Dialog
      title={humanize(entry.action)}
      description={`${formatAuditTime(entry.createdAt)} · ${entry.actor?.name ?? "Sistem"}`}
      trigger={
        <Button variant="ghost" size="sm">
          Lihat
        </Button>
      }
      contentClassName="audit-dialog"
    >
      <dl className="summary-list">
        <div>
          <dt>Resource</dt>
          <dd>{entry.resourceId ?? "-"}</dd>
        </div>
        <div>
          <dt>Request ID</dt>
          <dd>{entry.requestId ?? "-"}</dd>
        </div>
        <div>
          <dt>Alasan</dt>
          <dd>{entry.reason ?? "Tidak dicatat"}</dd>
        </div>
      </dl>
      <div className="audit-state-grid">
        <AuditState title="Sebelum" value={entry.beforeState} />
        <AuditState title="Sesudah" value={entry.afterState} />
      </div>
    </Dialog>
  );
}

function AuditState({ title, value }: { title: string; value: unknown }) {
  return (
    <section>
      <h3>{title}</h3>
      <pre>{JSON.stringify(value ?? null, null, 2)}</pre>
    </section>
  );
}

export function IntegratedAdminTenantsPage() {
  const tenants = useAdminTenants();
  const statusMutation = useUpdateAdminTenantStatus();
  const [search, setSearch] = useState("");
  if (!tenants.data)
    return tenants.isError ? (
      <LoadError onRetry={() => void tenants.refetch()} />
    ) : (
      <LoadingCard />
    );
  const items = tenants.data.items.filter((tenant) =>
    `${tenant.name} ${tenant.primaryOwner ?? ""} ${tenant.primaryOwnerEmail ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        eyebrow="Akun platform"
        title="Owner dan tenant"
        description="Organisasi, Primary Owner, dan status aktual dari database."
      />
      <div className="table-toolbar">
        <div className="search-input">
          <Search />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari tenant atau owner"
          />
        </div>
      </div>
      <Card className="data-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Organisasi</th>
              <th>Primary Owner</th>
              <th>Venue</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.map((tenant) => (
              <tr key={tenant.id}>
                <td>
                  <strong>{tenant.name}</strong>
                  <small>{tenant.slug}</small>
                </td>
                <td>
                  {tenant.primaryOwner ?? "Belum ditetapkan"}
                  <small>{tenant.primaryOwnerEmail}</small>
                </td>
                <td>{tenant.venueCount}</td>
                <td>
                  <StatusBadge status={tenant.status} />
                </td>
                <td>
                  <PlatformStatusDialog
                    resourceLabel={tenant.name}
                    currentStatus={tenant.status}
                    pending={statusMutation.isPending}
                    error={statusMutation.error?.message}
                    onSubmit={(status, reason) =>
                      statusMutation.mutateAsync({
                        tenantId: tenant.id,
                        status,
                        reason,
                      })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

export function IntegratedAdminVenuesPage() {
  const venues = useAdminVenues();
  const statusMutation = useUpdateAdminVenueStatus();
  if (!venues.data)
    return venues.isError ? (
      <LoadError onRetry={() => void venues.refetch()} />
    ) : (
      <LoadingCard />
    );
  return (
    <>
      <PageTitle
        eyebrow="Verifikasi"
        title="Venue platform"
        description="Status venue dan publikasi lintas tenant."
      />
      <Card className="data-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Venue</th>
              <th>Tenant</th>
              <th>Alamat</th>
              <th>Status</th>
              <th>Publikasi</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {venues.data.items.map((venue) => (
              <tr key={venue.id}>
                <td>
                  <strong>{venue.name}</strong>
                  <small>{venue.slug}</small>
                </td>
                <td>{venue.tenantName}</td>
                <td>{venue.addressLine || "Belum diisi"}</td>
                <td>
                  <StatusBadge status={venue.status} />
                </td>
                <td>
                  <StatusBadge status={venue.publicationStatus} />
                </td>
                <td>
                  <PlatformStatusDialog
                    resourceLabel={venue.name}
                    currentStatus={venue.status}
                    pending={statusMutation.isPending}
                    error={statusMutation.error?.message}
                    onSubmit={(status, reason) =>
                      statusMutation.mutateAsync({ venueId: venue.id, status, reason })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

type PlatformResourceStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "SUSPENDED";

const PLATFORM_STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "INACTIVE", label: "Nonaktif" },
  { value: "SUSPENDED", label: "Ditangguhkan" },
] as const;

function PlatformStatusDialog({
  resourceLabel,
  currentStatus,
  pending = false,
  error,
  onSubmit,
}: {
  resourceLabel: string;
  currentStatus: string;
  pending?: boolean;
  error?: string;
  onSubmit: (status: PlatformResourceStatus, reason: string) => Promise<unknown>;
}) {
  const [status, setStatus] = useState<PlatformResourceStatus>(
    isPlatformResourceStatus(currentStatus) ? currentStatus : "INACTIVE",
  );
  const [reason, setReason] = useState("");

  async function submitStatusChange() {
    await onSubmit(status, reason.trim());
    setReason("");
  }

  return (
    <Dialog
      title={`Ubah status ${resourceLabel}`}
      description="Perubahan sensitif ini dicatat pada audit log platform."
      trigger={
        <Button variant="ghost" size="sm">
          Kelola status
        </Button>
      }
    >
      <label>
        Status baru
        <SelectField
          ariaLabel={`Status baru untuk ${resourceLabel}`}
          value={status}
          options={PLATFORM_STATUS_OPTIONS.map((option) => ({ ...option }))}
          onValueChange={(value) => {
            if (isPlatformResourceStatus(value)) setStatus(value);
          }}
        />
      </label>
      <label>
        Alasan perubahan
        <textarea
          className="input"
          value={reason}
          maxLength={2000}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Minimal 5 karakter"
        />
      </label>
      {error && <p className="field-error">{error}</p>}
      <Button
        disabled={pending || reason.trim().length < 5 || status === currentStatus}
        onClick={() => void submitStatusChange()}
      >
        Simpan status
      </Button>
    </Dialog>
  );
}

function isPlatformResourceStatus(value: string): value is PlatformResourceStatus {
  return PLATFORM_STATUS_OPTIONS.some((option) => option.value === value);
}

export function IntegratedAdminVerificationsPage() {
  const verifications = useAdminVerifications();
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState("SUBMITTED");
  const [reason, setReason] = useState("");
  const decision = useDecideAdminVerification();
  const items = useMemo(
    () =>
      verifications.data?.items.filter(
        (item) => filter === "ALL" || item.status === filter,
      ) ?? [],
    [filter, verifications.data],
  );
  const selected =
    verifications.data?.items.find((item) => item.requestId === selectedId) ?? items[0];
  if (!verifications.data)
    return verifications.isError ? (
      <LoadError onRetry={() => void verifications.refetch()} />
    ) : (
      <LoadingCard />
    );

  async function decide(value: "APPROVED" | "REJECTED" | "REVISION_REQUIRED") {
    if (!selected) return;
    const finalReason =
      reason.trim() || (value === "APPROVED" ? "Dokumen dan data venue lengkap." : "");
    if (finalReason.length < 5) return;
    await decision.mutateAsync({
      requestId: selected.requestId,
      decision: value,
      reason: finalReason,
    });
    setReason("");
    setSelectedId("");
  }

  return (
    <>
      <PageTitle
        eyebrow="Verifikasi"
        title="Review pengajuan venue"
        description="Snapshot tidak berubah walaupun draft Owner diedit setelah submit."
        action={<SimulasiLabel />}
      />
      <div className="verification-layout">
        <Card className="verification-queue">
          <div className="card-heading">
            <h2>Antrian review</h2>
            <Badge tone="warning">{items.length}</Badge>
          </div>
          <SelectField
            ariaLabel="Filter antrian"
            value={filter}
            options={[
              { value: "ALL", label: "Semua" },
              { value: "SUBMITTED", label: "Pengajuan baru" },
              { value: "REVISION_REQUIRED", label: "Perlu revisi" },
              { value: "APPROVED", label: "Disetujui" },
            ]}
            onValueChange={setFilter}
          />
          {items.map((item) => (
            <button
              key={item.requestId}
              className={selected?.requestId === item.requestId ? "active" : ""}
              onClick={() => {
                setSelectedId(item.requestId);
                setReason("");
              }}
            >
              <span>
                <strong>{item.venueName}</strong>
                <small>{item.tenantName}</small>
              </span>
              <StatusBadge status={item.status} />
            </button>
          ))}
          {items.length === 0 && (
            <EmptyState
              title="Antrian kosong"
              description="Tidak ada pengajuan pada filter ini."
            />
          )}
        </Card>
        {selected && (
          <Card className="verification-review">
            <div className="card-heading">
              <div>
                <p className="eyebrow">Versi {selected.venueVersion}</p>
                <h2>{selected.venueName}</h2>
                <p>{selected.tenantName}</p>
              </div>
              <StatusBadge status={selected.status} />
            </div>
            <div className="document-preview">
              <ShieldCheck />
              <strong>Dokumen verifikasi</strong>
              <small>Simulasi · snapshot tersimpan</small>
            </div>
            <SnapshotSummary snapshot={selected.snapshot} />
            <label>
              Alasan keputusan
              <textarea
                className="input"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Wajib untuk penolakan atau revisi"
              />
            </label>
            {decision.error && <p className="field-error">{decision.error.message}</p>}
            <div className="form-actions">
              <Button
                variant="danger"
                disabled={reason.trim().length < 5 || decision.isPending}
                onClick={() => void decide("REJECTED")}
              >
                Tolak
              </Button>
              <Button
                variant="secondary"
                disabled={reason.trim().length < 5 || decision.isPending}
                onClick={() => void decide("REVISION_REQUIRED")}
              >
                Minta revisi
              </Button>
              <Button
                disabled={decision.isPending}
                onClick={() => void decide("APPROVED")}
              >
                <CheckCircle2 /> Setujui
              </Button>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

export function AdminMastersPage({ kind }: { kind: "sport" | "facility" }) {
  const masters = useAdminMasters();
  const create = useCreateAdminMaster();
  const toggle = useToggleAdminMaster();
  const [name, setName] = useState("");
  if (!masters.data)
    return masters.isError ? (
      <LoadError onRetry={() => void masters.refetch()} />
    ) : (
      <LoadingCard />
    );
  const items = kind === "sport" ? masters.data.sports : masters.data.facilities;
  const title = kind === "sport" ? "Master olahraga" : "Master fasilitas";
  return (
    <>
      <PageTitle
        eyebrow="Konfigurasi platform"
        title={title}
        description="Pilihan aktif digunakan oleh Owner saat setup venue."
        action={
          <Dialog
            title={`Tambah ${kind === "sport" ? "olahraga" : "fasilitas"}`}
            description="Nama dan slug disimpan pada master platform."
            trigger={<Button>Tambah</Button>}
          >
            <label>
              Nama
              <Input
                value={name}
                maxLength={50}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <Button
              disabled={name.trim().length < 2 || create.isPending}
              onClick={async () => {
                await create.mutateAsync({ kind, name: name.trim() });
                setName("");
              }}
            >
              Simpan
            </Button>
          </Dialog>
        }
      />
      <Card className="data-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nama</th>
              <th>Slug</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.name}</strong>
                </td>
                <td>{item.slug}</td>
                <td>
                  <Badge tone={item.active ? "success" : "neutral"}>
                    {item.active ? "Aktif" : "Nonaktif"}
                  </Badge>
                </td>
                <td>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={toggle.isPending}
                    onClick={() =>
                      toggle.mutate({ kind, id: item.id, active: !item.active })
                    }
                  >
                    {item.active ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

export function AdminSchedulingPage() {
  const masters = useAdminMasters();
  const create = useCreateAdminDuration();
  const [kind, setKind] = useState<"interval" | "buffer">("interval");
  const [minutes, setMinutes] = useState(60);
  if (!masters.data)
    return masters.isError ? (
      <LoadError onRetry={() => void masters.refetch()} />
    ) : (
      <LoadingCard />
    );
  return (
    <>
      <PageTitle
        eyebrow="Konfigurasi platform"
        title="Interval dan buffer"
        description="Opsi aktif digunakan pada jadwal lapangan B1."
        action={
          <Dialog
            title="Tambah opsi durasi"
            description="Durasi disimpan dalam menit."
            trigger={<Button>Tambah opsi</Button>}
          >
            <label>
              Jenis
              <SelectField
                ariaLabel="Jenis durasi"
                value={kind}
                options={[
                  { value: "interval", label: "Interval booking" },
                  { value: "buffer", label: "Buffer" },
                ]}
                onValueChange={(value) => setKind(value as "interval" | "buffer")}
              />
            </label>
            <label>
              Menit
              <Input
                type="number"
                min={0}
                max={360}
                value={minutes}
                onChange={(event) => setMinutes(Number(event.target.value))}
              />
            </label>
            <Button
              disabled={minutes < 0 || create.isPending}
              onClick={() => create.mutate({ kind, minutes })}
            >
              Simpan
            </Button>
          </Dialog>
        }
      />
      <div className="dashboard-grid">
        <DurationCard title="Interval booking" items={masters.data.bookingIntervals} />
        <DurationCard title="Buffer" items={masters.data.buffers} />
      </div>
    </>
  );
}

export function AdminPaymentOptionsPage() {
  const masters = useAdminMasters();
  const create = useCreateAdminPaymentOption();
  const toggle = useToggleAdminPaymentOption();
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  if (!masters.data)
    return masters.isError ? (
      <LoadError onRetry={() => void masters.refetch()} />
    ) : (
      <LoadingCard />
    );
  return (
    <>
      <PageTitle
        eyebrow="Konfigurasi B1"
        title="Opsi pembayaran"
        description="Opsi metode yang dapat dipilih Owner saat setup venue."
        action={
          <Dialog
            title="Tambah opsi pembayaran"
            description="Kode harus berupa huruf besar, angka, atau underscore."
            trigger={<Button>Tambah opsi</Button>}
          >
            <label>
              Kode
              <Input
                value={code}
                maxLength={24}
                onChange={(event) =>
                  setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))
                }
              />
            </label>
            <label>
              Label
              <Input
                value={label}
                maxLength={50}
                onChange={(event) => setLabel(event.target.value)}
              />
            </label>
            <Button
              disabled={code.length < 2 || label.trim().length < 2 || create.isPending}
              onClick={() => create.mutate({ code, label: label.trim() })}
            >
              Simpan
            </Button>
          </Dialog>
        }
      />
      <Card className="data-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Kode</th>
              <th>Label</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {masters.data.paymentOptions.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.code}</strong>
                </td>
                <td>{item.label}</td>
                <td>
                  <Badge tone={item.active ? "success" : "neutral"}>
                    {item.active ? "Aktif" : "Nonaktif"}
                  </Badge>
                </td>
                <td>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate({ id: item.id, active: !item.active })}
                  >
                    {item.active ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function DurationCard({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; minutes: number; active: boolean }>;
}) {
  return (
    <Card>
      <h2>{title}</h2>
      <div className="data-card">
        {items.map((item) => (
          <div className="list-item" key={item.id}>
            <strong>{item.minutes} menit</strong>
            <Badge tone={item.active ? "success" : "neutral"}>
              {item.active ? "Aktif" : "Nonaktif"}
            </Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SnapshotSummary({ snapshot }: { snapshot: unknown }) {
  if (!snapshot || typeof snapshot !== "object") return <p>Snapshot tidak tersedia.</p>;
  return (
    <dl className="summary-list">
      {Object.entries(snapshot)
        .slice(0, 8)
        .map(([key, value]) => (
          <div key={key}>
            <dt>{humanize(key)}</dt>
            <dd>{presentValue(value)}</dd>
          </div>
        ))}
    </dl>
  );
}
function presentValue(value: unknown): string {
  if (Array.isArray(value)) return `${value.length} item`;
  if (value && typeof value === "object") return "Data tersimpan";
  return String(value ?? "-");
}
function humanize(value: string): string {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (character) => character.toUpperCase());
}
function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "APPROVED" || status === "ACTIVE" || status === "PUBLIC"
      ? "success"
      : status === "REJECTED" || status === "SUSPENDED"
        ? "danger"
        : "warning";
  return <Badge tone={tone}>{status.replaceAll("_", " ")}</Badge>;
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <span>{label}</span>
      <strong>{value}</strong>
    </Card>
  );
}
function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}
function localDateBoundary(value: string, endOfDay: boolean): string {
  const time = endOfDay ? "23:59:59.999" : "00:00:00.000";
  return new Date(`${value}T${time}+07:00`).toISOString();
}
function formatAuditTime(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}
function LoadingCard() {
  return (
    <Card className="state-card" aria-busy="true">
      Memuat data Admin...
    </Card>
  );
}
function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      title="Data Admin belum dapat dimuat"
      description="Periksa koneksi API lalu coba lagi."
      action={<Button onClick={onRetry}>Coba lagi</Button>}
    />
  );
}
