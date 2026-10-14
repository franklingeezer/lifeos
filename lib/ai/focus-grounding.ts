import { timeToMinutes } from "@/lib/ai/context-engine";

/**
 * LifeOS Roadmap — Plan My Day, Part 3b: grounding check for Today Brain.
 *
 * Today Brain's prompt already forbids the model from inventing clock
 * times or durations, but a prompt rule is a request, not a guarantee —
 * and the model has a strong pull toward plausible-sounding specifics
 * ("about 45 minutes", "around 3pm"). This is the enforcement: after the
 * model answers, every clock time and duration in its free-text output is
 * checked against the set of values that were actually present in the
 * data it was given. Anything else is treated as invented.
 *
 * Pure functions, no I/O, so the whole check is unit-testable and costs
 * nothing (no second model call). Same defensive spirit as the
 * ref_id cross-check Today Brain already does for task/project/habit ids.
 */

export interface FocusGrounding {
  /** Minutes-since-midnight of every clock time present in the input data. */
  clockTimes: Set<number>;
  /** Every duration (in minutes) present in, or directly derivable from, the input data. */
  durations: Set<number>;
}

export function buildFocusGrounding(input: {
  /** Today's open windows, exactly as the model was shown them. */
  freeBlocks: { start: string; end: string }[];
  /** Every task-linked block shown to the model (scheduled today, missed, and tasks' next_block). */
  blocks: { start_time: string; end_time: string }[];
  /** The user's own per-task estimates, in minutes. */
  taskEstimates: number[];
  /** Any other pre-computed totals shown to the model (free minutes today, workload sum, ...). */
  extraDurations: number[];
}): FocusGrounding {
  const clockTimes = new Set<number>();
  const durations = new Set<number>();

  for (const b of input.freeBlocks) {
    const s = timeToMinutes(b.start);
    const e = timeToMinutes(b.end);
    clockTimes.add(s);
    clockTimes.add(e);
    if (e > s) durations.add(e - s);
  }
  for (const b of input.blocks) {
    const s = timeToMinutes(b.start_time);
    const e = timeToMinutes(b.end_time);
    clockTimes.add(s);
    clockTimes.add(e);
    if (e > s) durations.add(e - s);
  }
  for (const m of input.taskEstimates) if (m > 0) durations.add(m);
  for (const m of input.extraDurations) if (m > 0) durations.add(m);

  return { clockTimes, durations };
}

// "3pm", "3:30 PM", "3 p.m." -> minutes since midnight.
const TWELVE_HOUR = /\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)(?![a-z])/gi;
// "14:00", "9:05", "14:00:00" -> minutes since midnight. Run AFTER the
// 12-hour pass has been stripped out, so "3:30 PM" isn't read twice.
const TWENTY_FOUR_HOUR = /\b([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?\b/g;
// "1h 30m", "2 hours", "2 hours and 15 minutes", "1.5 hours" -> minutes.
const HOURS = /\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b(?:\s*(?:and\s*)?(\d+)\s*(?:minutes?|mins?|m)\b)?/gi;
// "45 min", "45 minutes" on their own (after hour forms are stripped).
const MINUTES = /\b(\d+)\s*(?:minutes?|mins?)\b/gi;

function extractClockTimes(text: string): number[] {
  const found: number[] = [];

  const withoutTwelve = text.replace(TWELVE_HOUR, (_m, h: string, min: string | undefined, ap: string) => {
    let hour = Number(h) % 12;
    if (ap.toLowerCase().startsWith("p")) hour += 12;
    found.push(hour * 60 + Number(min ?? 0));
    return " ";
  });

  for (const m of withoutTwelve.matchAll(TWENTY_FOUR_HOUR)) {
    found.push(Number(m[1]) * 60 + Number(m[2]));
  }
  return found;
}

function extractDurations(text: string): number[] {
  const found: number[] = [];

  const withoutHours = text.replace(HOURS, (_m, h: string, min: string | undefined) => {
    found.push(Math.round(Number(h) * 60) + Number(min ?? 0));
    return " ";
  });

  for (const m of withoutHours.matchAll(MINUTES)) found.push(Number(m[1]));
  return found;
}

/**
 * Returns the clock times and durations in `text` that do NOT appear in
 * the grounding data — an empty array means the text is clean.
 */
export function findUngrounded(text: string, grounding: FocusGrounding): string[] {
  const problems: string[] = [];
  for (const t of extractClockTimes(text)) {
    if (!grounding.clockTimes.has(t)) problems.push(`time ${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`);
  }
  for (const d of extractDurations(text)) {
    if (!grounding.durations.has(d)) problems.push(`duration ${d}m`);
  }
  return problems;
}

export interface SanitizablePlan<Item extends { type: string; title: string; reason: string }> {
  headline: string;
  focus_items: Item[];
}

/**
 * Applies the grounding check to a finished focus plan.
 *
 * Only model-written text is checked: `headline`, every item's `reason`,
 * and the `title` of "note" items (the model's own wording). Titles of
 * task/project/habit items are the user's own words copied back, so a task
 * literally called "30 min workout" must not be flagged as an invention.
 *
 *  - A headline with an ungrounded time/duration is blanked (the UI hides
 *    an empty headline).
 *  - An item whose reason is ungrounded gets `fallbackReason(item)`
 *    instead — a plain statement built from real data. If there's no safe
 *    fallback (it returns null), or a "note" item's title is ungrounded,
 *    the item is dropped.
 *  - Remaining items are renumbered 1..n so `order` stays contiguous.
 */
export function sanitizeFocusPlan<Item extends { type: string; title: string; reason: string; order: number }>(
  plan: SanitizablePlan<Item>,
  grounding: FocusGrounding,
  fallbackReason: (item: Item) => string | null
): { plan: SanitizablePlan<Item>; headlineBlanked: boolean; reasonsReplaced: number; itemsDropped: number } {
  let headlineBlanked = false;
  let reasonsReplaced = 0;
  let itemsDropped = 0;

  let headline = plan.headline ?? "";
  if (headline && findUngrounded(headline, grounding).length > 0) {
    headline = "";
    headlineBlanked = true;
  }

  const kept: Item[] = [];
  for (const item of plan.focus_items) {
    if (item.type === "note" && findUngrounded(item.title ?? "", grounding).length > 0) {
      itemsDropped += 1;
      continue;
    }

    if (findUngrounded(item.reason ?? "", grounding).length > 0) {
      const fallback = fallbackReason(item);
      if (fallback === null) {
        itemsDropped += 1;
        continue;
      }
      kept.push({ ...item, reason: fallback });
      reasonsReplaced += 1;
      continue;
    }

    kept.push(item);
  }

  return {
    plan: { headline, focus_items: kept.map((item, i) => ({ ...item, order: i + 1 })) },
    headlineBlanked,
    reasonsReplaced,
    itemsDropped,
  };
}