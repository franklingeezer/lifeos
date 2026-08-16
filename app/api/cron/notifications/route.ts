import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendPushToUser } from "@/lib/push/server";
import { todayISO } from "@/lib/date";

export const dynamic = "force-dynamic";

// Triggered by Vercel Cron (see vercel.json) roughly every 5 minutes.
// Protected by CRON_SECRET rather than a Supabase session, since a cron
// job has no logged-in user — Vercel Cron sends this same header
// automatically for routes defined in vercel.json, so no extra setup is
// needed beyond having the env var set.
function isAuthorized(req: NextRequest) {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
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

  // Scope work to users who actually have an active push subscription —
  // no subscriptions means nothing to deliver, regardless of how many
  // reminders/overdue tasks exist.
  const { data: subs } = await supabase.from("push_subscriptions").select("user_id");
  const userIds = [...new Set((subs ?? []).map((s) => s.user_id))];

  if (userIds.length === 0) {
    return NextResponse.json({ ok: true, users: 0, delivered: 0 });
  }

  let totalDelivered = 0;
  for (const userId of userIds) {
    await generateDueNotifications(supabase, userId);
    totalDelivered += await deliverPendingPush(supabase, userId);
  }

  return NextResponse.json({ ok: true, users: userIds.length, delivered: totalDelivered });
}