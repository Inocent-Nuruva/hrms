const DAY_MS = 86_400_000;

export function periodDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

export function periodDateLabel(value: string) {
  const date = periodDate(value);
  return date ? new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date) : value;
}

export function periodDateRange(start: string, end: string) {
  const first = periodDate(start);
  const last = periodDate(end);
  if (!first || !last) return `${start} – ${end}`;
  const shortMonth = (date: Date) => new Intl.DateTimeFormat(undefined, { month: "short", timeZone: "UTC" }).format(date);
  const startDay = first.getUTCDate();
  const endDay = last.getUTCDate();
  const startMonth = shortMonth(first);
  const endMonth = shortMonth(last);
  const startYear = first.getUTCFullYear();
  const endYear = last.getUTCFullYear();
  if (startYear === endYear && first.getUTCMonth() === last.getUTCMonth()) return `${startDay}–${endDay} ${endMonth} ${endYear}`;
  if (startYear === endYear) return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${endYear}`;
  return `${startDay} ${startMonth} ${startYear} – ${endDay} ${endMonth} ${endYear}`;
}

export function periodDayCount(start: string, end: string) {
  const first = periodDate(start);
  const last = periodDate(end);
  return first && last && last >= first ? Math.round((last.getTime() - first.getTime()) / DAY_MS) + 1 : null;
}

export function monthNumber(date: Date) { return date.getUTCFullYear() * 12 + date.getUTCMonth(); }
export function monthStart(number: number) { return new Date(Date.UTC(Math.floor(number / 12), number % 12, 1)); }
export function monthPosition(date: Date, fromMonth: number) {
  const days = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  return monthNumber(date) - fromMonth + (date.getUTCDate() - 1) / days;
}
export function monthEndPosition(date: Date, fromMonth: number) {
  const days = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  return monthNumber(date) - fromMonth + date.getUTCDate() / days;
}
