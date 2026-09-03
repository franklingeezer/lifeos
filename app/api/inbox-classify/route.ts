import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAIRateLimit } from "@/lib/ai-rate-limit";
import type { ConvertedType } from "@/hooks/useInbox";

export const dynamic = "force-dynamic";

const MODEL = "openai/gpt-oss-120b";

const VALID_TYPES: ConvertedType[] = ["task", "note", "idea", "project", "event", "reminder"];
const VALID_CONFIDENCE = new Set(["high", "medium", "low"]);

/**
 * LifeOS Roadmap — Phase 5: Smart Inbox classification.
 *
 * Per the Inbox design doc (section 13, "AI Integration — Later"): AI is
 * never mandatory for the Inbox to work — this route only ever suggests
 * a category, never assigns one. InboxProcessDrawer still opens with
 * "Task" selected by default and the person always confirms/overrides
 * before Convert, exactly like the doc's mock ("The user should always
 * confirm the AI suggestion before conversion").
 *
 * Deliberately excludes due-date extraction — the doc lists "Natural-
 * language date extraction" as a separate future improvement (section
 * 15), not part of the core category-suggestion feature (section 13).
 * Keeping this route to one job (type + confidence + reason) keeps the
 * prompt small and the failure mode simple: worst case, the suggestion
 * banner just doesn't show, and manual processing works exactly as it
 * does today.
 */
export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not set in .env.local. Add it and restart the dev server." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const content: string | undefined = body?.content?.trim();

  if (!content) {
    return NextResponse.json({ error: "Missing 'content' in request body." }, { status: 400 });
  }

  const supabase = createClient();

  const rateLimit = await checkAIRateLimit(supabase);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `You're sending AI requests too quickly. Try again in about ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minute(s).` },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const systemPrompt = `You classify a short freeform capture from a personal productivity app's Inbox into the LifeOS object type it most likely belongs to.

The six possible types, and what each is for:
- "task": a concrete action to do, often with an implicit or explicit deadline (e.g. "Finish LifeOS README", "Buy a new SSD").
- "note": a thought, reference, or piece of information worth keeping, with no clear action or event attached (e.g. "AI architecture thoughts").
- "idea": a speculative project or concept not yet committed to (e.g. "Maybe I should build a CTF platform").
- "project": a larger body of work the person is clearly already committing to, not just musing about.
- "event": something tied to a specific date/time with other people or a fixed occurrence (e.g. "Meet someone Friday").
- "reminder": a nudge to do or remember something at a future point, phrased as "remind me..." or similar (e.g. "Remind me to renew hosting").

Rules:
- Pick exactly one type — the single best fit, not a list.
- "confidence" must be "high", "medium", or "low" — be honest; short or ambiguous captures should usually get "medium" or "low", not "high".
- "reason" must be short and specific (under 10 words) — e.g. "phrased as an action with a deliverable" not "this seems like a task".
- Respond with ONLY valid JSON, no markdown fences, no commentary, in exactly this shape:
{"suggested_type": "task|note|idea|project|event|reminder", "confidence": "high|medium|low", "reason": "..."}`;

  const userPrompt = `Capture: "${content}"\n\nClassify it.`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
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

  let parsed: { suggested_type: string; confidence: string; reason: string };
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error("Failed to parse model output as JSON:", raw);
    return NextResponse.json({ error: "The model's response wasn't valid JSON. Try again." }, { status: 500 });
  }

  // Same cross-check pattern as prioritize-tasks: never let a hallucinated
  // or malformed value out of this route. A bad suggested_type would
  // otherwise reach TYPES.find() client-side and silently show nothing.
  if (!VALID_TYPES.includes(parsed.suggested_type as ConvertedType) || !VALID_CONFIDENCE.has(parsed.confidence)) {
    console.error("Model returned an invalid classification:", parsed);
    return NextResponse.json({ error: "The model's classification was invalid. Try again." }, { status: 500 });
  }

  return NextResponse.json({
    suggested_type: parsed.suggested_type as ConvertedType,
    confidence: parsed.confidence as "high" | "medium" | "low",
    reason: parsed.reason ?? "",
  });
}