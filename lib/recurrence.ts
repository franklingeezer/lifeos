import { addDaysISO, daysBetween } from "@/lib/date";

/**
 * LifeOS Roadmap — Recurring Tasks, Part 2.
 *
 * Pure date arithmetic, no Supabase — same separation lib/scheduler.ts
 * and lib/project-health.ts already draw between "figure out the answer"
 * and "the route that fetches data and acts on it" (app/api/cron/notifications).
 * Keeping this pure also makes it trivially testable without a database.
 */

export type RecurrenceRule = {
  frequency: "daily" | "weekly" | "monthly";
  interval_count: number;
  days_of_week: number[] | null; // weekly only, 0=Sun..6=Sat (JS Date.getDay() convention)
  day_of_month: number | null; // monthly only, 1-31
  start_date: string;
};

function mondayOfWeek(iso: string): string {
  const day = new Date(iso + "T12:00:00").getDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (day + 6) % 7; // Mon=0, Tue=1, ..., Sun=6
  return addDaysISO(iso, -daysSinceMonday);
}

function nextWeeklyOccurrence(fromDate: string, rule: RecurrenceRule): string {
  const days = rule.days_of_week && rule.days_of_week.length > 0 ? rule.days_of_week : [new Date(rule.start_date + "T12:00:00").getDay()];
  const startWeekMonday = mondayOfWeek(rule.start_date);

  let candidate = addDaysISO(fromDate, 1);
  // 400 days covers well over a year even for a weekly series — every
  // real weekly rule resolves in a handful of iterations; this cap only
  // exists to guarantee termination against a pathological input.
  for (let i = 0; i < 400; i++) {
    const dow = new Date(candidate + "T12:00:00").getDay();
    if (days.includes(dow)) {
      const candidateWeekMonday = mondayOfWeek(candidate);
      const weeksSinceStart = Math.round(daysBetween(new Date(candidateWeekMonday + "T12:00:00"), new Date(startWeekMonday + "T12:00:00")) / 7);
      // "Every N weeks" is measured from the series' own start week, not
      // an arbitrary calendar epoch — so a series starting mid-year still
      // lands on the weeks its creator actually meant.
      if (((weeksSinceStart % rule.interval_count) + rule.interval_count) % rule.interval_count === 0) {
        return candidate;
      }
    }
    candidate = addDaysISO(candidate, 1);
  }
  return candidate; // unreachable for any real rule; last computed date rather than throwing
}

function nextMonthlyOccurrence(fromDate: string, rule: RecurrenceRule): string {
  const d = new Date(fromDate + "T12:00:00");
  let year = d.getFullYear();
  let month = d.getMonth(); // 0-indexed
  const dayOfMonth = rule.day_of_month ?? new Date(rule.start_date + "T12:00:00").getDate();

  // 36 months (3 years) at interval_count=1 is far more than any real
  // series needs; exists purely as a termination guarantee.
  for (let i = 0; i < 36; i++) {
    month += rule.interval_count;
    year += Math.floor(month / 12);
    month = ((month % 12) + 12) % 12;

    const daysInThisMonth = new Date(year, month + 1, 0).getDate();
    // A month too short for the target day (e.g. day_of_month=31 in
    // February) is skipped entirely, not rolled forward to the 1st of
    // the next month or clamped to the last day — see phase21's own
    // comment on this: the app decides this behavior, not the DB.
    if (dayOfMonth <= daysInThisMonth) {
      return `${year}-${String(month + 1).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
    }
  }
  return fromDate; // unreachable for any real rule
}

/** The next occurrence strictly after `fromDate`, per the series' rule. */
export function computeNextOccurrence(fromDate: string, rule: RecurrenceRule): string {
  switch (rule.frequency) {
    case "daily":
      return addDaysISO(fromDate, rule.interval_count);
    case "weekly":
      return nextWeeklyOccurrence(fromDate, rule);
    case "monthly":
      return nextMonthlyOccurrence(fromDate, rule);
  }
}

/**
 * Given a series whose next_due_date has arrived (<= today), returns:
 *   - occurrenceDate: the one task instance to actually generate —
 *     always the most recent due date, never a backlog of every missed
 *     one. If a series' generation lapsed for a while (server downtime,
 *     a long pause), this deliberately collapses that gap into a single
 *     catch-up task rather than flooding Tasks with every date that was
 *     missed in between.
 *   - newNextDueDate: the value to write back to task_series.next_due_date
 *     — the first occurrence strictly after today, so the series resumes
 *     its normal cadence from here rather than re-triggering next run.
 */
export function resolveNextGeneration(
  nextDueDate: string,
  today: string,
  rule: RecurrenceRule
): { occurrenceDate: string; newNextDueDate: string } {
  let occurrenceDate = nextDueDate;
  let following = computeNextOccurrence(occurrenceDate, rule);

  // Bounded the same way the two helpers above are — guards against a
  // pathological rule (e.g. a start_date from years ago) generating an
  // unbounded loop instead of just collapsing the backlog quickly.
  for (let i = 0; i < 2000 && following <= today; i++) {
    occurrenceDate = following;
    following = computeNextOccurrence(occurrenceDate, rule);
  }

  return { occurrenceDate, newNextDueDate: following };
}