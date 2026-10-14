import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/date";
import { planDay, type PlanTaskInput } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

type FocusItem = {
  order: number;
  type: "task" | "project" | "habit" | "note";
  ref_id: string | null;
  title: string;
  reason: string;
};

/**
 * LifeOS Roadmap — Plan My Day, Part 1b.
 *
 * Takes today's Today Brain focus plan (already generated and cached by
 * /api/today-focus) and proposes a real time block for each task in it,
 * in the same order, using the rule-based scheduler.
 *
 * Deliberately NOT an AI route — same split as /api/schedule-task: Today
 * Brain already decided what matters and in what order, and placing that
 * list into free time is interval arithmetic over the calendar. So this
 * makes no Groq call and, for the same reason, no rate-limit check; a
 * stray loop here can't burn AI quota.
 *
 * Read-only: it only proposes. Accepting a proposal is a plain
 * calendar-event insert the frontend does itself (usePlanDay), same as
 * accepting a single-task proposal from the Tasks page.
 *
 * GET, not POST — it takes no input of its own. The focus plan and the
 * calendar are the input, and RLS scopes both to the caller.
 */
export async function GET() {
  const supabase = createClient();
  const today = todayISO();

  const { data: focusRow, error: focusError } = await supabase
    .from("ai_today_focus")
    .select("content")
    .eq("focus_date", today)
    .maybeSingle();

  if (focusError) {
    console.error("plan-day: failed to load today's focus", focusError);
    return NextResponse.json({ error: "Couldn't load today's focus plan." }, { status: 500 });
  }

  // The Today tab generates (and caches) the focus plan the moment it
  // opens, so in normal use this row always exists by the time someone
  // clicks "Plan my day". If it doesn't, say so plainly rather than
  // quietly planning from nothing — or silently spending an AI request
  // to build one from inside what's supposed to be a no-AI route.
  if (!focusRow) {
    return NextResponse.json(
      { error: "No focus plan for today yet — open the Today tab to generate one first." },
      { status: 409 }
    );
  }

  const focusItems: FocusItem[] = Array.isArray(focusRow.content?.focus_items) ? focusRow.content.focus_items : [];

  // Task items only, in Today Brain's own order, de-duplicated. Projects,
  // habits, and notes in the focus plan aren't schedulable work.
  const orderedTaskIds: string[] = [];
  for (const item of [...focusItems].sort((a, b) => a.order - b.order)) {
    if (item.type === "task" && item.ref_id && !orderedTaskIds.includes(item.ref_id)) {
      orderedTaskIds.push(item.ref_id);
    }
  }

  if (orderedTaskIds.length === 0) {
    const empty = await planDay(supabase, { tasks: [] });
    return NextResponse.json({
      ...empty,
      focus_date: today,
      note: "Today's focus plan has no tasks to schedule.",
    });
  }

  const [{ data: taskRows, error: tasksError }, { data: blockRows, error: blocksError }] = await Promise.all([
    supabase.from("tasks").select("id, title, due_date, estimated_minutes, status").in("id", orderedTaskIds),
    // Any block from today onward counts as "already scheduled" — a task
    // blocked for tomorrow shouldn't also get a second block today just
    // because Plan My Day was clicked.
    supabase.from("events").select("task_id").in("task_id", orderedTaskIds).gte("date", today),
  ]);

  if (tasksError || blocksError) {
    console.error("plan-day: failed to load tasks/events", tasksError ?? blocksError);
    return NextResponse.json({ error: "Couldn't load your tasks." }, { status: 500 });
  }

  const tasksById = new Map((taskRows ?? []).map((t) => [t.id, t]));
  const alreadyScheduledTaskIds = new Set((blockRows ?? []).map((e) => e.task_id as string));

  // Rebuild in focus order. A task completed (or deleted) since the focus
  // plan was cached is dropped silently — it's not a skipped task, it's
  // just no longer work.
  const tasks: PlanTaskInput[] = orderedTaskIds
    .map((id) => tasksById.get(id))
    .filter((t): t is NonNullable<typeof t> => !!t && t.status !== "done")
    .map((t) => ({
      id: t.id,
      title: t.title,
      estimated_minutes: t.estimated_minutes,
      due_date: t.due_date,
    }));

  const plan = await planDay(supabase, { tasks, alreadyScheduledTaskIds });

  return NextResponse.json({ ...plan, focus_date: today });
}