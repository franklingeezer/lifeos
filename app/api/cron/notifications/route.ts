import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendPushToUser } from "@/lib/push/server";
import { todayISO } from "@/lib/date";
import { resolveNextGeneration, type RecurrenceRule } from "@/lib/recurrence";

export const dynamic = "force-dynamic";

// Triggered by Vercel Cron (see vercel.json) roughly every 5 minutes.
// Protected by CRON_SECRET rather than a Supabase session, since a cron
// job has no logged-in user — Vercel Cron sends this same header
// automatically for routes defined in vercel.json, so no extra setup is
// needed beyond having the env var set.
//
// This route is deliberately reachable without a session (see PUBLIC_PATHS
// in lib/supabase/middleware.ts), so this check is the ONLY thing standing
// between the public internet and a service-role client — it has to be
// strict:
//  - If CRON_SECRET isn't set, nothing is authorized. Comparing against
//    `Bearer ${undefined}` would otherwise accept the literal header
//    "Bearer undefined".
//  - The comparison is constant-time, so response timing can't be used to
//    guess the secret one character at a time.
function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const provided = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

type TaskSeriesRow = {
  id: string;
  user_id: string;
  title: string;
  category: string | null;
  priority: string;
  project_id: string | null;
  estimated_minutes: number | null;
  frequency: RecurrenceRule["frequency"];
  interval_count: number;
  days_of_week: number[] | null;
  day_of_month: number | null;
  start_date: string;
  end_date: string | null;
  next_due_date: string;
};

/**
 * LifeOS Roadmap — Recurring Tasks, Part 2.
 *
 * Deliberately its own top-level pass, not folded into generateDueNotifications
 * below or gated behind push_subscriptions the way the rest of this route
 * is — a user who's never turned on push notifications should still get
 * their recurring tasks generated. Whether you're *notified* about a task
 * and whether the task *exists* are unrelated concerns; this route just
 * happens to be the one "runs every 5 minutes" hook the app already has.
 */
async function generateDueRecurringTasks(supabase: ReturnType<typeof createServiceClient>) {
  const today = todayISO();

  const { data: dueSeries, error: dueError } = await supabase
    .from("task_series")
    .select("id, user_id, title, category, priority, project_id, estimated_minutes, frequency, interval_count, days_of_week, day_of_month, start_date, end_date, next_due_date")
    .eq("active", true)
    .lte("next_due_date", today);

  // An error here used to be ignored, which made a failed query look
  // exactly like "nothing is due" — 200 OK, tasksGenerated: 0. Report it.
  if (dueError) {
    console.error("cron: couldn't load due recurring series", dueError);
    return { generated: 0, failed: 1, due: 0, firstError: `couldn't load due series: ${dueError.message}${dueError.code ? ` (${dueError.code})` : ""}` };
  }

  let generated = 0;
  let failed = 0;
  // The first failure's message, returned to the caller so a failed run
  // explains itself in the response (and in the GitHub Actions log)
  // instead of only in server logs. Only ever sent to a caller that has
  // already passed the CRON_SECRET check.
  let firstError: string | null = null;

  const due = (dueSeries ?? []) as TaskSeriesRow[];

  for (const series of due) {
    const rule: RecurrenceRule = {
      frequency: series.frequency,
      interval_count: series.interval_count,
      days_of_week: series.days_of_week,
      day_of_month: series.day_of_month,
      start_date: series.start_date,
    };

    // Collapses any backlog (a series that's fallen behind — server
    // downtime, a long pause since reactivated) into a single catch-up
    // task for the most recent due date, rather than flooding Tasks with
    // every date that was missed in between. See lib/recurrence.ts.
    const { occurrenceDate, newNextDueDate } = resolveNextGeneration(series.next_due_date, today, rule);

    // A series with an end_date naturally concludes once its next
    // occurrence would fall past it — deactivate rather than keep
    // querying a series that will never generate anything again.
    const stillActive = !series.end_date || newNextDueDate <= series.end_date;

    // Idempotent: if this occurrence already exists (a previous run
    // inserted it but failed before advancing the series, or the GitHub
    // Actions run and the Vercel cron overlapped), don't create a second
    // copy — just fall through and advance the series.
    const { data: existing, error: existingError } = await supabase
      .from("tasks")
      .select("id")
      .eq("series_id", series.id)
      .eq("due_date", occurrenceDate)
      .limit(1);
    if (existingError) {
      console.error(`cron: couldn't check existing occurrences for series ${series.id}`, existingError);
      failed += 1;
      firstError ??= `couldn't check existing occurrences: ${existingError.message}`;
      continue;
    }

    if (!existing || existing.length === 0) {
      const { error: insertError } = await supabase.from("tasks").insert({
        user_id: series.user_id,
        title: series.title,
        category: series.category,
        priority: series.priority,
        project_id: series.project_id,
        estimated_minutes: series.estimated_minutes,
        due_date: occurrenceDate,
        series_id: series.id,
      });
      // Fail-safe: if the task wasn't created, do NOT advance the series.
      // Leaving next_due_date where it is means the next run retries this
      // same occurrence, instead of silently skipping it forever.
      if (insertError) {
        console.error(`cron: failed to create occurrence for series ${series.id}`, insertError);
        failed += 1;
        firstError ??= `couldn't create occurrence: ${insertError.message}`;
        continue;
      }
      generated += 1;
    }

    const { error: advanceError } = await supabase
      .from("task_series")
      .update({ next_due_date: newNextDueDate, active: stillActive })
      .eq("id", series.id);
    if (advanceError) {
      console.error(`cron: failed to advance series ${series.id}`, advanceError);
      failed += 1;
      firstError ??= `couldn't advance series: ${advanceError.message}`;
    }
  }

  return { generated, failed, due: due.length, firstError };
}

/**
 * Same generation rules as useNotifications.ts's client-side sync() —
 * intentionally duplicated rather than shared, since that hook runs in
 * the browser against the user's own RLS-scoped session and this runs
 * server-side against a service-role client with no session at all. Keep
 * the two in sync by hand if the generation rules ever change; a shared
 * helper would need to accept a generic query client, which isn't worth
 * the abstraction for two ~15-line blocks.
 */
async function generateDueNotifications(supabase: ReturnType<typeof createServiceClient>, userId: string) {
  const nowISO = new Date().toISOString();
  const today = todayISO();

  const [{ data: dueReminders }, { data: existingReminderNotifs }, { data: overdueTasks }, { data: existingTaskNotifs }] =
    await Promise.all([
      supabase
        .from("reminders")
        .select("id, title, description, related_type, related_id, scheduled_at")
        .eq("user_id", userId)
        .lte("scheduled_at", nowISO),
      supabase.from("notifications").select("reminder_id").eq("user_id", userId).eq("type", "reminder").not("reminder_id", "is", null),
      supabase.from("tasks").select("id, title, due_date").eq("user_id", userId).lt("due_date", today).neq("status", "done"),
      supabase.from("notifications").select("related_id").eq("user_id", userId).eq("type", "overdue_task"),
    ]);

  const existingReminderIds = new Set((existingReminderNotifs ?? []).map((n) => n.reminder_id));
  const existingTaskIds = new Set((existingTaskNotifs ?? []).map((n) => n.related_id));
  const toInsert: Record<string, unknown>[] = [];

  (dueReminders ?? []).forEach((r) => {
    if (existingReminderIds.has(r.id)) return;
    toInsert.push({
      user_id: userId,
      type: "reminder",
      title: r.title,
      message: r.description,
      related_type: r.related_type,
      related_id: r.related_id,
      reminder_id: r.id,
      scheduled_at: r.scheduled_at,
    });
  });

  (overdueTasks ?? []).forEach((t) => {
    if (existingTaskIds.has(t.id)) return;
    toInsert.push({
      user_id: userId,
      type: "overdue_task",
      title: `Overdue: ${t.title}`,
      message: t.due_date ? `Was due ${t.due_date}` : null,
      related_type: "task",
      related_id: t.id,
      scheduled_at: nowISO,
    });
  });

  if (toInsert.length > 0) {
    await supabase.from("notifications").insert(toInsert);
  }
}

async function deliverPendingPush(supabase: ReturnType<typeof createServiceClient>, userId: string) {
  const nowISO = new Date().toISOString();

  const { data: pending } = await supabase
    .from("notifications")
    .select("id, type, title, message, related_type, related_id")
    .eq("user_id", userId)
    .is("push_sent_at", null)
    .is("dismissed_at", null)
    .lte("scheduled_at", nowISO);

  if (!pending || pending.length === 0) return 0;

  let delivered = 0;
  for (const n of pending) {
    const { sent } = await sendPushToUser(supabase, userId, {
      title: n.title,
      body: n.message || "",
      url: n.related_type && n.related_id ? `/${n.related_type}s` : "/",
      tag: n.id,
    });
    if (sent > 0) {
      await supabase.from("notifications").update({ push_sent_at: nowISO }).eq("id", n.id);
      delivered += 1;
    }
  }
  return delivered;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Fail loudly if SUPABASE_SERVICE_ROLE_KEY isn't really a service-role
  // key. A publishable/anon key in that slot doesn't error on queries — it
  // just sees zero rows through Row Level Security, so the whole run
  // "succeeds" having found no series, no subscriptions, and nothing to do.
  // Listing auth users is something only a service-role key may do, so it
  // doubles as a cheap, reliable check.
  const { error: keyError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (keyError) {
    console.error("cron: service-role key check failed", keyError);
    return NextResponse.json(
      { ok: false, error: "Service-role key check failed — SUPABASE_SERVICE_ROLE_KEY must be the secret/service_role key, not the publishable/anon one." },
      { status: 500 }
    );
  }

  // Independent of push subscriptions entirely — see generateDueRecurringTasks.
  const { generated: tasksGenerated, failed: tasksFailed, due: seriesDue, firstError } = await generateDueRecurringTasks(supabase);

  // Scope the notification/push work to users who actually have an active
  // push subscription — no subscriptions means nothing to deliver,
  // regardless of how many reminders/overdue tasks exist.
  const { data: subs } = await supabase.from("push_subscriptions").select("user_id");
  const userIds = [...new Set((subs ?? []).map((s) => s.user_id))];

  if (userIds.length === 0) {
    return NextResponse.json({ ok: tasksFailed === 0, users: 0, delivered: 0, seriesDue, tasksGenerated, tasksFailed, ...(firstError ? { detail: firstError } : {}) }, { status: tasksFailed === 0 ? 200 : 500 });
  }

  let totalDelivered = 0;
  for (const userId of userIds) {
    await generateDueNotifications(supabase, userId);
    totalDelivered += await deliverPendingPush(supabase, userId);
  }

  return NextResponse.json(
    { ok: tasksFailed === 0, users: userIds.length, delivered: totalDelivered, seriesDue, tasksGenerated, tasksFailed, ...(firstError ? { detail: firstError } : {}) },
    { status: tasksFailed === 0 ? 200 : 500 }
  );
}