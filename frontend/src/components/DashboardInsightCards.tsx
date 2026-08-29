import { ArrowUpRight, ShieldCheck, WalletCards, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, Card, SimulasiLabel } from "./ui";

export interface AttentionItem {
  icon: LucideIcon;
  value: string;
  label: string;
  status: string;
  tone: "warning" | "danger" | "info";
  onClick: () => void;
}

export function AttentionCard({
  title = "Butuh perhatian",
  description,
  items,
}: {
  title?: string;
  description: string;
  items: AttentionItem[];
}) {
  return (
    <Card className="dashboard-attention-card">
      <div className="dashboard-card-heading">
        <div>
          <p className="dashboard-card-kicker">Tindakan berikutnya</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <Badge tone={items.length === 0 ? "success" : "warning"}>
          {items.length === 0 ? "Selesai" : `${items.length} kategori`}
        </Badge>
      </div>
      <div className="attention-list">
        {items.map(({ icon: Icon, value, label, status, tone, onClick }) => (
          <button key={label} type="button" onClick={onClick}>
            <span className={`attention-item-icon attention-item-icon-${tone}`}>
              <Icon aria-hidden="true" />
            </span>
            <span className="attention-item-copy">
              <strong>{value}</strong>
              <span>{label}</span>
            </span>
            <span className="attention-item-action">
              <small>{status}</small>
              <ArrowUpRight aria-hidden="true" />
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}

export function SandboxVolumeCard({
  amount,
  footer,
}: {
  amount: string;
  footer?: ReactNode;
}) {
  return (
    <Card className="sandbox-volume-card">
      <div className="dashboard-card-heading compact">
        <div>
          <p className="dashboard-card-kicker">Payment attempt berhasil</p>
          <h2>Volume sandbox</h2>
        </div>
        <SimulasiLabel />
      </div>
      <div className="sandbox-volume-value">
        <span className="sandbox-volume-icon">
          <WalletCards aria-hidden="true" />
        </span>
        <strong>{amount}</strong>
      </div>
      <div className="sandbox-volume-note">
        <ShieldCheck aria-hidden="true" />
        <p>
          <strong>Tidak ada dana nyata yang berpindah.</strong>
          <span>Nilai ini hanya untuk memvalidasi alur pembayaran B1.</span>
        </p>
      </div>
      {footer && <div className="sandbox-volume-footer">{footer}</div>}
    </Card>
  );
}
