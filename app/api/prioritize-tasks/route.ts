import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAIRateLimit } from "@/lib/ai-rate-limit";
import { toLocalISODate as isoDate } from "@/lib/date";

export const dynamic = "force-dynamic";

const MODEL = "openai/gpt-oss-120b";

function daysBetween(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export async function POST(_req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not set in .env.local. Add it and restart the dev server." },
      { status: 500 }
    );
  }

  const supabase = createClient();
  const today = new Date();
  const todayISO = isoDate(today);
  const weekOut = new Date();
  weekOut.setDate(weekOut.getDate() + 7);

  const [{ data: openTasks }, { data: activeProjects }, { data: events }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, tag, category, priority, status, due_date, project_id")
      .neq("status", "done")
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("projects").select("id, name, deadline").eq("status", "active").not("deadline", "is", null),
    supabase.from("events").select("date").gte("date", todayISO).lte("date", isoDate(weekOut)),
  ]);

  if (!openTasks || openTasks.length === 0) {
    return NextResponse.json({ summary: "No open tasks to prioritize.", suggestions: [] });
  }

  const eventsToday = (events ?? []).filter((e) => e.date === todayISO).length;
  const eventsThisWeek = (events ?? []).length;

  const upcomingDeadlines = (activeProjects ?? [])
    .map((p) => ({ id: p.id, name: p.name, deadline: p.deadline, days_until: daysBetween(new Date(p.deadline), today) }))
    .filter((p) => p.days_until >= 0 && p.days_until <= 14);

  // Keyed by project id (not name — names aren't guaranteed unique) so
  // each task can look up its own project's deadline urgency below,
  // independent of the flat list shown in workload context.
  const deadlineByProjectId = new Map(upcomingDeadlines.map((p) => [p.id, p]));

  const workload = {
    today: todayISO,
    open_task_count: openTasks.length,
    events_today: eventsToday,
    events_this_week: eventsThisWeek,
    // Project id deliberately omitted here — this is prompt-facing
    // summary text, and the task list below is where project ids actually
    // matter to the model. Keeping two different kinds of id in play
    // in the same prompt is exactly the kind of thing that risks the
    // model mixing them up.
    upcoming_project_deadlines: upcomingDeadlines.map(({ name, deadline, days_until }) => ({ name, deadline, days_until })),
  };

  const tasksForPrompt = openTasks.map((t) => {
    const projectDeadline = t.project_id ? deadlineByProjectId.get(t.project_id) : undefined;
    return {
      id: t.id,
      title: t.title,
      tag: t.tag,
      category: t.category,
      current_priority: t.priority,
      status: t.status,
      due_date: t.due_date,
      // Present only when this task belongs to a project with a deadline
      // inside the next 14 days — a signal the task's own due_date alone
      // wouldn't capture (a task can have no due date set but still be
      // effectively urgent because the project it's part of is due soon).
      ...(projectDeadline
        ? { project_deadline: { project_name: projectDeadline.name, days_until: projectDeadline.days_until } }
        : {}),
    };
  });

  const systemPrompt = `You help prioritize an open task list in a personal productivity app called LifeOS.

Guiding principle: reduce busywork, don't replace thinking. You're suggesting an order and priority level — the user makes the final call on whether to apply it. Never claim a suggestion is the "right" answer, just the reasoning behind it.

Rules:
- Never invent tasks or ids. Only use what's in the provided JSON.
- For each task, suggest a priority ("low", "med", or "high") and an overall suggested_rank (1 = do first), based on: how soon it's due, whether it's already overdue, how much competing workload exists around that time (events, other tasks), and any signal from its category/tag.
- A task with a project_deadline field belongs to a project whose deadline is within 14 days — weigh that urgency into suggested_rank/priority even if the task's own due_date is unset or further out, since finishing it likely matters to hitting that deadline. Mention it in "reason" when it's the deciding factor (e.g. "no due date, but Cyber Terminal is due in 3 days").
- Tasks with no due date should generally rank lower than tasks with a due date, unless the title clearly signals urgency.
- "reason" must be short and specific (under 12 words) — e.g. "due tomorrow, only open task that day" not "this seems important."
- Only suggest a priority change if there's real reasoning for it — many tasks may correctly stay at their current priority. Don't manufacture changes just to have something to say.
- Respond with ONLY valid JSON, no markdown fences, no commentary, in exactly this shape:
{"summary": "one short sentence on the overall picture", "suggestions": [{"id": "...", "suggested_priority": "low|med|high", "suggested_rank": 1, "reason": "..."}]}
- Include every task id from the input, one entry each, ordered by suggested_rank ascending.`;

  const userPrompt = `Workload context:\n${JSON.stringify(workload, null, 2)}\n\nOpen tasks:\n${JSON.stringify(tasksForPrompt, null, 2)}\n\nReturn the prioritization.`;

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
      max_tokens: 3000,
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
  // No content/reasoning fallback here (unlike the plain-text routes) —
  // this needs valid JSON specifically, and reasoning is prose, not JSON,
  // so falling back to it would just fail JSON.parse below with a worse
  // error instead of a clearer one.
  const raw = result.choices?.[0]?.message?.content?.trim();

  if (!raw) {
    console.error("Groq returned no content:", JSON.stringify(result));
    return NextResponse.json({ error: "Groq returned an empty response." }, { status: 500 });
  }

  let parsed: { summary: string; suggestions: { id: string; suggested_priority: string; suggested_rank: number; reason: string }[] };
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error("Failed to parse model output as JSON:", raw);
    return NextResponse.json({ error: "The model's response wasn't valid JSON. Try again." }, { status: 500 });
  }

  // Cross-check ids and priority values — drop anything hallucinated or malformed.
  const validIds = new Set(openTasks.map((t) => t.id));
  const validPriorities = new Set(["low", "med", "high"]);
  const taskById = new Map(openTasks.map((t) => [t.id, t]));

  const suggestions = (parsed.suggestions ?? [])
    .filter((s) => validIds.has(s.id) && validPriorities.has(s.suggested_priority))
    .sort((a, b) => a.suggested_rank - b.suggested_rank)
    .map((s) => {
      const task = taskById.get(s.id)!;
      return {
        id: s.id,
        title: task.title,
        tag: task.tag,
        due_date: task.due_date,
        current_priority: task.priority,
        suggested_priority: s.suggested_priority,
        suggested_rank: s.suggested_rank,
        reason: s.reason,
      };
    });

  return NextResponse.json({ summary: parsed.summary ?? "", suggestions });
}