"use client";

import { useCallback, useMemo } from "react";
import { useSWRConfig } from "swr";
import { createClient } from "@/lib/supabase/client";
import { resolveNextGeneration, type RecurrenceRule } from "@/lib/recurrence";
import { todayISO } from "@/lib/date";
import type { Priority } from "@/hooks/useTasks";

export type CreateSeriesInput = {
  title: string;
  category: string | null;
  priority: Priority;
  project_id: string | null;
  estimated_minutes: number | null;
  frequency: RecurrenceRule["frequency"];
  interval_count: number;
  days_of_week: number[] | null; // weekly only
  day_of_month: number | null; // monthly only
  start_date: string;
  end_date: string | null;
};

/**
 * Roadmap — Recurring Tasks, Part 3.
 *
 * Client-side, direct-to-Supabase, same as every other create___ hook in
 * this app (useTasks, useCalendar) — recurring tasks don't need an API
 * route any more than a normal task does; RLS already scopes everything
 * to the caller.
 */
export function useTaskSeries() {
  const supabase = useMemo(() => createClient(), []);
  const { mutate } = useSWRConfig();

  const createSeries = useCallback(
    async (input: CreateSeriesInput) => {
      const today = todayISO();
      const rule: RecurrenceRule = {
        frequency: input.frequency,
        interval_count: input.interval_count,
        days_of_week: input.days_of_week,
        day_of_month: input.day_of_month,
        start_date: input.start_date,
      };

      // The very first occurrence is generated right here, immediately —
      // not left for the cron (app/api/cron/notifications) to pick up on
      // its next ~5-minute tick. Creating a recurring task should feel
      // exactly like creating a normal one: it shows up in your list
      // right away. Every occurrence after this one is the cron's job,
      // using this exact same resolveNextGeneration function, so the two
      // paths can never drift apart on what "the next occurrence" means.
      const { occurrenceDate, newNextDueDate } = resolveNextGeneration(input.start_date, today, rule);

      // Ordering matters here, mirroring the cron: the series is created
      // with next_due_date still pointing at the occurrence we're about
      // to generate, NOT already advanced. If the task insert below fails
      // partway through, the series is left correctly "still owing" its
      // first occurrence — a retry, or even just the next cron tick,
      // will generate it rather than silently skipping straight to the
      // second one.
      const { data: series, error: seriesError } = await supabase
        .from("task_series")
        .insert({
          title: input.title,
          category: input.category,
          priority: input.priority,
          project_id: input.project_id,
          estimated_minutes: input.estimated_minutes,
          frequency: input.frequency,
          interval_count: input.interval_count,
          days_of_week: input.days_of_week,
          day_of_month: input.day_of_month,
          start_date: input.start_date,
          end_date: input.end_date,
          next_due_date: occurrenceDate,
        })
        .select()
        .single();
      if (seriesError || !series) throw seriesError ?? new Error("Insert returned no row");

      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .insert({
          user_id: series.user_id,
          title: input.title,
          category: input.category,
          priority: input.priority,
          project_id: input.project_id,
          estimated_minutes: input.estimated_minutes,
          due_date: occurrenceDate,
          series_id: series.id,
        })
        .select()
        .single();
      if (taskError || !task) throw taskError ?? new Error("Insert returned no row");

      const stillActive = !input.end_date || newNextDueDate <= input.end_date;
      const { error: advanceError } = await supabase
        .from("task_series")
        .update({ next_due_date: newNextDueDate, active: stillActive })
        .eq("id", series.id);
      if (advanceError) throw advanceError;

      // Refresh the shared "tasks" SWR cache (keyed the same way
      // useTasks.ts keys it) so the new task shows up immediately
      // wherever it's rendered, without a full page reload.
      await mutate("tasks");

      return { series, task };
    },
    [supabase, mutate]
  );

  /**
   * Stops future generation without touching anything already created —
   * every past occurrence stays exactly as it is, completed or not. This
   * intentionally does NOT delete task_series itself (so "why did this
   * stop repeating" stays answerable later) or any generated tasks.
   */
  const stopSeries = useCallback(
    async (seriesId: string) => {
      const { error } = await supabase.from("task_series").update({ active: false }).eq("id", seriesId);
      if (error) throw error;
    },
    [supabase]
  );

  return { createSeries, stopSeries };
}