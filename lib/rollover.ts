import type { SupabaseClient } from "@supabase/supabase-js";
import { todayISO, addDaysISO, nowMinutesOfDay } from "@/lib/date";
import { timeToMinutes } from "@/lib/ai/context-engine";
import { loadBusyByDate, findSlot, type BusyByDate, type ScheduleCandidate } from "@/lib/scheduler";

/**
 * LifeOS Roadmap — Plan My Day, Part 2a: Rollover.
 *
 * Finds calendar blocks that were set aside for a task but whose time has
 * passed with the task still unfinished, and proposes a new slot for each.
 *
 * Rule-based, not AI — same reasoning as lib/scheduler.ts, which this is
 * built directly on (it reuses the scheduler's own busy-time loader and
 * slot finder, so a rolled-over block can never land on a slot the
 * scheduler itself wouldn't have offered).
 *
 * Proposes only; never writes. The caller decides what to do with each
 * proposal (reschedule it, or drop the block).
 *
 * What counts as "missed": a timed event linked to a task (events.task_id)
 * whose end time has already passed (earlier today, or any earlier day
 * within LOOKBACK_DAYS), where the task isn't done. A block that's still
 * in progress is not missed. A block whose task has been completed is not
 * missed. All-day events and unlinked events are never touched.
 */

// A week is plenty — beyond that a never-actioned block is better dropped
// than resurrected, and the query stays small.
const LOOKBACK_DAYS = 7;

// After this time of day, a missed block is offered a slot starting
// *tomorrow* instead of "the earliest gap tonight". Proposing a 9:05 PM
// work block to someone about to wrap up their day isn't a plan.
const EVENING_CUTOFF = "20:00";

// Same breathing room Plan My Day leaves between blocks it places.
const BUFFER_MINUTES = 10;

// The scheduler's own default search window; busy time is loaded this far
// ahead so findSlot never searches past what was loaded.
const SEARCH_DAYS_AHEAD = 14;

export interface MissedBlock {
  event_id: string;
  task_id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  /** The block's own length — reused as the estimate, so rollover never needs the task to have one. */
  duration_minutes: number;
  task_due_date: string | null;
}

export interface RolloverProposal extends MissedBlock {
  candidate: ScheduleCandidate;
}

export interface RolloverUnplaceable extends MissedBlock {
  /** Plain-language explanation, safe to show as-is. */
  reason: string;
}

export interface RolloverPlan {
  proposals: RolloverProposal[];
  unplaceable: RolloverUnplaceable[];
  /** Whether proposals were searched from right now, or from tomorrow because it's already evening. */
  starts_from: "now" | "tomorrow";
}

/** Unfinished-task blocks whose time has passed, oldest first. */
export async function findMissedBlocks(supabase: SupabaseClient): Promise<MissedBlock[]> {
  const today = todayISO();
  const nowMins = nowMinutesOfDay();

  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, title, date, start_time, end_time, task_id")
    .not("task_id", "is", null)
    .eq("all_day", false)
    .gte("date", addDaysISO(today, -LOOKBACK_DAYS))
    .lte("date", today);
  if (eventsError) throw eventsError;

  const past = (events ?? []).filter((e) => {
    if (!e.start_time || !e.end_time || !e.task_id) return false;
    if (e.date < today) return true;
    return timeToMinutes(e.end_time) <= nowMins; // today: only once the block has actually ended
  });
  if (past.length === 0) return [];

  const taskIds = [...new Set(past.map((e) => e.task_id as string))];
  const { data: tasks, error: tasksError } = await supabase.from("tasks").select("id, status, due_date").in("id", taskIds);
  if (tasksError) throw tasksError;

  const taskById = new Map((tasks ?? []).map((t) => [t.id as string, t]));

  const missed: MissedBlock[] = [];
  for (const e of past) {
    const task = taskById.get(e.task_id as string);
    if (!task || task.status === "done") continue; // completed (or gone) — nothing was missed

    const duration = timeToMinutes(e.end_time as string) - timeToMinutes(e.start_time as string);
    if (duration <= 0) continue;

    missed.push({
      event_id: e.id,
      task_id: e.task_id as string,
      title: e.title,
      date: e.date,
      start_time: e.start_time as string,
      end_time: e.end_time as string,
      duration_minutes: duration,
      task_due_date: (task.due_date as string | null) ?? null,
    });
  }

  return missed.sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
}

/**
 * Proposes a new slot for every missed block, oldest first, each placed
 * block (plus a buffer) counting as busy for the ones after it so
 * nothing overlaps. Reads the calendar once; writes nothing.
 *
 * `startFromTomorrow` overrides the time-of-day check — exists mainly so
 * the evening behavior can be exercised at any hour; normal callers omit it.
 */
export async function planRollover(
  supabase: SupabaseClient,
  options: { startFromTomorrow?: boolean } = {}
): Promise<RolloverPlan> {
  const missed = await findMissedBlocks(supabase);
  const today = todayISO();

  const fromTomorrow = options.startFromTomorrow ?? nowMinutesOfDay() >= timeToMinutes(EVENING_CUTOFF);
  const startDate = fromTomorrow ? addDaysISO(today, 1) : today;

  if (missed.length === 0) return { proposals: [], unplaceable: [], starts_from: fromTomorrow ? "tomorrow" : "now" };

  const busy: BusyByDate = await loadBusyByDate(supabase, today, addDaysISO(today, SEARCH_DAYS_AHEAD));

  // Starting from tomorrow: mark all of today busy so the scheduler's
  // earliest-fit search skips straight past it, without needing a
  // "start date" option on the scheduler itself.
  if (fromTomorrow) busy.set(today, [{ start: 0, end: 24 * 60 }]);

  const proposals: RolloverProposal[] = [];
  const unplaceable: RolloverUnplaceable[] = [];

  for (const block of missed) {
    // A task due before the day we're searching from has effectively
    // passed its deadline — treat it as having none (the scheduler's own
    // overdue rule) rather than reporting "no opening before a date that
    // already went by".
    const dueDate = block.task_due_date && block.task_due_date < startDate ? null : block.task_due_date;

    const result = findSlot(busy, { estimatedMinutes: block.duration_minutes, dueDate });
    if (!result.candidate) {
      unplaceable.push({ ...block, reason: result.reason });
      continue;
    }

    proposals.push({ ...block, candidate: result.candidate });

    const list = busy.get(result.candidate.date) ?? [];
    list.push({
      start: timeToMinutes(result.candidate.start_time),
      end: timeToMinutes(result.candidate.end_time) + BUFFER_MINUTES,
    });
    busy.set(result.candidate.date, list);
  }

  return { proposals, unplaceable, starts_from: fromTomorrow ? "tomorrow" : "now" };
}