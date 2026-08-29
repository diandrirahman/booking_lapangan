import * as Popover from "@radix-ui/react-popover";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { CalendarDays, ChevronDown } from "lucide-react";
import { DayPicker } from "react-day-picker";

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  ariaLabel?: string;
  className?: string;
}

// Adapted from the Calendar by coss on 21st.dev, then normalized to LapanganGo tokens.
export function DatePicker({
  value,
  onChange,
  ariaLabel = "Pilih tanggal",
  className = "",
}: DatePickerProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={`date-picker-trigger ${className}`}
          aria-label={ariaLabel}
        >
          <CalendarDays aria-hidden="true" />
          <span>{format(value, "dd MMM yyyy", { locale: id })}</span>
          <ChevronDown aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="date-picker-popover" sideOffset={8} align="start">
          <DayPicker
            mode="single"
            selected={value}
            onSelect={(date) => date && onChange(date)}
            captionLayout="dropdown"
            startMonth={new Date(2026, 0)}
            endMonth={new Date(2027, 11)}
            locale={id}
          />
          <Popover.Arrow className="date-picker-arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
