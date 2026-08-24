import { daysBetween, todayISO } from "@/lib/date";

/**
 * LifeOS 2.0 Roadmap — Phase 4: Project Health.
 *
 * Deliberately rule-based, not AI-generated. Every LifeOS feature works
 * completely without AI (see README's AI Philosophy) — and a project's
 * health here is arithmetic anyone can audit for themselves: days since
 * last update, days until deadline, how much linked work is overdue.
 * Being deterministic also means it's instant and free to compute
 * anywhere a project is rendered (a card grid, a detail modal, a future
 * AI prompt), unlike Morning Brief / Today Brain, which are gated behind
 * a cached once-a-day Groq call.
 *
 * Deliberately excludes the roadmap's "Calendar — available working
 * time" signal: `events` has no time-of-day data (see
 * lib/ai/context-engine.ts's has_time_of_day_data), so there's no honest
 * way to weigh "available time" against remaining work yet. Four signals
 * used here (Progress, Activity, Deadline, Tasks), not five — flagged
 * rather than faked, same call made in the Context Engine.
 */

export type ProjectHealthState = "healthy" | "slowing" | "at_risk" | "blocked";

export interface ProjectHealth {
  state: ProjectHealthState;
  reason: string;
}

export const PROJECT_HEALTH_META: Record<ProjectHealthState, { label: string; color: string }> = {
  healthy: { label: "Healthy", color: "rgb(var(--accent))" },
  slowing: { label: "Slowing", color: "rgb(var(--gold))" },
  at_risk: { label: "At Risk", color: "rgb(var(--danger))" },
  blocked: { label: "Blocked", color: "rgb(var(--danger))" },
};

interface RawProjectLike {
  status: string;
  progress: number;
  deadline: string | null;
  updated_at: string;
}

interface RawTaskLike {
  status: string;
  due_date: string | null;
}

interface TaskCounts {
  openTasks: number;
  overdueTasks: number;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function healthFromCounts(project: RawProjectLike, counts: TaskCounts, today: string): ProjectHealth | null {
  if (project.status !== "active") return null;

  const daysSinceUpdate = daysBetween(new Date(today), new Date(project.updated_at));
  const daysUntilDeadline = project.deadline ? daysBetween(new Date(project.deadline), new Date(today)) : null;
  const { openTasks, overdueTasks } = counts;

  // 1. Deadline already passed and the work isn't done — the clearest
  // possible "blocked": the thing this project existed to hit didn't happen.
  if (daysUntilDeadline !== null && daysUntilDeadline < 0 && project.progress < 100) {
    const daysPast = Math.abs(daysUntilDeadline);
    return {
      state: "blocked",
      reason: `deadline passed ${daysPast} day${daysPast === 1 ? "" : "s"} ago, still ${project.progress}% complete`,
    };
  }

  // 2. Overdue linked work AND nothing touched in a week+ — genuinely
  // stalled, not just moving slowly.
  if (overdueTasks > 0 && daysSinceUpdate >= 7) {
    return { state: "blocked", reason: `${plural(overdueTasks, "overdue task")}, no activity in ${daysSinceUpdate} days` };
  }

  // 3. Deadline within a week and meaningfully incomplete.
  if (daysUntilDeadline !== null && daysUntilDeadline >= 0 && daysUntilDeadline <= 7 && project.progress < 90) {
    return {
      state: "at_risk",
      reason: `deadline in ${daysUntilDeadline} day${daysUntilDeadline === 1 ? "" : "s"}, ${project.progress}% complete`,
    };
  }

  // 4. Overdue linked work, but still being touched recently — worth a
  // flag, not yet a crisis.
  if (overdueTasks > 0) {
    return { state: "at_risk", reason: `${plural(overdueTasks, "linked task")} overdue` };
  }

  // 5. Just quiet for a few days — same 3-day threshold the Context
  // Engine already uses for its own `stale` bucket, kept consistent.
  if (daysSinceUpdate >= 3) {
    return { state: "slowing", reason: `no updates in ${daysSinceUpdate} days` };
  }

  return { state: "healthy", reason: openTasks > 0 ? "on track, recently active" : "no open work, on track" };
}

/**
 * For callers with raw linked-task rows (any shape with `status` and
 * `due_date` — matches both the server's TaskSummary and the client's
 * Task type). This is what the Projects page uses, since it already has
 * the full task list loaded via useTasks.
 */
export function computeProjectHealth(
  project: RawProjectLike,
  linkedTasks: RawTaskLike[],
  today: string = todayISO()
): ProjectHealth | null {
  const overdueTasks = linkedTasks.filter((t) => t.status !== "done" && t.due_date && t.due_date < today).length;
  const openTasks = linkedTasks.filter((t) => t.status !== "done").length;
  return healthFromCounts(project, { openTasks, overdueTasks }, today);
}

/**
 * For callers that only have pre-aggregated counts — namely the Context
 * Engine, whose `getProjectGraph` already reduces linked tasks down to
 * `open_tasks`/`overdue_tasks` numbers (deliberately, to keep AI prompts
 * cheap — see project-graph.ts). Reshaping those counts back into fake
 * task rows just to satisfy `computeProjectHealth`'s signature would be
 * needless busywork, so the counts-based path is exposed directly.
 */
export function computeProjectHealthFromCounts(
  project: RawProjectLike,
  counts: TaskCounts,
  today: string = todayISO()
): ProjectHealth | null {
  return healthFromCounts(project, counts, today);
}