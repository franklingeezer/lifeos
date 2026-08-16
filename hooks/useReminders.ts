"use client";

import useSWR from "swr";
import { useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

export type RelatedType = "task" | "event" | "project" | "habit" | "journal" | "finance";
export type RepeatRule = "none" | "daily" | "weekly" | "monthly" | "custom";
export type Priority = "low" | "med" | "high";

export type Reminder = {
  id: string;
  title: string;
  description: string | null;
  related_type: RelatedType | null;
  related_id: string | null;
  scheduled_at: string;
  repeat_rule: RepeatRule;
  priority: Priority;
  created_at: string;
};

const REMINDERS_KEY = "reminders";

async function fetchReminders(supabase: ReturnType<typeof createClient>): Promise<Reminder[]> {
  const { data, error } = await supabase
    .from("reminders")
    .select("id, title, description, related_type, related_id, scheduled_at, repeat_rule, priority, created_at")
    .order("scheduled_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Reminder[];
}

export function useReminders() {
  const supabase = useMemo(() => createClient(), []);

  const { data, error, isLoading, mutate } = useSWR<Reminder[]>(REMINDERS_KEY, () => fetchReminders(supabase));

  const reminders = data ?? [];

  const createReminder = useCallback(
    async (input: Omit<Reminder, "id" | "created_at">) => {
      const { data: created, error } = await supabase.from("reminders").insert(input).select().single();
      if (error || !created) throw error ?? new Error("Insert returned no row");
      await mutate((current) => [...(current ?? []), created as Reminder], { revalidate: false });
      return created as Reminder;
    },
    [supabase, mutate]
  );

  const updateReminder = useCallback(
    async (id: string, patch: Partial<Reminder>) => {
      await mutate((current) => (current ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)), {
        revalidate: false,
      });
      const { error } = await supabase.from("reminders").update(patch).eq("id", id);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  const deleteReminder = useCallback(
    async (id: string) => {
      await mutate((current) => (current ?? []).filter((r) => r.id !== id), { revalidate: false });
      const { error } = await supabase.from("reminders").delete().eq("id", id);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  return {
    reminders,
    isLoading,
    error,
    createReminder,
    updateReminder,
    deleteReminder,
    refresh: mutate,
  };
}