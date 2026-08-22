import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAIRateLimit } from "@/lib/ai-rate-limit";
import { todayISO, toLocalISODate } from "@/lib/date";
import { getProjectGraph, nonEmptyProjectGraph } from "@/lib/ai/project-graph";

export const dynamic = "force-dynamic";

// Groq — gpt-oss-120b is plenty for a short summarization task like this.
// Swap to "openai/gpt-oss-20b" for a faster/cheaper option.
//
// Was "llama-3.3-70b-versatile" until Groq deprecated it (along with
// llama-3.1-8b-instant) in mid-2026 — gpt-oss-120b is Groq's own
// recommended replacement for the 70b tier specifically. If this ever
// breaks again with a "model not found" error, check
// https://console.groq.com/docs/models for the current lineup before
// picking a replacement — Groq's model list turns over often enough that
// this comment itself may go stale.
const MODEL = "openai/gpt-oss-120b";

// Swap this if the brief should address someone else.
// Fallback if app_settings has no row yet — actual name comes from Settings.
const DEFAULT_USER_NAME = "Chief";

function daysBetween(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

// Given a habit's logs (sorted, most recent first), how many consecutive
// days back from today/yesterday were completed.
function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const set = new Set(dates);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Streak counts from today if today's logged, otherwise from yesterday
  // (so a habit isn't shown as "broken" just because it's still morning).
  let cursor = new Date(today);
  if (!set.has(toLocalISODate(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!set.has(toLocalISODate(cursor))) return 0;
  }

  let streak = 0;
  while (set.has(toLocalISODate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export async function GET(req: NextRequest) {
  const regenerate = req.nextUrl.searchParams.get("regenerate") === "true";
  const today = todayISO();
  const supabase = createClient();

  const { data: settingsRow } = await supabase.from("app_settings").select("display_name").maybeSingle(); // per-user row, see phase11
  const USER_NAME = settingsRow?.display_name || DEFAULT_USER_NAME;

  if (!regenerate) {
    const { data: cached } = await supabase
      .from("ai_briefs")
      .select("content, created_at")
      .eq("brief_date", today)
      .maybeSingle();
    if (cached) {
      return NextResponse.json({ content: cached.content, cached: true, created_at: cached.created_at });
    }
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not set in .env.local. Add it and restart the dev server." },
      { status: 500 }
    );
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = toLocalISODate(tomorrow);

  const [{ data: overdueTasks }, { data: todayTasks }, { data: tomorrowTasks }, { data: habits }, { data: activeProjects }] =
    await Promise.all([
      supabase.from("tasks").select("title, priority, due_date").eq("done", false).lt("due_date", today),
      supabase.from("tasks").select("title, priority, due_date").eq("done", false).eq("due_date", today),
      supabase.from("tasks").select("title, priority, due_date").eq("done", false).eq("due_date", tomorrowISO),
      supabase.from("habits").select("id, name"),
      supabase.from("projects").select("id, name, status, deadline, updated_at").eq("status", "active"),
    ]);

  let habitStreaks: { name: string; streak: number }[] = [];
  if (habits && habits.length > 0) {
    const habitIds = habits.map((h) => h.id);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 45);
    const { data: logs } = await supabase
      .from("habit_logs")
      .select("habit_id, date")
      .in("habit_id", habitIds)
      .eq("completed", true)
      .gte("date", toLocalISODate(cutoff));

    habitStreaks = habits.map((h) => {
      const dates = (logs ?? []).filter((l) => l.habit_id === h.id).map((l) => l.date);
      return { name: h.name, streak: computeStreak(dates) };
    });
  }

  const now = new Date();
  const staleProjects = (activeProjects ?? [])
    .map((p) => ({ ...p, daysSinceUpdate: daysBetween(now, new Date(p.updated_at)) }))
    .filter((p) => p.daysSinceUpdate >= 3);

  const upcomingDeadlines = (activeProjects ?? [])
    .filter((p) => p.deadline)
    .map((p) => ({ name: p.name, deadline: p.deadline, daysUntil: daysBetween(new Date(p.deadline), now) }))
    .filter((p) => p.daysUntil >= 0 && p.daysUntil <= 7);

  // Cross-module context: for each active project, what's actually linked
  // to it (tasks/notes/events/learning) via the relationships added
  // earlier. Lets the brief say something like "Cyber Terminal — 3
  // overdue tasks, meeting Thursday" instead of tasks and projects being
  // two disconnected lists that happen to share a page.
  const projectIds = (activeProjects ?? []).map((p) => p.id);
  const projectNames = new Map((activeProjects ?? []).map((p) => [p.id, p.name]));
  const graph = await getProjectGraph(supabase, projectIds, today);
  const projectContext = nonEmptyProjectGraph(graph, projectNames);

  const dataSummary = {
    date: today,
    overdue_tasks: (overdueTasks ?? []).map((t) => ({ title: t.title, priority: t.priority, due_date: t.due_date })),
    due_today: (todayTasks ?? []).map((t) => ({ title: t.title, priority: t.priority })),
    due_tomorrow: (tomorrowTasks ?? []).map((t) => ({ title: t.title, priority: t.priority })),
    habit_streaks: habitStreaks.filter((h) => h.streak > 0),
    broken_habits: habitStreaks.filter((h) => h.streak === 0).map((h) => h.name),
    stale_projects: staleProjects.map((p) => ({ name: p.name, days_since_update: p.daysSinceUpdate })),
    upcoming_deadlines: upcomingDeadlines,
    // Only projects with something actually linked appear here — see
    // nonEmptyProjectGraph's reasoning for why an empty entry is worse
    // than no entry.
    project_context: projectContext.map((p) => ({
      name: p.name,
      open_tasks: p.open_tasks,
      overdue_tasks: p.overdue_tasks,
      linked_notes: p.linked_notes,
      upcoming_events: p.upcoming_events,
      linked_learning: p.linked_learning,
    })),
  };

  const systemPrompt = `You write the bullet points for a short daily "Morning Brief" in a personal productivity app called LifeOS.

Match this exact tone and format — study it closely:

---
• Finish the DBMS assignment today.
• Edit the recruitment video.
• You're on an 8-day coding streak.
• One assignment is due tomorrow.
• SpotShare hasn't been updated in four days.
---

Rules:
- Never invent information. Only use what's in the JSON data provided — the example above is a style reference only, not real data.
- Output ONLY the bullets, 3-6 of them, each starting with "•". No greeting line, no name, no preamble, no closing line, no sign-off — those are added separately, not your job.
- Each bullet is a short clause or fragment, not a full explanatory sentence. Write "Finish the CI pipeline — due Jul 12" not "You have an overdue task called the CI pipeline which was due on July 12th."
- Prioritize: overdue first, then due today, then due tomorrow, then anything else notable (streaks, stale projects, upcoming deadlines) — pick the 3-6 most useful items total, don't list everything if there's a lot.
- project_context connects a project to what's actually linked to it (its own tasks/notes/events/learning, via the app's relationship links — distinct from the plain due-date/deadline fields above). Use it when it adds a genuinely useful connection — e.g. a project with several overdue tasks AND an upcoming linked event is worth one combined bullet ("Cyber Terminal — 3 overdue tasks, standup Thursday") rather than two disconnected ones. Don't force a project_context bullet in if nothing in it is actually noteworthy that day.
- Skip any category with nothing in it — don't mention it at all, don't say "no tasks due today."
- Tone: terse, direct, like a text from a sharp assistant who respects your time. Not a chatbot, not customer-service voice. Cut every filler word.
- Plain text only. No markdown headers, no bold, no numbered lists — bullets only using "•".`;

  const userPrompt = `Here is today's data:\n\n${JSON.stringify(dataSummary, null, 2)}\n\nWrite the bullets.`;

  const rateLimit = checkAIRateLimit();
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
      // gpt-oss-120b is a reasoning model — it can spend part of its token
      // budget on internal "thinking" before writing the visible answer,
      // so the budget here needs headroom beyond just the target output
      // length. reasoning_effort: "low" keeps that overhead small for a
      // task this simple (bullet list from structured JSON, no deep
      // reasoning actually needed).
      max_tokens: 700,
      reasoning_effort: "low",
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
  // Fallback: some gpt-oss responses put output in `reasoning` instead of
  // `content` if the model treated the whole answer as its reasoning
  // trace. Prefer content when present; only fall back when it's empty.
  const bullets = (message?.content?.trim() || message?.reasoning?.trim());

  if (!bullets) {
    console.error("Groq returned no usable content or reasoning:", JSON.stringify(result));
    return NextResponse.json({ error: "Groq returned an empty response." }, { status: 500 });
  }

  // The greeting is hard-coded here rather than generated by the model —
  // guarantees the name is always right regardless of what the model does.
  const content = `Good morning, ${USER_NAME}.\n${bullets}`;

  await supabase
    .from("ai_briefs")
    .upsert({ brief_date: today, content }, { onConflict: "brief_date" });

  return NextResponse.json({ content, cached: false, created_at: new Date().toISOString() });
}