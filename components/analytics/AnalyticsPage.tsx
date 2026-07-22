"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { CheckSquare, Flame, Wallet, BookOpen, FolderKanban, Lightbulb } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toLocalISODate as isoDate } from "@/lib/date";
import Sidebar from "@/components/shell/Sidebar";

const ACCENT = "rgb(var(--accent))";
const GOLD = "rgb(var(--gold))";
const DANGER = "rgb(var(--danger))";
const BLUE = "#5FA8D3";
const PURPLE = "#8B7FD6";
const MUTED = "rgb(var(--text-muted))";

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

type TaskTrendPoint = { day: string; completed: number };
type HabitRow = { name: string; completions: number; rate: number; streak: number };
type FinanceMonth = { month: string; income: number; expense: number };
type JournalPoint = { day: string; mood: number | null; energy: number | null; stress: number | null };
type IdeaStatusCount = { status: string; count: number };
type ProjectStat = { name: string; progress: number; status: string };

export default function AnalyticsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);

  const [kpis, setKpis] = useState({
    tasksCompleted30d: 0,
    bestStreak: 0,
    bestStreakHabit: "",
    netFinance30d: 0,
    avgMood30d: null as number | null,
    activeProjects: 0,
  });

  const [taskTrend, setTaskTrend] = useState<TaskTrendPoint[]>([]);
  const [habitRows, setHabitRows] = useState<HabitRow[]>([]);
  const [financeMonths, setFinanceMonths] = useState<FinanceMonth[]>([]);
  const [journalTrend, setJournalTrend] = useState<JournalPoint[]>([]);
  const [ideaCounts, setIdeaCounts] = useState<IdeaStatusCount[]>([]);
  const [projectStats, setProjectStats] = useState<ProjectStat[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const today = new Date();
      const d30 = new Date(today); d30.setDate(d30.getDate() - 29);
      const d14 = new Date(today); d14.setDate(d14.getDate() - 13);
      const d6mo = new Date(today); d6mo.setMonth(d6mo.getMonth() - 5); d6mo.setDate(1);

      const [
        { data: tasks30 },
        { data: habits },
        { data: financeRows },
        { data: journalRows },
        { data: ideas },
        { data: projects },
      ] = await Promise.all([
        supabase.from("tasks").select("done, updated_at").eq("done", true).gte("updated_at", isoDate(d14)),
        supabase.from("habits").select("id, name"),
        supabase.from("finance_transactions").select("type, amount_bdt, occurred_on").gte("occurred_on", isoDate(d6mo)),
        supabase.from("journal_entries").select("entry_date, mood, energy, stress").gte("entry_date", isoDate(d30)).order("entry_date"),
        supabase.from("idea_vault_items").select("status"),
        supabase.from("projects").select("name, progress, status"),
      ]);

      // Task completion trend (last 14 days)
      const trendMap = new Map<string, number>();
      for (let i = 0; i < 14; i++) {
        const d = new Date(d14); d.setDate(d.getDate() + i);
        trendMap.set(isoDate(d), 0);
      }
      (tasks30 ?? []).forEach((t) => {
        const day = (t.updated_at as string).slice(0, 10);
        if (trendMap.has(day)) trendMap.set(day, (trendMap.get(day) ?? 0) + 1);
      });
      const trend = Array.from(trendMap.entries()).map(([day, completed]) => ({
        day: day.slice(5), completed,
      }));
      setTaskTrend(trend);

      // Habits (last 30 days)
      let bestStreak = 0;
      let bestStreakHabit = "";
      let habitRowsLocal: HabitRow[] = [];
      if (habits && habits.length > 0) {
        const habitIds = habits.map((h) => h.id);
        const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 60);
        const { data: logs } = await supabase
          .from("habit_logs")
          .select("habit_id, date")
          .in("habit_id", habitIds)
          .eq("completed", true)
          .gte("date", isoDate(cutoff));

        habitRowsLocal = habits.map((h) => {
          const allDates = (logs ?? []).filter((l) => l.habit_id === h.id).map((l) => l.date);
          const inLast30 = allDates.filter((d) => d >= isoDate(d30));
          const streak = computeStreak(allDates);
          if (streak > bestStreak) { bestStreak = streak; bestStreakHabit = h.name; }
          return { name: h.name, completions: inLast30.length, rate: Math.round((inLast30.length / 30) * 100), streak };
        });
      }
      setHabitRows(habitRowsLocal);

      // Finance by month (last 6 months)
      const monthMap = new Map<string, { income: number; expense: number }>();
      for (let i = 0; i < 6; i++) {
        const d = new Date(d6mo); d.setMonth(d.getMonth() + i);
        monthMap.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, { income: 0, expense: 0 });
      }
      (financeRows ?? []).forEach((t) => {
        const key = (t.occurred_on as string).slice(0, 7);
        const bucket = monthMap.get(key);
        if (bucket && (t.type === "income" || t.type === "expense")) {
          bucket[t.type as "income" | "expense"] += Number(t.amount_bdt);
        }
      });
      setFinanceMonths(
        Array.from(monthMap.entries()).map(([key, v]) => ({
          month: new Date(`${key}-01`).toLocaleDateString("en-US", { month: "short" }),
          income: v.income,
          expense: v.expense,
        }))
      );

      const net30d = (financeRows ?? [])
        .filter((t) => t.occurred_on >= isoDate(d30))
        .reduce((sum, t) => sum + (t.type === "income" ? Number(t.amount_bdt) : t.type === "expense" ? -Number(t.amount_bdt) : 0), 0);

      // Journal trend (last 30 days, sparse — only real entries)
      setJournalTrend(
        (journalRows ?? []).map((j) => ({
          day: (j.entry_date as string).slice(5),
          mood: j.mood, energy: j.energy, stress: j.stress,
        }))
      );
      const avgMood = journalRows && journalRows.length > 0
        ? Math.round((journalRows.reduce((s, j) => s + j.mood, 0) / journalRows.length) * 10) / 10
        : null;

      // Idea Vault pipeline
      const statusOrder = ["spark", "developing", "validated", "archived"];
      const counts = new Map<string, number>(statusOrder.map((s) => [s, 0]));
      (ideas ?? []).forEach((i) => counts.set(i.status, (counts.get(i.status) ?? 0) + 1));
      setIdeaCounts(statusOrder.map((s) => ({ status: s[0].toUpperCase() + s.slice(1), count: counts.get(s) ?? 0 })));

      // Projects
      setProjectStats((projects ?? []).map((p) => ({ name: p.name, progress: p.progress ?? 0, status: p.status })));

      setKpis({
        tasksCompleted30d: (tasks30 ?? []).length,
        bestStreak,
        bestStreakHabit,
        netFinance30d: net30d,
        avgMood30d: avgMood,
        activeProjects: (projects ?? []).filter((p) => p.status === "active").length,
      });

      setLoading(false);
    };
    load();
  }, [supabase]);

  const ideaColors: Record<string, string> = { Spark: GOLD, Developing: BLUE, Validated: ACCENT, Archived: MUTED };

  return (
    <div
      style={{
        background: "rgb(var(--bg))", color: "rgb(var(--text))", minHeight: "600px",
        display: "flex", borderRadius: 20, overflow: "hidden", border: "1px solid rgb(var(--border))", position: "relative",
      }}
    >
      <Sidebar />

      <div style={{ flex: 1, padding: "22px 26px", overflowY: "auto", maxHeight: "700px" }}>
        <div className="font-display" style={{ fontSize: 24, fontWeight: 500, marginBottom: 20 }}>Analytics</div>

        {loading && <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>Loading analytics…</div>}

        {!loading && (
          <>
            {/* KPI row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
              <Kpi icon={CheckSquare} label="Tasks completed (14d)" value={String(kpis.tasksCompleted30d)} color={ACCENT} />
              <Kpi icon={Flame} label="Best streak" value={kpis.bestStreak > 0 ? `${kpis.bestStreak}d · ${kpis.bestStreakHabit}` : "—"} color={GOLD} small />
              <Kpi icon={Wallet} label="Net (30d)" value={`৳${Math.round(kpis.netFinance30d).toLocaleString()}`} color={kpis.netFinance30d >= 0 ? ACCENT : DANGER} />
              <Kpi icon={BookOpen} label="Avg mood (30d)" value={kpis.avgMood30d !== null ? `${kpis.avgMood30d}/5` : "—"} color={PURPLE} />
              <Kpi icon={FolderKanban} label="Active projects" value={String(kpis.activeProjects)} color={BLUE} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              {/* Task completion trend */}
              <ChartCard title="Task completion — last 14 days">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={taskTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: "rgb(var(--text-muted))" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "rgb(var(--text-muted))" }} axisLine={false} tickLine={false} width={24} />
                    <Tooltip contentStyle={{ background: "rgb(var(--surface-2))", border: "1px solid rgb(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="completed" fill={ACCENT} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Journal trend */}
              <ChartCard title="Mood, energy & stress — last 30 days">
                {journalTrend.length === 0 ? (
                  <EmptyState text="No journal entries in this range yet." />
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={journalTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: "rgb(var(--text-muted))" }} axisLine={false} tickLine={false} />
                      <YAxis domain={[1, 5]} tick={{ fontSize: 10, fill: "rgb(var(--text-muted))" }} axisLine={false} tickLine={false} width={20} />
                      <Tooltip contentStyle={{ background: "rgb(var(--surface-2))", border: "1px solid rgb(var(--border))", borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="mood" stroke={ACCENT} strokeWidth={2} dot={{ r: 3 }} name="Mood" />
                      <Line type="monotone" dataKey="energy" stroke={BLUE} strokeWidth={2} dot={{ r: 3 }} name="Energy" />
                      <Line type="monotone" dataKey="stress" stroke={DANGER} strokeWidth={2} dot={{ r: 3 }} name="Stress" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              {/* Finance trend */}
              <ChartCard title="Income vs expenses — last 6 months">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={financeMonths}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "rgb(var(--text-muted))" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "rgb(var(--text-muted))" }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip
                      formatter={(v: number) => `৳${Math.round(v).toLocaleString()}`}
                      contentStyle={{ background: "rgb(var(--surface-2))", border: "1px solid rgb(var(--border))", borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="income" fill={ACCENT} radius={[4, 4, 0, 0]} name="Income" />
                    <Bar dataKey="expense" fill={DANGER} radius={[4, 4, 0, 0]} name="Expense" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Idea Vault pipeline */}
              <ChartCard title="Idea Vault pipeline">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={ideaCounts} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "rgb(var(--text-muted))" }} axisLine={false} tickLine={false} />
                    <YAxis
                      type="category" dataKey="status" width={80}
                      tick={{ fontSize: 11, fill: "rgb(var(--text-muted))" }}
                      axisLine={false} tickLine={false}
                    />
                    <Tooltip contentStyle={{ background: "rgb(var(--surface-2))", border: "1px solid rgb(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {ideaCounts.map((entry, i) => (
                        <Cell key={i} fill={ideaColors[entry.status] ?? MUTED} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {/* Habit consistency */}
            <ChartCard title="Habit consistency — last 30 days">
              {habitRows.length === 0 ? (
                <EmptyState text="No habits tracked yet." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {habitRows.map((h) => (
                    <div key={h.name}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
                        <span style={{ fontWeight: 500 }}>{h.name}</span>
                        <span style={{ color: "rgb(var(--text-muted))" }}>
                          {h.completions}/30 days · {h.streak > 0 ? `${h.streak}d streak` : "no active streak"}
                        </span>
                      </div>
                      <div style={{ height: 8, borderRadius: 999, background: "rgb(var(--surface-2))", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${h.rate}%`, background: ACCENT, borderRadius: 999 }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>

            {/* Projects overview */}
            <div style={{ marginTop: 16 }}>
              <ChartCard title="Projects overview">
                {projectStats.length === 0 ? (
                  <EmptyState text="No projects yet." />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {projectStats.map((p) => (
                      <div key={p.name}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
                          <span style={{ fontWeight: 500 }}>{p.name}</span>
                          <span style={{ color: "rgb(var(--text-muted))", textTransform: "capitalize" }}>{p.status} · {p.progress}%</span>
                        </div>
                        <div style={{ height: 8, borderRadius: 999, background: "rgb(var(--surface-2))", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${p.progress}%`, background: p.status === "done" ? ACCENT : BLUE, borderRadius: 999 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ChartCard>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, color, small }: { icon: React.ElementType; label: string; value: string; color: string; small?: boolean }) {
  return (
    <div style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 14, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: "rgb(var(--text-muted))" }}>
        <Icon size={13} color={color} />
        <span style={{ fontSize: 11 }}>{label}</span>
      </div>
      <div className="font-mono" style={{ fontSize: small ? 14 : 17, fontWeight: 600, color }}>{value}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))", padding: "40px 0", textAlign: "center" }}>
      {text}
    </div>
  );
}