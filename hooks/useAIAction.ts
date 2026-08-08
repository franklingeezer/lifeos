"use client";

import { useCallback, useState } from "react";

/**
 * Counterpart to useAIContent for the two tabs that don't auto-fetch on
 * load — Ask LifeOS and Prioritize are both "click a button, POST a
 * request, show the result" rather than "show cached content with a
 * Regenerate option". No SWR here on purpose: there's nothing to cache or
 * revalidate, just a one-shot action with a loading/error/result shape.
 */
export function useAIAction<TResult, TArgs = void>(url: string) {
  const [result, setResult] = useState<TResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (body?: TArgs) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error || "Something went wrong.");
          setResult(null);
        } else {
          setResult(data as TResult);
        }
      } catch {
        setError("Couldn't reach the server. Is the dev server running?");
      } finally {
        setLoading(false);
      }
    },
    [url]
  );

  return { result, loading, error, run, setResult };
}