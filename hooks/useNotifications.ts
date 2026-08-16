"use client";

import useSWR from "swr";
import { useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RelatedType } from "@/hooks/useReminders";

export type NotificationType = "reminder" | "overdue_task" | "habit_slip" | "project_inactive" | "ai_insight";

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  related_type: RelatedType | null;
  related_id: string | null;
  reminder_id: string | null;
  scheduled_at: string;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
};

const NOTIFICATIONS_KEY = "notifications";

async function fetchNotifications(supabase: ReturnType<typeof createClient>): Promise<Notification[]> {
  // Dismissed notifications drop out of the active feed entirely — they
  // stay in the table (nothing is deleted), just not queried into the
  // bell/center once acted on. "Do not spam the user" applies to the UI
  // staying clean just as much as it applies to not over-generating in
  // the first place.
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, message, related_type, related_id, reminder_id, scheduled_at, read_at, dismissed_at, created_at")
    .is("dismissed_at", null)
    .order("scheduled_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as Notification[];
}

/**
 * Client-side "reminder engine" for Phase 1 — checks for due reminders and
 * overdue tasks and turns each one into a stored notification row, exactly
 * once per source item (a reminder or task never generates a duplicate
 * notification, even across many syncs). This runs whenever the app is
 * open; Phase 3 moves the actual delivery (not the generation logic) to a
 * server-side cron so it can reach you even when LifeOS isn't open.
 */
async function syncNotifications(supabase: ReturnType<typeof createClient>) {
  const nowISO = new Date().toISOString();
  const todayISO = nowISO.slice(0, 10);

  const [{ data: dueReminders }, { data: existingReminderNotifs }, { data: overdueTasks }, { data: existingTaskNotifs }] =
    await Promise.all([
      supabase
        .from("reminders")
        .select("id, title, description, related_type, related_id, scheduled_at")
        .lte("scheduled_at", nowISO),
      supabase.from("notifications").select("reminder_id").eq("type", "reminder").not("reminder_id", "is", null),
      supabase.from("tasks").select("id, title, due_date").lt("due_date", todayISO).neq("status", "done"),
      supabase.from("notifications").select("related_id").eq("type", "overdue_task"),
    ]);

  const existingReminderIds = new Set((existingReminderNotifs ?? []).map((n) => n.reminder_id));
  const existingTaskIds = new Set((existingTaskNotifs ?? []).map((n) => n.related_id));

  const toInsert: Record<string, unknown>[] = [];

  (dueReminders ?? []).forEach((r) => {
    if (existingReminderIds.has(r.id)) return;
    toInsert.push({
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

export function useNotifications() {
  const supabase = useMemo(() => createClient(), []);

  const { data, error, isLoading, mutate } = useSWR<Notification[]>(NOTIFICATIONS_KEY, () => fetchNotifications(supabase), {
    // Notifications are exactly the kind of thing you want fresh when you
    // tab back in, unlike the AI content hooks which deliberately don't
    // revalidate on focus.
    revalidateOnFocus: true,
  });

  const notifications = data ?? [];
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const sync = useCallback(async () => {
    await syncNotifications(supabase);
    await mutate();
  }, [supabase, mutate]);

  const markRead = useCallback(
    async (id: string) => {
      const now = new Date().toISOString();
      await mutate((current) => (current ?? []).map((n) => (n.id === id ? { ...n, read_at: now } : n)), {
        revalidate: false,
      });
      const { error } = await supabase.from("notifications").update({ read_at: now }).eq("id", id);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await mutate((current) => (current ?? []).map((n) => (n.read_at ? n : { ...n, read_at: now })), {
      revalidate: false,
    });
    const { error } = await supabase.from("notifications").update({ read_at: now }).in("id", unreadIds);
    if (error) await mutate();
  }, [supabase, mutate, notifications]);

  const dismiss = useCallback(
    async (id: string) => {
      const now = new Date().toISOString();
      await mutate((current) => (current ?? []).filter((n) => n.id !== id), { revalidate: false });
      const { error } = await supabase.from("notifications").update({ dismissed_at: now }).eq("id", id);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    sync,
    markRead,
    markAllRead,
    dismiss,
    refresh: mutate,
  };
}