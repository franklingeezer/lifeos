import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toLocalISODate as isoDate } from "@/lib/date";

export const dynamic = "force-dynamic";

const MODEL = "llama-3.3-70b-versatile";
const DEFAULT_USER_NAME = "Chief";

type RangeType = "30d" | "90d" | "all";

function rangeFor(range: RangeType) {
  const end = new Date();
  if (range === "all") return { start: null as string | null, end: isoDate(end) };
  const start = new Date();
  start.setDate(start.getDate() - (range === "30d" ? 29 : 89));
  return { start: isoDate(start), end: isoDate(end) };
}

export async function GET(req: NextRequest) {
  const rangeParam = req.nextUrl.searchParams.get("range");
  const range: RangeType = rangeParam === "90d" || rangeParam === "all" ? rangeParam : "30d";
  const regenerate = req.nextUrl.searchParams.get("regenerate") === "true";
  const { start, end } = rangeFor(range);
  const supabase = createClient();

  const { data: settingsRow } = await supabase.from("app_settings").select("display_name").eq("id", 1).maybeSingle();
  const USER_NAME = settingsRow?.display_name || DEFAULT_USER_NAME;

  if (!regenerate) {
    const { data: cached } = await supabase
      .from("ai_journal_insights")
      .select("content, entry_count, created_at")
      .eq("range_type", range)
      .eq("period_end", end)
      .maybeSingle();
    if (cached) {
      return NextResponse.json({
        content: cached.content,
        entry_count: cached.entry_count,
        cached: true,
        created_at: cached.created_at,
        period: { start, end },
      });
    }
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not set in .env.local. Add it and restart the dev server." },
      { status: 500 }
    );
  }

  let query = supabase
    .from("journal_entries")
    .select("entry_date, mood, energy, stress, wins, failures, lessons, tomorrow_goals, gratitude")
    .order("entry_date", { ascending: true });

  if (start) query = query.gte("entry_date", start);
  query = query.lte("entry_date", end);

  const { data: entries, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!entries || entries.length < 3) {
    return NextResponse.json({
      content: `Not enough journal entries yet in this range to find real patterns — ${entries?.length ?? 0} so far. A few more and this'll have something to work with.`,
      entry_count: entries?.length ?? 0,
      cached: false,
      created_at: new Date().toISOString(),
      period: { start, end },
    });
  }

  const corpus = entries.map((e) => ({
    date: e.entry_date,
    mood: e.mood,
    energy: e.energy,
    stress: e.stress,
    wins: e.wins,
    failures: e.failures,
    lessons: e.lessons,
    gratitude: e.gratitude,
  }));

  const systemPrompt = `You analyze journal entries for ${USER_NAME} in a personal productivity app called LifeOS, looking for real patterns — not just summarizing each entry.

Guiding principle: quietly help, don't take over. Report what the data shows. Don't diagnose, don't moralize, don't give life advice, don't tell ${USER_NAME} what to feel or do differently. If you're not confident about a pattern, say so or leave it out rather than overreaching.

CRITICAL — grounding requirement: if you name a specific date as a turning point or attribute a mood/energy/stress change to a cause, that cause MUST be something explicitly written in that date's own wins/failures/lessons/gratitude text. Never guess, infer, or invent a reason that isn't literally present in the entry text for that date. If you don't know why a shift happened because the entry doesn't say, describe the shift itself (numbers only) without attributing a cause. Do not reference anything — bugs, features, events — that isn't explicitly named in the provided entries.

Rules:
- Never invent entries, dates, content, or causes. Only use what's in the JSON provided.
- Look for genuine patterns across multiple entries: recurring topics in wins/failures/lessons, mood or stress trends over time, days/periods that stand out as noticeably better or worse, recurring gratitude themes.
- If there's no real pattern in something, don't force one — say the data's too mixed or thin rather than inventing a trend.
- Structure: one-line opening, then a few short plain-text section labels in CAPS (e.g. RECURRING THEMES, MOOD & STRESS, NOTABLE SHIFTS — only sections with real content), each with 1-4 terse bullets using "•".
- Bullets are short observations, not full sentences. "Stress spiked around Jul 10-12" not "It looks like your stress levels increased significantly around July 10th to 12th."
- No greeting-card tone, no exclamation points, no emoji, no "you should" or "consider."
- Plain text only. No markdown headers (#), no bold (**).`;

  const userPrompt = `Journal entries from ${start ?? "the beginning"} to ${end} (${entries.length} entries):\n\n${JSON.stringify(corpus, null, 2)}\n\nWrite the insights.`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 700,
      temperature: 0.15,
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
    .from("ai_journal_insights")
    .upsert(
      { range_type: range, period_start: start, period_end: end, entry_count: entries.length, content },
      { onConflict: "range_type,period_end" }
    );

  return NextResponse.json({
    content,
    entry_count: entries.length,
    cached: false,
    created_at: new Date().toISOString(),
    period: { start, end },
  });
}