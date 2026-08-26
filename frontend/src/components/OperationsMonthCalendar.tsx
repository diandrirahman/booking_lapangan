import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { id } from "date-fns/locale";
import type { Booking } from "../domain/types";

interface OperationsMonthCalendarProps {
  bookings: Booking[];
  month?: Date;
}

// Adapted from Fullscreen Calendar by Ahmed Mayara on 21st.dev.
export function OperationsMonthCalendar({
  bookings,
  month = new Date(2026, 7, 1),
}: OperationsMonthCalendarProps) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });

  return (
    <div
      className="month-calendar"
      aria-label="Kalender booking bulan Agustus 2026"
    >
      <div className="month-calendar-weekdays" aria-hidden="true">
        {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="month-calendar-grid">
        {days.map((day, index) => {
          const dayBookings =
            index % 3 === 0 ? bookings.slice(index % 5, (index % 5) + 2) : [];
          return (
            <article
              key={day.toISOString()}
              className={isSameMonth(day, month) ? "" : "outside-month"}
            >
              <time dateTime={format(day, "yyyy-MM-dd")}>
                {format(day, "d")}
              </time>
              <div>
                {dayBookings.map((booking) => (
                  <button
                    key={booking.id}
                    type="button"
                    className={`month-event ${booking.source}`}
                  >
                    <strong>{booking.slots[0]}</strong>
                    <span>{booking.id}</span>
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </div>
      <p className="month-calendar-caption">
        {format(month, "MMMM yyyy", { locale: id })} · klik booking untuk
        melihat detail
      </p>
    </div>
  );
}
