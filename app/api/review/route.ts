import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MODEL = "llama-3.3-70b-versatile";
const USER_NAME = "Chief";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function periodFor(type: "weekly" | "monthly") {
  const end = new Date();
  const start = new Date();
  if (type === "weekly") start.setDate(start.getDate() - 6);
  else start.setDate(start.getDate() - 29);
  return { start: isoDate(start), end: isoDate(end) };
}

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

export async function GET(req: NextRequest) {
  const type = (req.nextUrl.searchParams.get("type") === "monthly" ? "monthly" : "weekly") as "weekly" | "monthly";
  const regenerate = req.nextUrl.searchParams.get("regenerate") === "true";
  const { start, end } = periodFor(type);
  const supabase = createClient();

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
    supabase.from("projects").select("name, status, progress").eq("status", "active"),
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
      .gte("date", cutoff.toISOString().slice(0, 10));

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
- Skip any section with nothing meaningful in it. Don't say "no journal entries this ${label}" — just omit the section.
- Bullets are short fragments, not full sentences. "5 tasks closed, 2 still overdue" not "You managed to complete five tasks this week, though two remain overdue."
- If mood/energy/stress data exists, mention it briefly as an observation, not a diagnosis — e.g. "mood held steady around 4/5" not "you seem happy."
- End with one short neutral observation line if something stands out (a streak, a stale project, a spending pattern) — phrased as a fact, not advice. No "you should" or "consider doing X."
- No greeting-card tone, no "great job!", no exclamation points, no emoji.
- Plain text only. No markdown headers (#), no bold (**). Section labels are just plain capitalized text on their own line.`;

  const userPrompt = `Here is the data for this ${label} (${start} to ${end}):\n\n${JSON.stringify(dataSummary, null, 2)}\n\nWrite the review.`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: type === "monthly" ? 900 : 650,
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
  const content = result.choices?.[0]?.message?.content?.trim();

  if (!content) {
    return NextResponse.json({ error: "Groq returned an empty response." }, { status: 500 });
  }

  await supabase
    .from("ai_reviews")
    .upsert({ period_type: type, period_start: start, period_end: end, content }, { onConflict: "period_type,period_start" });

  return NextResponse.json({ content, cached: false, created_at: new Date().toISOString(), period: { start, end } });
}