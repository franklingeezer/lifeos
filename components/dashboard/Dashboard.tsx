"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Sun, Moon, StickyNote, Sparkles,
  Circle, CheckCircle2, FolderKanban, ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toLocalISODate } from "@/lib/date";
import Sidebar from "@/components/shell/Sidebar";

type Task = {
  id: string;
  title: string;
  tag: string | null;
  priority: "low" | "med" | "high";
  done: boolean;
  status: "todo" | "in_progress" | "done";
};

type HabitRow = { name: string; streak: number; pct: number };
type Note = { id: string; title: string };
type ProjectRow = { name: string; progress: number };

const THEME_KEY = "lifeos-theme";
const DEFAULT_NAME = "Chief";
const WEEK_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

const isoDate = toLocalISODate;

function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const set = new Set(dates);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let cursor = new Date(today);
  if (!set.has(isoDate(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!set.has(isoDate(cursor))) return 0;
  }
  let streak = 0;
  while (set.has(isoDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default function Dashboard() {
  const supabase = useMemo(() => createClient(), []);
  const [theme, setThemeState] = useState<"dark" | "light">("dark");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [displayName, setDisplayName] = useState(DEFAULT_NAME);
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [netThisMonth, setNetThisMonth] = useState(0);
  const [briefTeaser, setBriefTeaser] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [eventDays, setEventDays] = useState<Set<string>>(new Set());
  const [recentNotes, setRecentNotes] = useState<Note[]>([]);

  useEffect(() => {
    const savedTheme = typeof window !== "undefined" ? localStorage.getItem(THEME_KEY) : null;
    setThemeState(savedTheme === "light" ? "light" : "dark");
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setThemeState(next);
    localStorage.setItem(THEME_KEY, next);
    document.documentElement.classList.toggle("light", next === "light");
  };

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

  const loadRest = useCallback(async () => {
    const today = new Date();
    const monthStart = isoDate(new Date(today.getFullYear(), today.getMonth(), 1));
    const monthEndExclusive = isoDate(new Date(today.getFullYear(), today.getMonth() + 1, 1));
    const weekStart = new Date(today);
    const dayOfWeek = (today.getDay() + 6) % 7; // 0 = Monday
    weekStart.setDate(today.getDate() - dayOfWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const [
      { data: settingsRow },
      { data: habitsData },
      { data: financeRows },
      { data: briefRow },
      { data: projectsData },
      { data: eventsData },
      { data: notesData },
    ] = await Promise.all([
      supabase.from("app_settings").select("display_name").eq("id", 1).maybeSingle(),
      supabase.from("habits").select("id, name"),
      supabase.from("finance_transactions").select("type, amount_bdt").gte("occurred_on", monthStart).lt("occurred_on", monthEndExclusive),
      supabase.from("ai_briefs").select("content").eq("brief_date", isoDate(today)).maybeSingle(),
      supabase.from("projects").select("name, progress").eq("status", "active").order("progress", { ascending: false }).limit(4),
      supabase.from("events").select("date").gte("date", isoDate(weekStart)).lte("date", isoDate(weekEnd)),
      supabase.from("notes").select("id, title").order("updated_at", { ascending: false }).limit(3),
    ]);

    if (settingsRow?.display_name) setDisplayName(settingsRow.display_name);

    if (habitsData && habitsData.length > 0) {
      const habitIds = habitsData.map((h) => h.id);
      const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 60);
      const { data: logs } = await supabase
        .from("habit_logs")
        .select("habit_id, date")
        .in("habit_id", habitIds)
        .eq("completed", true)
        .gte("date", isoDate(cutoff));
      const d30 = new Date(today); d30.setDate(d30.getDate() - 29);
      setHabits(
        habitsData.map((h) => {
          const allDates = (logs ?? []).filter((l) => l.habit_id === h.id).map((l) => l.date);
          const in30 = allDates.filter((d) => d >= isoDate(d30));
          return { name: h.name, streak: computeStreak(allDates), pct: in30.length / 30 };
        })
      );
    }

    const net = (financeRows ?? []).reduce((sum, t) => {
      if (t.type === "income") return sum + Number(t.amount_bdt);
      if (t.type === "expense" || t.type === "savings" || t.type === "investment") return sum - Number(t.amount_bdt);
      return sum;
    }, 0);
    setNetThisMonth(net);

    if (briefRow?.content) {
      const firstBullet = briefRow.content.split("\n").find((l: string) => l.trim().startsWith("•"));
      setBriefTeaser(firstBullet?.replace(/^•\s*/, "") ?? briefRow.content.split("\n")[0]);
    }

    setProjects((projectsData ?? []).map((p) => ({ name: p.name, progress: p.progress ?? 0 })));
    setEventDays(new Set((eventsData ?? []).map((e) => e.date as string)));
    setRecentNotes((notesData ?? []) as Note[]);
  }, [supabase]);

  useEffect(() => {
    loadTasks();
    loadRest();
  }, [loadTasks, loadRest]);

  const toggle = async (id: string, done: boolean) => {
    const nextStatus = done ? "todo" : "done";
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !done, status: nextStatus } : t)));
    await supabase.from("tasks").update({ status: nextStatus }).eq("id", id);
  };

  const greeting = useMemo(() => {
    const h = now.getHours();
    if (h < 5) return `Still up, ${displayName}`;
    if (h < 12) return `Good morning, ${displayName}`;
    if (h < 17) return `Good afternoon, ${displayName}`;
    if (h < 21) return `Good evening, ${displayName}`;
    return `Late night, ${displayName}`;
  }, [now, displayName]);

  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const doneCount = tasks.filter((t) => t.done).length;
  const taskPct = tasks.length ? doneCount / tasks.length : 0;
  const habitAvg = habits.length ? habits.reduce((a, h) => a + Math.min(h.pct, 1), 0) / habits.length : 0;
  const systemLoad = Math.round(((taskPct + habitAvg) / 2) * 100);
  const priorityColor = (p: Task["priority"]) =>
    p === "high" ? "rgb(var(--danger))" : p === "med" ? "rgb(var(--gold))" : "rgb(var(--text-muted))";

  const ringCirc = 2 * Math.PI * 26;
  const ringOffset = ringCirc - (systemLoad / 100) * ringCirc;

  // Week strip — Monday-start, real event dots
  const weekStart = new Date(now);
  const dow = (now.getDay() + 6) % 7;
  weekStart.setDate(now.getDate() - dow);
  const weekDates = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d;
  });

  return (
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

      <div style={{ flex: 1, padding: "22px 26px", overflowY: "auto", maxHeight: "700px" }}>
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
                <div>tasks + habits avg</div>
              </div>
            </div>

            <div
              onClick={toggleTheme}
              style={{
                width: 36, height: 36, borderRadius: 10, background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 14 }}>
          {/* Tasks — live */}
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
                <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>No tasks yet.</div>
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

          {/* AI Morning Brief teaser — live */}
          <Link href="/ai-assistant" style={{ textDecoration: "none", color: "inherit", gridColumn: "span 5" }}>
            <div className="lifeos-card" style={{ height: "100%", background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 18, display: "flex", flexDirection: "column", justifyContent: "space-between", cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600 }}>
                  <Sparkles size={14} color="rgb(var(--accent))" /> Morning Brief
                </div>
                <ArrowRight size={14} color="rgb(var(--text-muted))" />
              </div>
              <div style={{ fontSize: 13, color: briefTeaser ? "rgb(var(--text))" : "rgb(var(--text-muted))", lineHeight: 1.5, padding: "10px 0" }}>
                {briefTeaser ?? "No brief generated yet today — open AI Assistant to create one."}
              </div>
              <div style={{ fontSize: 11.5, color: "rgb(var(--accent))" }}>View full brief →</div>
            </div>
          </Link>

          {/* Habits — live */}
          <div className="lifeos-card" style={{ gridColumn: "span 5", background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Habit progress</div>
            {habits.length === 0 && <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))" }}>No habits tracked yet.</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {habits.map((h) => (
                <div key={h.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                    <span>{h.name}</span>
                    <span className="font-mono" style={{ color: "rgb(var(--text-muted))" }}>
                      {h.streak > 0 ? `${h.streak}d streak` : "no streak"}
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 99, background: "rgb(var(--surface-2))", overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(h.pct, 1) * 100}%`, height: "100%", background: "rgb(var(--accent))", borderRadius: 99 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Finance — live */}
          <div className="lifeos-card" style={{ gridColumn: "span 4", background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Finance — this month</div>
            <div className="font-mono" style={{ fontSize: 22, fontWeight: 500, color: netThisMonth >= 0 ? "rgb(var(--accent))" : "rgb(var(--danger))" }}>
              ৳{Math.round(Math.abs(netThisMonth)).toLocaleString()}
            </div>
            <div style={{ fontSize: 11.5, color: "rgb(var(--text-muted))" }}>{netThisMonth >= 0 ? "net saved" : "net spent"} this month</div>
          </div>

          {/* Active projects — live */}
          <Link href="/projects" style={{ textDecoration: "none", color: "inherit", gridColumn: "span 3" }}>
          <div className="lifeos-card" style={{ height: "100%", background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 18, cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <FolderKanban size={13} color="rgb(var(--text-muted))" />
              <span style={{ fontSize: 12.5, color: "rgb(var(--text-muted))" }}>Active projects</span>
            </div>
            <div className="font-mono" style={{ fontSize: 30, fontWeight: 500 }}>{projects.length}</div>
            <div style={{ fontSize: 11, color: "rgb(var(--text-muted))" }}>
              {projects.length > 0 ? `avg ${Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length)}% progress` : "none right now"}
            </div>
          </div>
          </Link>

          {/* Projects list — live */}
          <Link href="/projects" style={{ textDecoration: "none", color: "inherit", gridColumn: "span 5" }}>
          <div className="lifeos-card" style={{ height: "100%", background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 18, cursor: "pointer" }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Project progress</div>
            {projects.length === 0 && <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))" }}>No active projects.</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {projects.map((p) => (
                <div key={p.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                    <span>{p.name}</span>
                    <span className="font-mono" style={{ color: "rgb(var(--text-muted))" }}>{p.progress}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 99, background: "rgb(var(--surface-2))", overflow: "hidden" }}>
                    <div style={{ width: `${p.progress}%`, height: "100%", background: "#5FA8D3", borderRadius: 99 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          </Link>

          {/* This week — live event dots */}
          <div className="lifeos-card" style={{ gridColumn: "span 7", background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>This week</div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              {weekDates.map((d, i) => {
                const iso = isoDate(d);
                const isToday = iso === isoDate(now);
                const hasEvent = eventDays.has(iso);
                return (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, color: "rgb(var(--text-muted))" }}>{WEEK_LABELS[i]}</span>
                    <div
                      className="font-mono"
                      style={{
                        width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12.5, fontWeight: 600,
                        background: isToday ? "rgb(var(--accent))" : "transparent",
                        color: isToday ? "rgb(var(--bg))" : "rgb(var(--text))",
                        border: isToday ? "none" : "1px solid rgb(var(--border))",
                      }}
                    >
                      {d.getDate()}
                    </div>
                    <span style={{ width: 4, height: 4, borderRadius: 99, background: hasEvent ? "rgb(var(--gold))" : "transparent" }} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent notes — live */}
          <div className="lifeos-card" style={{ gridColumn: "span 5", background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Recent notes</div>
            {recentNotes.length === 0 && <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))" }}>No notes yet.</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recentNotes.map((n) => (
                <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <StickyNote size={13} color="rgb(var(--text-muted))" />
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}