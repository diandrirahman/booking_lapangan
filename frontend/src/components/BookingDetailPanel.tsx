import {
  CalendarCheck2,
  CircleDollarSign,
  CreditCard,
  MapPin,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "./ui";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

interface BookingDetailPanelProps {
  bookingCode: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  schedule?: string;
  location?: string;
  status: {
    label: string;
    tone: BadgeTone;
  };
  payment: {
    method: string;
    status: string;
    total: string;
    balance: string;
  };
  actions?: ReactNode;
}

export function BookingDetailPanel({
  bookingCode,
  title,
  subtitle,
  imageUrl,
  schedule,
  location,
  status,
  payment,
  actions,
}: BookingDetailPanelProps) {
  return (
    <section className="booking-detail-panel" aria-label="Detail booking">
      <article className="booking-summary-card">
        <header className="booking-summary-header">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="booking-summary-image" />
          ) : (
            <span className="booking-summary-icon" aria-hidden="true">
              <CalendarCheck2 />
            </span>
          )}
          <div className="booking-summary-heading">
            <p>Ringkasan reservasi</p>
            <h2>{title}</h2>
            {subtitle && <span>{subtitle}</span>}
          </div>
          <Badge tone={status.tone}>{status.label}</Badge>
        </header>

        {(schedule || location) && (
          <div className="booking-visit-details">
            {schedule && (
              <DetailItem icon={<CalendarCheck2 />} label="Jadwal" value={schedule} />
            )}
            {location && (
              <DetailItem icon={<MapPin />} label="Lokasi" value={location} />
            )}
          </div>
        )}

        <div className="booking-payment-summary">
          <div className="booking-payment-heading">
            <span aria-hidden="true">
              <CreditCard />
            </span>
            <div>
              <p>Pembayaran</p>
              <strong>{payment.status}</strong>
            </div>
          </div>
          <dl>
            <SummaryRow label="Metode" value={payment.method} />
            <SummaryRow label="Total booking" value={payment.total} />
            <div className="booking-balance-row">
              <dt>Sisa pembayaran</dt>
              <dd>{payment.balance}</dd>
            </div>
          </dl>
        </div>

        <div className="booking-sandbox-note">
          <ShieldCheck aria-hidden="true" />
          <p>
            <strong>Lingkungan simulasi</strong>
            Pembayaran dan refund B1 tidak memproses uang nyata.
          </p>
        </div>

        {actions && <div className="booking-summary-actions">{actions}</div>}
      </article>

      <aside className="booking-checkin-pass" aria-label="Pass check-in simulasi">
        <div className="booking-pass-header">
          <div>
            <p>LapanganGo Pass</p>
            <strong>Check-in venue</strong>
          </div>
          <Badge tone="info">Simulasi</Badge>
        </div>

        <div className="booking-qr-frame" aria-hidden="true">
          <QrCode />
        </div>

        <div className="booking-pass-code">
          <span>Kode booking</span>
          <strong>{bookingCode}</strong>
        </div>

        <div className="booking-pass-status">
          <CircleDollarSign aria-hidden="true" />
          <p>
            <span>Status pembayaran</span>
            <strong>{payment.status}</strong>
          </p>
        </div>

        <p className="booking-pass-disclaimer">
          QR ini hanya representasi visual. Token check-in asli tidak dikirim ke
          halaman.
        </p>
      </aside>
    </section>
  );
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <span aria-hidden="true">{icon}</span>
      <p>
        <small>{label}</small>
        <strong>{value}</strong>
      </p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
