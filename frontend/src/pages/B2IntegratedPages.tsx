import * as Popover from "@radix-ui/react-popover";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Landmark,
  MessageCircleQuestion,
  MessageSquareText,
  Percent,
  Plus,
  ReceiptText,
  Send,
  Settings2,
  ShieldCheck,
  Star,
  TicketCheck,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { useParams } from "react-router-dom";
import {
  useAdminB2List,
  useB2BusinessList,
  useCreatePayout,
  useCreateReview,
  useCreateSupportTicket,
  useCustomerSupport,
  useFinanceSummary,
  useCustomerBookingsForReview,
} from "../api/b2Queries";
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Input,
  LoadingState,
  PageTitle,
  SimulasiLabel,
} from "../components/ui";
import { apiClient } from "../api/apiClient";
import { useSession } from "../api/session";
import { SelectField } from "../components/SelectField";
import { b2ItemAmount, b2ItemTitle, nextPayoutStatus } from "./b2UiState";

const initialReviewScores = {
  rating: 5,
  cleanliness: 5,
  courtQuality: 5,
  facility: 5,
  service: 5,
  value: 5,
};

type ReviewScoreField = keyof typeof initialReviewScores;

type BusinessB2Resource =
  "ledger" | "payments" | "payouts" | "promotions" | "refunds" | "reviews" | "support";

type FinanceExportDataset =
  | "bookings"
  | "payments"
  | "refunds"
  | "payouts"
  | "promotions"
  | "staff-activity"
  | "offline-bookings";

type FinanceExportFormat = "csv" | "xlsx";

export const financeExportOptions: Array<{
  value: FinanceExportDataset;
  label: string;
}> = [
  { value: "bookings", label: "Booking" },
  { value: "payments", label: "Pembayaran" },
  { value: "refunds", label: "Refund" },
  { value: "payouts", label: "Payout" },
  { value: "promotions", label: "Promosi" },
  { value: "staff-activity", label: "Aktivitas staff" },
  { value: "offline-bookings", label: "Booking offline" },
];

export const financeExportFormatOptions: Array<{
  value: FinanceExportFormat;
  label: string;
}> = [
  { value: "csv", label: "CSV" },
  { value: "xlsx", label: "Excel (XLSX)" },
];

const contextualExportDatasets: Partial<
  Record<BusinessB2Resource, FinanceExportDataset>
> = {
  payments: "payments",
  payouts: "payouts",
  promotions: "promotions",
  refunds: "refunds",
};

const resourcePresentation: Record<
  BusinessB2Resource,
  { eyebrow: string; description: string; emptyDescription: string }
> = {
  ledger: {
    eyebrow: "Arus dana",
    description: "Riwayat pencatatan debit dan kredit dari transaksi workspace.",
    emptyDescription: "Pencatatan ledger muncul setelah pembayaran pertama diproses.",
  },
  payments: {
    eyebrow: "Keuangan",
    description: "Pantau pembayaran online dan pembayaran di venue dari satu tempat.",
    emptyDescription: "Transaksi pembayaran akan muncul setelah booking dibayar.",
  },
  payouts: {
    eyebrow: "Pencairan sandbox",
    description: "Pantau permintaan dan status pencairan saldo simulasi workspace.",
    emptyDescription: "Payout dapat diminta setelah saldo tersedia memenuhi minimum.",
  },
  promotions: {
    eyebrow: "Pertumbuhan",
    description: "Kelola kode promo owner beserta periode dan statusnya.",
    emptyDescription: "Buat promo pertama untuk mulai menawarkan potongan harga.",
  },
  refunds: {
    eyebrow: "Perlindungan transaksi",
    description: "Pantau pengembalian dana dan sengketa yang terkait dengan booking.",
    emptyDescription: "Refund atau sengketa baru akan muncul saat ada pengajuan.",
  },
  reviews: {
    eyebrow: "Pengalaman pelanggan",
    description: "Baca ulasan terverifikasi dan berikan satu balasan dari owner.",
    emptyDescription: "Review akan muncul setelah pelanggan menyelesaikan booking.",
  },
  support: {
    eyebrow: "Bantuan pelanggan",
    description: "Tindak lanjuti tiket yang terkait dengan venue dan transaksi.",
    emptyDescription: "Tiket pelanggan yang terkait workspace akan muncul di sini.",
  },
};

const reviewScoreFields: Array<{ field: ReviewScoreField; label: string }> = [
  { field: "rating", label: "Nilai keseluruhan" },
  { field: "cleanliness", label: "Kebersihan" },
  { field: "courtQuality", label: "Kualitas lapangan" },
  { field: "facility", label: "Fasilitas" },
  { field: "service", label: "Pelayanan" },
  { field: "value", label: "Kesesuaian harga" },
];

function ReviewRatingField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <fieldset className="review-rating-field">
      <legend>{label}</legend>
      <div className="review-rating-control">
        <div className="review-stars" role="group" aria-label={label}>
          {[1, 2, 3, 4, 5].map((score) => (
            <button
              type="button"
              className={score <= value ? "active" : ""}
              key={score}
              aria-label={`${label}: ${score} dari 5`}
              aria-pressed={score === value}
              onClick={() => onChange(score)}
            >
              <Star />
            </button>
          ))}
        </div>
        <strong>{value}/5</strong>
      </div>
    </fieldset>
  );
}

function ExportSplitButton({
  tenantId,
  dataset,
}: {
  tenantId: string;
  dataset: FinanceExportDataset;
}) {
  return (
    <div className="export-split-button">
      <a
        className="export-split-primary"
        href={financeExportUrl(tenantId, dataset, "csv")}
      >
        <Download aria-hidden="true" />
        Ekspor CSV
      </a>
      <Popover.Root>
        <Popover.Trigger
          className="export-split-menu-trigger"
          aria-label="Pilih format export"
        >
          <ChevronDown aria-hidden="true" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="export-format-popover"
            align="end"
            sideOffset={8}
            collisionPadding={12}
          >
            <div className="export-format-heading">
              <strong>Pilih format</strong>
              <span>Data mengikuti filter dan izin workspace.</span>
            </div>
            <a
              className="export-format-option"
              href={financeExportUrl(tenantId, dataset, "csv")}
            >
              <span className="export-format-icon" aria-hidden="true">
                <FileText />
              </span>
              <span>
                <strong>CSV</strong>
                <small>Ringkas dan mudah diolah</small>
              </span>
            </a>
            <a
              className="export-format-option"
              href={financeExportUrl(tenantId, dataset, "xlsx")}
            >
              <span className="export-format-icon" aria-hidden="true">
                <FileSpreadsheet />
              </span>
              <span>
                <strong>Excel</strong>
                <small>Workbook dengan format XLSX</small>
              </span>
            </a>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

export function BusinessFinancePage() {
  const { tenant } = useParams();
  const summary = useFinanceSummary(tenant);
  const session = useSession();
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ["business", tenant, "finance-settings"],
    queryFn: () => apiClient.getFinanceSettings(tenant!),
    enabled: Boolean(tenant),
  });
  const [accountLabel, setAccountLabel] = useState("");
  const [accountLast4, setAccountLast4] = useState("");
  const [exportDataset, setExportDataset] = useState<FinanceExportDataset>("bookings");
  const [exportFormat, setExportFormat] = useState<FinanceExportFormat>("csv");
  const saveSettings = useMutation({
    mutationFn: () =>
      apiClient.updateFinanceSettings({
        tenantId: tenant!,
        manualPayoutEnabled: true,
        payoutAccountLabel: accountLabel,
        payoutAccountLast4: accountLast4,
        reason: "Memperbarui rekening payout sandbox",
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["business", tenant, "finance-settings"],
      }),
  });
  if (!tenant)
    return (
      <EmptyState title="Workspace tidak valid" description="Pilih workspace aktif." />
    );
  if (!summary.data)
    return <LoadBoundary error={summary.isError} label="ringkasan keuangan" />;
  const membership = session.data?.memberships.find(
    (candidate) => candidate.tenantId === tenant,
  );
  const canExport = canExportFinance(membership);
  const metrics = [
    {
      label: "Pendapatan bruto",
      value: summary.data.grossRevenue,
      note: "Sebelum potongan",
      icon: TrendingUp,
      emphasis: true,
    },
    {
      label: "Total dibayar",
      value: summary.data.totalPaid,
      note: "Dana terverifikasi",
      icon: CreditCard,
      emphasis: false,
    },
    {
      label: "Saldo tersedia",
      value: summary.data.availableBalance,
      note: "Siap diminta payout",
      icon: WalletCards,
      emphasis: true,
    },
    {
      label: "Pendapatan bersih",
      value: summary.data.netOwnerRevenue,
      note: "Bagian untuk owner",
      icon: Landmark,
      emphasis: false,
    },
    {
      label: "Pembayaran DP",
      value: summary.data.dpPaid,
      note: "Pembayaran sebagian",
      icon: ReceiptText,
      emphasis: false,
    },
    {
      label: "Tunai di venue",
      value: summary.data.cashRevenue,
      note: "Dicatat oleh tim",
      icon: Banknote,
      emphasis: false,
    },
    {
      label: "Saldo ditahan",
      value: summary.data.heldBalance,
      note: "Belum dapat dicairkan",
      icon: ShieldCheck,
      emphasis: false,
    },
    {
      label: "Biaya gateway",
      value: summary.data.gatewayFees,
      note: "Biaya pemrosesan",
      icon: CircleDollarSign,
      emphasis: false,
    },
  ] as const;
  return (
    <>
      <PageTitle
        eyebrow="Keuangan sandbox"
        title="Ringkasan keuangan"
        description="Angka dihitung dari snapshot dan ledger server; tidak ada transfer nyata."
        action={
          <div className="page-actions finance-page-actions">
            {canExport && (
              <Dialog
                title="Ekspor laporan"
                description="Pilih data dan format laporan sandbox yang akan diunduh."
                trigger={
                  <Button className="finance-action-button">
                    <Download aria-hidden="true" />
                    Ekspor laporan
                    <ChevronDown
                      className="finance-action-chevron"
                      aria-hidden="true"
                    />
                  </Button>
                }
              >
                <div className="dialog-form">
                  <label>
                    Jenis data
                    <SelectField
                      ariaLabel="Jenis data laporan"
                      options={financeExportOptions}
                      value={exportDataset}
                      onValueChange={(value) =>
                        setExportDataset(value as FinanceExportDataset)
                      }
                    />
                  </label>
                  <label>
                    Format
                    <SelectField
                      ariaLabel="Format laporan"
                      options={financeExportFormatOptions}
                      value={exportFormat}
                      onValueChange={(value) =>
                        setExportFormat(value as FinanceExportFormat)
                      }
                    />
                  </label>
                  <div className="dialog-actions">
                    <a
                      className="btn btn-primary btn-md export-download-button"
                      href={financeExportUrl(tenant, exportDataset, exportFormat)}
                    >
                      <Download /> Unduh {exportFormat.toUpperCase()}
                    </a>
                  </div>
                </div>
              </Dialog>
            )}
            <Dialog
              title="Rekening payout sandbox"
              description={`Minimum payout ${money(Number(settings.data?.minimumPayoutAmount ?? 100_000))}.`}
              trigger={
                <Button className="finance-action-button" variant="secondary">
                  <Settings2 aria-hidden="true" />
                  Pengaturan payout
                </Button>
              }
            >
              <label>
                Label rekening
                <Input
                  value={accountLabel}
                  onChange={(event) => setAccountLabel(event.target.value)}
                />
              </label>
              <label>
                4 digit terakhir
                <Input
                  maxLength={4}
                  value={accountLast4}
                  onChange={(event) =>
                    setAccountLast4(event.target.value.replace(/\D/g, ""))
                  }
                />
              </label>
              <Button
                disabled={accountLast4.length !== 4 || saveSettings.isPending}
                onClick={() => saveSettings.mutate()}
              >
                Simpan
              </Button>
            </Dialog>
          </div>
        }
      />
      <div className="owner-finance-metrics">
        {metrics.map(({ label, value, note, icon: Icon, emphasis }) => (
          <Card className={emphasis ? "is-emphasis" : ""} key={label}>
            <div className="owner-finance-metric-heading">
              <span>{label}</span>
              <span className="owner-finance-metric-icon" aria-hidden="true">
                <Icon />
              </span>
            </div>
            <strong>{money(value)}</strong>
            <small>{note}</small>
          </Card>
        ))}
      </div>
      <Card className="data-card owner-reconciliation-card">
        <div className="owner-section-heading">
          <div>
            <h2>Rekonsiliasi pendapatan</h2>
            <p>Ringkasan komponen yang membentuk saldo workspace.</p>
          </div>
          <Badge tone="success">Tersinkron</Badge>
        </div>
        <dl className="owner-reconciliation-grid">
          <div>
            <dt>Online</dt>
            <dd>{money(summary.data.onlineRevenue)}</dd>
          </div>
          <div>
            <dt>Offline</dt>
            <dd>{money(summary.data.offlineRevenue)}</dd>
          </div>
          <div>
            <dt>Discount</dt>
            <dd>{money(summary.data.discounts)}</dd>
          </div>
          <div>
            <dt>Komisi</dt>
            <dd>{money(summary.data.commission)}</dd>
          </div>
          <div>
            <dt>Refund</dt>
            <dd>{money(summary.data.refunds)}</dd>
          </div>
          <div>
            <dt>Outstanding</dt>
            <dd>{money(summary.data.balanceDue)}</dd>
          </div>
        </dl>
      </Card>
      <div className="supporting-grid owner-comparison-grid">
        <Card className="data-card">
          <div className="owner-section-heading">
            <div>
              <h2>Per venue</h2>
              <p>Kontribusi pembayaran tiap lokasi.</p>
            </div>
          </div>
          {summary.data.venueComparison.map((item) => (
            <div className="domain-row" key={item.venueId}>
              <span className="owner-comparison-label">
                <strong>{item.name}</strong>
                <small>Venue</small>
              </span>
              <strong>{money(item.paid)}</strong>
            </div>
          ))}
        </Card>
        <Card className="data-card">
          <div className="owner-section-heading">
            <div>
              <h2>Per lapangan</h2>
              <p>Kontribusi pembayaran tiap lapangan.</p>
            </div>
          </div>
          {summary.data.courtComparison.map((item) => (
            <div className="domain-row" key={item.courtId}>
              <span className="owner-comparison-label">
                <strong>{item.name}</strong>
                <small>{item.venueName}</small>
              </span>
              <strong>{money(item.paid)}</strong>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}

export function BusinessB2ListPage({
  resource,
  title,
}: {
  resource: BusinessB2Resource;
  title: string;
}) {
  const { tenant } = useParams();
  const query = useB2BusinessList(tenant, resource);
  const payout = useCreatePayout(tenant ?? "");
  const queryClient = useQueryClient();
  const session = useSession();
  const [promoCode, setPromoCode] = useState("");
  const [promoName, setPromoName] = useState("");
  const [promoStartTime, setPromoStartTime] = useState("06:00");
  const [promoEndTime, setPromoEndTime] = useState("23:00");
  const [reply, setReply] = useState("");
  const [promoDialogOpen, setPromoDialogOpen] = useState(false);
  const [reviewReplyId, setReviewReplyId] = useState<string | null>(null);
  const [supportReplyId, setSupportReplyId] = useState<string | null>(null);
  const createPromo = useMutation({
    mutationFn: () =>
      apiClient.createBusinessPromotion({
        tenantId: tenant!,
        code: promoCode,
        name: promoName,
        description: "Promo owner lokal",
        discountType: "PERCENT",
        discountValue: 1_000,
        maximumDiscount: 50_000,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        startsAtTime: `${promoStartTime}:00`,
        endsAtTime: `${promoEndTime}:00`,
        quota: 100,
        perUserLimit: 1,
        fundingSource: "OWNER",
      }),
    onSuccess: () => {
      setPromoDialogOpen(false);
      setPromoCode("");
      setPromoName("");
      void queryClient.invalidateQueries({
        queryKey: ["business", tenant, "b2", "promotions"],
      });
    },
  });
  const replyReview = useMutation({
    mutationFn: (reviewId: string) =>
      apiClient.replyToBusinessReview(reviewId, tenant!, reply),
    onSuccess: () => {
      setReviewReplyId(null);
      setReply("");
      void queryClient.invalidateQueries({
        queryKey: ["business", tenant, "b2", "reviews"],
      });
    },
  });
  const replySupport = useMutation({
    mutationFn: (ticketId: string) =>
      apiClient.replyToBusinessSupport(ticketId, tenant!, reply),
    onSuccess: () => {
      setSupportReplyId(null);
      setReply("");
      void queryClient.invalidateQueries({
        queryKey: ["business", tenant, "b2", "support"],
      });
    },
  });
  if (!tenant)
    return (
      <EmptyState title="Workspace tidak valid" description="Pilih workspace aktif." />
    );
  const presentation = resourcePresentation[resource];
  const membership = session.data?.memberships.find(
    (candidate) => candidate.tenantId === tenant,
  );
  const exportDataset = contextualExportDataset(resource);
  const showExport = Boolean(exportDataset) && canExportFinance(membership);
  return (
    <>
      <PageTitle
        eyebrow={presentation.eyebrow}
        title={title}
        description={presentation.description}
        action={
          <div className="owner-b2-page-actions">
            <SimulasiLabel />
            {resource === "payouts" && (
              <Button disabled={payout.isPending} onClick={() => payout.mutate()}>
                <Plus /> Minta payout
              </Button>
            )}
            {resource === "promotions" && (
              <Dialog
                open={promoDialogOpen}
                onOpenChange={setPromoDialogOpen}
                title="Buat promo owner"
                description="Validasi quota, budget, scope, dan limit dilakukan server."
                contentClassName="b2-form-dialog owner-promo-dialog"
                trigger={
                  <Button>
                    <Plus /> Tambah promo
                  </Button>
                }
              >
                <div className="dialog-form">
                  <div className="dialog-context-panel">
                    <Percent aria-hidden="true" />
                    <span>
                      <strong>Promo ditanggung owner</strong>
                      <small>Diskon default 10% dengan maksimum Rp50.000.</small>
                    </span>
                  </div>
                  <label>
                    Kode promo
                    <Input
                      autoComplete="off"
                      placeholder="CONTOH10"
                      value={promoCode}
                      onChange={(event) =>
                        setPromoCode(event.target.value.toUpperCase())
                      }
                    />
                    <small className="field-hint">Minimal 2 karakter.</small>
                  </label>
                  <label>
                    Nama promo
                    <Input
                      placeholder="Promo akhir pekan"
                      value={promoName}
                      onChange={(event) => setPromoName(event.target.value)}
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      Mulai berlaku
                      <Input
                        type="time"
                        value={promoStartTime}
                        onChange={(event) => setPromoStartTime(event.target.value)}
                      />
                    </label>
                    <label>
                      Selesai berlaku
                      <Input
                        type="time"
                        value={promoEndTime}
                        onChange={(event) => setPromoEndTime(event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="dialog-actions">
                    <Button variant="ghost" onClick={() => setPromoDialogOpen(false)}>
                      Batal
                    </Button>
                    <Button
                      disabled={
                        promoCode.length < 2 ||
                        promoName.length < 2 ||
                        createPromo.isPending
                      }
                      onClick={() => createPromo.mutate()}
                    >
                      {createPromo.isPending ? "Menyimpan…" : "Simpan promo"}
                    </Button>
                  </div>
                </div>
              </Dialog>
            )}
            {showExport && (
              <ExportSplitButton tenantId={tenant} dataset={exportDataset!} />
            )}
          </div>
        }
      />
      {!query.data ? (
        <LoadBoundary error={query.isError} label={title.toLowerCase()} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          title={`Belum ada ${title.toLowerCase()}`}
          description={presentation.emptyDescription}
        />
      ) : (
        <Card className="owner-b2-list-card">
          {query.data.items.map((item, index) => (
            <div className="owner-b2-item" key={item.id ?? index}>
              <span className="owner-b2-item-icon" aria-hidden="true">
                <OwnerResourceIcon resource={resource} />
              </span>
              <div className="owner-b2-item-copy">
                <div className="owner-b2-item-title">
                  <strong>{ownerItemTitle(resource, item)}</strong>
                  <Badge tone={statusTone(item.status)}>
                    {humanizeStatus(item.status)}
                  </Badge>
                </div>
                <p>{ownerItemDescription(resource, item)}</p>
                <small>{formatDateTime(item.createdAt)}</small>
              </div>
              {ownerItemAmount(resource, item) && (
                <strong className="owner-b2-item-amount">
                  {ownerItemAmount(resource, item)}
                </strong>
              )}
              <div className="owner-b2-item-action">
                {resource === "reviews" && !item.reply && (
                  <Dialog
                    open={reviewReplyId === item.id}
                    onOpenChange={(open) => {
                      setReviewReplyId(open ? item.id : null);
                      if (!open) setReply("");
                    }}
                    title="Balas review"
                    description="Satu balasan owner untuk review ini."
                    contentClassName="b2-form-dialog"
                    trigger={
                      <Button variant="secondary" size="sm">
                        <MessageSquareText /> Balas
                      </Button>
                    }
                  >
                    <div className="dialog-form">
                      <div className="dialog-context-panel">
                        <Star aria-hidden="true" />
                        <span>
                          <strong>{ownerItemTitle(resource, item)}</strong>
                          <small>{ownerItemDescription(resource, item)}</small>
                        </span>
                      </div>
                      <label>
                        Balasan
                        <textarea
                          className="input dialog-textarea"
                          placeholder="Tulis tanggapan yang sopan dan membantu…"
                          value={reply}
                          onChange={(event) => setReply(event.target.value)}
                        />
                      </label>
                      <div className="dialog-actions">
                        <Button variant="ghost" onClick={() => setReviewReplyId(null)}>
                          Batal
                        </Button>
                        <Button
                          disabled={reply.trim().length < 2 || replyReview.isPending}
                          onClick={() => replyReview.mutate(item.id)}
                        >
                          <Send /> Kirim balasan
                        </Button>
                      </div>
                    </div>
                  </Dialog>
                )}
                {resource === "support" && (
                  <Dialog
                    open={supportReplyId === item.id}
                    onOpenChange={(open) => {
                      setSupportReplyId(open ? item.id : null);
                      if (!open) setReply("");
                    }}
                    title="Balas tiket"
                    description="Pesan tersimpan pada thread tiket."
                    contentClassName="b2-form-dialog"
                    trigger={
                      <Button variant="secondary" size="sm">
                        <MessageSquareText /> Balas
                      </Button>
                    }
                  >
                    <div className="dialog-form">
                      <div className="dialog-context-panel">
                        <TicketCheck aria-hidden="true" />
                        <span>
                          <strong>{ownerItemTitle(resource, item)}</strong>
                          <small>{ownerItemDescription(resource, item)}</small>
                        </span>
                      </div>
                      <label>
                        Pesan
                        <textarea
                          className="input dialog-textarea"
                          placeholder="Tulis jawaban untuk pelanggan…"
                          value={reply}
                          onChange={(event) => setReply(event.target.value)}
                        />
                      </label>
                      <div className="dialog-actions">
                        <Button variant="ghost" onClick={() => setSupportReplyId(null)}>
                          Batal
                        </Button>
                        <Button
                          disabled={reply.trim().length < 1 || replySupport.isPending}
                          onClick={() => replySupport.mutate(item.id)}
                        >
                          <Send /> Kirim pesan
                        </Button>
                      </div>
                    </div>
                  </Dialog>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}
      {payout.error && (
        <p className="field-error" role="alert">
          {payout.error.message}
        </p>
      )}
    </>
  );
}

export function CustomerSupportPage() {
  const query = useCustomerSupport();
  const create = useCreateSupportTicket();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const submitTicket = () =>
    create.mutate(
      {
        category: "OTHER",
        subject,
        message,
        transactionDispute: false,
      },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setSubject("");
          setMessage("");
        },
      },
    );
  return (
    <div className="content-container b2-customer-page">
      <PageTitle
        eyebrow="Bantuan"
        title="Tiket bantuan"
        description="Percakapan bantuan dan dispute transaksi tersimpan di server."
        action={
          <Dialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            title="Buat tiket"
            description="Jelaskan masalah agar tim dapat menindaklanjuti."
            contentClassName="b2-form-dialog"
            trigger={
              <Button>
                <Plus /> Buat tiket
              </Button>
            }
          >
            <div className="dialog-form">
              <div className="dialog-context-panel">
                <MessageCircleQuestion />
                <span>
                  <strong>Ceritakan kendalamu</strong>
                  <small>Tim bantuan akan membalas melalui tiket ini.</small>
                </span>
              </div>
              <div className="dialog-field-stack">
                <label>
                  Judul
                  <Input
                    placeholder="Contoh: Pembayaran belum terverifikasi"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                  />
                </label>
                <label>
                  Pesan
                  <textarea
                    className="input dialog-textarea"
                    placeholder="Jelaskan kronologi dan hasil yang kamu harapkan"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                  />
                </label>
              </div>
              <div className="dialog-actions">
                <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                  Batal
                </Button>
                <Button
                  disabled={
                    subject.trim().length < 3 ||
                    message.trim().length < 3 ||
                    create.isPending
                  }
                  onClick={submitTicket}
                >
                  <Send /> {create.isPending ? "Mengirim..." : "Kirim tiket"}
                </Button>
              </div>
            </div>
          </Dialog>
        }
      />
      {!query.data ? (
        <LoadBoundary error={query.isError} label="tiket" />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          title="Belum ada tiket"
          description="Tiket yang dibuat akan muncul di sini."
        />
      ) : (
        <div className="customer-ticket-grid">
          {query.data.items.map((item) => (
            <Card className="customer-ticket-card" key={String(item.id)}>
              <div className="customer-ticket-card-header">
                <span className="customer-flow-icon">
                  <MessageCircleQuestion />
                </span>
                <Badge tone={item.status === "RESOLVED" ? "success" : "info"}>
                  {supportStatusLabel(String(item.status))}
                </Badge>
              </div>
              <div className="customer-ticket-copy">
                <h2>{String(item.subject)}</h2>
                <p>Tim bantuan akan memperbarui status tiket saat ada perkembangan.</p>
              </div>
              <div className="customer-ticket-reference">
                <span>Nomor tiket</span>
                <strong>{String(item.ticketCode ?? item.id)}</strong>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function CustomerReviewsPage() {
  const bookings = useCustomerBookingsForReview();
  const create = useCreateReview();
  const [selected, setSelected] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [scores, setScores] = useState({ ...initialReviewScores });
  const completed =
    bookings.data?.items.filter((booking) => booking.status === "COMPLETED") ?? [];
  const closeReviewDialog = () => {
    setSelected(null);
    setComment("");
    setScores({ ...initialReviewScores });
  };
  return (
    <div className="content-container b2-customer-page">
      <PageTitle
        eyebrow="Pengalaman bermain"
        title="Review Saya"
        description="Review hanya dapat dibuat untuk booking yang sudah selesai."
      />
      {!bookings.data ? (
        <LoadBoundary error={bookings.isError} label="booking selesai" />
      ) : completed.length === 0 ? (
        <EmptyState
          title="Belum ada booking yang dapat direview"
          description="Selesaikan permainan terlebih dahulu."
        />
      ) : (
        <div className="customer-review-grid">
          {completed.map((booking) => (
            <Card className="customer-review-card" key={booking.id}>
              <div className="customer-review-card-heading">
                <span className="customer-flow-icon">
                  {booking.reviewId ? <CheckCircle2 /> : <Star />}
                </span>
                {booking.reviewId ? (
                  <Badge tone="success">Review terkirim</Badge>
                ) : (
                  <Badge tone="neutral">Menunggu review</Badge>
                )}
              </div>
              <div className="customer-review-copy">
                <h2>{booking.venueName}</h2>
                <p>{booking.courtName}</p>
                <span>
                  <CalendarDays />
                  {new Date(booking.startsAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              {booking.reviewId ? (
                <p className="customer-review-complete">
                  Terima kasih, pengalamanmu membantu pemain lain memilih venue.
                </p>
              ) : (
                <Dialog
                  open={selected === booking.id}
                  onOpenChange={(open) =>
                    open ? setSelected(booking.id) : closeReviewDialog()
                  }
                  title="Tulis review"
                  description="Nilai pengalaman bermainmu secara jujur."
                  contentClassName="b2-form-dialog b2-review-dialog"
                  trigger={
                    <Button>
                      <Star /> Beri review
                    </Button>
                  }
                >
                  <div className="dialog-form">
                    <div className="review-booking-context">
                      <span className="customer-flow-icon">
                        <Star />
                      </span>
                      <span>
                        <strong>{booking.venueName}</strong>
                        <small>{booking.courtName}</small>
                      </span>
                    </div>
                    <div className="review-rating-grid">
                      {reviewScoreFields.map(({ field, label }) => (
                        <ReviewRatingField
                          key={field}
                          label={label}
                          value={scores[field]}
                          onChange={(value) =>
                            setScores((current) => ({ ...current, [field]: value }))
                          }
                        />
                      ))}
                    </div>
                    <label>
                      Komentar
                      <textarea
                        className="input dialog-textarea"
                        placeholder="Bagikan hal yang paling berkesan dari venue ini"
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                      />
                    </label>
                    {create.error && (
                      <p className="field-error" role="alert">
                        {create.error.message}
                      </p>
                    )}
                    <div className="dialog-actions">
                      <Button variant="secondary" onClick={closeReviewDialog}>
                        Batal
                      </Button>
                      <Button
                        disabled={
                          !selected || comment.trim().length < 3 || create.isPending
                        }
                        onClick={() =>
                          selected &&
                          create.mutate(
                            { bookingId: selected, ...scores, comment },
                            { onSuccess: closeReviewDialog },
                          )
                        }
                      >
                        <Send /> {create.isPending ? "Mengirim..." : "Kirim review"}
                      </Button>
                    </div>
                  </div>
                </Dialog>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminB2Page({
  resource,
  title,
}: {
  resource:
    | "commission-configs"
    | "refunds"
    | "support"
    | "promotions"
    | "payouts"
    | "reviews"
    | "finance/ledger";
  title: string;
}) {
  const query = useAdminB2List(resource);
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("Konfigurasi Phase B2 lokal");
  const [promoCode, setPromoCode] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const createConfig = useMutation({
    mutationFn: () =>
      resource === "commission-configs"
        ? apiClient.createAdminCommission({
            tenantId: null,
            rateBasisPoints: 800,
            effectiveFrom: new Date().toISOString(),
            gatewayFeeFunding: "OWNER",
            gatewayFeeBasisPoints: 250,
            reason,
          })
        : apiClient.createAdminPromotion({
            tenantId: null,
            code: promoCode,
            name: `Promo ${promoCode}`,
            description: reason,
            discountType: "PERCENT",
            discountValue: 1_000,
            maximumDiscount: 50_000,
            startsAt: new Date().toISOString(),
            endsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
            quota: 100,
            perUserLimit: 1,
            fundingSource: "PLATFORM",
            budgetAmount: 5_000_000,
          }),
    onSuccess: () => {
      setCreateDialogOpen(false);
      setPromoCode("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "b2", resource] });
    },
  });
  const decideRefund = useMutation({
    mutationFn: (input: { id: string; approved: boolean }) =>
      apiClient.decideRefund(input.id, input.approved, reason),
    onSuccess: () => query.refetch(),
  });
  const updatePayout = useMutation({
    mutationFn: (input: {
      id: string;
      status: "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
    }) => apiClient.updatePayout(input.id, input.status, reason),
    onSuccess: () => query.refetch(),
  });
  const moderate = useMutation({
    mutationFn: (input: { id: string; status: "VISIBLE" | "HIDDEN" }) =>
      apiClient.moderateReview(input.id, input.status, reason),
    onSuccess: () => query.refetch(),
  });
  const resolveSupport = useMutation({
    mutationFn: (id: string) =>
      apiClient.updateSupportTicket(id, { status: "RESOLVED", resolution: reason }),
    onSuccess: () => query.refetch(),
  });
  const createAction =
    resource === "commission-configs" || resource === "promotions" ? (
      <Dialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        title={
          resource === "commission-configs"
            ? "Buat konfigurasi komisi"
            : "Buat promo platform"
        }
        description="Nilai versioned dan diaudit oleh server."
        trigger={
          <Button>
            <Plus /> Tambah
          </Button>
        }
      >
        {resource === "promotions" && (
          <label>
            Kode promo
            <Input
              value={promoCode}
              onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
            />
          </label>
        )}
        <label>
          Alasan
          <Input value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <Button
          disabled={
            reason.trim().length < 3 ||
            (resource === "promotions" && promoCode.length < 2) ||
            createConfig.isPending
          }
          onClick={() => createConfig.mutate()}
        >
          Simpan
        </Button>
      </Dialog>
    ) : null;
  return (
    <>
      <PageTitle
        eyebrow="Administrasi B2"
        title={title}
        description="Data operasional lintas tenant dari API lokal."
        action={
          <div className="page-actions">
            <SimulasiLabel />
            {createAction}
          </div>
        }
      />
      {!query.data ? (
        <LoadBoundary error={query.isError} label={title.toLowerCase()} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          title="Belum ada data"
          description="Belum ada record yang perlu ditinjau."
        />
      ) : (
        <Card className="data-card">
          {query.data.items.map((item) => (
            <div className="domain-row" key={item.id}>
              <span className="domain-icon">
                <ShieldCheck />
              </span>
              <span>
                <strong>{b2ItemTitle(item)}</strong>
                <small>{String(item.tenantId ?? "Platform")}</small>
              </span>
              <span className="domain-context">{money(b2ItemAmount(item))}</span>
              <Badge tone="neutral">{String(item.status ?? "AKTIF")}</Badge>
              {resource === "refunds" && item.status === "MANUAL_REQUIRED" && (
                <>
                  <Button
                    variant="secondary"
                    disabled={decideRefund.isPending}
                    onClick={() => decideRefund.mutate({ id: item.id, approved: true })}
                  >
                    Setujui
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={decideRefund.isPending}
                    onClick={() =>
                      decideRefund.mutate({ id: item.id, approved: false })
                    }
                  >
                    Tolak
                  </Button>
                </>
              )}
              {resource === "payouts" && nextPayoutStatus(item.status) && (
                <Button
                  variant="secondary"
                  disabled={updatePayout.isPending}
                  onClick={() =>
                    updatePayout.mutate({
                      id: item.id,
                      status: nextPayoutStatus(item.status)!,
                    })
                  }
                >
                  {item.status === "SCHEDULED" ? "Mulai proses" : "Selesaikan"}
                </Button>
              )}
              {resource === "reviews" && (
                <Button
                  variant="secondary"
                  disabled={moderate.isPending}
                  onClick={() =>
                    moderate.mutate({
                      id: item.id,
                      status: item.status === "HIDDEN" ? "VISIBLE" : "HIDDEN",
                    })
                  }
                >
                  {item.status === "HIDDEN" ? "Pulihkan" : "Sembunyikan"}
                </Button>
              )}
              {resource === "support" &&
                !["RESOLVED", "CLOSED"].includes(String(item.status)) && (
                  <Button
                    variant="secondary"
                    disabled={resolveSupport.isPending}
                    onClick={() => resolveSupport.mutate(item.id)}
                  >
                    Selesaikan
                  </Button>
                )}
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

function LoadBoundary({ error, label }: { error: boolean; label: string }) {
  return error ? (
    <EmptyState
      title={`Gagal memuat ${label}`}
      description="Periksa koneksi API lalu coba lagi."
    />
  ) : (
    <LoadingState
      title={`Memuat ${label}…`}
      description="Menyiapkan data terbaru dari workspace."
      variant="panel"
    />
  );
}

function OwnerResourceIcon({ resource }: { resource: BusinessB2Resource }) {
  const icons = {
    ledger: ReceiptText,
    payments: CreditCard,
    payouts: Landmark,
    promotions: Percent,
    refunds: ShieldCheck,
    reviews: Star,
    support: MessageCircleQuestion,
  } as const;
  const Icon = icons[resource];
  return <Icon />;
}

function ownerItemTitle(resource: BusinessB2Resource, item: Record<string, unknown>) {
  if (resource === "reviews") return "Ulasan pelanggan terverifikasi";
  if (resource === "payouts") {
    return item.kind === "MANUAL" ? "Payout manual" : "Payout mingguan";
  }
  if (resource === "refunds") {
    return readString(item.bookingId) ?? "Pengajuan refund";
  }
  return b2ItemTitle(item);
}

export function ownerItemDescription(
  resource: BusinessB2Resource,
  item: Record<string, unknown>,
) {
  if (resource === "reviews") {
    const rating = typeof item.rating === "number" ? `${item.rating}/5` : null;
    return [rating, readString(item.comment)].filter(Boolean).join(" · ") || "Ulasan";
  }
  if (resource === "support") {
    const category = humanizeStatus(item.category);
    const ticketCode = readString(item.ticketCode);
    return [category, ticketCode].filter(Boolean).join(" · ");
  }
  if (resource === "promotions") {
    const code = readString(item.code);
    const discount = promotionDiscount(item);
    return [code ? `Kode ${code}` : null, discount].filter(Boolean).join(" · ");
  }
  if (resource === "ledger") {
    return humanizeStatus(item.kind);
  }
  if (resource === "payments") {
    return readString(item.bookingCode) ?? "Pembayaran booking";
  }
  if (resource === "refunds") {
    return readString(item.reason) ?? "Pengembalian dana booking";
  }
  return item.kind === "MANUAL"
    ? "Permintaan pencairan oleh Primary Owner"
    : "Pencairan terjadwal workspace";
}

export function ownerItemAmount(
  resource: BusinessB2Resource,
  item: Record<string, unknown>,
) {
  if (["promotions", "reviews", "support"].includes(resource)) return null;
  return money(b2ItemAmount(item));
}

function promotionDiscount(item: Record<string, unknown>) {
  if (typeof item.discountValue !== "number") return null;
  if (item.discountType === "PERCENT") {
    return `Diskon ${item.discountValue / 100}%`;
  }
  return `Diskon ${money(item.discountValue)}`;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function formatDateTime(value: unknown) {
  if (typeof value !== "string") return "Data terbaru";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data terbaru";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

export function humanizeStatus(value: unknown) {
  const status = readString(value) ?? "TERCATAT";
  const labels: Record<string, string> = {
    ACTIVE: "Aktif",
    CANCELLED: "Dibatalkan",
    CAPTURED: "Tercatat",
    CLOSED: "Ditutup",
    FAILED: "Gagal",
    HIDDEN: "Disembunyikan",
    IN_PROGRESS: "Diproses",
    MANUAL: "Manual",
    MANUAL_REQUIRED: "Perlu ditinjau",
    OPEN: "Terbuka",
    OWNER: "Owner",
    PAYMENT_RECEIVED: "Pembayaran diterima",
    PENDING: "Menunggu",
    PROCESSING: "Diproses",
    RESOLVED: "Selesai",
    SCHEDULED: "Terjadwal",
    SUCCEEDED: "Berhasil",
    VISIBLE: "Terbit",
    WAITING_CUSTOMER: "Menunggu pelanggan",
  };
  return labels[status] ?? status.replaceAll("_", " ").toLowerCase();
}

function statusTone(
  value: unknown,
): "neutral" | "success" | "warning" | "danger" | "info" {
  const status = readString(value);
  if (
    ["ACTIVE", "CAPTURED", "RESOLVED", "SUCCEEDED", "VISIBLE"].includes(status ?? "")
  ) {
    return "success";
  }
  if (["FAILED", "CANCELLED", "HIDDEN"].includes(status ?? "")) return "danger";
  if (["MANUAL_REQUIRED", "PENDING", "WAITING_CUSTOMER"].includes(status ?? "")) {
    return "warning";
  }
  if (["IN_PROGRESS", "PROCESSING", "SCHEDULED"].includes(status ?? "")) {
    return "info";
  }
  return "neutral";
}

function money(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}
export function contextualExportDataset(
  resource: BusinessB2Resource,
): FinanceExportDataset | null {
  return contextualExportDatasets[resource] ?? null;
}

export function canExportFinance(
  membership:
    { role: "PRIMARY_OWNER" | "OWNER" | "STAFF"; permissions: string[] } | undefined,
): boolean {
  return Boolean(
    membership &&
    (membership.role !== "STAFF" || membership.permissions.includes("exports.run")),
  );
}

function financeExportUrl(
  tenantId: string,
  dataset: FinanceExportDataset,
  format: FinanceExportFormat,
) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || "/api/v1";
  const query = new URLSearchParams({ tenantId, dataset, format });
  return `${baseUrl}/business/finance/export?${query.toString()}`;
}
function supportStatusLabel(status: string) {
  return (
    {
      OPEN: "Terbuka",
      IN_PROGRESS: "Diproses",
      WAITING_CUSTOMER: "Menunggu kamu",
      RESOLVED: "Selesai",
      CLOSED: "Ditutup",
    }[status] ?? status
  );
}
