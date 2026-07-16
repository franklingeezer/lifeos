import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MODEL = "llama-3.3-70b-versatile";
const MAX_ITEMS_PER_TYPE = 120;
const SNIPPET_LENGTH = 280;

function truncate(text: string | null | undefined, len = SNIPPET_LENGTH) {
  if (!text) return "";
  return text.length > len ? text.slice(0, len) + "…" : text;
}

type CorpusItem = {
  type: "note" | "task" | "project" | "journal";
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

  const [{ data: notes }, { data: tasks }, { data: projects }, { data: journalEntries }] = await Promise.all([
    supabase
      .from("notes")
      .select("id, title, content, folder, tags")
      .order("updated_at", { ascending: false })
      .limit(MAX_ITEMS_PER_TYPE),
    supabase
      .from("tasks")
      .select("id, title, tag, category, status, priority, due_date")
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
  ]);

  const corpus: CorpusItem[] = [
    ...(notes ?? []).map((n) => ({
      type: "note" as const,
      id: n.id,
      title: n.title,
      snippet: truncate(n.content),
      meta: [n.folder, ...(n.tags ?? [])].filter(Boolean).join(", "),
    })),
    ...(tasks ?? []).map((t) => ({
      type: "task" as const,
      id: t.id,
      title: t.title,
      snippet: "",
      meta: [t.status, t.priority, t.category, t.due_date ? `due ${t.due_date}` : null].filter(Boolean).join(", "),
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
  ];

  if (corpus.length === 0) {
    return NextResponse.json({ results: [], summary: "There's nothing in Notes, Tasks, Projects, or Journal yet to search." });
  }

  const systemPrompt = `You are a search engine over a personal productivity app's data. You'll get a natural-language query and a JSON array of items (notes, tasks, projects, journal entries).

Rules:
- Only return items that are actually relevant to the query. Do not force a fixed count — return however many genuinely match, up to 8. If nothing matches, return an empty array.
- Never invent items, ids, or content that aren't in the provided JSON.
- Judge relevance loosely — match on meaning, not just exact keywords. "stuff about the car project" should match a project about cars even if the query doesn't say "project".
- Respond with ONLY valid JSON, no markdown fences, no commentary, in exactly this shape:
{"summary": "one short sentence describing what was found", "results": [{"type": "note|task|project|journal", "id": "...", "title": "...", "reason": "short phrase, why this matched"}]}
- "reason" should be specific and short (under 12 words), e.g. "mentions the same deadline" not "this seems related."`;

  const userPrompt = `Query: "${query}"\n\nItems:\n${JSON.stringify(corpus)}`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
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