import type { SupabaseClient } from "@supabase/supabase-js";

export type ProjectGraphEntry = {
  id: string;
  name: string;
  open_tasks: number;
  overdue_tasks: number;
  linked_notes: number;
  upcoming_events: { title: string; date: string }[];
  linked_learning: { title: string; progress: number }[];
};

/**
 * Pulls together everything linked to a set of projects — via the
 * project_id columns added across phase6/phase13/phase14/phase15 — into
 * one compact per-project summary. Built for feeding AI prompts: every
 * field here is a count or a short list, never raw rows, so it stays
 * cheap to stringify into a prompt even for someone with dozens of tasks.
 *
 * Batched (one query per related table, filtered with `.in("project_id",
 * projectIds)`), not one query per project — N+1 here would mean N+1
 * round trips inside a single AI request, which is the kind of latency
 * that makes a "quick" Morning Brief feel slow.
 */
export async function getProjectGraph(
  supabase: SupabaseClient,
  projectIds: string[],
  todayISO: string
): Promise<Map<string, ProjectGraphEntry>> {
  const map = new Map<string, ProjectGraphEntry>();
  if (projectIds.length === 0) return map;

  const [{ data: tasks }, { data: notes }, { data: events }, { data: learning }] = await Promise.all([
    supabase.from("tasks").select("project_id, done, due_date").in("project_id", projectIds),
    supabase.from("notes").select("project_id").in("project_id", projectIds),
    supabase
      .from("events")
      .select("project_id, title, date")
      .in("project_id", projectIds)
      .gte("date", todayISO)
      .order("date", { ascending: true }),
    supabase.from("learning_items").select("project_id, title, progress").in("project_id", projectIds),
  ]);

  for (const id of projectIds) {
    map.set(id, { id, name: "", open_tasks: 0, overdue_tasks: 0, linked_notes: 0, upcoming_events: [], linked_learning: [] });
  }

  for (const t of tasks ?? []) {
    const entry = t.project_id ? map.get(t.project_id) : undefined;
    if (!entry) continue;
    if (!t.done) {
      entry.open_tasks += 1;
      if (t.due_date && t.due_date < todayISO) entry.overdue_tasks += 1;
    }
  }
  for (const n of notes ?? []) {
    const entry = n.project_id ? map.get(n.project_id) : undefined;
    if (entry) entry.linked_notes += 1;
  }
  for (const ev of events ?? []) {
    const entry = ev.project_id ? map.get(ev.project_id) : undefined;
    // Capped per project so one heavily-scheduled project can't crowd out
    // everything else in the prompt — the AI needs "what's coming up," not
    // an exhaustive log.
    if (entry && entry.upcoming_events.length < 3) entry.upcoming_events.push({ title: ev.title, date: ev.date });
  }
  for (const li of learning ?? []) {
    const entry = li.project_id ? map.get(li.project_id) : undefined;
    if (entry) entry.linked_learning.push({ title: li.title, progress: li.progress });
  }

  return map;
}

/**
 * Flattens the graph into an array trimmed to only projects that actually
 * have something linked — an empty project entry (0 tasks, 0 notes, 0
 * events, 0 learning) adds prompt-token cost for zero value, and risks
 * the model treating "nothing linked" as itself a notable fact worth a
 * bullet, which it isn't.
 */
export function nonEmptyProjectGraph(
  graph: Map<string, ProjectGraphEntry>,
  names: Map<string, string>
): (ProjectGraphEntry & { name: string })[] {
  return Array.from(graph.values())
    .filter((p) => p.open_tasks > 0 || p.linked_notes > 0 || p.upcoming_events.length > 0 || p.linked_learning.length > 0)
    .map((p) => ({ ...p, name: names.get(p.id) ?? "" }));
}