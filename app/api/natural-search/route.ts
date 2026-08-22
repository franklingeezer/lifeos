import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAIRateLimit } from "@/lib/ai-rate-limit";

export const dynamic = "force-dynamic";

const MODEL = "openai/gpt-oss-120b";
const MAX_ITEMS_PER_TYPE = 120;
const SNIPPET_LENGTH = 280;

function truncate(text: string | null | undefined, len = SNIPPET_LENGTH) {
  if (!text) return "";
  return text.length > len ? text.slice(0, len) + "…" : text;
}

type CorpusItem = {
  type: "note" | "task" | "project" | "journal" | "event" | "learning";
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

  const [{ data: notes }, { data: tasks }, { data: projects }, { data: journalEntries }, { data: events }, { data: learningItems }] = await Promise.all([
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
    // Previously entirely absent from Ask LifeOS — a search for "when's
    // that meeting" or "what's due around the launch" had nothing to
    // search against before this.
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
  ]);

  // Project id -> name, so every other item type can surface which
  // project it's linked to (via phase6/13/14/15) in its own meta — lets a
  // query like "stuff about Cyber Terminal" match a task or note whose
  // own title/content never actually says "Cyber Terminal".
  const projectNameById = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const projectTag = (projectId: string | null) => (projectId && projectNameById.has(projectId) ? `project: ${projectNameById.get(projectId)}` : null);

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
      meta: [p.category, p.status].filter(Boolean).join(", "),
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
  ];

  if (corpus.length === 0) {
    return NextResponse.json({ results: [], summary: "There's nothing yet across Notes, Tasks, Projects, Calendar, Learning, or Journal to search." });
  }

  const systemPrompt = `You are a search engine over a personal productivity app's data. You'll get a natural-language query and a JSON array of items (notes, tasks, projects, calendar events, learning items, journal entries).

Rules:
- Only return items that are actually relevant to the query. Do not force a fixed count — return however many genuinely match, up to 8. If nothing matches, return an empty array.
- Never invent items, ids, or content that aren't in the provided JSON.
- Judge relevance loosely — match on meaning, not just exact keywords. "stuff about the car project" should match a project about cars even if the query doesn't say "project".
- Some items' "meta" field includes "project: <name>" when that item is linked to a project. Treat that as a real, strong relevance signal — a query naming a project should surface every item tagged to it (tasks, notes, events, learning), not just the project record itself.
- Respond with ONLY valid JSON, no markdown fences, no commentary, in exactly this shape:
{"summary": "one short sentence describing what was found", "results": [{"type": "note|task|project|journal|event|learning", "id": "...", "title": "...", "reason": "short phrase, why this matched"}]}
- "reason" should be specific and short (under 12 words), e.g. "mentions the same deadline" not "this seems related."`;

  const userPrompt = `Query: "${query}"\n\nItems:\n${JSON.stringify(corpus)}`;

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
      max_tokens: 1800,
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

  return NextResponse.json({ summary: parsed.summary ?? "", results: safeResults });
}