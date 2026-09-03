import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAIRateLimit } from "@/lib/ai-rate-limit";
import { buildLifeOSContext, CONTEXT_GROUNDING_RULES } from "@/lib/ai/context-engine";
import { PROJECT_HEALTH_META } from "@/lib/project-health";

export const dynamic = "force-dynamic";

const MODEL = "openai/gpt-oss-120b";
const MAX_ITEMS_PER_TYPE = 120;
const SNIPPET_LENGTH = 280;

function truncate(text: string | null | undefined, len = SNIPPET_LENGTH) {
  if (!text) return "";
  return text.length > len ? text.slice(0, len) + "…" : text;
}

type CorpusItem = {
  type: "note" | "task" | "project" | "journal" | "event" | "learning" | "debt";
  id: string;
  title: string;
  snippet: string;
  meta?: string;
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const query: string | undefined = body?.query?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing 'query' in request body." }, { status: 400 });
  }
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not set in .env.local. Add it and restart the dev server." },
      { status: 500 }
    );
  }

  const supabase = createClient();

  // Roadmap Phase 6 — Ask LifeOS 2.0: alongside the raw corpus below (still
  // needed for full-text matching — context-engine doesn't carry note
  // bodies or project descriptions), pull the same structured context the
  // other AI tools already reason over. This is what lets a query like
  // "how's Cyber Terminal doing" or "why has my mood dropped" get a real
  // answer grounded in health/deadline/streak/mood math instead of just a
  // list of loosely keyword-matched items.
  const [{ data: notes }, { data: tasks }, { data: projects }, { data: journalEntries }, { data: events }, { data: learningItems }, { data: debts }, lifeOSContext] =
    await Promise.all([
      supabase
        .from("notes")
        .select("id, title, content, folder, tags, project_id")
        .order("updated_at", { ascending: false })
        .limit(MAX_ITEMS_PER_TYPE),
      supabase
        .from("tasks")
        .select("id, title, tag, category, status, priority, due_date, project_id")
        .order("updated_at", { ascending: false })
        .limit(MAX_ITEMS_PER_TYPE),
      supabase
        .from("projects")
        .select("id, name, description, category, status")
        .order("created_at", { ascending: false })
        .limit(MAX_ITEMS_PER_TYPE),
      supabase
        .from("journal_entries")
        .select("id, entry_date, wins, failures, lessons, tomorrow_goals, gratitude, mood")
        .order("entry_date", { ascending: false })
        .limit(MAX_ITEMS_PER_TYPE),
      supabase
        .from("events")
        .select("id, title, date, project_id")
        .order("date", { ascending: false })
        .limit(MAX_ITEMS_PER_TYPE),
      supabase
        .from("learning_items")
        .select("id, title, category, status, progress, project_id")
        .order("updated_at", { ascending: false })
        .limit(MAX_ITEMS_PER_TYPE),
      // Previously entirely absent from Ask LifeOS — a query naming a
      // person only ever mentioned in Finance → Debts & Loans had nowhere
      // to match before this.
      supabase
        .from("finance_debts")
        .select("id, person_name, direction, amount_bdt, note, due_date, settled")
        .order("settled", { ascending: true })
        .limit(MAX_ITEMS_PER_TYPE),
      buildLifeOSContext(supabase, { sections: ["tasks", "projects", "habits", "journal", "finance"] }),
    ]);

  // Project id -> name, so every other item type can surface which
  // project it's linked to (via phase6/13/14/15) in its own meta — lets a
  // query like "stuff about Cyber Terminal" match a task or note whose
  // own title/content never actually says "Cyber Terminal".
  const projectNameById = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const projectTag = (projectId: string | null) => (projectId && projectNameById.has(projectId) ? `project: ${projectNameById.get(projectId)}` : null);

  // Roadmap Phase 6: project id -> its health/deadline signal from the
  // Context Engine, so a project's own corpus entry (and the reasoning
  // behind it) can cite the same "At Risk, deadline in 3 days" logic
  // Project Health cards already show, instead of the model guessing at
  // urgency from raw status/deadline fields alone.
  const projectSignalById = new Map(
    (lifeOSContext.projects?.active ?? []).map((p) => [
      p.id,
      [
        p.health ? `health: ${PROJECT_HEALTH_META[p.health.state].label} (${p.health.reason})` : null,
        p.days_until_deadline !== null ? `deadline in ${p.days_until_deadline}d` : null,
      ]
        .filter(Boolean)
        .join(", "),
    ])
  );

  const corpus: CorpusItem[] = [
    ...(notes ?? []).map((n) => ({
      type: "note" as const,
      id: n.id,
      title: n.title,
      snippet: truncate(n.content),
      meta: [n.folder, ...(n.tags ?? []), projectTag(n.project_id)].filter(Boolean).join(", "),
    })),
    ...(tasks ?? []).map((t) => ({
      type: "task" as const,
      id: t.id,
      title: t.title,
      snippet: "",
      meta: [t.status, t.priority, t.category, t.due_date ? `due ${t.due_date}` : null, projectTag(t.project_id)].filter(Boolean).join(", "),
    })),
    ...(projects ?? []).map((p) => ({
      type: "project" as const,
      id: p.id,
      title: p.name,
      snippet: truncate(p.description),
      meta: [p.category, p.status, projectSignalById.get(p.id)].filter(Boolean).join(", "),
    })),
    ...(journalEntries ?? []).map((j) => ({
      type: "journal" as const,
      id: j.id,
      title: `Journal — ${j.entry_date}`,
      snippet: truncate([j.wins, j.failures, j.lessons, j.gratitude].filter(Boolean).join(" | ")),
      meta: `mood ${j.mood}/5`,
    })),
    ...(events ?? []).map((e) => ({
      type: "event" as const,
      id: e.id,
      title: e.title,
      snippet: "",
      meta: [e.date, projectTag(e.project_id)].filter(Boolean).join(", "),
    })),
    ...(learningItems ?? []).map((li) => ({
      type: "learning" as const,
      id: li.id,
      title: li.title,
      snippet: "",
      meta: [li.category, li.status, `${li.progress}% done`, projectTag(li.project_id)].filter(Boolean).join(", "),
    })),
    ...(debts ?? []).map((d) => ({
      type: "debt" as const,
      id: d.id,
      title: d.person_name,
      snippet: truncate(d.note),
      meta: [
        d.direction === "owed_to_me" ? "owed to me" : "I owe",
        `${d.amount_bdt} BDT`,
        d.due_date ? `due ${d.due_date}` : null,
        d.settled ? "settled" : null,
      ]
        .filter(Boolean)
        .join(", "),
    })),
  ];

  if (corpus.length === 0) {
    return NextResponse.json({ results: [], summary: "There's nothing yet across Notes, Tasks, Projects, Calendar, Learning, or Journal to search." });
  }

  // Roadmap Phase 6: a compact status digest (not the raw corpus) for
  // questions that aren't really "find me an item" — mood trend, habit
  // streaks, finance overview. Kept separate and small on purpose: this
  // is supporting evidence for the "summary" answer, not something the
  // model should be pattern-matching query text against the way it does
  // the corpus above.
  const statusDigest = {
    open_task_count: lifeOSContext.tasks?.open_count ?? null,
    overdue_task_count: lifeOSContext.tasks?.overdue.length ?? null,
    habits: (lifeOSContext.habits?.habits ?? []).map((h) => ({ name: h.name, streak: h.streak, success_rate_30d: h.success_rate_30d })),
    broken_habits: lifeOSContext.habits?.broken ?? [],
    mood_avg_recent: lifeOSContext.journal?.avg_mood_recent ?? null,
    mood_avg_previous: lifeOSContext.journal?.avg_mood_previous ?? null,
    finance_month_to_date: lifeOSContext.finance?.month_to_date ?? null,
    finance_top_expense_categories: lifeOSContext.finance?.top_expense_categories ?? [],
  };

  const systemPrompt = `You are Ask LifeOS, a search-and-status assistant over a personal productivity app's data. You'll get a natural-language query, a JSON array of searchable items (notes, tasks, projects, calendar events, learning items, journal entries), and a separate "status digest" with computed signals (open/overdue task counts, habit streaks, mood trend, finance overview) that aren't tied to any single item.

${CONTEXT_GROUNDING_RULES}

Rules:
- For a query asking to find or recall something ("what did I write about X", "tasks tagged Y"), return matching items — loosely on meaning, not just exact keywords. Do not force a fixed count; return however many genuinely match, up to 8. If nothing matches, return an empty array.
- For a query asking about status, trend, or how something is going ("how's Cyber Terminal doing", "why has my mood dropped", "am I overspending"), use the status digest (and any matching project/task items) to write a real, specific answer in "summary" — cite the actual numbers (streak length, mood averages, days until deadline). Still return any directly relevant items (e.g. the project itself) so there's something to click through to, but don't force items to exist just to fill the array.
- Never invent items, ids, numbers, or content that aren't in the provided JSON or status digest.
- Some items' "meta" field includes "project: <name>" when linked to a project, and a project's own "meta" may include a "health: ..." signal computed by LifeOS's Project Health feature — treat both as strong, literal signals, not just text to keyword-match.
- A "debt" item's title is a person's name — e.g. "Nirob" — with direction ("owed to me" / "I owe"), amount, and due date in its meta. Match these on the person's name just like any other item.
- Respond with ONLY valid JSON, no markdown fences, no commentary, in exactly this shape:
{"summary": "one or two sentences: either what was found, or a real answer grounded in the status digest", "results": [{"type": "note|task|project|journal|event|learning|debt", "id": "...", "title": "...", "reason": "short phrase, why this matched"}]}
- "reason" should be specific and short (under 12 words), e.g. "mentions the same deadline" or "health: At Risk, deadline in 3 days" — not "this seems related."`;

  const userPrompt = `Query: "${query}"\n\nStatus digest:\n${JSON.stringify(statusDigest)}\n\nSearchable items:\n${JSON.stringify(corpus)}`;

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
      max_tokens: 2000,
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

  let parsed: { summary: string; results: { type: string; id: string; title: string; reason: string }[] };
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error("Failed to parse model output as JSON:", raw);
    return NextResponse.json({ error: "The model's response wasn't valid JSON. Try rephrasing the query." }, { status: 500 });
  }

  // Cross-check ids actually exist in the corpus — drop anything hallucinated.
  const corpusIds = new Set(corpus.map((c) => `${c.type}:${c.id}`));
  const safeResults = (parsed.results ?? []).filter((r) => corpusIds.has(`${r.type}:${r.id}`));

  // Roadmap Phase 6, Part 2: a "signal" badge for the UI — computed here
  // from the same deterministic Context Engine / Project Health data
  // already used above, not read back out of the model's free-text
  // "reason". Keeps the badge auditable (same rule Phase 4's Project
  // Health card holds itself to) instead of depending on the model
  // consistently phrasing "health: At Risk" the same way every time.
  const overdueTaskIds = new Set((lifeOSContext.tasks?.overdue ?? []).map((t) => t.id));
  const projectHealthLabelById = new Map(
    (lifeOSContext.projects?.active ?? [])
      .filter((p) => p.health)
      .map((p) => [p.id, PROJECT_HEALTH_META[p.health!.state].label])
  );

  const overdueDebtIds = new Set(
    (debts ?? []).filter((d) => !d.settled && d.due_date && d.due_date < lifeOSContext.meta.today).map((d) => d.id)
  );

  const resultsWithSignal = safeResults.map((r) => {
    let signal: string | null = null;
    if (r.type === "project") signal = projectHealthLabelById.get(r.id) ?? null;
    if (r.type === "task" && overdueTaskIds.has(r.id)) signal = "Overdue";
    if (r.type === "debt" && overdueDebtIds.has(r.id)) signal = "Overdue";
    return { ...r, signal };
  });

  return NextResponse.json({ summary: parsed.summary ?? "", results: resultsWithSignal });
}