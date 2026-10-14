"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { createClient } from "@/lib/supabase/client";
import type { RolloverPlan, RolloverProposal } from "@/lib/rollover";

export type RolloverData = RolloverPlan & { today: string };

// Exported so anything that changes the calendar or a task's status can
// `mutate(ROLLOVER_KEY)` and have the card update immediately, instead of
// waiting for the next refresh interval — same pattern as
// GITHUB_ACTIVITY_KEY in useGithubActivity.
export const ROLLOVER_KEY = "/api/rollover";

async function fetchRollover(): Promise<RolloverData> {
  const res = await fetch(ROLLOVER_KEY, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to check for missed blocks");
  return res.json();
}

/**
 * LifeOS Roadmap — Plan My Day, Part 2c: Rollover.
 *
 * Reads missed-block proposals from /api/rollover (rule-based, no AI) and
 * applies the user's choice for each one:
 *   - reschedule: MOVES the existing event to the proposed slot (one
 *     block per task — the missed time isn't left behind as a ghost), or
 *   - drop: removes the missed block (the task itself is never touched).
 *
 * Direct-to-Supabase writes, same as usePlanDay and useCalendar — RLS
 * scopes everything to the caller. Both actions are keyed by event id, so
 * repeating one (a double-click, a second open tab) is harmless: moving an
 * already-moved event or deleting an already-deleted one changes nothing.
 */
export function useRollover() {
  const supabase = useMemo(() => createClient(), []);
  const { mutate } = useSWRConfig();

  // Proposals depend on "now" — a slot that was free at 2:25 may not be at
  // 2:40 — so refresh on a modest interval as well as on focus (SWR default).
  const { data, error, isLoading } = useSWR<RolloverData>(ROLLOVER_KEY, fetchRollover, {
    refreshInterval: 5 * 60 * 1000,
  });

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const busyRef = useRef(false); // hard guard against double-clicks, same reasoning as usePlanDay

  const refresh = useCallback(async () => {
    await Promise.all([mutate("calendar"), mutate(ROLLOVER_KEY)]);
  }, [mutate]);

  /**
   * Moves each block to its proposed slot. Skips any whose task was
   * completed since the proposal was made (rescheduling finished work
   * would just be noise). Returns how many moved and how many failed.
   */
  const reschedule = useCallback(
    async (proposals: RolloverProposal[]) => {
      if (busyRef.current || proposals.length === 0) return { moved: 0, failed: 0 };
      busyRef.current = true;
      setBusy(true);
      setActionError(null);

      try {
        const { data: tasks, error: tasksError } = await supabase
          .from("tasks")
          .select("id, status")
          .in("id", [...new Set(proposals.map((p) => p.task_id))]);
        if (tasksError) throw tasksError;

        const doneIds = new Set((tasks ?? []).filter((t) => t.status === "done").map((t) => t.id as string));
        const toMove = proposals.filter((p) => !doneIds.has(p.task_id));

        const results = await Promise.all(
          toMove.map((p) =>
            supabase
              .from("events")
              .update({ date: p.candidate.date, start_time: p.candidate.start_time, end_time: p.candidate.end_time })
              .eq("id", p.event_id)
          )
        );

        const failed = results.filter((r) => r.error).length;
        if (failed > 0) setActionError(`Couldn't move ${failed} block${failed === 1 ? "" : "s"} — try again.`);

        await refresh();
        return { moved: toMove.length - failed, failed };
      } catch (e) {
        console.error("useRollover: reschedule failed", e);
        setActionError("Couldn't reschedule those blocks — try again.");
        return { moved: 0, failed: proposals.length };
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [supabase, refresh]
  );

  /** Removes a missed block from the calendar. The task it was for is left exactly as it is. */
  const drop = useCallback(
    async (eventId: string) => {
      if (busyRef.current) return false;
      busyRef.current = true;
      setBusy(true);
      setActionError(null);

      try {
        const { error: deleteError } = await supabase.from("events").delete().eq("id", eventId);
        if (deleteError) throw deleteError;
        await refresh();
        return true;
      } catch (e) {
        console.error("useRollover: drop failed", e);
        setActionError("Couldn't remove that block — try again.");
        return false;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [supabase, refresh]
  );

  const missedCount = data ? data.proposals.length + data.unplaceable.length : 0;

  return { data, error, isLoading, busy, actionError, missedCount, reschedule, drop };
}