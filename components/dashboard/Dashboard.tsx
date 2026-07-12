"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Sun, Moon, Github, StickyNote,
  Clock, Quote as QuoteIcon, Circle, CheckCircle2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/shell/Sidebar";

type Task = {
  id: string;
  title: string;
  tag: string | null;
  priority: "low" | "med" | "high";
  done: boolean;
  status: "todo" | "in_progress" | "done";
};

// Still mocked — real tables/UI land in Phase 3 (habits, notes) and Phase 4 (finance).
const HABITS = [
  { name: "Coding", streak: 14, pct: 0.92 },
  { name: "Reading", streak: 21, pct: 0.85 },
  { name: "Workout", streak: 3, pct: 0.4 },
  { name: "Water", streak: 6, pct: 0.6 },
];
const NOTES = ["SENTINEL prompt architecture", "AES-GCM key rotation ideas", "Elsewhere footer lines v3"];
const WEEK = ["M", "T", "W", "T", "F", "S", "S"];
const WEEK_DOTS = [0, 1, 0, 2, 1, 0, 1];

function useTheme() {
  const [mode, setMode] = useState<"dark" | "light">("dark");
  return { mode, setMode };
}

export default function Dashboard() {
  const { mode, setMode } = useTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(t);
  }, []);

  const loadTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, tag, priority, done, status")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    if (!error && data) setTasks(data as Task[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const toggle = async (id: string, done: boolean) => {
    const nextStatus = done ? "todo" : "done";
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !done, status: nextStatus } : t)));
    await supabase.from("tasks").update({ status: nextStatus }).eq("id", id);
  };

  const greeting = useMemo(() => {
    const h = now.getHours();
    if (h < 5) return "Still up, Ramim";
    if (h < 12) return "Good morning, Ramim";
    if (h < 17) return "Good afternoon, Ramim";
    if (h < 21) return "Good evening, Ramim";
    return "Late night, Ramim";
  }, [now]);

  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const doneCount = tasks.filter((t) => t.done).length;
  const taskPct = tasks.length ? doneCount / tasks.length : 0;
  const habitAvg = HABITS.reduce((a, h) => a + h.pct, 0) / HABITS.length;
  const systemLoad = Math.round(((taskPct + habitAvg) / 2) * 100);
  const priorityColor = (p: Task["priority"]) =>
    p === "high" ? "rgb(var(--danger))" : p === "med" ? "rgb(var(--gold))" : "rgb(var(--text-muted))";

  const ringCirc = 2 * Math.PI * 26;
  const ringOffset = ringCirc - (systemLoad / 100) * ringCirc;

  return (
    <div className={mode === "light" ? "light" : ""}>
      <div
        style={{
          background: "rgb(var(--bg))",
          color: "rgb(var(--text))",
          minHeight: "600px",
          display: "flex",
          transition: "background 0.4s ease, color 0.4s ease",
          borderRadius: "20px",
          overflow: "hidden",
          border: "1px solid rgb(var(--border))",
        }}
      >
        <style>{`
          @keyframes lifeosFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes lifeosPulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
          .lifeos-card { animation: lifeosFadeUp 0.5s ease both; }
          .lifeos-navbtn:hover { background: rgb(var(--surface-2)); }
        `}</style>

        <Sidebar />

        {/* Main */}
        <div style={{ flex: 1, padding: "22px 26px", overflowY: "auto", maxHeight: "700px" }}>
          {/* Topbar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
            <div>
              <div className="font-display" style={{ fontSize: 26, fontWeight: 500 }}>{greeting}</div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4, color: "rgb(var(--text-muted))", fontSize: 13 }}>
                <span>{dateStr}</span>
                <span className="font-mono">{timeStr}</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <svg width="60" height="60" viewBox="0 0 60 60">
                  <circle cx="30" cy="30" r="26" fill="none" stroke="rgb(var(--border))" strokeWidth="4" />
                  <circle
                    cx="30" cy="30" r="26" fill="none" stroke="rgb(var(--accent))" strokeWidth="4"
                    strokeDasharray={ringCirc} strokeDashoffset={ringOffset} strokeLinecap="round"
                    transform="rotate(-90 30 30)"
                    style={{ transition: "stroke-dashoffset 0.6s ease" }}
                  />
                  <text x="30" y="34" textAnchor="middle" className="font-mono" style={{ fontSize: 12, fill: "rgb(var(--text))" }}>{systemLoad}%</text>
                </svg>
                <div className="font-mono" style={{ fontSize: 10.5, color: "rgb(var(--text-muted))", lineHeight: 1.4 }}>
                  <div style={{ color: "rgb(var(--accent))", animation: "lifeosPulse 2.4s ease-in-out infinite" }}>● SYSTEM ONLINE</div>
                </div>
              </div>

              <div
                onClick={() => setMode((m) => (m === "dark" ? "light" : "dark"))}
                style={{
                  width: 36, height: 36, borderRadius: 10, background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}
              >
                {mode === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 14 }}>
            {/* Tasks — live from Supabase */}
            <div className="lifeos-card" style={{ gridColumn: "span 7", background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Today's priorities</div>
                <div style={{ fontSize: 12, color: "rgb(var(--text-muted))" }} className="font-mono">
                  {loading ? "…" : `${doneCount}/${tasks.length}`}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {loading && <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>Loading tasks…</div>}
                {!loading && tasks.length === 0 && (
                  <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>
                    No tasks yet — add rows to the `tasks` table in Supabase, or wire up the create-task form next.
                  </div>
                )}
                {tasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => toggle(t.id, t.done)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", borderRadius: 10, cursor: "pointer", opacity: t.done ? 0.5 : 1 }}
                  >
                    {t.done ? <CheckCircle2 size={17} color="rgb(var(--accent))" /> : <Circle size={17} color="rgb(var(--text-muted))" />}
                    <span style={{ fontSize: 13.5, textDecoration: t.done ? "line-through" : "none", flex: 1 }}>{t.title}</span>
                    <span style={{ width: 6, height: 6, borderRadius: 99, background: priorityColor(t.priority), flexShrink: 0 }} />
                    {t.tag && <span style={{ fontSize: 11, color: "rgb(var(--text-muted))", minWidth: 90, textAlign: "right" }}>{t.tag}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Focus timer */}
            <div className="lifeos-card" style={{ gridColumn: "span 5", background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 18, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Focus timer</div>
                <Clock size={15} color="rgb(var(--text-muted))" />
              </div>
              <div style={{ textAlign: "center", padding: "10px 0" }}>
                <div className="font-mono" style={{ fontSize: 34, fontWeight: 500 }}>25:00</div>
                <div style={{ fontSize: 12, color: "rgb(var(--text-muted))" }}>Ready when you are</div>
              </div>
              <div style={{ textAlign: "center", padding: 8, borderRadius: 10, background: "rgb(var(--accent) / 0.15)", color: "rgb(var(--accent))", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Start session
              </div>
            </div>

            {/* Habits */}
            <div className="lifeos-card" style={{ gridColumn: "span 5", background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Habit progress</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {HABITS.map((h) => (
                  <div key={h.name}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                      <span>{h.name}</span>
                      <span className="font-mono" style={{ color: "rgb(var(--text-muted))" }}>{h.streak}d streak</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, background: "rgb(var(--surface-2))", overflow: "hidden" }}>
                      <div style={{ width: `${h.pct * 100}%`, height: "100%", background: "rgb(var(--accent))", borderRadius: 99 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Finance */}
            <div className="lifeos-card" style={{ gridColumn: "span 4", background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Finance — this month</div>
              <div className="font-mono" style={{ fontSize: 22, fontWeight: 500 }}>৳26,800</div>
              <div style={{ fontSize: 11.5, color: "rgb(var(--text-muted))" }}>saved (mock — Phase 4)</div>
            </div>

            {/* Weekly score */}
            <div className="lifeos-card" style={{ gridColumn: "span 3", background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 18 }}>
              <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))" }}>Weekly score</div>
              <div className="font-mono" style={{ fontSize: 30, fontWeight: 500 }}>82</div>
              <div style={{ fontSize: 11.5, color: "rgb(var(--accent))" }}>▲ 6 vs last week</div>
            </div>

            {/* GitHub activity */}
            <div className="lifeos-card" style={{ gridColumn: "span 5", background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Github size={15} color="rgb(var(--text-muted))" />
                <div style={{ fontSize: 14, fontWeight: 600 }}>franklingeezer</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(14, 1fr)", gap: 3 }}>
                {Array.from({ length: 28 }).map((_, i) => {
                  const level = (i * 7 + 3) % 5;
                  return (
                    <div key={i} style={{ aspectRatio: "1", borderRadius: 3, background: level === 0 ? "rgb(var(--surface-2))" : "rgb(var(--accent))", opacity: level === 0 ? 1 : 0.25 + level * 0.18 }} />
                  );
                })}
              </div>
            </div>

            {/* Calendar preview */}
            <div className="lifeos-card" style={{ gridColumn: "span 7", background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>This week</div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                {WEEK.map((d, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, color: "rgb(var(--text-muted))" }}>{d}</span>
                    <div
                      className="font-mono"
                      style={{
                        width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12.5, fontWeight: 600,
                        background: i === 6 ? "rgb(var(--accent))" : "transparent",
                        color: i === 6 ? "rgb(var(--bg))" : "rgb(var(--text))",
                        border: i === 6 ? "none" : "1px solid rgb(var(--border))",
                      }}
                    >
                      {12 - 6 + i}
                    </div>
                    <span style={{ width: 4, height: 4, borderRadius: 99, background: WEEK_DOTS[i] === 2 ? "rgb(var(--danger))" : WEEK_DOTS[i] === 1 ? "rgb(var(--gold))" : "transparent" }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Recent notes */}
            <div className="lifeos-card" style={{ gridColumn: "span 5", background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Recent notes</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {NOTES.map((n) => (
                  <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <StickyNote size={13} color="rgb(var(--text-muted))" />
                    <span>{n}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quote strip */}
            <div className="lifeos-card" style={{ gridColumn: "span 12", background: "rgb(var(--surface-2))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 }}>
              <QuoteIcon size={14} color="rgb(var(--accent))" />
              <span className="font-display" style={{ fontSize: 14.5, fontStyle: "italic", color: "rgb(var(--text-muted))" }}>
                Discipline is just motivation that remembered to show up.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
