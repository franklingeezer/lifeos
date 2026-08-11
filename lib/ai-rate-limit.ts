const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS = 15; // across all 5 AI routes combined, per window

type Bucket = { count: number; windowStart: number };

// Module-level Map, not a database table or external store — this is
// intentional. LifeOS runs as a single Node process (`npm run start` on
// one machine), so an in-memory Map persists correctly for the process's
// whole lifetime and is more than sufficient for a single-user app. If
// LifeOS is ever deployed to a platform that runs multiple serverless
// instances (e.g. Vercel with concurrent invocations), each instance
// would have its own separate memory and this would need to move to a
// shared store like Upstash Redis instead — worth revisiting only if
// that deployment model actually happens.
const buckets = new Map<string, Bucket>();

/**
 * Call once per request, right before the point that actually calls the
 * Groq API (not before a cache-hit early-return — reading already-cached
 * content isn't the thing being protected against).
 *
 * Keyed by a single shared bucket rather than per-route, since the risk
 * being guarded against — something spamming regenerate in a loop — is
 * the same regardless of which specific AI feature it happens on.
 */
export function checkAIRateLimit(key = "ai"): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (bucket.count >= MAX_REQUESTS) {
    const retryAfterSeconds = Math.ceil((WINDOW_MS - (now - bucket.windowStart)) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  bucket.count += 1;
  return { allowed: true };
}