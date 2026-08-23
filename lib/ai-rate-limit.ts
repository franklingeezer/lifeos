import type { SupabaseClient } from "@supabase/supabase-js";

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS = 15; // across all 5 AI routes combined, per user, per window

/**
 * Call once per request, right before the point that actually calls the
 * Groq API (not before a cache-hit early-return — reading already-cached
 * content isn't the thing being protected against).
 *
 * Pass the same request-scoped Supabase client each route already
 * creates for its own queries — this derives the caller's own auth.uid()
 * from that client's session and uses it as the bucket key, so usage is
 * tracked per user rather than one shared bucket for the whole app.
 *
 * Backed by a Postgres table + an atomic upsert RPC (see
 * phase16_ai_rate_limit.sql) instead of an in-memory Map — a plain Map
 * only works if the app runs as a single long-lived Node process. On
 * Vercel, each request can land on a different serverless instance with
 * its own separate memory, which would let the old version's limit be
 * trivially bypassed just by chance of routing. A shared Postgres row is
 * the fix; the RPC's INSERT ... ON CONFLICT DO UPDATE also makes the
 * whole read-check-write sequence atomic, closing a race-condition the
 * old in-memory version had too, not just a multi-instance one.
 */
export async function checkAIRateLimit(
  supabase: SupabaseClient
): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Every AI route sits behind the auth middleware, so this should always
  // resolve to a real user — but rate-limiting is a safety net, not the
  // primary access control, so there's no reason to throw here if it
  // somehow doesn't. Falling back to a fixed key just means an
  // unauthenticated edge case shares one bucket, which is a reasonable
  // degradation rather than a crash.
  const key = user?.id ?? "unauthenticated";

  const { data, error } = await supabase.rpc("check_ai_rate_limit", {
    p_key: key,
    p_window_ms: WINDOW_MS,
    p_max_requests: MAX_REQUESTS,
  });

  if (error || !data || data.length === 0) {
    // Fail OPEN, not closed: if the rate-limit check itself breaks (bad
    // deploy, RPC missing, Supabase hiccup), that should never be the
    // reason every AI feature in the app goes down. Worst case here is
    // one broken request slips through unlimited for a moment — an
    // acceptable trade against the alternative of a single infra hiccup
    // taking out Morning Brief, Review, Prioritize, Journal Insights, and
    // Ask LifeOS all at once.
    console.error("AI rate limit check failed, allowing request:", error);
    return { allowed: true };
  }

  const row = data[0] as { allowed: boolean; retry_after_seconds: number };
  return row.allowed ? { allowed: true } : { allowed: false, retryAfterSeconds: row.retry_after_seconds };
}