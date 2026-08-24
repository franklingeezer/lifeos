import { toLocalISODate } from "@/lib/date";

/**
 * Extracted from morning-brief/route.ts and review/route.ts, which had
 * identical copies of this function — exactly the kind of duplication the
 * Context Engine exists to remove. Any future AI feature that needs streak
 * math (Today Brain, Project Health "activity" signal, etc.) imports this
 * instead of writing a third copy.
 *
 * Given a habit's completed-log dates, how many consecutive days back from
 * today (or yesterday, if today isn't logged yet) were completed.
 */
export function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const set = new Set(dates);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Streak counts from today if today's logged, otherwise from yesterday
  // (so a habit isn't shown as "broken" just because it's still morning).
  let cursor = new Date(today);
  if (!set.has(toLocalISODate(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!set.has(toLocalISODate(cursor))) return 0;
  }

  let streak = 0;
  while (set.has(toLocalISODate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Completed-days / total-days over the last `windowDays`, as a 0-100 integer. */
export function successRate(dates: string[], windowDays: number): number {
  if (windowDays <= 0) return 0;
  const completed = new Set(dates).size;
  return Math.round((Math.min(completed, windowDays) / windowDays) * 100);
}