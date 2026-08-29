import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { twMerge } from "tailwind-merge";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectFieldProps {
  ariaLabel: string;
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  variant?: "default" | "embedded";
  onValueChange?: (value: string) => void;
}

// Visual direction: shadcn Select on 21st.dev. The public API and styling
// remain local so every dropdown follows LapanganGo's tokens and states.
export function SelectField({
  ariaLabel,
  options,
  value,
  defaultValue,
  placeholder = "Pilih opsi",
  className,
  variant = "default",
  onValueChange,
}: SelectFieldProps) {
  return (
    <SelectPrimitive.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
    >
      <SelectPrimitive.Trigger
        className={twMerge("select-trigger", `select-${variant}`, className)}
        aria-label={ariaLabel}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="select-content"
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          style={{ zIndex: 200 }}
        >
          <SelectPrimitive.Viewport className="select-viewport">
            {options.map((option) => (
              <SelectPrimitive.Item
                className="select-item"
                disabled={option.disabled}
                key={option.value}
                value={option.value}
              >
                <SelectPrimitive.ItemIndicator className="select-indicator">
                  <Check aria-hidden="true" />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
