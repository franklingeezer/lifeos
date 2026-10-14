"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { createClient } from "@/lib/supabase/client";
import { todayISO } from "@/lib/date";
import type { DayPlan, PlannedBlock } from "@/lib/scheduler";

// The same blue the Tasks page uses for a block created by accepting a scheduling
// proposal (TasksPage.handleAcceptSlot) — a block placed by Plan My Day is
// the same kind of thing and should look the same on the Calendar.
const SCHEDULED_BLOCK_COLOR = "#6C8EF5";

const MIN_ESTIMATE = 5;
const MAX_ESTIMATE = 600;

/**
 * LifeOS Roadmap — Plan My Day, Part 1c.
 *
 * On-demand, not SWR-cached: a plan is a proposal made at a specific
 * moment against a specific calendar, so showing a stale one on page
 * focus or re-mount would be misleading ("15:45 is free" stops being
 * true at 15:46). The caller decides when to ask for a fresh one.
 *
 * Client-side and direct-to-Supabase for the writes, same as useTaskSeries
 * and useCalendar — RLS already scopes everything to the caller, and
 * accepting a proposal is an ordinary calendar-event insert.
 */
export function usePlanDay() {
  const supabase = useMemo(() => createClient(), []);
  const { mutate } = useSWRConfig();

  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptedBlocks, setAcceptedBlocks] = useState<PlannedBlock[]>([]);

  // A ref, not just state: two fast clicks can both read `accepting` as
  // false before React re-renders, and double-inserting a day's worth of
  // calendar blocks is exactly the kind of mistake worth a hard guard.
  const acceptingRef = useRef(false);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plan-day", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Couldn't build a plan right now.");
      setPlan(data as DayPlan);
      return data as DayPlan;
    } catch (e) {
      setPlan(null);
      setError(e instanceof Error ? e.message : "Couldn't build a plan right now.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Turns proposed blocks into real Calendar events (tagged with
   * events.task_id, so a block always traces back to its task).
   *
   * Re-checks the calendar for existing blocks before inserting: the plan
   * on screen could be minutes old, or the same plan could be open in a
   * second tab, and "accept" must never create a duplicate block for a
   * task that already got one in the meantime. Anything already blocked
   * is quietly left out; the return value says how many were actually
   * created vs. skipped for that reason.
   */
  const acceptBlocks = useCallback(
    async (blocks: PlannedBlock[]) => {
      if (acceptingRef.current || blocks.length === 0) return { created: 0, skippedExisting: 0 };
      acceptingRef.current = true;
      setAccepting(true);
      setError(null);

      try {
        const taskIds = blocks.map((b) => b.task_id);

        const [{ data: existing, error: existingError }, { data: taskRows, error: tasksError }] = await Promise.all([
          supabase.from("events").select("task_id").in("task_id", taskIds).gte("date", todayISO()),
          supabase.from("tasks").select("id, project_id").in("id", taskIds),
        ]);
        if (existingError) throw existingError;
        if (tasksError) throw tasksError;

        const alreadyBlocked = new Set((existing ?? []).map((e) => e.task_id as string));
        const projectByTask = new Map((taskRows ?? []).map((t) => [t.id as string, (t.project_id as string | null) ?? null]));

        const toCreate = blocks.filter((b) => !alreadyBlocked.has(b.task_id));
        const skippedExisting = blocks.length - toCreate.length;

        if (toCreate.length > 0) {
          const { error: insertError } = await supabase.from("events").insert(
            toCreate.map((b) => ({
              title: b.title,
              date: b.candidate.date,
              color: SCHEDULED_BLOCK_COLOR,
              all_day: false,
              project_id: projectByTask.get(b.task_id) ?? null,
              start_time: b.candidate.start_time,
              end_time: b.candidate.end_time,
              task_id: b.task_id,
            }))
          );
          if (insertError) throw insertError;

          // Refresh the shared Calendar cache (keyed the same way
          // useCalendar.ts keys it) so the new blocks show up on the
          // Calendar page immediately, without a reload.
          await mutate("calendar");
          setAcceptedBlocks((prev) => [...prev, ...toCreate]);
        }

        // Re-plan so the panel reflects reality: accepted tasks now show
        // as "already scheduled", and the rest are re-fitted around them.
        await fetchPlan();

        return { created: toCreate.length, skippedExisting };
      } catch (e) {
        setError("Couldn't add those blocks to your calendar — try again.");
        console.error("usePlanDay: accept failed", e);
        return { created: 0, skippedExisting: 0 };
      } finally {
        acceptingRef.current = false;
        setAccepting(false);
      }
    },
    [supabase, mutate, fetchPlan]
  );

  /**
   * Sets a task's time estimate (the thing that makes it placeable) and
   * re-plans. Same column the Tasks page edits, so this is just a faster
   * path to the same field, not a second source of truth.
   */
  const setEstimate = useCallback(
    async (taskId: string, minutes: number) => {
      if (!Number.isInteger(minutes) || minutes < MIN_ESTIMATE || minutes > MAX_ESTIMATE) return false;
      setError(null);
      const { error: updateError } = await supabase.from("tasks").update({ estimated_minutes: minutes }).eq("id", taskId);
      if (updateError) {
        setError("Couldn't save that estimate — try again.");
        return false;
      }
      await mutate("tasks"); // keep the Tasks page's own cache in step
      await fetchPlan();
      return true;
    },
    [supabase, mutate, fetchPlan]
  );

  const reset = useCallback(() => {
    setPlan(null);
    setError(null);
    setAcceptedBlocks([]);
  }, []);

  return { plan, loading, error, accepting, acceptedBlocks, fetchPlan, acceptBlocks, setEstimate, reset };
}