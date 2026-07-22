// Shared date helpers. LifeOS is built for a single Bangladesh-based user, so
// "today" and calendar-date math should always be computed in Asia/Dhaka time
// — never with `new Date().toISOString().slice(0, 10)`, which is UTC and
// silently drifts a day off between midnight and 6am Dhaka time (and, for
// month-boundary math built from local Date components, can be off by a full
// day every time, not just during that window).
//
// Works the same whether called in the browser or in a Next.js API route —
// Intl.DateTimeFormat with an explicit timeZone doesn't depend on the host
// machine's local timezone setting.

const DEFAULT_TZ = "Asia/Dhaka";

/** Format a Date as YYYY-MM-DD in the given timezone (defaults to Dhaka). */
export function toLocalISODate(date: Date, timeZone: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(date);
}

/** Today's date as YYYY-MM-DD in Dhaka time. */
export function todayISO(timeZone: string = DEFAULT_TZ): string {
  return toLocalISODate(new Date(), timeZone);
}

/** Add (or subtract, with a negative n) days to an ISO date string. */
export function addDaysISO(iso: string, n: number, timeZone: string = DEFAULT_TZ): string {
  const d = new Date(iso + "T12:00:00"); // noon avoids DST-adjacent edge cases entirely
  d.setDate(d.getDate() + n);
  return toLocalISODate(d, timeZone);
}