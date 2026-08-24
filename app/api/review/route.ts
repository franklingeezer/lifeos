import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAIRateLimit } from "@/lib/ai-rate-limit";
import { toLocalISODate as isoDate } from "@/lib/date";
import { getProjectGraph, nonEmptyProjectGraph } from "@/lib/ai/project-graph";
import { computeStreak } from "@/lib/ai/habit-streak";

export const dynamic = "force-dynamic";

const MODEL = "openai/gpt-oss-120b";
const DEFAULT_USER_NAME = "Chief";

function periodFor(type: "weekly" | "monthly") {
  const end = new Date();
  const start = new Date();
  if (type === "weekly") start.setDate(start.getDate() - 6);
  else start.setDate(start.getDate() - 29);
  return { start: isoDate(start), end: isoDate(end) };
}

export async function GET(req: NextRequest) {
  const type = (req.nextUrl.searchParams.get("type") === "monthly" ? "monthly" : "weekly") as "weekly" | "monthly";
  const regenerate = req.nextUrl.searchParams.get("regenerate") === "true";
  const { start, end } = periodFor(type);
  const supabase = createClient();

  const { data: settingsRow } = await supabase.from("app_settings").select("display_name").maybeSingle(); // per-user row, see phase11
  const USER_NAME = settingsRow?.display_name || DEFAULT_USER_NAME;

  if (!regenerate) {
    const { data: cached } = await supabase
      .from("ai_reviews")
      .select("content, created_at")
      .eq("period_type", type)
      .eq("period_start", start)
      .maybeSingle();
    if (cached) {
      return NextResponse.json({ content: cached.content, cached: true, created_at: cached.created_at, period: { start, end } });
    }
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not set in .env.local. Add it and restart the dev server." },
      { status: 500 }
    );
  }

  const endExclusive = new Date(end);
  endExclusive.setDate(endExclusive.getDate() + 1);
  const endExclusiveISO = isoDate(endExclusive);
  const today = isoDate(new Date());

  const [
    { data: completedTasks },
    { data: createdTasks },
    { data: stillOverdue },
    { data: habits },
    { data: touchedProjects },
    { data: allActiveProjects },
    { data: transactions },
    { data: journalEntries },
    { data: newIdeas },
    { data: validatedIdeas },
    { data: newNotes },
  ] = await Promise.all([
    supabase.from("tasks").select("title").eq("done", true).gte("updated_at", start).lt("updated_at", endExclusiveISO),
    supabase.from("tasks").select("id").gte("created_at", start).lt("created_at", endExclusiveISO),
    supabase.from("tasks").select("title, due_date").eq("done", false).lt("due_date", today),
    supabase.from("habits").select("id, name"),
    supabase.from("projects").select("name, status, progress").gte("updated_at", start).lt("updated_at", endExclusiveISO),
    supabase.from("projects").select("id, name, status, progress").eq("status", "active"),
    supabase.from("finance_transactions").select("type, amount_bdt").gte("occurred_on", start).lt("occurred_on", endExclusiveISO),
    supabase.from("journal_entries").select("entry_date, mood, energy, stress, wins, lessons").gte("entry_date", start).lt("entry_date", endExclusiveISO).order("entry_date"),
    supabase.from("idea_vault_items").select("id").gte("created_at", start).lt("created_at", endExclusiveISO),
    supabase.from("idea_vault_items").select("title").eq("status", "validated").gte("updated_at", start).lt("updated_at", endExclusiveISO),
    supabase.from("notes").select("id").gte("created_at", start).lt("created_at", endExclusiveISO),
  ]);

  let habitSummary: { name: string; completions: number; currentStreak: number }[] = [];
  if (habits && habits.length > 0) {
    const habitIds = habits.map((h) => h.id);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    const { data: logs } = await supabase
      .from("habit_logs")
      .select("habit_id, date")
      .in("habit_id", habitIds)
      .eq("completed", true)
      .gte("date", isoDate(cutoff));

    habitSummary = habits.map((h) => {
      const allDates = (logs ?? []).filter((l) => l.habit_id === h.id).map((l) => l.date);
      const inPeriod = allDates.filter((d) => d >= start && d < endExclusiveISO);
      return { name: h.name, completions: inPeriod.length, currentStreak: computeStreak(allDates) };
    });
  }

  const financeTotals = { income: 0, expense: 0, savings: 0, investment: 0 };
  (transactions ?? []).forEach((t) => {
    financeTotals[t.type as keyof typeof financeTotals] += Number(t.amount_bdt);
  });

  const avgOf = (arr: number[]) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null);
  const moods = (journalEntries ?? []).map((j) => j.mood);
  const energies = (journalEntries ?? []).map((j) => j.energy);
  const stresses = (journalEntries ?? []).map((j) => j.stress);

  // Same cross-module context as Morning Brief — what's actually linked
  // to each active project, so the PROJECTS section can say something
  // like "Cyber Terminal — 60% done, 2 tasks still open" instead of just
  // a bare progress number.
  const projectIds = (allActiveProjects ?? []).map((p) => p.id);
  const projectNames = new Map((allActiveProjects ?? []).map((p) => [p.id, p.name]));
  const graph = await getProjectGraph(supabase, projectIds, endExclusiveISO);
  const projectContext = nonEmptyProjectGraph(graph, projectNames);

  const dataSummary = {
    period_type: type,
    period_start: start,
    period_end: end,
    tasks_completed: (completedTasks ?? []).map((t) => t.title),
    tasks_created_count: (createdTasks ?? []).length,
    still_overdue: (stillOverdue ?? []).map((t) => ({ title: t.title, due_date: t.due_date })),
    habits: habitSummary,
    projects_touched: (touchedProjects ?? []).map((p) => ({ name: p.name, status: p.status, progress: p.progress })),
    all_active_projects: (allActiveProjects ?? []).map((p) => ({ name: p.name, progress: p.progress })),
    project_context: projectContext.map((p) => ({
      name: p.name,
      open_tasks: p.open_tasks,
      overdue_tasks: p.overdue_tasks,
      linked_notes: p.linked_notes,
      upcoming_events: p.upcoming_events,
      linked_learning: p.linked_learning,
    })),
    finance: financeTotals,
    journal_entry_count: (journalEntries ?? []).length,
    avg_mood: avgOf(moods),
    avg_energy: avgOf(energies),
    avg_stress: avgOf(stresses),
    journal_highlights: (journalEntries ?? []).slice(-5).map((j) => ({ date: j.entry_date, win: j.wins, lesson: j.lessons })),
    new_ideas_count: (newIdeas ?? []).length,
    ideas_validated: (validatedIdeas ?? []).map((i) => i.title),
    new_notes_count: (newNotes ?? []).length,
  };

  const label = type === "weekly" ? "week" : "month";
  const systemPrompt = `You write a ${label}ly review for ${USER_NAME} in a personal productivity app called LifeOS.

Guiding principle: quietly help, don't take over. Reflect what happened — don't lecture, don't moralize, don't tell ${USER_NAME} what to prioritize next. Observation, not direction. Leave the interpretation to him.

Rules:
- Never invent information. Only use what's in the JSON data provided.
- Structure: a one-line opening (e.g. "Here's how your ${label} went, ${USER_NAME}."), then short plain-text section labels in CAPS (TASKS, HABITS, PROJECTS, FINANCE, JOURNAL — only include sections that have real data), each followed by 1-4 terse bullets using "•".
- For the PROJECTS section: project_context has what's actually linked to each project (its own open/overdue tasks, notes, upcoming events, learning progress) — richer than the bare progress % in all_active_projects. Prefer it when a project appears in both; e.g. "Cyber Terminal — 60% done, 2 tasks still open" beats a bare progress number. Don't fabricate a connection between two projects just because both have data — only combine facts that project_context or projects_touched actually ties to the same project.
- Skip any section with nothing meaningful in it. Don't say "no journal entries this ${label}" — just omit the section.
- Bullets are short fragments, not full sentences. "5 tasks closed, 2 still overdue" not "You managed to complete five tasks this week, though two remain overdue."
- If mood/energy/stress data exists, mention it briefly as an observation, not a diagnosis — e.g. "mood held steady around 4/5" not "you seem happy."
- End with one short neutral observation line if something stands out (a streak, a stale project, a spending pattern) — phrased as a fact, not advice. No "you should" or "consider doing X."
- No greeting-card tone, no "great job!", no exclamation points, no emoji.
- Plain text only. No markdown headers (#), no bold (**). Section labels are just plain capitalized text on their own line.`;

  const userPrompt = `Here is the data for this ${label} (${start} to ${end}):\n\n${JSON.stringify(dataSummary, null, 2)}\n\nWrite the review.`;

  const rateLimit = await checkAIRateLimit(supabase);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `You're sending AI requests too quickly. Try again in about ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minute(s).` },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      // See morning-brief's comment on reasoning_effort/token headroom —
      // same reasoning model, same fix.
      max_tokens: type === "monthly" ? 1400 : 1000,
      reasoning_effort: "low",
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Groq API error:", errText);
    return NextResponse.json({ error: `Groq API error: ${errText}` }, { status: 500 });
  }

  const result = await response.json();
  const message = result.choices?.[0]?.message;
  const content = message?.content?.trim() || message?.reasoning?.trim();

  if (!content) {
    console.error("Groq returned no usable content or reasoning:", JSON.stringify(result));
    return NextResponse.json({ error: "Groq returned an empty response." }, { status: 500 });
  }

  await supabase
    .from("ai_reviews")
    .upsert({ period_type: type, period_start: start, period_end: end, content }, { onConflict: "period_type,period_start" });

  return NextResponse.json({ content, cached: false, created_at: new Date().toISOString(), period: { start, end } });
}