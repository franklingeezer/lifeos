"use client";

import { useCallback, useMemo } from "react";
import useSWR, { useSWRConfig } from "swr";
import { createClient } from "@/lib/supabase/client";
import { resolveNextGeneration, type RecurrenceRule } from "@/lib/recurrence";
import { firstOccurrenceFrom } from "@/lib/series-schedule";
import { todayISO, addDaysISO } from "@/lib/date";
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

// Roadmap — Recurring Tasks, series management. One row of task_series.
export type TaskSeries = {
  id: string;
  user_id: string;
  title: string;
  category: string | null;
  priority: Priority;
  project_id: string | null;
  estimated_minutes: number | null;
  frequency: RecurrenceRule["frequency"];
  interval_count: number;
  days_of_week: number[] | null;
  day_of_month: number | null;
  start_date: string;
  end_date: string | null;
  active: boolean;
  next_due_date: string;
  created_at: string;
};

// What a series edit can change. start_date is deliberately not here: it
// anchors "every N weeks" and the whole occurrence sequence, so changing
// it would quietly shift every future date. To change it, make a new series.
export type UpdateSeriesInput = Partial<
  Pick<
    TaskSeries,
    "title" | "category" | "priority" | "project_id" | "estimated_minutes" | "frequency" | "interval_count" | "days_of_week" | "day_of_month" | "end_date"
  >
>;

export const SERIES_KEY = "task_series";

const ruleOf = (s: Pick<TaskSeries, "frequency" | "interval_count" | "days_of_week" | "day_of_month" | "start_date">): RecurrenceRule => ({
  frequency: s.frequency,
  interval_count: s.interval_count,
  days_of_week: s.days_of_week,
  day_of_month: s.day_of_month,
  start_date: s.start_date,
});

/**
 * Roadmap — Recurring Tasks, Part 3 + series management.
 *
 * Client-side, direct-to-Supabase, same as every other create___ hook in
 * this app (useTasks, useCalendar) — recurring tasks don't need an API
 * route any more than a normal task does; RLS already scopes everything
 * to the caller.
 *
 * Pause/resume is the existing `active` flag — there's no separate
 * "paused" column. Anything already generated from a series is never
 * touched by any of these actions.
 */
export function useTaskSeries() {
  const supabase = useMemo(() => createClient(), []);
  const { mutate } = useSWRConfig();

  const { data, error, isLoading } = useSWR<TaskSeries[]>(SERIES_KEY, async () => {
    const { data: rows, error: listError } = await supabase.from("task_series").select("*").order("created_at", { ascending: false });
    if (listError) throw listError;
    return (rows ?? []) as TaskSeries[];
  });

  const refreshSeries = useCallback(() => mutate(SERIES_KEY), [mutate]);

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
      await Promise.all([mutate("tasks"), refreshSeries()]);

      return { series, task };
    },
    [supabase, mutate, refreshSeries]
  );

  const fetchSeriesRow = useCallback(
    async (seriesId: string): Promise<TaskSeries> => {
      const { data: row, error: rowError } = await supabase.from("task_series").select("*").eq("id", seriesId).single();
      if (rowError || !row) throw rowError ?? new Error("That series no longer exists.");
      return row as TaskSeries;
    },
    [supabase]
  );

  /**
   * The next date this series should generate on, from the rules as they
   * stand now. If today's occurrence already exists as a task, the search
   * starts tomorrow — re-resuming or re-editing a series must never make
   * the cron create a second copy of a task that's already in your list.
   */
  const nextDueFor = useCallback(
    async (rule: RecurrenceRule, seriesId: string): Promise<string> => {
      const today = todayISO();
      const { data: existing, error: existingError } = await supabase
        .from("tasks")
        .select("id")
        .eq("series_id", seriesId)
        .eq("due_date", today)
        .limit(1);
      if (existingError) throw existingError;
      const todayTaken = (existing?.length ?? 0) > 0;
      return firstOccurrenceFrom(rule, todayTaken ? addDaysISO(today, 1) : today);
    },
    [supabase]
  );

  /**
   * Pauses a series: no new occurrences are generated until it's resumed.
   * Nothing already created is touched — every past occurrence stays
   * exactly as it is, completed or not — and the series row itself is
   * kept, so it can be resumed and "why did this stop" stays answerable.
   */
  const pauseSeries = useCallback(
    async (seriesId: string) => {
      const { error: pauseError } = await supabase.from("task_series").update({ active: false }).eq("id", seriesId);
      if (pauseError) throw pauseError;
      await refreshSeries();
    },
    [supabase, refreshSeries]
  );

  /**
   * Resumes a paused series from its next real occurrence — it does NOT
   * back-fill the paused period. (Leaving next_due_date where it was would
   * make the cron generate one overdue "catch-up" task the moment you
   * resume; nobody pausing a series wants that.) Throws a readable Error
   * if the series has actually ended and there's nothing left to generate.
   */
  const resumeSeries = useCallback(
    async (seriesId: string) => {
      const row = await fetchSeriesRow(seriesId);
      const today = todayISO();

      if (row.end_date && row.end_date < today) {
        throw new Error(`This series ended on ${row.end_date}. Extend its end date first.`);
      }

      const next = await nextDueFor(ruleOf(row), seriesId);
      if (row.end_date && next > row.end_date) {
        throw new Error(`There are no more occurrences before its end date (${row.end_date}). Extend the end date first.`);
      }

      const { error: resumeError } = await supabase.from("task_series").update({ active: true, next_due_date: next }).eq("id", seriesId);
      if (resumeError) throw resumeError;
      await refreshSeries();
      return { nextDueDate: next };
    },
    [supabase, fetchSeriesRow, nextDueFor, refreshSeries]
  );

  /**
   * Edits a series. Changes apply to FUTURE occurrences only — tasks
   * already generated are never rewritten. If the schedule itself changed
   * (frequency, interval, days, day of month, end date), the next due date
   * is recomputed from the new rule. A paused or ended series stays
   * paused: extending an ended series' end date makes it resumable, it
   * doesn't silently restart it.
   */
  const updateSeries = useCallback(
    async (seriesId: string, patch: UpdateSeriesInput) => {
      const row = await fetchSeriesRow(seriesId);
      const today = todayISO();

      const merged = { ...row, ...patch };

      // Keep the stored shape consistent with the frequency: weekly keeps
      // days_of_week only, monthly keeps day_of_month only, daily neither.
      merged.interval_count = Math.max(1, Math.floor(merged.interval_count || 1));
      if (merged.frequency === "weekly") {
        merged.day_of_month = null;
        merged.days_of_week = merged.days_of_week && merged.days_of_week.length > 0 ? [...new Set(merged.days_of_week)].sort((a, b) => a - b) : null;
      } else if (merged.frequency === "monthly") {
        merged.days_of_week = null;
        if (merged.day_of_month != null && (merged.day_of_month < 1 || merged.day_of_month > 31)) {
          throw new Error("Day of month must be between 1 and 31.");
        }
      } else {
        merged.days_of_week = null;
        merged.day_of_month = null;
      }

      if (!merged.title.trim()) throw new Error("A series needs a title.");
      if (merged.end_date && merged.end_date < today) throw new Error("The end date can't be in the past.");

      const scheduleChanged =
        row.frequency !== merged.frequency ||
        row.interval_count !== merged.interval_count ||
        row.day_of_month !== merged.day_of_month ||
        row.end_date !== merged.end_date ||
        JSON.stringify(row.days_of_week) !== JSON.stringify(merged.days_of_week);

      let nextDueDate = row.next_due_date;
      let active = row.active;
      if (scheduleChanged) {
        nextDueDate = await nextDueFor(ruleOf(merged), seriesId);
        // A new end date earlier than the next occurrence means there's
        // nothing left to generate — the series has ended, same as the
        // cron treats it.
        if (merged.end_date && nextDueDate > merged.end_date) active = false;
      }

      const { error: updateError } = await supabase
        .from("task_series")
        .update({
          title: merged.title.trim(),
          category: merged.category,
          priority: merged.priority,
          project_id: merged.project_id,
          estimated_minutes: merged.estimated_minutes,
          frequency: merged.frequency,
          interval_count: merged.interval_count,
          days_of_week: merged.days_of_week,
          day_of_month: merged.day_of_month,
          end_date: merged.end_date,
          next_due_date: nextDueDate,
          active,
        })
        .eq("id", seriesId);
      if (updateError) throw updateError;

      await refreshSeries();
      return { nextDueDate, ended: row.active && !active };
    },
    [supabase, fetchSeriesRow, nextDueFor, refreshSeries]
  );

  /**
   * Deletes the series definition. Every task already generated from it
   * stays in your list as an ordinary task (the database just clears its
   * link to the series), so nothing you've done or planned is lost.
   */
  const deleteSeries = useCallback(
    async (seriesId: string) => {
      const { error: deleteError } = await supabase.from("task_series").delete().eq("id", seriesId);
      if (deleteError) throw deleteError;
      await Promise.all([refreshSeries(), mutate("tasks")]);
    },
    [supabase, mutate, refreshSeries]
  );

  return {
    series: data ?? [],
    isLoading,
    error,
    createSeries,
    pauseSeries,
    resumeSeries,
    updateSeries,
    deleteSeries,
    // Kept under its original name so existing callers (the Tasks page's
    // "Stop repeating" button) keep working unchanged — it's the same
    // action as pausing, and is now undoable.
    stopSeries: pauseSeries,
  };
}