import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  LoaderCircle,
  X,
} from "lucide-react";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { twMerge } from "tailwind-merge";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost" | "danger";
    size?: "sm" | "md" | "lg";
  }
>(({ className, variant = "primary", size = "md", ...props }, ref) => (
  <button
    ref={ref}
    className={twMerge("btn", `btn-${variant}`, `btn-${size}`, className)}
    {...props}
  />
));
export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={twMerge("input", className)} {...props} />
));
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <article className={twMerge("card", className)} {...props} />;
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="page-actions">{action}</div>}
    </div>
  );
}
export function EmptyState({
  title = "Belum ada data",
  description = "Data akan muncul di sini saat tersedia.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="state-card">
      <div className="state-icon">
        <AlertCircle />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function LoadingState() {
  return (
    <div className="state-card" role="status">
      <LoaderCircle className="spin" />
      <h2>Memuat data simulasi…</h2>
      <p>Menyiapkan fixture lokal untuk skenario ini.</p>
    </div>
  );
}
export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="state-card error">
      <AlertCircle />
      <h2>Data belum berhasil dimuat</h2>
      <p>Ini adalah skenario error yang dapat dipulihkan.</p>
      {onRetry && <Button onClick={onRetry}>Coba lagi</Button>}
    </div>
  );
}

const scenarioCopy: Record<
  string,
  { title: string; description: string; tone: "error" | "success" }
> = {
  "validation-error": {
    title: "Periksa kembali data yang diisi",
    description: "Beberapa field simulasi belum memenuhi ketentuan.",
    tone: "error",
  },
  expired: {
    title: "Sesi simulasi sudah berakhir",
    description: "Mulai ulang proses untuk mendapatkan sesi yang baru.",
    tone: "error",
  },
  stale: {
    title: "Data simulasi perlu diperbarui",
    description: "Fixture berubah sejak halaman ini terakhir dibuka.",
    tone: "error",
  },
  unauthorized: {
    title: "Akses untuk role ini dibatasi",
    description: "Pindah role atau kembali ke workspace yang sesuai.",
    tone: "error",
  },
  reconnecting: {
    title: "Menyambungkan ulang fixture lokal",
    description: "State akan dipulihkan tanpa melakukan network request.",
    tone: "error",
  },
  success: {
    title: "Perubahan berhasil disimpan",
    description: "Seluruh entity terkait sudah membaca state terbaru.",
    tone: "success",
  },
};

function ScenarioState({ scenario }: { scenario: string }) {
  const copy = scenarioCopy[scenario];
  if (!copy) return null;
  return (
    <div className={`state-card ${copy.tone}`} role="status">
      {copy.tone === "success" ? <CheckCircle2 /> : <AlertCircle />}
      <h2>{copy.title}</h2>
      <p>{copy.description}</p>
    </div>
  );
}
export function ScenarioBoundary({
  scenario,
  children,
  emptyTitle,
}: {
  scenario: string;
  children: ReactNode;
  emptyTitle?: string;
}) {
  if (scenario === "loading") return <LoadingState />;
  if (scenario === "empty") return <EmptyState title={emptyTitle} />;
  if (scenario === "server-error") return <ErrorState />;
  if (scenarioCopy[scenario]) return <ScenarioState scenario={scenario} />;
  return <>{children}</>;
}

export function Dialog({
  trigger,
  title,
  description,
  children,
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay" />
        <DialogPrimitive.Content className="dialog-content">
          <div className="dialog-heading">
            <div>
              <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description>
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close className="icon-button" aria-label="Tutup">
              <X />
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
export const Tabs = TabsPrimitive.Root;
export const TabsList = TabsPrimitive.List;
export const TabsTrigger = TabsPrimitive.Trigger;
export const TabsContent = TabsPrimitive.Content;

export function ProgressSteps({
  items,
  active,
}: {
  items: string[];
  active: number;
}) {
  return (
    <ol className="progress-steps">
      {items.map((item, index) => (
        <li key={item} className={index <= active ? "active" : ""}>
          <span>{index < active ? <Check /> : index + 1}</span>
          <p>{item}</p>
          {index < items.length - 1 && <ChevronRight />}
        </li>
      ))}
    </ol>
  );
}
export function SimulasiLabel() {
  return <Badge tone="info">Simulasi</Badge>;
}
