import type { SupabaseClient } from "@supabase/supabase-js";
import { todayISO, addDaysISO, daysBetween } from "@/lib/date";
import { computeStreak, successRate } from "@/lib/ai/habit-streak";
import { getProjectGraph } from "@/lib/ai/project-graph";

/**
 * LifeOS Context Engine — Roadmap Phase 1.
 *
 * The problem this replaces: every AI route (Morning Brief, Review,
 * Prioritize, Search, Journal Insights) independently queries its own
 * slice of Supabase, in its own shape, with its own copy of helpers like
 * `daysBetween` and `computeStreak`. That's how Morning Brief and Ask
 * LifeOS ended up able to reason over slightly different data even though
 * they're describing the same LifeOS instance.
 *
 * This module is the single place that assembles "what does the user's
 * LifeOS actually look like right now" — tasks, projects, calendar,
 * habits, journal, learning, finance, and a merged recent-activity feed —
 * as one typed object. Every future cross-module AI feature (Today Brain,
 * Project Health, Ask LifeOS 2.0) should build on this instead of writing
 * its own queries.
 *
 * Deliberately NOT done here: calling Groq, writing prompts, or caching
 * AI output. This is a data layer only — pure context assembly, no
 * opinions about what to do with it. Each AI route stays in charge of its
 * own prompt, its own cache table, and its own rate-limit check.
 *
 * Deliberately modular: every section is fetched only if requested via
 * `options.sections`, and sections fetch in parallel via Promise.all
 * within each group. A caller that only wants `["tasks", "calendar"]` for
 * a lightweight feature shouldn't pay the query cost (or prompt-token
 * cost) of finance and learning data it'll never use.
 */

// ---------- Section selection ----------

export type ContextSection =
  | "tasks"
  | "projects"
  | "calendar"
  | "habits"
  | "journal"
  | "learning"
  | "finance"
  | "recent_activity";

export const ALL_SECTIONS: ContextSection[] = [
  "tasks",
  "projects",
  "calendar",
  "habits",
  "journal",
  "learning",
  "finance",
  "recent_activity",
];

export interface BuildContextOptions {
  /** Which sections to assemble. Defaults to all 8. */
  sections?: ContextSection[];
  /** How far ahead "upcoming" reaches for deadlines/calendar. Default 7. */
  lookaheadDays?: number;
  /** How far back "recent" reaches for recent_activity and finance top-categories. Default 14. */
  lookbackDays?: number;
  /** Max journal entries returned (most recent first). Default 5. */
  journalEntryLimit?: number;
  /** Max combined items in recent_activity. Default 15. */
  recentActivityLimit?: number;
  /** Override "today" (Dhaka-local YYYY-MM-DD). Mainly for testing. */
  today?: string;
}

// ---------- Section types ----------

export interface TaskSummary {
  id: string;
  title: string;
  tag: string | null;
  category: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  project_id: string | null;
}

export interface TasksContext {
  overdue: TaskSummary[];
  due_today: TaskSummary[];
  /** Due after today, within lookaheadDays. */
  due_soon: TaskSummary[];
  /** High priority, no due date at all — easy to lose track of otherwise. */
  no_due_date_high_priority: TaskSummary[];
  open_count: number;
}

export interface ProjectLinkedSummary {
  open_tasks: number;
  overdue_tasks: number;
  linked_notes: number;
  upcoming_events: { title: string; date: string }[];
  linked_learning: { title: string; progress: number }[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  priority: string;
  deadline: string | null;
  days_until_deadline: number | null;
  progress: number;
  days_since_update: number;
  linked: ProjectLinkedSummary;
}

export interface ProjectsContext {
  active: ProjectSummary[];
  /** Subset of active: no update in 3+ days. Same threshold Morning Brief already uses. */
  stale: ProjectSummary[];
  /** Subset of active: deadline within lookaheadDays. */
  deadlines_approaching: ProjectSummary[];
}

export interface CalendarEventSummary {
  id: string;
  title: string;
  date: string;
  project_id: string | null;
}

export interface CalendarContext {
  today_count: number;
  upcoming: CalendarEventSummary[];
  /**
   * `events` currently stores only a date + all_day flag, no start/end
   * time — so "available calendar time" (roadmap item 3) can't be
   * computed yet at the granularity a real scheduler needs. Surfaced
   * explicitly here rather than silently returning something that looks
   * like a real availability signal but isn't — Phase 3 will need a
   * schema change (start_time/end_time columns) before real time-block
   * scheduling is possible.
   */
  has_time_of_day_data: false;
}

export interface HabitSummary {
  id: string;
  name: string;
  streak: number;
  success_rate_30d: number;
}

export interface HabitsContext {
  habits: HabitSummary[];
  broken: string[];
}

export interface JournalEntrySummary {
  entry_date: string;
  mood: number;
  energy: number;
  stress: number;
  wins: string | null;
  failures: string | null;
  lessons: string | null;
  gratitude: string | null;
}

export interface JournalContext {
  recent: JournalEntrySummary[];
  /** Average mood across `recent`. Null if there are no entries — never fabricated as 0 or 3. */
  avg_mood_recent: number | null;
  /** Average mood across the equal-length window immediately before `recent`, for trend questions like "why has my mood dropped". Null if not enough history. */
  avg_mood_previous: number | null;
}

export interface LearningContext {
  in_progress: { title: string; category: string | null; progress: number; hours_studied: number }[];
  completed_recent: { title: string; category: string | null }[];
}

export interface FinanceContext {
  month_to_date: { income: number; expense: number; savings: number; investment: number };
  top_expense_categories: { category: string; amount: number }[];
  open_debts: { owed_to_me: number; i_owe: number; overdue_count: number };
}

export interface RecentActivityItem {
  type: "task" | "project" | "note" | "journal" | "learning";
  title: string;
  at: string; // ISO timestamp
}

export interface LifeOSContext {
  meta: {
    generated_at: string;
    today: string;
    sections_included: ContextSection[];
  };
  tasks?: TasksContext;
  projects?: ProjectsContext;
  calendar?: CalendarContext;
  habits?: HabitsContext;
  journal?: JournalContext;
  learning?: LearningContext;
  finance?: FinanceContext;
  recent_activity?: RecentActivityItem[];
}

// ---------- Section builders ----------

async function buildTasks(supabase: SupabaseClient, today: string, lookaheadDays: number): Promise<TasksContext> {
  const { data } = await supabase
    .from("tasks")
    .select("id, title, tag, category, priority, status, due_date, project_id")
    .neq("status", "done")
    .order("due_date", { ascending: true, nullsFirst: false });

  const tasks = (data ?? []) as TaskSummary[];
  const soonCutoff = addDaysISO(today, lookaheadDays);

  return {
    overdue: tasks.filter((t) => t.due_date && t.due_date < today),
    due_today: tasks.filter((t) => t.due_date === today),
    due_soon: tasks.filter((t) => t.due_date && t.due_date > today && t.due_date <= soonCutoff),
    no_due_date_high_priority: tasks.filter((t) => !t.due_date && t.priority === "high"),
    open_count: tasks.length,
  };
}

async function buildProjects(
  supabase: SupabaseClient,
  today: string,
  lookaheadDays: number
): Promise<ProjectsContext> {
  const { data } = await supabase
    .from("projects")
    .select("id, name, status, priority, deadline, progress, updated_at")
    .eq("status", "active");

  const rows = data ?? [];
  const now = new Date();
  const projectIds = rows.map((p) => p.id as string);

  // Reuses the existing project-graph helper (batched, one query per
  // related table) rather than re-implementing the same linked-data join
  // — this is exactly the kind of duplication the engine exists to avoid.
  const graph = await getProjectGraph(supabase, projectIds, today);

  const active: ProjectSummary[] = rows.map((p) => {
    const linkedEntry = graph.get(p.id as string);
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      priority: p.priority,
      deadline: p.deadline,
      days_until_deadline: p.deadline ? daysBetween(new Date(p.deadline), now) : null,
      progress: p.progress,
      days_since_update: daysBetween(now, new Date(p.updated_at)),
      linked: linkedEntry
        ? {
            open_tasks: linkedEntry.open_tasks,
            overdue_tasks: linkedEntry.overdue_tasks,
            linked_notes: linkedEntry.linked_notes,
            upcoming_events: linkedEntry.upcoming_events,
            linked_learning: linkedEntry.linked_learning,
          }
        : { open_tasks: 0, overdue_tasks: 0, linked_notes: 0, upcoming_events: [], linked_learning: [] },
    };
  });

  return {
    active,
    stale: active.filter((p) => p.days_since_update >= 3),
    deadlines_approaching: active.filter(
      (p) => p.days_until_deadline !== null && p.days_until_deadline >= 0 && p.days_until_deadline <= lookaheadDays
    ),
  };
}

async function buildCalendar(supabase: SupabaseClient, today: string, lookaheadDays: number): Promise<CalendarContext> {
  const { data } = await supabase
    .from("events")
    .select("id, title, date, project_id")
    .gte("date", today)
    .lte("date", addDaysISO(today, lookaheadDays))
    .order("date", { ascending: true });

  const events = (data ?? []) as CalendarEventSummary[];
  return {
    today_count: events.filter((e) => e.date === today).length,
    upcoming: events,
    has_time_of_day_data: false,
  };
}

async function buildHabits(supabase: SupabaseClient, today: string): Promise<HabitsContext> {
  const { data: habits } = await supabase.from("habits").select("id, name");
  if (!habits || habits.length === 0) return { habits: [], broken: [] };

  const habitIds = habits.map((h) => h.id);
  // 45-day lookback: enough to compute a real 30-day success rate even for
  // streaks that started a bit before the window edge — same window
  // Morning Brief already fetches for streak math.
  const { data: logs } = await supabase
    .from("habit_logs")
    .select("habit_id, date")
    .in("habit_id", habitIds)
    .eq("completed", true)
    .gte("date", addDaysISO(today, -45));

  const thirtyDaysAgo = addDaysISO(today, -30);
  const summaries: HabitSummary[] = habits.map((h) => {
    const dates = (logs ?? []).filter((l) => l.habit_id === h.id).map((l) => l.date);
    const last30 = dates.filter((d) => d >= thirtyDaysAgo);
    return {
      id: h.id,
      name: h.name,
      streak: computeStreak(dates),
      success_rate_30d: successRate(last30, 30),
    };
  });

  return {
    habits: summaries,
    broken: summaries.filter((h) => h.streak === 0).map((h) => h.name),
  };
}

async function buildJournal(supabase: SupabaseClient, today: string, entryLimit: number): Promise<JournalContext> {
  // Fetch double the limit so the second half can serve as the
  // "previous window" for trend comparisons ("why has my mood dropped
  // this week") without a second round trip.
  const { data } = await supabase
    .from("journal_entries")
    .select("entry_date, mood, energy, stress, wins, failures, lessons, gratitude")
    .lte("entry_date", today)
    .order("entry_date", { ascending: false })
    .limit(entryLimit * 2);

  const rows = (data ?? []) as JournalEntrySummary[];
  const recent = rows.slice(0, entryLimit);
  const previous = rows.slice(entryLimit, entryLimit * 2);

  const avg = (rows_: JournalEntrySummary[]) =>
    rows_.length === 0 ? null : Math.round((rows_.reduce((s, r) => s + r.mood, 0) / rows_.length) * 10) / 10;

  return {
    recent,
    avg_mood_recent: avg(recent),
    avg_mood_previous: avg(previous),
  };
}

async function buildLearning(supabase: SupabaseClient, today: string, lookbackDays: number): Promise<LearningContext> {
  const { data } = await supabase
    .from("learning_items")
    .select("title, category, status, progress, hours_studied, updated_at");

  const rows = data ?? [];
  const cutoff = addDaysISO(today, -lookbackDays);

  return {
    in_progress: rows
      .filter((r) => r.status !== "completed")
      .map((r) => ({ title: r.title, category: r.category, progress: r.progress, hours_studied: r.hours_studied })),
    completed_recent: rows
      .filter((r) => r.status === "completed" && r.updated_at.slice(0, 10) >= cutoff)
      .map((r) => ({ title: r.title, category: r.category })),
  };
}

async function buildFinance(supabase: SupabaseClient, today: string): Promise<FinanceContext> {
  const monthStart = `${today.slice(0, 7)}-01`;

  const [{ data: txns }, { data: debts }] = await Promise.all([
    supabase
      .from("finance_transactions")
      .select("type, category, amount_bdt")
      .gte("occurred_on", monthStart)
      .lte("occurred_on", today),
    supabase.from("finance_debts").select("direction, amount_bdt, due_date").eq("settled", false),
  ]);

  const monthToDate = { income: 0, expense: 0, savings: 0, investment: 0 };
  const expenseByCategory = new Map<string, number>();
  for (const t of txns ?? []) {
    const type = t.type as keyof typeof monthToDate;
    if (type in monthToDate) monthToDate[type] += t.amount_bdt;
    if (t.type === "expense") {
      const cat = t.category || "Uncategorized";
      expenseByCategory.set(cat, (expenseByCategory.get(cat) ?? 0) + t.amount_bdt);
    }
  }
  const topExpenseCategories = Array.from(expenseByCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, amount]) => ({ category, amount }));

  let owedToMe = 0;
  let iOwe = 0;
  let overdueCount = 0;
  for (const d of debts ?? []) {
    if (d.direction === "owed_to_me") owedToMe += d.amount_bdt;
    else iOwe += d.amount_bdt;
    if (d.due_date && d.due_date < today) overdueCount += 1;
  }

  return {
    month_to_date: monthToDate,
    top_expense_categories: topExpenseCategories,
    open_debts: { owed_to_me: owedToMe, i_owe: iOwe, overdue_count: overdueCount },
  };
}

async function buildRecentActivity(
  supabase: SupabaseClient,
  today: string,
  lookbackDays: number,
  limit: number
): Promise<RecentActivityItem[]> {
  const cutoff = new Date(addDaysISO(today, -lookbackDays) + "T00:00:00").toISOString();

  const [{ data: tasks }, { data: projects }, { data: notes }, { data: journal }, { data: learning }] =
    await Promise.all([
      supabase.from("tasks").select("title, updated_at").gte("updated_at", cutoff),
      supabase.from("projects").select("name, updated_at").gte("updated_at", cutoff),
      supabase.from("notes").select("title, updated_at").gte("updated_at", cutoff),
      supabase.from("journal_entries").select("entry_date, updated_at").gte("updated_at", cutoff),
      supabase.from("learning_items").select("title, updated_at").gte("updated_at", cutoff),
    ]);

  const items: RecentActivityItem[] = [
    ...(tasks ?? []).map((t) => ({ type: "task" as const, title: t.title, at: t.updated_at })),
    ...(projects ?? []).map((p) => ({ type: "project" as const, title: p.name, at: p.updated_at })),
    ...(notes ?? []).map((n) => ({ type: "note" as const, title: n.title, at: n.updated_at })),
    ...(journal ?? []).map((j) => ({ type: "journal" as const, title: `Journal — ${j.entry_date}`, at: j.updated_at })),
    ...(learning ?? []).map((l) => ({ type: "learning" as const, title: l.title, at: l.updated_at })),
  ];

  return items.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, limit);
}

// ---------- Entry point ----------

/**
 * Build the unified LifeOS context. Pass the same request-scoped Supabase
 * client each AI route already creates — RLS scopes every query to the
 * caller's own auth.uid() automatically, same as every other query in the
 * app, so there's no separate "which user" parameter to get wrong.
 */
export async function buildLifeOSContext(
  supabase: SupabaseClient,
  options: BuildContextOptions = {}
): Promise<LifeOSContext> {
  const sections = options.sections ?? ALL_SECTIONS;
  const lookaheadDays = options.lookaheadDays ?? 7;
  const lookbackDays = options.lookbackDays ?? 14;
  const journalEntryLimit = options.journalEntryLimit ?? 5;
  const recentActivityLimit = options.recentActivityLimit ?? 15;
  const today = options.today ?? todayISO();

  const want = (s: ContextSection) => sections.includes(s);

  const [tasks, projects, calendar, habits, journal, learning, finance, recent_activity] = await Promise.all([
    want("tasks") ? buildTasks(supabase, today, lookaheadDays) : Promise.resolve(undefined),
    want("projects") ? buildProjects(supabase, today, lookaheadDays) : Promise.resolve(undefined),
    want("calendar") ? buildCalendar(supabase, today, lookaheadDays) : Promise.resolve(undefined),
    want("habits") ? buildHabits(supabase, today) : Promise.resolve(undefined),
    want("journal") ? buildJournal(supabase, today, journalEntryLimit) : Promise.resolve(undefined),
    want("learning") ? buildLearning(supabase, today, lookbackDays) : Promise.resolve(undefined),
    want("finance") ? buildFinance(supabase, today) : Promise.resolve(undefined),
    want("recent_activity")
      ? buildRecentActivity(supabase, today, lookbackDays, recentActivityLimit)
      : Promise.resolve(undefined),
  ]);

  return {
    meta: { generated_at: new Date().toISOString(), today, sections_included: sections },
    tasks,
    projects,
    calendar,
    habits,
    journal,
    learning,
    finance,
    recent_activity,
  };
}

/**
 * Grounding rules every AI feature built on this context should include in
 * its system prompt. Pulled out as one shared constant so "don't invent
 * what you don't know" stays worded consistently across Today Brain,
 * Project Health, Ask LifeOS 2.0, etc., instead of each route writing its
 * own slightly-different version — matching the standard Journal Insights
 * already holds itself to.
 */
export const CONTEXT_GROUNDING_RULES = `Ground every claim in the JSON context provided. Never invent a task, deadline, pattern, or cause that isn't literally present in the data. If the data doesn't support a confident answer (too little history, nothing relevant found), say so plainly instead of guessing — a short honest "not enough data yet" beats a fabricated insight.`;