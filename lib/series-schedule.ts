import { addDaysISO } from "@/lib/date";
import { resolveNextGeneration, type RecurrenceRule } from "@/lib/recurrence";

/**
 * LifeOS Roadmap — Recurring Tasks, series management.
 *
 * Small pure helpers for the series manager. Deliberately a separate file
 * from lib/recurrence.ts: that file owns "what is the next occurrence
 * after X" and is also what the cron runs on, so it stays untouched.
 * These only build on its exports.
 */

export type SeriesLike = RecurrenceRule & {
  end_date: string | null;
  active: boolean;
  next_due_date: string;
};

/**
 * The first occurrence on or after `fromDate`, walking the series' OWN
 * sequence from its start_date — the exact same sequence the cron
 * produces, so a resumed or edited series lands on dates it would have
 * landed on anyway.
 *
 * Why not just call computeNextOccurrence(fromDate)? It always means
 * "strictly after, then advance by the interval", so for a monthly series
 * it would skip this month's occurrence entirely, and for "every 3 days"
 * it would ignore the series' own cadence.
 */
export function firstOccurrenceFrom(rule: RecurrenceRule, fromDate: string): string {
  // The series' first occurrence is its start_date itself (that's how
  // createSeries seeds it), so if that hasn't passed yet, it's the answer.
  if (rule.start_date >= fromDate) return rule.start_date;

  // resolveNextGeneration(...).newNextDueDate is the first occurrence
  // strictly after its `today` argument; passing the day before
  // `fromDate` makes that "on or after fromDate".
  const { newNextDueDate } = resolveNextGeneration(rule.start_date, addDaysISO(fromDate, -1), rule);

  // resolveNextGeneration is bounded (2000 steps) against pathological
  // input. A series that old and that dense could in theory stop short;
  // never return a date in the past — fall back to fromDate itself.
  return newNextDueDate < fromDate ? fromDate : newNextDueDate;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/** Human-readable schedule, e.g. "Every Mon, Wed, Fri" or "The 15th of every 2 months". */
export function describeSchedule(rule: RecurrenceRule): string {
  const n = Math.max(1, rule.interval_count || 1);

  if (rule.frequency === "daily") {
    return n === 1 ? "Every day" : `Every ${n} days`;
  }

  if (rule.frequency === "weekly") {
    // Matches lib/recurrence.ts: no days picked means the start date's weekday.
    const days = rule.days_of_week && rule.days_of_week.length > 0
      ? [...rule.days_of_week].sort((a, b) => a - b)
      : [new Date(rule.start_date + "T12:00:00").getDay()];
    const names = days.map((d) => WEEKDAYS[d]).join(", ");
    return n === 1 ? `Every ${names}` : `Every ${n} weeks on ${names}`;
  }

  const dom = rule.day_of_month ?? new Date(rule.start_date + "T12:00:00").getDate();
  return n === 1 ? `The ${ordinal(dom)} of every month` : `The ${ordinal(dom)} of every ${n} months`;
}

export type SeriesStatus = "active" | "paused" | "ended";

/**
 * There's no separate "ended" column — `active` is the only flag, and the
 * cron itself sets it false when a series runs past its end_date. So an
 * inactive series whose next occurrence falls after its end_date has
 * ended; any other inactive series was paused.
 */
export function seriesStatus(series: Pick<SeriesLike, "active" | "end_date" | "next_due_date">): SeriesStatus {
  if (series.active) return "active";
  if (series.end_date && series.next_due_date > series.end_date) return "ended";
  return "paused";
}