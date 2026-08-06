"use client";

import useSWR from "swr";
import { useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { toLocalISODate } from "@/lib/date";

export type DashboardTask = {
  id: string;
  title: string;
  tag: string | null;
  priority: "low" | "med" | "high";
  done: boolean;
  status: "todo" | "in_progress" | "done";
};
export type HabitRow = { name: string; streak: number; pct: number };
export type Note = { id: string; title: string };
export type ProjectRow = { name: string; progress: number };

export type DashboardData = {
  tasks: DashboardTask[];
  displayName: string;
  habits: HabitRow[];
  netThisMonth: number;
  briefTeaser: string | null;
  projects: ProjectRow[];
  eventDays: string[]; // ISO date strings — turn into a Set in the component if needed
  recentNotes: Note[];
};

const DASHBOARD_KEY = "dashboard";
const DEFAULT_NAME = "Chief";
const isoDate = toLocalISODate;

function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const set = new Set(dates);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let cursor = new Date(today);
  if (!set.has(isoDate(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!set.has(isoDate(cursor))) return 0;
  }
  let streak = 0;
  while (set.has(isoDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

async function fetchDashboardData(supabase: ReturnType<typeof createClient>): Promise<DashboardData> {
  const today = new Date();
  const monthStart = isoDate(new Date(today.getFullYear(), today.getMonth(), 1));
  const monthEndExclusive = isoDate(new Date(today.getFullYear(), today.getMonth() + 1, 1));
  const weekStart = new Date(today);
  const dayOfWeek = (today.getDay() + 6) % 7; // 0 = Monday
  weekStart.setDate(today.getDate() - dayOfWeek);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const [
    { data: tasksData },
    { data: settingsRow },
    { data: habitsData },
    { data: financeRows },
    { data: briefRow },
    { data: projectsData },
    { data: eventsData },
    { data: notesData },
  ] = await Promise.all([
    supabase.from("tasks").select("id, title, tag, priority, done, status").order("position", { ascending: true }).order("created_at", { ascending: true }),
    supabase.from("app_settings").select("display_name").eq("id", 1).maybeSingle(),
    supabase.from("habits").select("id, name"),
    supabase.from("finance_transactions").select("type, amount_bdt").gte("occurred_on", monthStart).lt("occurred_on", monthEndExclusive),
    supabase.from("ai_briefs").select("content").eq("brief_date", isoDate(today)).maybeSingle(),
    supabase.from("projects").select("name, progress").eq("status", "active").order("progress", { ascending: false }).limit(4),
    supabase.from("events").select("date").gte("date", isoDate(weekStart)).lte("date", isoDate(weekEnd)),
    supabase.from("notes").select("id, title").order("updated_at", { ascending: false }).limit(3),
  ]);

  let habits: HabitRow[] = [];
  if (habitsData && habitsData.length > 0) {
    const habitIds = habitsData.map((h) => h.id);
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - 60);
    const { data: logs } = await supabase
      .from("habit_logs")
      .select("habit_id, date")
      .in("habit_id", habitIds)
      .eq("completed", true)
      .gte("date", isoDate(cutoff));
    const d30 = new Date(today);
    d30.setDate(d30.getDate() - 29);
    habits = habitsData.map((h) => {
      const allDates = (logs ?? []).filter((l) => l.habit_id === h.id).map((l) => l.date);
      const in30 = allDates.filter((d) => d >= isoDate(d30));
      return { name: h.name, streak: computeStreak(allDates), pct: in30.length / 30 };
    });
  }

  const netThisMonth = (financeRows ?? []).reduce((sum, t) => {
    if (t.type === "income") return sum + Number(t.amount_bdt);
    if (t.type === "expense" || t.type === "savings" || t.type === "investment") return sum - Number(t.amount_bdt);
    return sum;
  }, 0);

  let briefTeaser: string | null = null;
  if (briefRow?.content) {
    const firstBullet = briefRow.content.split("\n").find((l: string) => l.trim().startsWith("•"));
    briefTeaser = firstBullet?.replace(/^•\s*/, "") ?? briefRow.content.split("\n")[0];
  }

  return {
    tasks: (tasksData ?? []) as DashboardTask[],
    displayName: settingsRow?.display_name ?? DEFAULT_NAME,
    habits,
    netThisMonth,
    briefTeaser,
    projects: (projectsData ?? []).map((p) => ({ name: p.name, progress: p.progress ?? 0 })),
    eventDays: (eventsData ?? []).map((e) => e.date as string),
    recentNotes: (notesData ?? []) as Note[],
  };
}

export function useDashboardData() {
  const supabase = useMemo(() => createClient(), []);

  const { data, error, isLoading, mutate } = useSWR<DashboardData>(DASHBOARD_KEY, () => fetchDashboardData(supabase));

  const toggleTask = useCallback(
    async (id: string, done: boolean) => {
      const nextStatus = done ? "todo" : "done";
      await mutate(
        (current) =>
          current && {
            ...current,
            tasks: current.tasks.map((t) => (t.id === id ? { ...t, done: !done, status: nextStatus } : t)),
          },
        { revalidate: false }
      );
      const { error } = await supabase.from("tasks").update({ status: nextStatus }).eq("id", id);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  return {
    data,
    isLoading,
    error,
    toggleTask,
    refresh: mutate,
  };
}