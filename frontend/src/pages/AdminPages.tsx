import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  Dialog,
  Input,
  PageTitle,
  SimulasiLabel,
} from "../components/ui";
import { usePrototype } from "../store/PrototypeStore";
import { formatRupiah, statusLabel } from "../store/selectors";
import { SelectField } from "../components/SelectField";

export function AdminDashboardPage() {
  const { state } = usePrototype();
  const navigate = useNavigate();
  return (
    <>
      <PageTitle
        eyebrow="Admin Platform"
        title="Kendali operasional LapanganGo"
        description="Pantau pertumbuhan, pekerjaan tertunda, dan kesehatan sistem."
      />
      <div className="metric-grid four">
        <Card>
          <span>GMV bulan ini</span>
          <strong>{formatRupiah(428_600_000)}</strong>
          <small>
            <SimulasiLabel />
          </small>
        </Card>
        <Card>
          <span>Venue aktif</span>
          <strong>
            {
              state.venues.filter((venue) => venue.status === "published")
                .length
            }
          </strong>
          <small>2 sedang ditinjau</small>
        </Card>
        <Card>
          <span>Booking hari ini</span>
          <strong>148</strong>
          <small>+12,4%</small>
        </Card>
        <Card>
          <span>Owner menunggu</span>
          <strong>
            {
              state.tenants.filter((tenant) => tenant.status !== "verified")
                .length
            }
          </strong>
          <small>Perlu keputusan</small>
        </Card>
      </div>
      <div className="admin-dashboard-grid">
        <Card className="attention-card">
          <div className="card-heading">
            <h2>Antrian kerja</h2>
            <Badge tone="warning">7 prioritas</Badge>
          </div>
          <button onClick={() => navigate("/admin/verifications")}>
            <ShieldCheck />
            <span>
              <strong>Verifikasi owner</strong>3 dokumen menunggu review
            </span>
          </button>
          <button onClick={() => navigate("/admin/refunds")}>
            <AlertTriangle />
            <span>
              <strong>Refund manual</strong>2 kasus perlu keputusan
            </span>
          </button>
          <button onClick={() => navigate("/admin/system")}>
            <Clock3 />
            <span>
              <strong>Event tertunda</strong>2 outbox melewati SLA
            </span>
          </button>
        </Card>
        <Card className="system-health">
          <h2>Kesehatan sistem</h2>
          {[
            "Fixture store",
            "Payment sandbox",
            "Notification outbox",
            "Cron simulator",
          ].map((item, index) => (
            <div key={item}>
              <span>
                <i className={index === 2 ? "warning" : ""} />
                {item}
              </span>
              <Badge tone={index === 2 ? "warning" : "success"}>
                {index === 2 ? "Degraded" : "Healthy"}
              </Badge>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}

export function TenantsPage() {
  const { state } = usePrototype();
  return (
    <>
      <PageTitle
        eyebrow="Akun platform"
        title="Owner dan tenant"
        description="Review organisasi, membership, dan status verifikasi."
      />
      <div className="table-toolbar">
        <div className="search-input">
          <Search />
          <Input placeholder="Cari tenant atau owner" />
        </div>
        <SelectField
          ariaLabel="Filter status tenant"
          defaultValue="all"
          options={[
            { value: "all", label: "Semua status" },
            { value: "pending", label: "Menunggu" },
            { value: "verified", label: "Terverifikasi" },
          ]}
        />
      </div>
      <Card className="data-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Organisasi</th>
              <th>Owner</th>
              <th>Venue</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {state.tenants.map((tenant) => (
              <tr key={tenant.id}>
                <td>
                  <strong>{tenant.name}</strong>
                  <small>{tenant.id}</small>
                </td>
                <td>{tenant.owner}</td>
                <td>
                  {
                    state.venues.filter((venue) => venue.tenantId === tenant.id)
                      .length
                  }{" "}
                  venue
                </td>
                <td>
                  <Badge
                    tone={
                      tenant.status === "verified"
                        ? "success"
                        : tenant.status === "revision"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {statusLabel(tenant.status)}
                  </Badge>
                </td>
                <td>
                  <Dialog
                    title={tenant.name}
                    description="Ringkasan organisasi dan status verifikasi tenant."
                    trigger={
                      <Button variant="ghost" size="sm">
                        Lihat
                      </Button>
                    }
                  >
                    <p>Owner: {tenant.owner}</p>
                    <p>Status: {statusLabel(tenant.status)}</p>
                    <p>
                      {
                        state.venues.filter(
                          (venue) => venue.tenantId === tenant.id,
                        ).length
                      }{" "}
                      venue terdaftar.
                    </p>
                  </Dialog>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

export function VerificationsPage() {
  const { state, dispatch } = usePrototype();
  const pending = state.venues.filter(
    (venue) => venue.status === "in_review" || venue.status === "revision",
  );
  const [selectedId, setSelectedId] = useState(
    pending[0]?.id ?? state.venues[5].id,
  );
  const [queueFilter, setQueueFilter] = useState("all");
  const selected = state.venues.find((venue) => venue.id === selectedId)!;
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const displayedQueue = pending.filter(
    (venue) => queueFilter === "all" || venue.status === queueFilter,
  );
  function decide(decision: "approve" | "reject" | "revision") {
    if (decision !== "approve" && !reason.trim()) {
      setReasonError("Alasan wajib diisi untuk reject atau revision.");
      return;
    }
    setReasonError("");
    dispatch({
      type: "DECIDE_VENUE",
      venueId: selected.id,
      decision,
      reason: reason.trim() || undefined,
    });
  }
  return (
    <>
      <PageTitle
        eyebrow="Verifikasi"
        title="Review pengajuan venue"
        description="Dokumen legal dan keputusan di halaman ini sepenuhnya simulasi."
        action={<SimulasiLabel />}
      />
      <div className="verification-layout">
        <Card className="verification-queue">
          <div className="card-heading">
            <h2>Antrian review</h2>
            <Badge tone="warning">{pending.length}</Badge>
          </div>
          <SelectField
            ariaLabel="Filter antrian verifikasi"
            value={queueFilter}
            options={[
              { value: "all", label: "Semua antrian" },
              { value: "in_review", label: "Pengajuan baru" },
              { value: "revision", label: "Perlu revisi" },
            ]}
            onValueChange={setQueueFilter}
          />
          {(displayedQueue.length
            ? displayedQueue
            : state.venues.slice(-1)
          ).map((venue) => (
            <button
              key={venue.id}
              className={selectedId === venue.id ? "active" : ""}
              onClick={() => {
                setSelectedId(venue.id);
                setReason("");
                setReasonError("");
              }}
            >
              <img src={venue.image} alt="" />
              <span>
                <strong>{venue.name}</strong>
                <small>{venue.location}</small>
              </span>
              <Badge tone="warning">{statusLabel(venue.status)}</Badge>
            </button>
          ))}
        </Card>
        <div>
          <Card className="review-card">
            <div className="review-cover">
              <img src={selected.image} alt={selected.name} />
              <div>
                <Badge tone="info">Pengajuan baru</Badge>
                <h2>{selected.name}</h2>
                <p>{selected.location}</p>
              </div>
            </div>
            <h3>Checklist dokumen</h3>
            {[
              "Identitas pemilik",
              "Dokumen badan usaha",
              "Bukti pengelolaan venue",
              "Foto dan fasilitas",
            ].map((document, index) => (
              <div className="document-row" key={document}>
                <FileText />
                <span>
                  <strong>{document}</strong>
                  <small>legal-{index + 1}.pdf · simulasi</small>
                </span>
                <Badge tone="success">
                  <CheckCircle2 />
                  Lengkap
                </Badge>
              </div>
            ))}
            <label className="reason-field">
              Catatan keputusan
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Wajib untuk reject atau revisi"
              />
              {reasonError && (
                <span className="field-error">{reasonError}</span>
              )}
            </label>
            <div className="decision-actions">
              <Dialog
                trigger={
                  <Button>
                    <CheckCircle2 />
                    Setujui & tayangkan
                  </Button>
                }
                title="Setujui venue?"
                description="Keputusan akan muncul di Customer dan Business workspace."
              >
                <p>Venue akan berstatus tayang dan tenant terverifikasi.</p>
                <Button onClick={() => decide("approve")}>
                  Konfirmasi persetujuan
                </Button>
              </Dialog>
              <Button variant="secondary" onClick={() => decide("revision")}>
                <Clock3 />
                Minta revisi
              </Button>
              <Button variant="danger" onClick={() => decide("reject")}>
                <XCircle />
                Tolak
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

export function AdminVenuesPage() {
  const { state } = usePrototype();
  const navigate = useNavigate();
  return (
    <>
      <PageTitle
        eyebrow="Verifikasi"
        title="Semua venue"
        description="Status submission, publikasi, dan moderasi venue lintas tenant."
      />
      <div className="venue-admin-grid">
        {state.venues.map((venue) => (
          <Card key={venue.id} className="owner-venue-card">
            <img src={venue.image} alt={venue.name} />
            <div>
              <Badge
                tone={venue.status === "published" ? "success" : "warning"}
              >
                {statusLabel(venue.status)}
              </Badge>
              <h2>{venue.name}</h2>
              <p>{venue.location}</p>
              <Button
                variant="secondary"
                onClick={() => navigate("/admin/verifications")}
              >
                Review venue
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
