"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, X, Flame, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toLocalISODate } from "@/lib/date";
import Sidebar from "@/components/shell/Sidebar";

type Habit = { id: string; name: string; color: string };
type HabitLog = { id: string; habit_id: string; date: string; completed: boolean };

const SWATCHES = ["#5EA8A0", "#D4A857", "#C57B6B", "#6C8EF5", "#9B8AC4"];
const GRID_DAYS = 35;

const toISODate = toLocalISODate;
const todayISO = toISODate(new Date());

function lastNDays(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(toISODate(d));
  }
  return out;
}

function currentStreak(dates: Set<string>): number {
  let streak = 0;
  const cursor = new Date();
  if (!dates.has(toISODate(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (dates.has(toISODate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function longestStreak(dates: Set<string>): number {
  if (dates.size === 0) return 0;
  const sorted = Array.from(dates).sort();
  let longest = 1, run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + "T00:00:00");
    const curr = new Date(sorted[i] + "T00:00:00");
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    run = diffDays === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  return longest;
}

export default function HabitsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(SWATCHES[0]);

  const days = useMemo(() => lastNDays(GRID_DAYS), []);

  const load = useCallback(async () => {
    const [{ data: h }, { data: l }] = await Promise.all([
      supabase.from("habits").select("id, name, color").order("created_at", { ascending: true }),
      supabase.from("habit_logs").select("id, habit_id, date, completed").eq("completed", true),
    ]);
    if (h) setHabits(h as Habit[]);
    if (l) setLogs(l as HabitLog[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const datesFor = (habitId: string) => new Set(logs.filter((l) => l.habit_id === habitId).map((l) => l.date));

  const toggleDay = async (habitId: string, date: string) => {
    if (date > todayISO) return; // no marking the future
    const isCompleted = logs.some((l) => l.habit_id === habitId && l.date === date);
    if (isCompleted) {
      setLogs((prev) => prev.filter((l) => !(l.habit_id === habitId && l.date === date)));
      await supabase.from("habit_logs").delete().eq("habit_id", habitId).eq("date", date);
    } else {
      setLogs((prev) => [...prev, { id: `optimistic-${habitId}-${date}`, habit_id: habitId, date, completed: true }]);
      const { data, error } = await supabase
        .from("habit_logs")
        .upsert({ habit_id: habitId, date, completed: true }, { onConflict: "habit_id,date" })
        .select()
        .single();
      if (!error && data) {
        setLogs((prev) => prev.map((l) => (l.id === `optimistic-${habitId}-${date}` ? (data as HabitLog) : l)));
      }
    }
  };

  const createHabit = async () => {
    if (!newName.trim()) return;
    const { data, error } = await supabase.from("habits").insert({ name: newName.trim(), color: newColor }).select().single();
    if (!error && data) setHabits((prev) => [...prev, data as Habit]);
    setNewName("");
    setNewColor(SWATCHES[0]);
    setShowCreate(false);
  };

  const deleteHabit = async (id: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
    setLogs((prev) => prev.filter((l) => l.habit_id !== id));
    await supabase.from("habits").delete().eq("id", id);
  };

  return (
    <div style={{ background: "rgb(var(--bg))", color: "rgb(var(--text))", minHeight: "600px", display: "flex", borderRadius: 20, overflow: "hidden", border: "1px solid rgb(var(--border))", position: "relative" }}>
      <style>{`
        .lifeos-navbtn:hover { background: rgb(var(--surface-2)); }
        .habit-card:hover { border-color: rgb(var(--accent) / 0.4); }
        .day-sq:hover { outline: 1px solid rgb(var(--text-muted)); }
        .icon-btn:hover { background: rgb(var(--surface-2)); }
      `}</style>

      <Sidebar />

      <div style={{ flex: 1, padding: "22px 26px", overflowY: "auto", maxHeight: "700px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div className="font-display" style={{ fontSize: 24, fontWeight: 500 }}>Habits</div>
          <button
            onClick={() => setShowCreate(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: "rgb(var(--accent))", color: "rgb(var(--bg))", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}
          >
            <Plus size={15} /> New habit
          </button>
        </div>

        {loading && <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>Loading habits…</div>}
        {!loading && habits.length === 0 && <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>No habits yet — add your first one.</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {habits.map((h) => {
            const dates = datesFor(h.id);
            const streak = currentStreak(dates);
            const longest = longestStreak(dates);
            const last30 = days.slice(-30);
            const completedLast30 = last30.filter((d) => dates.has(d)).length;
            const rate = Math.round((completedLast30 / 30) * 100);

            return (
              <div key={h.id} className="habit-card" style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 99, background: h.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{h.name}</span>
                    {streak >= 7 && (
                      <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10.5, background: "rgb(var(--gold) / 1)", color: "rgb(var(--bg))", padding: "2px 7px", borderRadius: 99, fontWeight: 700 }}>
                        <Flame size={10} /> {streak}d
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <Stat label="Streak" value={streak} />
                    <Stat label="Longest" value={longest} />
                    <Stat label="30d rate" value={`${rate}%`} />
                    <button onClick={() => deleteHabit(h.id)} className="icon-btn" style={{ width: 26, height: 26, borderRadius: 7, background: "transparent", border: "1px solid rgb(var(--border))", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                      <Trash2 size={12} color="rgb(var(--danger))" />
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                  {days.map((d) => {
                    const done = dates.has(d);
                    return (
                      <div
                        key={d}
                        className="day-sq"
                        onClick={() => toggleDay(h.id, d)}
                        title={`${d}${done ? " — done" : ""}`}
                        style={{
                          width: 16, height: 16, borderRadius: 4, cursor: d > todayISO ? "default" : "pointer",
                          background: done ? h.color : "rgb(var(--surface-2))",
                          opacity: d > todayISO ? 0.3 : 1,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showCreate && (
        <div onClick={() => setShowCreate(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 22, width: 320 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>New habit</span>
              <X size={16} style={{ cursor: "pointer", color: "rgb(var(--text-muted))" }} onClick={() => setShowCreate(false)} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11.5, color: "rgb(var(--text-muted))", marginBottom: 5 }}>Name</div>
              <input
                autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createHabit()}
                placeholder="e.g. Coding"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: "rgb(var(--surface-2))", border: "1px solid rgb(var(--border))", color: "rgb(var(--text))", fontSize: 13, outline: "none" }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11.5, color: "rgb(var(--text-muted))", marginBottom: 5 }}>Color</div>
              <div style={{ display: "flex", gap: 8 }}>
                {SWATCHES.map((c) => (
                  <div key={c} onClick={() => setNewColor(c)} style={{ width: 24, height: 24, borderRadius: 99, background: c, cursor: "pointer", border: newColor === c ? "2px solid rgb(var(--text))" : "2px solid transparent" }} />
                ))}
              </div>
            </div>
            <button onClick={createHabit} style={{ width: "100%", padding: "10px", borderRadius: 10, background: "rgb(var(--accent))", color: "rgb(var(--bg))", fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer" }}>
              Create habit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div className="font-mono" style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: 9.5, color: "rgb(var(--text-muted))" }}>{label}</div>
    </div>
  );
}