import { Banknote, CreditCard, Landmark, type LucideIcon } from "lucide-react";

export interface PaymentMethodOption {
  value: string;
  label: string;
  description: string;
  amount: string;
  badge?: string;
  icon: "card" | "deposit" | "venue";
}

const paymentIcons: Record<PaymentMethodOption["icon"], LucideIcon> = {
  card: CreditCard,
  deposit: Landmark,
  venue: Banknote,
};

export function PaymentMethodSelector({
  value,
  options,
  onChange,
}: {
  value: string;
  options: PaymentMethodOption[];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="payment-method-selector">
      <legend>Pilih metode pembayaran</legend>
      <p>Harga final dan ketersediaan tetap divalidasi oleh server.</p>
      <div className="payment-method-list">
        {options.map((option) => {
          const Icon = paymentIcons[option.icon];
          const selected = option.value === value;
          return (
            <label
              className={`payment-method-card ${selected ? "selected" : ""}`}
              key={option.value}
            >
              <input
                type="radio"
                name="paymentMethod"
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
              />
              <span className="payment-method-icon">
                <Icon aria-hidden="true" />
              </span>
              <span className="payment-method-copy">
                <span>
                  <strong>{option.label}</strong>
                  {option.badge && <small>{option.badge}</small>}
                </span>
                <span>{option.description}</span>
              </span>
              <strong className="payment-method-amount">{option.amount}</strong>
              <span className="payment-method-indicator" aria-hidden="true" />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
