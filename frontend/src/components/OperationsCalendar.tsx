import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { id } from "date-fns/locale";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Columns3,
  List,
  Search,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { SelectField } from "./SelectField";
import { Button, EmptyState, Input } from "./ui";

export type OperationsCalendarView = "month" | "week" | "day" | "list";

export interface OperationsCalendarEvent {
  id: string;
  startsAt: string;
  endsAt: string;
  title: string;
  detail: string;
  venueId: string;
  kind: "booking" | "block";
  tone: "confirmed" | "pending" | "offline" | "block" | "muted";
}

interface OperationsCalendarProps {
  month: Date;
  events: OperationsCalendarEvent[];
  venues: Array<{ id: string; name: string }>;
  actions: ReactNode;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onSelectEvent: (event: OperationsCalendarEvent) => void;
}

const viewOptions: Array<{
  value: OperationsCalendarView;
  label: string;
  icon: typeof CalendarDays;
}> = [
  { value: "month", label: "Bulan", icon: CalendarDays },
  { value: "week", label: "Minggu", icon: Columns3 },
  { value: "day", label: "Hari", icon: Clock3 },
  { value: "list", label: "Daftar", icon: List },
];

export function OperationsCalendar({
  month,
  events,
  venues,
  actions,
  onPreviousMonth,
  onNextMonth,
  onToday,
  onSelectEvent,
}: OperationsCalendarProps) {
  const [view, setView] = useState<OperationsCalendarView>("month");
  const [query, setQuery] = useState("");
  const [venueId, setVenueId] = useState("all");
  const [kind, setKind] = useState("all");
  const [selectedDate, setSelectedDate] = useState(() => dateWithinMonth(month));
  const activeDate = isSameMonth(selectedDate, month)
    ? selectedDate
    : dateWithinMonth(month);

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
    return events.filter((event) => {
      const matchesVenue = venueId === "all" || event.venueId === venueId;
      const matchesKind = kind === "all" || event.kind === kind;
      const matchesQuery =
        !normalizedQuery ||
        `${event.title} ${event.detail}`
          .toLocaleLowerCase("id-ID")
          .includes(normalizedQuery);
      return matchesVenue && matchesKind && matchesQuery;
    });
  }, [events, kind, query, venueId]);

  return (
    <section className="operations-calendar" aria-label="Kalender operasional venue">
      <header className="operations-calendar-header">
        <div className="operations-calendar-period">
          <h2>{format(month, "MMMM yyyy", { locale: id })}</h2>
          <div className="operations-calendar-navigation">
            <Button
              variant="secondary"
              size="sm"
              aria-label="Bulan sebelumnya"
              onClick={onPreviousMonth}
            >
              <ChevronLeft />
            </Button>
            <Button variant="secondary" size="sm" onClick={onToday}>
              Hari ini
            </Button>
            <Button
              variant="secondary"
              size="sm"
              aria-label="Bulan berikutnya"
              onClick={onNextMonth}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
        <div className="operations-calendar-header-actions">
          <div
            className="operations-calendar-views"
            aria-label="Pilih tampilan kalender"
          >
            {viewOptions.map((option) => {
              const Icon = option.icon;
              return (
                <Button
                  key={option.value}
                  variant={view === option.value ? "primary" : "ghost"}
                  size="sm"
                  aria-pressed={view === option.value}
                  onClick={() => setView(option.value)}
                >
                  <Icon aria-hidden="true" /> {option.label}
                </Button>
              );
            })}
          </div>
          <div className="operations-calendar-actions">{actions}</div>
        </div>
      </header>

      <div className="operations-calendar-filters">
        <label className="operations-calendar-search">
          <Search aria-hidden="true" />
          <Input
            aria-label="Cari aktivitas kalender"
            value={query}
            placeholder="Cari booking, customer, atau lapangan..."
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <SelectField
          ariaLabel="Filter venue kalender"
          value={venueId}
          options={[
            { value: "all", label: "Semua venue" },
            ...venues.map((venue) => ({ value: venue.id, label: venue.name })),
          ]}
          onValueChange={setVenueId}
        />
        <SelectField
          ariaLabel="Filter jenis aktivitas"
          value={kind}
          options={[
            { value: "all", label: "Semua aktivitas" },
            { value: "booking", label: "Booking" },
            { value: "block", label: "Block dan maintenance" },
          ]}
          onValueChange={setKind}
        />
      </div>

      <div className="operations-calendar-legend" aria-label="Keterangan kalender">
        <span>
          <i className="confirmed" /> Dikonfirmasi
        </span>
        <span>
          <i className="pending" /> Hold dan menunggu
        </span>
        <span>
          <i className="offline" /> Booking offline
        </span>
        <span>
          <i className="block" /> Block dan maintenance
        </span>
      </div>

      {view === "month" && (
        <MonthView
          month={month}
          events={filteredEvents}
          onSelectDate={setSelectedDate}
          onSelectEvent={onSelectEvent}
          onShowDay={(date) => {
            setSelectedDate(date);
            setView("day");
          }}
        />
      )}
      {view === "week" && (
        <WeekView
          selectedDate={activeDate}
          events={filteredEvents}
          onSelectDate={(date) => {
            setSelectedDate(date);
            setView("day");
          }}
          onSelectEvent={onSelectEvent}
        />
      )}
      {view === "day" && (
        <DayView
          selectedDate={activeDate}
          events={filteredEvents}
          onSelectEvent={onSelectEvent}
        />
      )}
      {view === "list" && (
        <ListView events={filteredEvents} onSelectEvent={onSelectEvent} />
      )}
    </section>
  );
}

function MonthView({
  month,
  events,
  onSelectDate,
  onSelectEvent,
  onShowDay,
}: {
  month: Date;
  events: OperationsCalendarEvent[];
  onSelectDate: (date: Date) => void;
  onSelectEvent: (event: OperationsCalendarEvent) => void;
  onShowDay: (date: Date) => void;
}) {
  const days = monthDays(month);
  return (
    <div className="operations-month-scroll">
      <div className="operations-month-calendar">
        <div className="operations-month-weekdays" aria-hidden="true">
          {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="operations-month-grid">
          {days.map((day) => {
            const dayEvents = eventsForDay(events, day);
            const visibleEvents = dayEvents.slice(0, 3);
            return (
              <article
                key={day.toISOString()}
                className={isSameMonth(day, month) ? "" : "outside-month"}
                onFocus={() => onSelectDate(day)}
              >
                <button
                  type="button"
                  className="operations-calendar-date"
                  aria-label={format(day, "EEEE, d MMMM yyyy", { locale: id })}
                  onClick={() => onShowDay(day)}
                >
                  {format(day, "d")}
                </button>
                <div className="operations-month-events">
                  {visibleEvents.map((event) => (
                    <CalendarEventButton
                      key={event.id}
                      event={event}
                      compact
                      onSelect={onSelectEvent}
                    />
                  ))}
                  {dayEvents.length > visibleEvents.length && (
                    <button
                      type="button"
                      className="operations-calendar-more"
                      onClick={() => onShowDay(day)}
                    >
                      +{dayEvents.length - visibleEvents.length} lainnya
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WeekView({
  selectedDate,
  events,
  onSelectDate,
  onSelectEvent,
}: {
  selectedDate: Date;
  events: OperationsCalendarEvent[];
  onSelectDate: (date: Date) => void;
  onSelectEvent: (event: OperationsCalendarEvent) => void;
}) {
  const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({
    start,
    end: endOfWeek(selectedDate, { weekStartsOn: 1 }),
  });
  return (
    <div className="operations-week-scroll">
      <div className="operations-week-grid">
        {days.map((day) => (
          <article key={day.toISOString()}>
            <button
              type="button"
              className="operations-week-heading"
              onClick={() => onSelectDate(day)}
            >
              <span>{format(day, "EEE", { locale: id })}</span>
              <strong>{format(day, "d")}</strong>
            </button>
            <div>
              {eventsForDay(events, day).map((event) => (
                <CalendarEventButton
                  key={event.id}
                  event={event}
                  onSelect={onSelectEvent}
                />
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function DayView({
  selectedDate,
  events,
  onSelectEvent,
}: {
  selectedDate: Date;
  events: OperationsCalendarEvent[];
  onSelectEvent: (event: OperationsCalendarEvent) => void;
}) {
  const dayEvents = eventsForDay(events, selectedDate);
  return (
    <div className="operations-day-view">
      <div className="operations-day-heading">
        <span>{format(selectedDate, "EEEE", { locale: id })}</span>
        <strong>{format(selectedDate, "d MMMM yyyy", { locale: id })}</strong>
      </div>
      <EventList events={dayEvents} onSelectEvent={onSelectEvent} />
    </div>
  );
}

function ListView({
  events,
  onSelectEvent,
}: {
  events: OperationsCalendarEvent[];
  onSelectEvent: (event: OperationsCalendarEvent) => void;
}) {
  const dates = Array.from(new Set(events.map((event) => event.startsAt.slice(0, 10))));
  if (dates.length === 0) return <CalendarEmptyState />;
  return (
    <div className="operations-calendar-list">
      {dates.map((date) => {
        const day = parseISO(`${date}T00:00:00`);
        return (
          <section key={date}>
            <h3>{format(day, "EEEE, d MMMM", { locale: id })}</h3>
            <EventList
              events={eventsForDay(events, day)}
              onSelectEvent={onSelectEvent}
            />
          </section>
        );
      })}
    </div>
  );
}

function EventList({
  events,
  onSelectEvent,
}: {
  events: OperationsCalendarEvent[];
  onSelectEvent: (event: OperationsCalendarEvent) => void;
}) {
  if (events.length === 0) return <CalendarEmptyState />;
  return (
    <div className="operations-event-list">
      {events.map((event) => (
        <CalendarEventButton key={event.id} event={event} onSelect={onSelectEvent} />
      ))}
    </div>
  );
}

function CalendarEventButton({
  event,
  compact = false,
  onSelect,
}: {
  event: OperationsCalendarEvent;
  compact?: boolean;
  onSelect: (event: OperationsCalendarEvent) => void;
}) {
  return (
    <button
      type="button"
      className={`operations-calendar-event tone-${event.tone} ${compact ? "compact" : ""}`}
      aria-label={`${formatTime(event.startsAt)}, ${event.title}, ${event.detail}`}
      onClick={() => onSelect(event)}
    >
      <time dateTime={event.startsAt}>{formatTime(event.startsAt)}</time>
      <span>
        <strong>{event.title}</strong>
        {!compact && <small>{event.detail}</small>}
      </span>
    </button>
  );
}

function CalendarEmptyState() {
  return (
    <EmptyState
      title="Tidak ada aktivitas"
      description="Belum ada booking atau block pada periode dan filter ini."
    />
  );
}

function eventsForDay(events: OperationsCalendarEvent[], day: Date) {
  return events.filter((event) => isSameDay(parseISO(event.startsAt), day));
}

function monthDays(month: Date) {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
}

function dateWithinMonth(month: Date) {
  const today = new Date();
  return isSameMonth(today, month) ? today : startOfMonth(month);
}

function formatTime(value: string) {
  return format(parseISO(value), "HH.mm");
}
