"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Compass, Clock, ListTodo, FolderKanban, Flame, StickyNote,
  CalendarClock, CalendarCheck, CheckCircle2, X, RefreshCw,
} from "lucide-react";
import { useAIContent } from "@/hooks/useAIContent";
import { usePlanDay } from "@/hooks/usePlanDay";
import { AIErrorBox, RegenerateButton } from "./shared";

type FocusItem = {
  order: number;
  type: "task" | "project" | "habit" | "note";
  ref_id: string | null;
  title: string;
  reason: string;
};
type TodayFocus = { headline: string; focus_items: FocusItem[]; created_at: string };

// Each item's icon/color reflects which module it came from — the whole
// point of Today Brain is that one plan can draw from Tasks, Projects,
// Habits, and Journal at once, so it should still be visually obvious at
// a glance which is which, same as the color-by-priority pattern Prioritize
// already uses.
const TYPE_META: Record<FocusItem["type"], { icon: React.ElementType; color: string; label: string }> = {
  task: { icon: ListTodo, color: "rgb(var(--danger))", label: "Task" },
  project: { icon: FolderKanban, color: "rgb(var(--gold))", label: "Project" },
  habit: { icon: Flame, color: "rgb(var(--accent))", label: "Habit" },
  note: { icon: StickyNote, color: "rgb(var(--text-muted))", label: "Signal" },
};

// Quick-pick estimates for tasks Plan My Day had to skip. A fixed handful
// of chips rather than a free-text box: the point is a one-tap fix, and
// anything unusual can still be set precisely from the Tasks page.
const ESTIMATE_CHIPS = [15, 30, 60, 90];

function fmtMinutes(total: number): string {
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// "15:45" -> "3:45 PM", matching the 12-hour style the rest of the app
// already shows times in (e.g. the "Generated 3:41 PM" line below).
function fmtClock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export default function TodayTab() {
  const { data, error, isLoading, regenerating, regenerate } = useAIContent<TodayFocus>("/api/today-focus");
  const {
    plan, loading: planLoading, error: planError, accepting, acceptedBlocks,
    fetchPlan, acceptBlocks, setEstimate, reset,
  } = usePlanDay();

  const [planOpen, setPlanOpen] = useState(false);
  // Tracks what the user has *unchecked*, not what's checked — so a
  // re-plan (after setting an estimate, say) keeps their choices instead
  // of silently re-checking everything.
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [savingEstimateFor, setSavingEstimateFor] = useState<string | null>(null);

  const items = data?.focus_items ?? [];
  const focusBusy = isLoading || regenerating;
  const canPlan = !focusBusy && !error && !!data;

  const openPlan = () => {
    setPlanOpen(true);
    setDeselected(new Set());
    setNotice(null);
    void fetchPlan();
  };

  const closePlan = () => {
    setPlanOpen(false);
    setNotice(null);
    reset();
  };

  // A regenerated focus plan can reorder or replace the tasks, so any
  // proposal built from the old one is stale — close it rather than leave
  // it showing times for a plan that no longer exists.
  const handleRegenerate = () => {
    closePlan();
    void regenerate();
  };

  const toggleBlock = (taskId: string) => {
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const selectedBlocks = (plan?.blocks ?? []).filter((b) => !deselected.has(b.task_id));

  const handleAccept = async () => {
    setNotice(null);
    const { created, skippedExisting } = await acceptBlocks(selectedBlocks);
    if (created > 0) {
      setNotice(
        `Added ${created} block${created === 1 ? "" : "s"} to your calendar.` +
          (skippedExisting > 0 ? ` ${skippedExisting} already had one, so ${skippedExisting === 1 ? "it was" : "they were"} left alone.` : "")
      );
    } else if (skippedExisting > 0) {
      setNotice("Those tasks already have a block on your calendar.");
    }
  };

  const handleEstimate = async (taskId: string, minutes: number) => {
    setSavingEstimateFor(taskId);
    try {
      await setEstimate(taskId, minutes);
    } finally {
      setSavingEstimateFor(null);
    }
  };

  const overbooked = !!plan && plan.needed_minutes > plan.free_minutes;
  const nothingToPlace = !!plan && plan.blocks.length === 0 && plan.skipped.length === 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <button
          onClick={planOpen ? closePlan : openPlan}
          disabled={!canPlan}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10,
            background: planOpen ? "rgb(var(--surface))" : "rgb(var(--accent))",
            color: planOpen ? "rgb(var(--text))" : "rgb(var(--bg))",
            border: planOpen ? "1px solid rgb(var(--border))" : "none",
            fontSize: 12.5, fontWeight: 600, cursor: canPlan ? "pointer" : "default", opacity: canPlan ? 1 : 0.5,
          }}
        >
          <CalendarClock size={14} /> {planOpen ? "Close plan" : "Plan my day"}
        </button>
        <RegenerateButton onClick={handleRegenerate} busy={regenerating || isLoading} />
      </div>

      <div style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 24, minHeight: 220 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgb(var(--accent))", marginBottom: 16 }}>
          <Compass size={16} />
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>Today's Focus</span>
        </div>

        {(isLoading || regenerating) && (
          <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>
            {regenerating ? "Rebuilding your plan…" : "Reading across your day…"}
          </div>
        )}

        {!isLoading && !regenerating && error && <AIErrorBox message={error} />}

        {!isLoading && !regenerating && !error && data && (
          <>
            {data.headline && (
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 18 }}>{data.headline}</div>
            )}

            {items.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))", padding: 16, textAlign: "center" }}>
                Nothing urgent on the board right now.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((item) => {
                  const meta = TYPE_META[item.type];
                  const Icon = meta.icon;
                  return (
                    <div
                      key={`${item.type}-${item.ref_id ?? item.order}`}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderRadius: 10,
                        background: "rgb(var(--surface-2))", border: "1px solid rgb(var(--border))",
                      }}
                    >
                      <div
                        className="font-mono"
                        style={{ fontSize: 11, color: "rgb(var(--text-muted))", flexShrink: 0, marginTop: 2, width: 16, textAlign: "center" }}
                      >
                        {item.order}
                      </div>
                      <Icon size={15} color={meta.color} style={{ flexShrink: 0, marginTop: 1 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{item.title}</span>
                          <span
                            className="font-mono"
                            style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.4, color: meta.color, opacity: 0.85 }}
                          >
                            {meta.label.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: 11.5, color: "rgb(var(--text-muted))", marginTop: 2 }}>{item.reason}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {data?.created_at && !isLoading && !error && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 20, fontSize: 10.5, color: "rgb(var(--text-muted))" }}>
            <Clock size={11} /> Generated {new Date(data.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </div>
        )}
      </div>

      {/* Roadmap — Plan My Day, Part 1d/1e. Rule-based proposal built from the focus plan above; nothing is written until "Add to calendar". */}
      {planOpen && (
        <div style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 24, marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgb(var(--accent))" }}>
              <CalendarClock size={16} />
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>Plan for today</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                onClick={() => { setNotice(null); void fetchPlan(); }}
                disabled={planLoading || accepting}
                aria-label="Re-plan"
                title="Re-plan from now"
                style={{ display: "flex", alignItems: "center", padding: 6, borderRadius: 8, background: "transparent", border: "1px solid rgb(var(--border))", color: "rgb(var(--text-muted))", cursor: planLoading || accepting ? "default" : "pointer" }}
              >
                <RefreshCw size={12} className={planLoading ? "spin" : ""} />
              </button>
              <button
                onClick={closePlan}
                aria-label="Close plan"
                style={{ display: "flex", alignItems: "center", padding: 6, borderRadius: 8, background: "transparent", border: "1px solid rgb(var(--border))", color: "rgb(var(--text-muted))", cursor: "pointer" }}
              >
                <X size={12} />
              </button>
            </div>
          </div>

          {planLoading && !plan && (
            <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>Finding room in your day…</div>
          )}

          {planError && <AIErrorBox message={planError} />}

          {plan && (
            <>
              {/* Capacity line: what needs placing vs. what's actually free from now. */}
              {plan.needed_minutes > 0 && (
                <div
                  style={{
                    fontSize: 12, marginBottom: 14, padding: "8px 12px", borderRadius: 8,
                    background: overbooked ? "rgb(var(--gold) / 0.12)" : "rgb(var(--surface-2))",
                    border: `1px solid ${overbooked ? "rgb(var(--gold) / 0.35)" : "rgb(var(--border))"}`,
                    color: overbooked ? "rgb(var(--gold))" : "rgb(var(--text-muted))",
                  }}
                >
                  {overbooked
                    ? `Needs ${fmtMinutes(plan.needed_minutes)}, but only ${fmtMinutes(plan.free_minutes)} is free from now — something won't fit.`
                    : `Needs ${fmtMinutes(plan.needed_minutes)} · ${fmtMinutes(plan.free_minutes)} free from now.`}
                </div>
              )}

              {nothingToPlace && (
                <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))", padding: 12, textAlign: "center" }}>
                  Today's focus plan has no tasks to place on the calendar.
                </div>
              )}

              {/* Proposed blocks */}
              {plan.blocks.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                  {plan.blocks.map((b) => {
                    const checked = !deselected.has(b.task_id);
                    return (
                      <label
                        key={b.task_id}
                        style={{
                          display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                          background: "rgb(var(--surface-2))", border: `1px solid ${checked ? "rgb(var(--accent) / 0.45)" : "rgb(var(--border))"}`,
                          opacity: checked ? 1 : 0.6,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleBlock(b.task_id)}
                          style={{ accentColor: "rgb(var(--accent))", flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{b.title}</div>
                          <div className="font-mono" style={{ fontSize: 11, color: "rgb(var(--text-muted))", marginTop: 2 }}>
                            {fmtClock(b.candidate.start_time)} – {fmtClock(b.candidate.end_time)} · {fmtMinutes(b.estimated_minutes)}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Tasks that couldn't be placed, with a one-tap fix where there is one. */}
              {plan.skipped.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                  {plan.skipped.map((s) => {
                    const justAdded = acceptedBlocks.find((b) => b.task_id === s.task_id);
                    return (
                      <div
                        key={s.task_id}
                        style={{ padding: "12px 14px", borderRadius: 10, background: "rgb(var(--surface-2))", border: "1px solid rgb(var(--border))" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {s.code === "already_scheduled" && <CheckCircle2 size={14} color="rgb(var(--accent))" style={{ flexShrink: 0 }} />}
                          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{s.title}</span>
                        </div>
                        <div style={{ fontSize: 11.5, color: "rgb(var(--text-muted))", marginTop: 2 }}>
                          {s.code === "already_scheduled" && justAdded
                            ? `Scheduled ${fmtClock(justAdded.candidate.start_time)} – ${fmtClock(justAdded.candidate.end_time)}.`
                            : s.reason}
                        </div>

                        {s.code === "no_estimate" && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                            <span style={{ fontSize: 11, color: "rgb(var(--text-muted))" }}>How long will it take?</span>
                            {ESTIMATE_CHIPS.map((m) => (
                              <button
                                key={m}
                                onClick={() => handleEstimate(s.task_id, m)}
                                disabled={savingEstimateFor !== null || planLoading || accepting}
                                className="font-mono"
                                style={{
                                  padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                                  background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", color: "rgb(var(--text))",
                                  cursor: savingEstimateFor !== null ? "default" : "pointer",
                                  opacity: savingEstimateFor === s.task_id ? 0.5 : 1,
                                }}
                              >
                                {fmtMinutes(m)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {notice && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, marginBottom: 14, color: "rgb(var(--accent))" }}>
                  <CalendarCheck size={14} style={{ flexShrink: 0 }} />
                  <span>{notice}</span>
                  <Link href="/calendar" style={{ marginLeft: 4, fontWeight: 600, textDecoration: "underline", color: "inherit" }}>
                    View calendar
                  </Link>
                </div>
              )}

              {plan.blocks.length > 0 && (
                <button
                  onClick={handleAccept}
                  disabled={accepting || selectedBlocks.length === 0}
                  style={{
                    width: "100%", padding: "10px", borderRadius: 10, background: "rgb(var(--accent))", color: "rgb(var(--bg))",
                    fontWeight: 600, fontSize: 13, border: "none",
                    cursor: accepting || selectedBlocks.length === 0 ? "default" : "pointer",
                    opacity: accepting || selectedBlocks.length === 0 ? 0.6 : 1,
                  }}
                >
                  {accepting
                    ? "Adding…"
                    : selectedBlocks.length === 0
                      ? "Select a block to add"
                      : `Add ${selectedBlocks.length} block${selectedBlocks.length === 1 ? "" : "s"} to calendar`}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}