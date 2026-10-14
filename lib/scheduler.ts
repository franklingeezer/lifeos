import type { SupabaseClient } from "@supabase/supabase-js";
import { todayISO, addDaysISO, nowMinutesOfDay } from "@/lib/date";
import { WORK_WINDOW_START, WORK_WINDOW_END, timeToMinutes, minutesToTime } from "@/lib/ai/context-engine";

/**
 * LifeOS Roadmap — Task → Calendar Smart Scheduling (+ Plan My Day, Part 1a).
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
 * (app/api/schedule-task, app/api/plan-day) is responsible for turning an
 * accepted ScheduleCandidate into a real Calendar event.
 *
 * Structure (Plan My Day refactor): the original single function is now
 * three layers so a whole day can be planned from ONE calendar query
 * instead of one query per task —
 *   loadBusyByDate   — the only function that touches Supabase
 *   freeBlocksForDate / findSlot — pure, no I/O, trivially testable
 *   findScheduleSlot / planDay   — the two public entry points
 * findScheduleSlot's signature and behavior are unchanged, so
 * app/api/schedule-task keeps working exactly as before.
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

/** Busy intervals as minutes-since-midnight, keyed by ISO date. */
export type BusyByDate = Map<string, { start: number; end: number }[]>;

// Used when a task has no due date to search up to — searching forever
// isn't useful, and 14 days covers "sometime soon" without the response
// time growing unbounded for a very open-ended task.
const DEFAULT_LOOKAHEAD_DAYS = 14;

// Breathing room added after each block Plan My Day places, so a plan
// isn't a wall of back-to-back work. Only applies between planned blocks —
// it never shrinks a slot against your own existing calendar events.
const DEFAULT_BUFFER_MINUTES = 10;

// Proposed start times snap up to the next multiple of this many minutes,
// so "now" being 15:41 proposes 15:45 instead of an awkward 15:41 block.
const START_ROUNDING_MINUTES = 5;
const roundUp = (mins: number) => Math.ceil(mins / START_ROUNDING_MINUTES) * START_ROUNDING_MINUTES;

/**
 * Loads timed events in [from, to] (inclusive) as busy intervals. All-day
 * events are ignored entirely, matching the Context Engine's own rule that
 * they never consume a time block.
 */
export async function loadBusyByDate(supabase: SupabaseClient, from: string, to: string): Promise<BusyByDate> {
  const { data, error } = await supabase
    .from("events")
    .select("date, all_day, start_time, end_time")
    .gte("date", from)
    .lte("date", to)
    .eq("all_day", false);

  if (error) throw error;

  const busyByDate: BusyByDate = new Map();
  for (const e of data ?? []) {
    if (!e.start_time || !e.end_time) continue; // a timed=false-looking row with incomplete times; skip rather than guess
    const list = busyByDate.get(e.date) ?? [];
    list.push({ start: timeToMinutes(e.start_time), end: timeToMinutes(e.end_time) });
    busyByDate.set(e.date, list);
  }
  return busyByDate;
}

/**
 * Open windows for one date, as minute ranges inside WORK_WINDOW, after
 * merging overlapping/back-to-back busy intervals. Same clamp-to-now rule
 * as the Context Engine's today_free_blocks — a slot proposed for 9am when
 * it's already 2pm would be useless. Every other day starts fresh at
 * WORK_WINDOW_START.
 */
export function freeBlocksForDate(busyByDate: BusyByDate, date: string): { start: number; end: number }[] {
  const windowStartMins = timeToMinutes(WORK_WINDOW_START);
  const windowEndMins = timeToMinutes(WORK_WINDOW_END);
  const dayStart = date === todayISO() ? Math.max(windowStartMins, nowMinutesOfDay()) : windowStartMins;

  const merged: { start: number; end: number }[] = [];
  for (const iv of (busyByDate.get(date) ?? [])
    .map((iv) => ({ start: Math.max(iv.start, dayStart), end: Math.min(iv.end, windowEndMins) }))
    .filter((iv) => iv.end > iv.start)
    .sort((a, b) => a.start - b.start)) {
    const last = merged[merged.length - 1];
    if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end);
    else merged.push({ ...iv });
  }

  const free: { start: number; end: number }[] = [];
  let cursor = dayStart;
  for (const iv of merged) {
    if (iv.start > cursor) free.push({ start: cursor, end: iv.start });
    cursor = Math.max(cursor, iv.end);
  }
  if (windowEndMins > cursor) free.push({ start: cursor, end: windowEndMins });
  return free;
}

/**
 * Pure slot search over an already-loaded busy map — no I/O. Searches up
 * to and including `dueDate` if the task has one and it's today or later;
 * otherwise DEFAULT_LOOKAHEAD_DAYS ahead. A task that's already overdue is
 * treated the same as having no due date. With `todayOnly`, the search
 * never leaves today regardless of the due date (Plan My Day is about
 * *today* — quietly pushing a task to next Thursday isn't a plan).
 */
export function findSlot(
  busyByDate: BusyByDate,
  params: { estimatedMinutes: number; dueDate: string | null; todayOnly?: boolean }
): ScheduleResult {
  const { estimatedMinutes, dueDate, todayOnly } = params;

  if (!estimatedMinutes || estimatedMinutes <= 0) {
    return { candidate: null, reason: "This task has no time estimate yet — add one before scheduling it." };
  }

  const today = todayISO();
  const isOverdue = !!dueDate && dueDate < today;
  const rangeEnd = todayOnly ? today : dueDate && !isOverdue ? dueDate : addDaysISO(today, DEFAULT_LOOKAHEAD_DAYS);
  const beforeDue = !todayOnly && dueDate && !isOverdue ? `, before the ${dueDate} due date` : "";

  let cursorDate = today;
  let daysChecked = 0;

  while (cursorDate <= rangeEnd) {
    // Snap the start up to a tidy minute, then check the task still fits
    // in what's left of the block after snapping.
    const block = freeBlocksForDate(busyByDate, cursorDate).find((b) => b.end - roundUp(b.start) >= estimatedMinutes);
    if (block) {
      const start = roundUp(block.start);
      return {
        candidate: {
          date: cursorDate,
          start_time: minutesToTime(start),
          end_time: minutesToTime(start + estimatedMinutes),
        },
        reason: `First ${estimatedMinutes}-minute opening found${todayOnly ? " today" : ""}${beforeDue}.`,
      };
    }
    daysChecked += 1;
    cursorDate = addDaysISO(cursorDate, 1);
  }

  if (todayOnly) {
    return { candidate: null, reason: `No ${estimatedMinutes}-minute opening left today.` };
  }
  const overdueNote = isOverdue ? " (its own due date has already passed, so this searched the next two weeks instead)" : "";
  return {
    candidate: null,
    reason: `No ${estimatedMinutes}-minute opening found in the next ${daysChecked} day${daysChecked === 1 ? "" : "s"}${overdueNote}.`,
  };
}

/**
 * Finds the earliest slot, from today onward, that is at least
 * `estimatedMinutes` long and doesn't overlap any existing timed event.
 * Unchanged public behavior — now a thin load-then-search wrapper.
 */
export async function findScheduleSlot(
  supabase: SupabaseClient,
  params: { estimatedMinutes: number; dueDate: string | null; todayOnly?: boolean }
): Promise<ScheduleResult> {
  const { estimatedMinutes, dueDate, todayOnly } = params;

  // Bail before touching the database if there's nothing to search for.
  if (!estimatedMinutes || estimatedMinutes <= 0) {
    return findSlot(new Map(), params);
  }

  const today = todayISO();
  const isOverdue = !!dueDate && dueDate < today;
  const rangeEnd = todayOnly ? today : dueDate && !isOverdue ? dueDate : addDaysISO(today, DEFAULT_LOOKAHEAD_DAYS);

  const busyByDate = await loadBusyByDate(supabase, today, rangeEnd);
  return findSlot(busyByDate, { estimatedMinutes, dueDate, todayOnly });
}

// ---------------------------------------------------------------------------
// Plan My Day
// ---------------------------------------------------------------------------

export interface PlanTaskInput {
  id: string;
  title: string;
  estimated_minutes: number | null;
  due_date: string | null;
}

export interface PlannedBlock {
  task_id: string;
  title: string;
  estimated_minutes: number;
  candidate: ScheduleCandidate;
}

export type SkipCode = "no_estimate" | "no_room" | "already_scheduled";

export interface SkippedTask {
  task_id: string;
  title: string;
  code: SkipCode;
  /** Plain-language explanation, safe to show as-is. */
  reason: string;
}

export interface DayPlan {
  /** Proposed blocks, in the order the tasks were given (i.e. focus order). */
  blocks: PlannedBlock[];
  skipped: SkippedTask[];
  /** Open minutes left today (from now, inside the work window) before any block was placed. */
  free_minutes: number;
  /** Total minutes of the blocks actually placed. */
  planned_minutes: number;
  /** Total estimated minutes of every task that needed a slot (placed or not) — lets the UI say "needs 3h, you have 2h". */
  needed_minutes: number;
}

/**
 * Places an ordered list of tasks into TODAY's free time, one after
 * another, earliest-fit, with each placed block (plus a small buffer)
 * counted as busy for the tasks after it so nothing overlaps.
 *
 * Order is the caller's decision — Plan My Day passes Today Brain's focus
 * order, so the most important task gets the earliest slot. This function
 * never reorders.
 *
 * Honest about what it can't do: a task with no estimate is skipped with
 * a reason (never given a guessed duration), a task already blocked on
 * the calendar is skipped (so re-planning is safe to repeat), and a task
 * that doesn't fit anywhere today is skipped (never silently pushed to
 * another day). Reads the calendar once; writes nothing.
 */
export async function planDay(
  supabase: SupabaseClient,
  params: {
    tasks: PlanTaskInput[];
    alreadyScheduledTaskIds?: ReadonlySet<string>;
    bufferMinutes?: number;
  }
): Promise<DayPlan> {
  const { tasks, alreadyScheduledTaskIds, bufferMinutes = DEFAULT_BUFFER_MINUTES } = params;
  const today = todayISO();
  const windowEndMins = timeToMinutes(WORK_WINDOW_END);

  const busy = await loadBusyByDate(supabase, today, today);
  const freeMinutes = freeBlocksForDate(busy, today).reduce((sum, b) => sum + (b.end - b.start), 0);

  const blocks: PlannedBlock[] = [];
  const skipped: SkippedTask[] = [];
  let neededMinutes = 0;

  for (const task of tasks) {
    if (alreadyScheduledTaskIds?.has(task.id)) {
      skipped.push({ task_id: task.id, title: task.title, code: "already_scheduled", reason: "Already has a time block on your calendar." });
      continue;
    }

    const estimate = task.estimated_minutes ?? 0;
    if (estimate <= 0) {
      skipped.push({ task_id: task.id, title: task.title, code: "no_estimate", reason: "No time estimate yet — add one so it can be placed." });
      continue;
    }
    neededMinutes += estimate;

    const result = findSlot(busy, { estimatedMinutes: estimate, dueDate: task.due_date, todayOnly: true });
    if (!result.candidate) {
      skipped.push({ task_id: task.id, title: task.title, code: "no_room", reason: result.reason });
      continue;
    }

    blocks.push({ task_id: task.id, title: task.title, estimated_minutes: estimate, candidate: result.candidate });

    // Count this block (plus buffer) as busy for every task after it.
    const list = busy.get(today) ?? [];
    list.push({
      start: timeToMinutes(result.candidate.start_time),
      end: Math.min(timeToMinutes(result.candidate.end_time) + bufferMinutes, windowEndMins),
    });
    busy.set(today, list);
  }

  return {
    blocks,
    skipped,
    free_minutes: freeMinutes,
    planned_minutes: blocks.reduce((sum, b) => sum + b.estimated_minutes, 0),
    needed_minutes: neededMinutes,
  };
}