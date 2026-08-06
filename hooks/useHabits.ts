"use client";

import useSWR from "swr";
import { useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { toLocalISODate } from "@/lib/date";

export type Habit = { id: string; name: string; color: string };
export type HabitLog = { id: string; habit_id: string; date: string; completed: boolean };

export type HabitsData = { habits: Habit[]; logs: HabitLog[] };

const HABITS_KEY = "habits";
const todayISO = toLocalISODate(new Date());

async function fetchHabitsData(supabase: ReturnType<typeof createClient>): Promise<HabitsData> {
  const [{ data: h }, { data: l }] = await Promise.all([
    supabase.from("habits").select("id, name, color").order("created_at", { ascending: true }),
    supabase.from("habit_logs").select("id, habit_id, date, completed").eq("completed", true),
  ]);
  return { habits: (h ?? []) as Habit[], logs: (l ?? []) as HabitLog[] };
}

export function useHabits() {
  const supabase = useMemo(() => createClient(), []);

  const { data, error, isLoading, mutate } = useSWR<HabitsData>(HABITS_KEY, () => fetchHabitsData(supabase));

  const habits = data?.habits ?? [];
  const logs = data?.logs ?? [];

  const toggleDay = useCallback(
    async (habitId: string, date: string) => {
      if (date > todayISO) return; // no marking the future

      const isCompleted = logs.some((l) => l.habit_id === habitId && l.date === date);

      if (isCompleted) {
        await mutate(
          (current) =>
            current && { ...current, logs: current.logs.filter((l) => !(l.habit_id === habitId && l.date === date)) },
          { revalidate: false }
        );
        const { error } = await supabase.from("habit_logs").delete().eq("habit_id", habitId).eq("date", date);
        if (error) await mutate();
      } else {
        const optimisticId = `optimistic-${habitId}-${date}`;
        await mutate(
          (current) =>
            current && {
              ...current,
              logs: [...current.logs, { id: optimisticId, habit_id: habitId, date, completed: true }],
            },
          { revalidate: false }
        );
        const { data: created, error } = await supabase
          .from("habit_logs")
          .upsert({ habit_id: habitId, date, completed: true }, { onConflict: "habit_id,date" })
          .select()
          .single();
        if (error) {
          await mutate();
        } else if (created) {
          await mutate(
            (current) =>
              current && {
                ...current,
                logs: current.logs.map((l) => (l.id === optimisticId ? (created as HabitLog) : l)),
              },
            { revalidate: false }
          );
        }
      }
    },
    [supabase, mutate, logs]
  );

  const createHabit = useCallback(
    async (name: string, color: string) => {
      const { data: created, error } = await supabase.from("habits").insert({ name, color }).select().single();
      if (error || !created) throw error ?? new Error("Insert returned no row");
      await mutate((current) => current && { ...current, habits: [...current.habits, created as Habit] }, {
        revalidate: false,
      });
      return created as Habit;
    },
    [supabase, mutate]
  );

  const deleteHabit = useCallback(
    async (id: string) => {
      await mutate(
        (current) =>
          current && {
            habits: current.habits.filter((h) => h.id !== id),
            logs: current.logs.filter((l) => l.habit_id !== id),
          },
        { revalidate: false }
      );
      const { error } = await supabase.from("habits").delete().eq("id", id);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  return {
    habits,
    logs,
    isLoading,
    error,
    toggleDay,
    createHabit,
    deleteHabit,
    refresh: mutate,
  };
}