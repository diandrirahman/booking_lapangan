import type { PaymentAttempt } from "@lapangango/api-client";
import {
  Check,
  CheckCircle2,
  Clock3,
  Hourglass,
  ReceiptText,
  ShieldCheck,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Badge, Button } from "./ui";

export type SandboxPaymentResult = "success" | "pending" | "failed";

interface PaymentStatusPanelProps {
  attemptId: string;
  bookingId: string;
  amount: string;
  kind: string;
  status: PaymentAttempt["status"];
  countdown?: string;
  isSubmitting?: boolean;
  errorMessage?: string;
  onSimulate: (result: SandboxPaymentResult) => void;
}

type StatusTone = "pending" | "success" | "danger" | "neutral";
type ProgressState = "complete" | "active" | "waiting" | "stopped";

interface StatusPresentation {
  badge: string;
  title: string;
  description: string;
  tone: StatusTone;
  icon: LucideIcon;
}

const statusPresentations: Record<PaymentAttempt["status"], StatusPresentation> = {
  CREATED: {
    badge: "Siap dibayar",
    title: "Pembayaran siap diproses",
    description: "Pilih hasil provider sandbox untuk melanjutkan pengujian booking.",
    tone: "pending",
    icon: Hourglass,
  },
  PENDING: {
    badge: "Menunggu provider",
    title: "Pembayaran sedang diproses",
    description:
      "Status akan diperbarui setelah provider mengirimkan hasil pembayaran.",
    tone: "pending",
    icon: Clock3,
  },
  PAID: {
    badge: "Berhasil",
    title: "Pembayaran telah diterima",
    description: "Booking sudah dapat dikonfirmasi menggunakan hasil pembayaran ini.",
    tone: "success",
    icon: CheckCircle2,
  },
  FAILED: {
    badge: "Gagal",
    title: "Pembayaran belum berhasil",
    description: "Buat payment attempt baru jika waktu hold booking masih tersedia.",
    tone: "danger",
    icon: XCircle,
  },
  EXPIRED: {
    badge: "Kedaluwarsa",
    title: "Waktu pembayaran telah berakhir",
    description:
      "Pembayaran terlambat tidak akan mengaktifkan booking yang kedaluwarsa.",
    tone: "danger",
    icon: XCircle,
  },
  CANCELLED: {
    badge: "Dibatalkan",
    title: "Percobaan pembayaran dibatalkan",
    description: "Tidak ada dana yang diproses oleh payment attempt ini.",
    tone: "neutral",
    icon: XCircle,
  },
};

const paymentKindLabels: Record<string, string> = {
  FULL: "Bayar penuh",
  DP: "DP 50%",
  RESERVATION: "Biaya reservasi",
  BALANCE: "Pelunasan",
  RETRY: "Percobaan ulang",
};

export function PaymentStatusPanel({
  attemptId,
  bookingId,
  amount,
  kind,
  status,
  countdown,
  isSubmitting = false,
  errorMessage,
  onSimulate,
}: PaymentStatusPanelProps) {
  const presentation = statusPresentations[status];
  const StatusIcon = presentation.icon;
  const progress = paymentProgress(status);

  return (
    <section className="payment-status-panel" aria-labelledby="payment-status-title">
      <div className="payment-status-main">
        <div className={`payment-status-hero tone-${presentation.tone}`} role="status">
          <span className="payment-status-symbol" aria-hidden="true">
            <StatusIcon />
          </span>
          <div>
            <Badge tone={badgeTone(presentation.tone)}>{presentation.badge}</Badge>
            <h2 id="payment-status-title">{presentation.title}</h2>
            <p>{presentation.description}</p>
          </div>
          {countdown && (
            <span className="payment-countdown">
              <Clock3 aria-hidden="true" />
              <span>
                Sisa waktu
                <strong>{countdown}</strong>
              </span>
            </span>
          )}
        </div>

        <ol className="payment-progress" aria-label="Progres pembayaran">
          <ProgressItem
            number="1"
            label="Booking dibuat"
            description="Slot berhasil ditahan"
            state="complete"
          />
          <ProgressItem
            number="2"
            label="Proses pembayaran"
            description={progress.paymentDescription}
            state={progress.paymentState}
          />
          <ProgressItem
            number="3"
            label="Konfirmasi booking"
            description={progress.confirmationDescription}
            state={progress.confirmationState}
          />
        </ol>

        <div className="payment-simulation-controls">
          <div>
            <span className="payment-simulation-title">
              Kontrol sandbox <Badge tone="info">Simulasi</Badge>
            </span>
            <p>Pilih respons provider untuk menguji status pembayaran.</p>
          </div>
          <div className="payment-simulation-actions">
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={() => onSimulate("success")}
            >
              <Check aria-hidden="true" /> Berhasil
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isSubmitting}
              onClick={() => onSimulate("pending")}
            >
              <Clock3 aria-hidden="true" /> Pending
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={isSubmitting}
              onClick={() => onSimulate("failed")}
            >
              <X aria-hidden="true" /> Gagal
            </Button>
          </div>
          {errorMessage && (
            <p className="field-error" role="alert">
              {errorMessage}
            </p>
          )}
        </div>
      </div>

      <aside className="payment-receipt" aria-label="Ringkasan pembayaran">
        <div className="payment-receipt-heading">
          <span aria-hidden="true">
            <ReceiptText />
          </span>
          <div>
            <p>Ringkasan transaksi</p>
            <strong>Transaksi #{attemptId}</strong>
          </div>
        </div>
        <dl>
          <ReceiptRow label="Booking" value={`#${bookingId}`} />
          <ReceiptRow label="Metode" value={paymentKindLabels[kind] ?? kind} />
          <ReceiptRow label="Provider" value="Midtrans Sandbox" />
          <div className="payment-receipt-total">
            <dt>Total pembayaran</dt>
            <dd>{amount}</dd>
          </div>
        </dl>
        <div className="payment-sandbox-note">
          <ShieldCheck aria-hidden="true" />
          <p>
            <strong>Lingkungan simulasi</strong>
            Tidak ada uang nyata yang diproses.
          </p>
        </div>
      </aside>
    </section>
  );
}

function ProgressItem({
  number,
  label,
  description,
  state,
}: {
  number: string;
  label: string;
  description: string;
  state: ProgressState;
}) {
  return (
    <li data-state={state}>
      <span className="payment-progress-marker" aria-hidden="true">
        {state === "complete" ? <Check /> : number}
      </span>
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
    </li>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function badgeTone(tone: StatusTone): "neutral" | "success" | "warning" | "danger" {
  if (tone === "pending") return "warning";
  if (tone === "success") return "success";
  if (tone === "danger") return "danger";
  return "neutral";
}

function paymentProgress(status: PaymentAttempt["status"]): {
  paymentState: ProgressState;
  paymentDescription: string;
  confirmationState: ProgressState;
  confirmationDescription: string;
} {
  if (status === "PAID") {
    return {
      paymentState: "complete",
      paymentDescription: "Pembayaran diterima",
      confirmationState: "complete",
      confirmationDescription: "Booking siap digunakan",
    };
  }
  if (status === "FAILED" || status === "EXPIRED" || status === "CANCELLED") {
    return {
      paymentState: "stopped",
      paymentDescription: "Proses tidak dilanjutkan",
      confirmationState: "waiting",
      confirmationDescription: "Menunggu pembayaran valid",
    };
  }
  return {
    paymentState: "active",
    paymentDescription: "Menunggu hasil provider",
    confirmationState: "waiting",
    confirmationDescription: "Belum dikonfirmasi",
  };
}
