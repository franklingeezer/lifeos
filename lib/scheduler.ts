import type { SupabaseClient } from "@supabase/supabase-js";
import { todayISO, addDaysISO, nowMinutesOfDay } from "@/lib/date";
import { WORK_WINDOW_START, WORK_WINDOW_END, timeToMinutes, minutesToTime } from "@/lib/ai/context-engine";

/**
 * LifeOS Roadmap — Task → Calendar Smart Scheduling.
 *
 * Deliberately NOT an AI feature, same reasoning as Project Health
 * (lib/project-health.ts): finding the earliest gap that's at least as
 * long as a task's estimate is pure interval arithmetic over data that's
 * already known exactly (today's/upcoming events, from the same
 * WORK_WINDOW the Context Engine already uses). Asking a model to "find
 * free time" would mean either re-deriving this arithmetic inside a
 * prompt (slower, costs tokens, and can get it wrong) or trusting the
 * model's own idea of availability instead of the calendar's actual one.
 * A rule-based scheduler is also always exactly reproducible — the same
 * task and calendar state always propose the same slot.
 *
 * This module only *proposes*; it never writes anything. The caller
 * (app/api/schedule-task) is responsible for turning an accepted
 * ScheduleCandidate into a real Calendar event.
 */

export interface ScheduleCandidate {
  date: string;
  start_time: string;
  end_time: string;
}

export interface ScheduleResult {
  candidate: ScheduleCandidate | null;
  /** Always set, whether or not a candidate was found — the caller should show this either way rather than inventing its own message. */
  reason: string;
}

// Used when a task has no due date to search up to — searching forever
// isn't useful, and 14 days covers "sometime soon" without the response
// time growing unbounded for a very open-ended task.
const DEFAULT_LOOKAHEAD_DAYS = 14;

/**
 * Finds the earliest slot, from today onward, that is at least
 * `estimatedMinutes` long and doesn't overlap any existing timed event.
 * All-day events are ignored entirely, matching the Context Engine's own
 * rule that they never consume a time block.
 *
 * Searches up to and including `dueDate` if the task has one and it's
 * today or later; otherwise searches DEFAULT_LOOKAHEAD_DAYS ahead. A task
 * that's already overdue (due date in the past) is treated the same as
 * having no due date — there's no meaningful "search up to the deadline"
 * left to do, so it searches the default window instead and says so.
 */
export async function findScheduleSlot(
  supabase: SupabaseClient,
  params: { estimatedMinutes: number; dueDate: string | null }
): Promise<ScheduleResult> {
  const { estimatedMinutes, dueDate } = params;

  if (!estimatedMinutes || estimatedMinutes <= 0) {
    return { candidate: null, reason: "This task has no time estimate yet — add one before scheduling it." };
  }

  const today = todayISO();
  const isOverdue = !!dueDate && dueDate < today;
  const rangeEnd = dueDate && !isOverdue ? dueDate : addDaysISO(today, DEFAULT_LOOKAHEAD_DAYS);

  const { data, error } = await supabase
    .from("events")
    .select("date, all_day, start_time, end_time")
    .gte("date", today)
    .lte("date", rangeEnd)
    .eq("all_day", false);

  if (error) throw error;

  const busyByDate = new Map<string, { start: number; end: number }[]>();
  for (const e of data ?? []) {
    if (!e.start_time || !e.end_time) continue; // a timed=false-looking row with incomplete times; skip rather than guess
    const list = busyByDate.get(e.date) ?? [];
    list.push({ start: timeToMinutes(e.start_time), end: timeToMinutes(e.end_time) });
    busyByDate.set(e.date, list);
  }

  const windowStartMins = timeToMinutes(WORK_WINDOW_START);
  const windowEndMins = timeToMinutes(WORK_WINDOW_END);

  let cursorDate = today;
  let daysChecked = 0;

  while (cursorDate <= rangeEnd) {
    // Same clamp-to-now fix as the Context Engine's today_free_blocks —
    // a slot proposed for 9am when it's already 2pm would be useless.
    // Every later day in the range starts fresh at WORK_WINDOW_START.
    const dayStart = cursorDate === today ? Math.max(windowStartMins, nowMinutesOfDay()) : windowStartMins;

    const merged: { start: number; end: number }[] = [];
    for (const iv of (busyByDate.get(cursorDate) ?? [])
      .map((iv) => ({ start: Math.max(iv.start, dayStart), end: Math.min(iv.end, windowEndMins) }))
      .filter((iv) => iv.end > iv.start)
      .sort((a, b) => a.start - b.start)) {
      const last = merged[merged.length - 1];
      if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end);
      else merged.push({ ...iv });
    }

    let cursor = dayStart;
    for (const iv of merged) {
      if (iv.start - cursor >= estimatedMinutes) {
        return {
          candidate: { date: cursorDate, start_time: minutesToTime(cursor), end_time: minutesToTime(cursor + estimatedMinutes) },
          reason: `First ${estimatedMinutes}-minute opening found${dueDate && !isOverdue ? `, before the ${dueDate} due date` : ""}.`,
        };
      }
      cursor = Math.max(cursor, iv.end);
    }
    if (windowEndMins - cursor >= estimatedMinutes) {
      return {
        candidate: { date: cursorDate, start_time: minutesToTime(cursor), end_time: minutesToTime(cursor + estimatedMinutes) },
        reason: `First ${estimatedMinutes}-minute opening found${dueDate && !isOverdue ? `, before the ${dueDate} due date` : ""}.`,
      };
    }

    daysChecked += 1;
    cursorDate = addDaysISO(cursorDate, 1);
  }

  const overdueNote = isOverdue ? " (its own due date has already passed, so this searched the next two weeks instead)" : "";
  return {
    candidate: null,
    reason: `No ${estimatedMinutes}-minute opening found in the next ${daysChecked} day${daysChecked === 1 ? "" : "s"}${overdueNote}.`,
  };
}