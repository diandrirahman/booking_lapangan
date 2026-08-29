export function localDateBoundsUtc(
  localDate: string,
  timeZone: string,
): { start: Date; end: Date } {
  const start = localDateTimeToUtc(localDate, "00:00:00", timeZone);
  const nextDate = new Date(`${localDate}T00:00:00Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const nextLocalDate = nextDate.toISOString().slice(0, 10);
  return { start, end: localDateTimeToUtc(nextLocalDate, "00:00:00", timeZone) };
}

export function datePartsInTimeZone(
  date: Date,
  timeZone: string,
): {
  localDate: string;
  localTime: string;
  dayOfWeek: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const weekdayByName: Readonly<Record<string, number>> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    localDate: `${value("year")}-${value("month")}-${value("day")}`,
    localTime: `${value("hour")}:${value("minute")}:${value("second")}`,
    dayOfWeek: weekdayByName[value("weekday")] ?? 0,
  };
}

export function localDateTimeToUtc(
  localDate: string,
  localTime: string,
  timeZone: string,
): Date {
  const desiredUtc = new Date(`${localDate}T${localTime}Z`).getTime();
  let candidate = new Date(desiredUtc);
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const actual = datePartsInTimeZone(candidate, timeZone);
    const representedAsUtc = new Date(
      `${actual.localDate}T${actual.localTime}Z`,
    ).getTime();
    candidate = new Date(candidate.getTime() + desiredUtc - representedAsUtc);
  }
  return candidate;
}
