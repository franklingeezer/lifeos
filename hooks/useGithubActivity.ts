"use client";

import useSWR from "swr";

export type GithubActivityItem = {
  id: string;
  label: string;
  detail: string | null;
  repo: string;
  isLifeOS: boolean;
  url: string;
  createdAt: string;
};

export type GithubActivityData =
  | { configured: false; error?: string }
  | { configured: true; username: string; error: string }
  | { configured: true; username: string; profileUrl: string; todayCount: number; activities: GithubActivityItem[] };

// Exported so SettingsPage can `mutate(GITHUB_ACTIVITY_KEY)` the instant
// the username changes, without waiting for this hook's own refresh
// interval — same reasoning as useCurrencySymbol's CURRENCY_SYMBOL_KEY.
export const GITHUB_ACTIVITY_KEY = "/api/github/activity";

async function fetchGithubActivity(): Promise<GithubActivityData> {
  const res = await fetch(GITHUB_ACTIVITY_KEY);
  if (!res.ok) throw new Error("Failed to load GitHub activity");
  return res.json();
}

/**
 * Its own SWR key (not folded into useDashboardData) so it can poll and
 * revalidate independently — the rest of the Dashboard's data doesn't
 * need to refetch every few minutes just because this card does.
 */
export function useGithubActivity() {
  const { data, error, isLoading } = useSWR<GithubActivityData>(GITHUB_ACTIVITY_KEY, fetchGithubActivity, {
    refreshInterval: 5 * 60 * 1000, // activity changes through the day; keep the card reasonably live without hammering GitHub
  });
  return { data, error, isLoading };
}                   