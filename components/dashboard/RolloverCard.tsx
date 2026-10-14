"use client";

import React, { useEffect, useState } from "react";
import { CalendarClock, ArrowRight, AlertCircle } from "lucide-react";
import { useRollover } from "@/hooks/useRollover";
import { addDaysISO } from "@/lib/date";

// "15:55:00" or "15:55" -> "3:55 PM", the same 12-hour style the rest of
// the app shows times in.
function fmtClock(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

// Relative for the days that matter here (a missed block is almost always
// today or yesterday), an absolute date for anything older.
function fmtDay(iso: string, today: string): string {
  if (iso === today) return "Today";
  if (iso === addDaysISO(today, -1)) return "Yesterday";
  if (iso === addDaysISO(today, 1)) return "Tomorrow";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const REMOVE_CONFIRM_MS = 4000;

/**
 * LifeOS Roadmap — Plan My Day, Part 2d: Rollover card.
 *
 * Appears on the Dashboard only when a calendar block set aside for a task
 * has gone by with the task unfinished, and disappears the moment there's
 * nothing to act on. Never nags otherwise — it renders nothing at all when
 * there are no missed blocks, and nothing if the check itself fails (it's
 * a convenience, not something worth an error banner on the home page).
 *
 * Every row is a choice, never an automatic move: Move puts the block in
 * the proposed slot, Remove deletes the block (the task is untouched).
 */
export default function RolloverCard() {
  const { data, isLoading, error, busy, actionError, missedCount, reschedule, drop } = useRollover();

  // Remove deletes a calendar event, so it gets the same two-click
  // confirmation the rest of the app uses for deletes — and, like them,
  // the "armed" state wears off on its own rather than lingering.
  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null);
  useEffect(() => {
    if (!confirmingRemove) return;
    const t = setTimeout(() => setConfirmingRemove(null), REMOVE_CONFIRM_MS);
    return () => clearTimeout(t);
  }, [confirmingRemove]);

  if (isLoading || error || !data || missedCount === 0) return null;

  const { proposals, unplaceable, starts_from, today } = data;

  const handleRemove = async (eventId: string) => {
    if (confirmingRemove !== eventId) {
      setConfirmingRemove(eventId);
      return;
    }
    setConfirmingRemove(null);
    await drop(eventId);
  };

  const removeButton = (eventId: string) => {
    const armed = confirmingRemove === eventId;
    return (
      <button
        onClick={() => handleRemove(eventId)}
        disabled={busy}
        style={{
          padding: "5px 10px", borderRadius: 8, fontSize: 11.5, fontWeight: 600, border: "1px solid rgb(var(--border))",
          background: armed ? "rgb(var(--danger))" : "transparent",
          color: armed ? "rgb(var(--bg))" : "rgb(var(--text-muted))",
          cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
        }}
      >
        {armed ? "Sure?" : "Remove"}
      </button>
    );
  };

  return (
    <div
      className="lifeos-card"
      style={{
        marginBottom: 22, background: "rgb(var(--surface))", border: "1px solid rgb(var(--gold) / 0.4)", borderRadius: 16, padding: 18,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600 }}>
          <CalendarClock size={14} color="rgb(var(--gold))" />
          Missed blocks
          <span className="font-mono" style={{ fontSize: 11, color: "rgb(var(--text-muted))", fontWeight: 500 }}>{missedCount}</span>
        </div>
        {proposals.length > 1 && (
          <button
            onClick={() => reschedule(proposals)}
            disabled={busy}
            style={{
              padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none",
              background: "rgb(var(--accent))", color: "rgb(var(--bg))", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "Moving…" : `Move all ${proposals.length}`}
          </button>
        )}
      </div>

      <div style={{ fontSize: 11.5, color: "rgb(var(--text-muted))", marginBottom: 12 }}>
        {starts_from === "tomorrow"
          ? "These didn't get done. Proposed for tomorrow, since the day is winding down."
          : "These didn't get done. Proposed for the next open time."}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {proposals.map((p) => (
          <div
            key={p.event_id}
            style={{
              display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 12px", borderRadius: 10,
              background: "rgb(var(--surface-2))", border: "1px solid rgb(var(--border))",
            }}
          >
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.title}</div>
              <div className="font-mono" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 11, color: "rgb(var(--text-muted))", marginTop: 3 }}>
                <span style={{ textDecoration: "line-through", opacity: 0.8 }}>
                  {fmtDay(p.date, today)} {fmtClock(p.start_time)}
                </span>
                <ArrowRight size={11} />
                <span style={{ color: "rgb(var(--accent))" }}>
                  {fmtDay(p.candidate.date, today)} {fmtClock(p.candidate.start_time)} – {fmtClock(p.candidate.end_time)}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                onClick={() => reschedule([p])}
                disabled={busy}
                style={{
                  padding: "5px 12px", borderRadius: 8, fontSize: 11.5, fontWeight: 600, border: "none",
                  background: "rgb(var(--accent))", color: "rgb(var(--bg))", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
                }}
              >
                Move
              </button>
              {removeButton(p.event_id)}
            </div>
          </div>
        ))}

        {/* Couldn't be placed anywhere in the search window — shown with the reason, and the only action offered is Remove. */}
        {unplaceable.map((u) => (
          <div
            key={u.event_id}
            style={{
              display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 12px", borderRadius: 10,
              background: "rgb(var(--surface-2))", border: "1px solid rgb(var(--border))",
            }}
          >
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{u.title}</div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 5, fontSize: 11.5, color: "rgb(var(--text-muted))", marginTop: 3 }}>
                <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{u.reason}</span>
              </div>
            </div>
            {removeButton(u.event_id)}
          </div>
        ))}
      </div>

      {actionError && (
        <div style={{ fontSize: 12, color: "rgb(var(--danger))", marginTop: 10 }}>{actionError}</div>
      )}
    </div>
  );
}