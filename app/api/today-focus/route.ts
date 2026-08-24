import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAIRateLimit } from "@/lib/ai-rate-limit";
import { todayISO } from "@/lib/date";
import { buildLifeOSContext } from "@/lib/ai/context-engine";

export const dynamic = "force-dynamic";

const MODEL = "openai/gpt-oss-120b";

type FocusItem = {
  order: number;
  type: "task" | "project" | "habit" | "note";
  ref_id: string | null;
  title: string;
  reason: string;
};

export async function GET(req: NextRequest) {
  const regenerate = req.nextUrl.searchParams.get("regenerate") === "true";
  const today = todayISO();
  const supabase = createClient();

  if (!regenerate) {
    const { data: cached } = await supabase
      .from("ai_today_focus")
      .select("content, created_at")
      .eq("focus_date", today)
      .maybeSingle();
    if (cached) {
      return NextResponse.json({ ...cached.content, cached: true, created_at: cached.created_at });
    }
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not set in .env.local. Add it and restart the dev server." },
      { status: 500 }
    );
  }

  // Today Brain — roadmap Phase 2: Morning Brief and Prioritize merged into
  // one ordered focus plan, instead of two separate lists the user has to
  // reconcile themselves. Journal is included (neither Morning Brief nor
  // Prioritize used it) specifically for the "notice habit inconsistency
  // and relevant journal signals" part of the roadmap.
  const context = await buildLifeOSContext(supabase, {
    sections: ["tasks", "projects", "calendar", "habits", "journal"],
    lookaheadDays: 3,
  });

  const tasks = context.tasks!;
  const projects = context.projects!;
  const calendar = context.calendar!;
  const habits = context.habits!;
  const journal = context.journal!;

  // Nothing worth surfacing at all — skip the Groq call entirely rather
  // than spend a request asking the model to describe an empty day.
  const nothingToShow =
    tasks.overdue.length === 0 &&
    tasks.due_today.length === 0 &&
    tasks.due_soon.length === 0 &&
    tasks.no_due_date_high_priority.length === 0 &&
    projects.deadlines_approaching.length === 0 &&
    projects.stale.length === 0 &&
    habits.broken.length === 0;

  if (nothingToShow) {
    const emptyPlan = {
      headline: "Nothing urgent on the board right now.",
      focus_items: [] as FocusItem[],
    };
    await supabase.from("ai_today_focus").upsert({ focus_date: today, content: emptyPlan }, { onConflict: "focus_date" });
    return NextResponse.json({ ...emptyPlan, cached: false, created_at: new Date().toISOString() });
  }

  // Slim, id-bearing views of each candidate source the model is allowed
  // to reference. ref_id lets the frontend deep-link a focus item back to
  // its real task/project — and lets the cross-check below drop any id
  // the model didn't actually receive.
  const candidateTasks = [
    ...tasks.overdue.map((t) => ({ ...t, bucket: "overdue" })),
    ...tasks.due_today.map((t) => ({ ...t, bucket: "due_today" })),
    ...tasks.due_soon.map((t) => ({ ...t, bucket: "due_soon" })),
    ...tasks.no_due_date_high_priority.map((t) => ({ ...t, bucket: "no_due_date_high_priority" })),
  ];
  const candidateProjects = [
    ...projects.deadlines_approaching.map((p) => ({ id: p.id, name: p.name, signal: "deadline_approaching", deadline: p.deadline, days_until_deadline: p.days_until_deadline })),
    ...projects.stale.map((p) => ({ id: p.id, name: p.name, signal: "stale", days_since_update: p.days_since_update })),
  ];
  const candidateHabits = habits.habits.map((h) => ({ id: h.id, name: h.name, streak: h.streak, broken: h.streak === 0 }));

  const validTaskIds = new Set(candidateTasks.map((t) => t.id));
  const validProjectIds = new Set(candidateProjects.map((p) => p.id));
  const validHabitIds = new Set(candidateHabits.map((h) => h.id));

  const signals = {
    date: today,
    tasks: candidateTasks,
    projects: candidateProjects,
    habits: candidateHabits,
    // Day-level only — see calendar.has_time_of_day_data in the Context
    // Engine. The model is told explicitly below not to invent times.
    calendar: { events_today: calendar.today_count, upcoming: calendar.upcoming },
    // Trend signals only — never a diagnosis, never a cause. Mirrors the
    // grounding standard Journal Insights already holds itself to.
    journal_signal:
      journal.avg_mood_recent !== null
        ? { avg_mood_recent: journal.avg_mood_recent, avg_mood_previous: journal.avg_mood_previous }
        : null,
  };

  const systemPrompt = `You build a short, ordered "today's focus plan" for a personal productivity app called LifeOS — replacing what used to be two separate features (a morning summary and a task-priority list) with one combined recommendation.

Rules:
- Never invent a task, project, habit, or id that isn't in the JSON provided. Every focus item with type "task" must use a real id from the tasks array; type "project" a real id from projects; type "habit" a real id from habits. Use ref_id: null only for type "note" (a general observation with nothing to link to, e.g. a journal-mood signal).
- Do NOT invent specific clock times ("9:00 AM") or exact durations ("2 hours"). The data has no task-duration estimates and the calendar has no time-of-day data — only day-level event counts. Speak in relative order only: "first", "then", "after that".
- Order matters: focus_items should be in the sequence you recommend tackling them, most important first. Typically: overdue tasks first, then today's calendar load context, then due-today/due-soon, then a project signal if one is genuinely urgent (approaching deadline or notably stale), then at most one habit signal if a streak is broken and nothing more pressing exists.
- 3-6 focus_items total. Don't pad the list — if there are only 2 genuinely worth mentioning, return 2.
- journal_signal, if present, is a mood trend only (recent average vs. previous average) — never claim to know *why* mood changed. If you reference it, phrase it as an observation, not a diagnosis: "energy's trended down this week" is fine, "you seem stressed about the deadline" is not, since nothing in the data says that.
- "reason" is short and specific (under 15 words), e.g. "overdue since Aug 14, no other overdue work" not "this seems important."
- "headline" is one short sentence (under 15 words) framing the day's overall shape — e.g. "Two things overdue, otherwise a light day."
- Respond with ONLY valid JSON, no markdown fences, no commentary, in exactly this shape:
{"headline": "...", "focus_items": [{"order": 1, "type": "task|project|habit|note", "ref_id": "...|null", "title": "...", "reason": "..."}]}`;

  const userPrompt = `Today's signals:\n${JSON.stringify(signals, null, 2)}\n\nBuild the focus plan.`;

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
      max_tokens: 1200,
      reasoning_effort: "low",
      temperature: 0.2,
      response_format: { type: "json_object" },
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
  const raw = result.choices?.[0]?.message?.content?.trim();

  if (!raw) {
    console.error("Groq returned no content:", JSON.stringify(result));
    return NextResponse.json({ error: "Groq returned an empty response." }, { status: 500 });
  }

  let parsed: { headline: string; focus_items: FocusItem[] };
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error("Failed to parse model output as JSON:", raw);
    return NextResponse.json({ error: "The model's response wasn't valid JSON. Try again." }, { status: 500 });
  }

  // Drop any item referencing an id that was never actually offered to
  // the model — the same defensive cross-check prioritize-tasks uses.
  // "note" items are allowed through with ref_id null unconditionally.
  const validTypes = new Set(["task", "project", "habit", "note"]);
  const focusItems = (parsed.focus_items ?? [])
    .filter((item) => validTypes.has(item.type))
    .filter((item) => {
      if (item.type === "task") return item.ref_id !== null && validTaskIds.has(item.ref_id);
      if (item.type === "project") return item.ref_id !== null && validProjectIds.has(item.ref_id);
      if (item.type === "habit") return item.ref_id !== null && validHabitIds.has(item.ref_id);
      return true; // "note"
    })
    .sort((a, b) => a.order - b.order)
    .slice(0, 6);

  const plan = { headline: parsed.headline ?? "", focus_items: focusItems };

  await supabase.from("ai_today_focus").upsert({ focus_date: today, content: plan }, { onConflict: "focus_date" });

  return NextResponse.json({ ...plan, cached: false, created_at: new Date().toISOString() });
}