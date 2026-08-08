"use client";

import useSWR from "swr";
import { useCallback, useEffect, useState } from "react";

async function aiFetcher(url: string) {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || "Something went wrong.");
  }
  return data;
}

/**
 * Shared hook for the "GET a cached AI-generated blob, with a Regenerate
 * button" pattern used by Morning Brief, Review, and Journal Insights.
 * Each tab just builds a URL (encoding whatever params it has — a review
 * type, a journal date range) and passes it in; this hook owns the
 * loading/error/regenerate state that would otherwise be five separate
 * useState calls copy-pasted into every tab.
 *
 * Pass `null` for the url to skip fetching (e.g. a required param isn't
 * ready yet) — mirrors SWR's own convention for conditional fetching.
 *
 * `revalidateOnFocus: false` is intentional here, unlike the rest of the
 * app's data hooks — these calls hit an LLM and are meant to be cached
 * server-side for the day/period; refiring one just because the browser
 * tab regained focus would be wasteful and mildly surprising (content
 * would appear to "jump" for no user-initiated reason).
 */
export function useAIContent<T = any>(url: string | null) {
  const { data, error, isLoading, mutate } = useSWR<T>(url, aiFetcher, {
    revalidateOnFocus: false,
  });

  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

  // A fresh url (e.g. switching Review from weekly -> monthly) means any
  // error from the *previous* url's regenerate attempt is no longer
  // relevant — clear it so a stale error doesn't linger under new content.
  useEffect(() => {
    setRegenerateError(null);
  }, [url]);

  const regenerate = useCallback(async () => {
    if (!url) return;
    setRegenerating(true);
    setRegenerateError(null);
    try {
      const separator = url.includes("?") ? "&" : "?";
      const fresh = await aiFetcher(`${url}${separator}regenerate=true`);
      await mutate(fresh, { revalidate: false });
    } catch (e) {
      setRegenerateError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setRegenerating(false);
    }
  }, [url, mutate]);

  return {
    data,
    error: regenerateError ?? (error instanceof Error ? error.message : null),
    isLoading,
    regenerating,
    regenerate,
    refresh: mutate,
  };
}