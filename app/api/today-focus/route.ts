import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAIRateLimit } from "@/lib/ai-rate-limit";
import { todayISO } from "@/lib/date";
import { buildLifeOSContext, timeToMinutes } from "@/lib/ai/context-engine";
import { buildFocusGrounding, sanitizeFocusPlan } from "@/lib/ai/focus-grounding";

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

  // Roadmap — Plan My Day, Part 3b. What's already on the calendar for
  // tasks, and how today's estimated work compares to today's real free
  // time. All of it is computed from data (Context Engine, 3a) — nothing
  // here is the model's estimate, and the model is told so below.
  const freeMinutesToday = calendar.today_free_blocks.reduce(
    (sum, b) => sum + (timeToMinutes(b.end) - timeToMinutes(b.start)),
    0
  );
  const schedule = {
    // Blocks already on today's calendar for open tasks, earliest first.
    scheduled_today: tasks.scheduled_today.map((b) => ({ task_id: b.task_id, title: b.title, start_time: b.start_time, end_time: b.end_time })),
    // Blocks whose time passed with the task still open (last 7 days).
    missed_blocks: tasks.missed_blocks.map((b) => ({ task_id: b.task_id, title: b.title, date: b.date, start_time: b.start_time, end_time: b.end_time })),
    // Sum of the user's own estimates across overdue + due-today tasks. Tasks with no estimate add nothing — see due_now_unestimated_count.
    due_now_estimated_minutes: tasks.due_now_estimated_minutes,
    due_now_unestimated_count: tasks.due_now_unestimated_count,
    free_minutes_today: freeMinutesToday,
  };

  // Everything the model was shown that carries a clock time or a
  // duration — the allow-list the output is checked against afterwards.
  const grounding = buildFocusGrounding({
    freeBlocks: calendar.today_free_blocks,
    blocks: [
      ...tasks.scheduled_today,
      ...tasks.missed_blocks,
      ...candidateTasks.flatMap((t) => (t.next_block ? [t.next_block] : [])),
    ],
    taskEstimates: candidateTasks.flatMap((t) => (t.estimated_minutes ? [t.estimated_minutes] : [])),
    extraDurations: [tasks.due_now_estimated_minutes, freeMinutesToday],
  });

  const signals = {
    date: today,
    tasks: candidateTasks,
    projects: candidateProjects,
    habits: candidateHabits,
    schedule,
    // Roadmap Phase 3, Part 5 — today_free_blocks/today_busy_minutes are
    // now real, computed availability (see Context Engine's buildCalendar),
    // not a placeholder. The model is told below it may cite these exact
    // windows but still may not invent any time not literally in this array.
    calendar: {
      events_today: calendar.today_count,
      upcoming: calendar.upcoming,
      today_busy_minutes: calendar.today_busy_minutes,
      today_free_blocks: calendar.today_free_blocks,
    },
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
- calendar.today_free_blocks lists today's genuinely open windows (each an exact "HH:MM"-"HH:MM" pair, already computed — not your estimate). You may cite one of these exact windows verbatim (e.g. "free 14:00-16:00, good spot for this") when it's genuinely useful for ordering the plan. Never invent a clock time, window, or duration that isn't literally present in the JSON (a free block, a scheduled/missed block, or an estimated_minutes value) or literally derivable by subtracting two clock times in it. If today_free_blocks is empty, say the day is booked solid rather than inventing a gap.
- Some tasks carry estimated_minutes — the user's OWN estimate. You may cite it as given (e.g. "est. 45 min"). A task with no estimated_minutes has no known duration: never guess one, and never say how long it will take.
- A task with next_block already has a time block on the calendar (date, start_time, end_time). If next_block.date is today's date, say it's already blocked at that time instead of treating it as unplanned, and never suggest a free window for a task that's already blocked.
- schedule.scheduled_today lists today's blocks for open tasks. schedule.missed_blocks lists blocks whose time already passed with the task still open — you may mention that a task's block was missed as a reason to prioritize it, in neutral wording ("block missed yesterday"), but never propose a new time for it; the app handles rescheduling separately. Mention missed blocks in at most one focus item.
- schedule.due_now_estimated_minutes is the sum of the user's own estimates for overdue + due-today tasks, and schedule.free_minutes_today is today's real remaining free time. If the first exceeds the second you may say it won't all fit, citing both numbers as given. If schedule.due_now_unestimated_count is above 0, the total is incomplete — say "at least" rather than presenting it as the full amount. Never add up, scale, or round these numbers into a figure that isn't in the data.
- Order matters: focus_items should be in the sequence you recommend tackling them, most important first. Typically: overdue tasks first, then today's calendar load context (citing a free block if one genuinely fits), then due-today/due-soon, then a project signal if one is genuinely urgent (approaching deadline or notably stale), then at most one habit signal if a streak is broken and nothing more pressing exists.
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

  // Roadmap — Plan My Day, Part 3b. The prompt forbids invented times and
  // durations, but a prompt is a request; this is the enforcement. Any
  // clock time or duration in the model's own wording that isn't present
  // in the data it was shown is removed (see lib/ai/focus-grounding.ts).
  const bucketById = new Map(candidateTasks.map((t) => [t.id, t.bucket]));
  const BUCKET_REASON: Record<string, string> = {
    overdue: "Overdue",
    due_today: "Due today",
    due_soon: "Due soon",
    no_due_date_high_priority: "High priority, no due date",
  };
  const signalById = new Map(candidateProjects.map((p) => [p.id, p.signal]));

  const checked = sanitizeFocusPlan({ headline: parsed.headline ?? "", focus_items: focusItems }, grounding, (item) => {
    if (item.type === "task") return BUCKET_REASON[bucketById.get(item.ref_id ?? "") ?? ""] ?? null;
    if (item.type === "project") return signalById.get(item.ref_id ?? "") === "stale" ? "Hasn't been updated in a while" : "Deadline approaching";
    if (item.type === "habit") return "Streak is broken";
    return null; // a free-form "note" has no data-backed fallback — drop it
  });

  if (checked.headlineBlanked || checked.reasonsReplaced > 0 || checked.itemsDropped > 0) {
    console.warn(
      `today-focus: removed ungrounded specifics (headline blanked: ${checked.headlineBlanked}, reasons replaced: ${checked.reasonsReplaced}, items dropped: ${checked.itemsDropped})`
    );
  }

  const plan = checked.plan;

  await supabase.from("ai_today_focus").upsert({ focus_date: today, content: plan }, { onConflict: "focus_date" });

  return NextResponse.json({ ...plan, cached: false, created_at: new Date().toISOString() });
}