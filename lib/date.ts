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

/**
 * Whole-day difference between two Dates (a - b), rounded. Was copy-pasted
 * identically into morning-brief, review, and prioritize-tasks routes —
 * pulled out here as part of the Context Engine work so there's one
 * definition instead of three drifting slowly apart.
 */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Minutes since midnight, right now, in the given timezone (defaults to
 * Dhaka) — e.g. 14:30 -> 870. Added for the Context Engine's calendar
 * free-block math and the Task -> Calendar Smart Scheduling module, both
 * of which need to know "how much of today's work window is already
 * behind us", not just what the window's fixed start/end times are.
 */
export function nowMinutesOfDay(timeZone: string = DEFAULT_TZ): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(
    new Date()
  );
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10) % 24; // some environments format midnight as "24"
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return hour * 60 + minute;
}

/**
 * "3m ago" / "2h ago" / "5d ago" — identical to the formatter already
 * living separately in NotificationCenter.tsx and InboxPage.tsx. Added
 * here for the GitHub Activity card so it isn't a third copy-paste; those
 * two call sites are untouched for now and can be pointed at this later.
 * Timezone-independent by nature (it's a duration, not a calendar date),
 * so no `timeZone` parameter is needed the way the functions above take one.
 */
export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}