import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findScheduleSlot } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

/**
 * LifeOS Roadmap — Task -> Calendar Smart Scheduling, Part 4.
 *
 * Deliberately thin: this route's only job is "look up the task, hand its
 * duration/due-date to the scheduler, return what it says." All the
 * actual free-slot logic lives in lib/scheduler.ts, not here — same
 * separation Context Engine already draws between data assembly and the
 * route that uses it.
 *
 * No Groq call, so no rate-limit check either — this is arithmetic over
 * data the caller already owns, not an AI feature. It's also read-only:
 * this route only proposes a slot, it never creates anything. Accepting
 * a proposal is a plain calendar-event creation the frontend does itself
 * via the existing useCalendar().createEvent(), the same as any other
 * event on the Calendar.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const taskId: string | undefined = body?.task_id;

  if (!taskId) {
    return NextResponse.json({ error: "Missing 'task_id' in request body." }, { status: 400 });
  }

  const supabase = createClient();

  // RLS already scopes this to the caller's own tasks — a task_id
  // belonging to someone else simply won't be found, not a 403 that
  // would confirm the id exists.
  const { data: task, error } = await supabase
    .from("tasks")
    .select("id, title, due_date, estimated_minutes")
    .eq("id", taskId)
    .maybeSingle();

  if (error) {
    console.error("schedule-task: failed to load task", error);
    return NextResponse.json({ error: "Couldn't load that task." }, { status: 500 });
  }
  if (!task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  // "No estimate yet" and "no opening found" are both legitimate, expected
  // outcomes of scheduling a real task — not request errors — so both
  // come back as a normal 200 with candidate: null and a reason, exactly
  // as findScheduleSlot already shapes them. The frontend is responsible
  // for showing that reason instead of treating it as a failure.
  const result = await findScheduleSlot(supabase, {
    estimatedMinutes: task.estimated_minutes ?? 0,
    dueDate: task.due_date,
  });

  return NextResponse.json({
    task: { id: task.id, title: task.title },
    ...result,
  });
}