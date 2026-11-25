const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Dates are stored as local `YYYY-MM-DD` keys so they sort and compare as strings. */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(key: string, days: number): string {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** "Tue, 20th" */
export function formatShortDate(key: string): string {
  const date = fromDateKey(key);
  return `${WEEKDAYS_SHORT[date.getDay()]}, ${ordinal(date.getDate())}`;
}

/** Group heading on the Upcoming screen: "Tomorrow" or the weekday name. */
export function formatDayTitle(key: string): string {
  if (key === addDays(todayKey(), 1)) return 'Tomorrow';
  return WEEKDAYS[fromDateKey(key).getDay()];
}

/** Secondary text next to the group heading: "Wed, 21st" for tomorrow, else "22nd". */
export function formatDaySubtitle(key: string): string {
  if (key === addDays(todayKey(), 1)) return formatShortDate(key);
  const date = fromDateKey(key);
  const daysAway = Math.round((date.getTime() - fromDateKey(todayKey()).getTime()) / 86_400_000);
  if (daysAway > 6) return `${date.toLocaleString('en-US', { month: 'short' })} ${ordinal(date.getDate())}`;
  return ordinal(date.getDate());
}

/** Label for a date chip in the Add Task card: "Today", "Tmrw", "Thu 22". */
export function formatChipDate(key: string): string {
  const today = todayKey();
  if (key === today) return 'Today';
  if (key === addDays(today, 1)) return 'Tomorrow';
  const date = fromDateKey(key);
  return `${WEEKDAYS_SHORT[date.getDay()]} ${date.getDate()}`;
}

/** "10:00" -> "10:00 AM" */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Local midnight at the start of today, in ms. */
export function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
