import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toLocalISODate as isoDate } from "@/lib/date";

export const dynamic = "force-dynamic";

const MODEL = "llama-3.3-70b-versatile";

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
      .select("id, title, tag, category, priority, status, due_date")
      .neq("status", "done")
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("projects").select("name, deadline").eq("status", "active").not("deadline", "is", null),
    supabase.from("events").select("date").gte("date", todayISO).lte("date", isoDate(weekOut)),
  ]);

  if (!openTasks || openTasks.length === 0) {
    return NextResponse.json({ summary: "No open tasks to prioritize.", suggestions: [] });
  }

  const eventsToday = (events ?? []).filter((e) => e.date === todayISO).length;
  const eventsThisWeek = (events ?? []).length;

  const upcomingDeadlines = (activeProjects ?? [])
    .map((p) => ({ name: p.name, deadline: p.deadline, days_until: daysBetween(new Date(p.deadline), today) }))
    .filter((p) => p.days_until >= 0 && p.days_until <= 14);

  const workload = {
    today: todayISO,
    open_task_count: openTasks.length,
    events_today: eventsToday,
    events_this_week: eventsThisWeek,
    upcoming_project_deadlines: upcomingDeadlines,
  };

  const tasksForPrompt = openTasks.map((t) => ({
    id: t.id,
    title: t.title,
    tag: t.tag,
    category: t.category,
    current_priority: t.priority,
    status: t.status,
    due_date: t.due_date,
  }));

  const systemPrompt = `You help prioritize an open task list in a personal productivity app called LifeOS.

Guiding principle: reduce busywork, don't replace thinking. You're suggesting an order and priority level — the user makes the final call on whether to apply it. Never claim a suggestion is the "right" answer, just the reasoning behind it.

Rules:
- Never invent tasks or ids. Only use what's in the provided JSON.
- For each task, suggest a priority ("low", "med", or "high") and an overall suggested_rank (1 = do first), based on: how soon it's due, whether it's already overdue, how much competing workload exists around that time (events, other tasks), and any signal from its category/tag.
- Tasks with no due date should generally rank lower than tasks with a due date, unless the title clearly signals urgency.
- "reason" must be short and specific (under 12 words) — e.g. "due tomorrow, only open task that day" not "this seems important."
- Only suggest a priority change if there's real reasoning for it — many tasks may correctly stay at their current priority. Don't manufacture changes just to have something to say.
- Respond with ONLY valid JSON, no markdown fences, no commentary, in exactly this shape:
{"summary": "one short sentence on the overall picture", "suggestions": [{"id": "...", "suggested_priority": "low|med|high", "suggested_rank": 1, "reason": "..."}]}
- Include every task id from the input, one entry each, ordered by suggested_rank ascending.`;

  const userPrompt = `Workload context:\n${JSON.stringify(workload, null, 2)}\n\nOpen tasks:\n${JSON.stringify(tasksForPrompt, null, 2)}\n\nReturn the prioritization.`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
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