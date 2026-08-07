"use client";

import useSWR from "swr";
import { useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

export type SearchResultType = "task" | "note" | "project" | "habit" | "learning" | "idea" | "event";

export type SearchResult = {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  href: string;
};

const RESULTS_PER_MODULE = 5;
const MIN_QUERY_LENGTH = 2;

// Escape Postgres ILIKE wildcards so a literal "%" or "_" in someone's search
// doesn't get treated as a pattern character.
function escapeLike(s: string) {
  return s.replace(/[%_]/g, (c) => `\\${c}`);
}

async function runSearch(supabase: ReturnType<typeof createClient>, query: string): Promise<SearchResult[]> {
  const q = `%${escapeLike(query)}%`;

  const [tasks, notes, projects, habits, learning, ideas, events] = await Promise.all([
    supabase.from("tasks").select("id, title, status").ilike("title", q).limit(RESULTS_PER_MODULE),
    supabase.from("notes").select("id, title, folder").ilike("title", q).limit(RESULTS_PER_MODULE),
    supabase.from("projects").select("id, name, status").ilike("name", q).limit(RESULTS_PER_MODULE),
    supabase.from("habits").select("id, name").ilike("name", q).limit(RESULTS_PER_MODULE),
    supabase.from("learning_items").select("id, title, status").ilike("title", q).limit(RESULTS_PER_MODULE),
    supabase.from("idea_vault_items").select("id, title, status").ilike("title", q).limit(RESULTS_PER_MODULE),
    supabase.from("events").select("id, title, date").ilike("title", q).limit(RESULTS_PER_MODULE),
  ]);

  const results: SearchResult[] = [
    ...(tasks.data ?? []).map((t) => ({
      id: t.id, type: "task" as const, title: t.title, subtitle: t.status, href: "/tasks",
    })),
    ...(notes.data ?? []).map((n) => ({
      id: n.id, type: "note" as const, title: n.title, subtitle: n.folder ?? undefined, href: "/notes",
    })),
    ...(projects.data ?? []).map((p) => ({
      id: p.id, type: "project" as const, title: p.name, subtitle: p.status, href: "/projects",
    })),
    ...(habits.data ?? []).map((h) => ({
      id: h.id, type: "habit" as const, title: h.name, href: "/habits",
    })),
    ...(learning.data ?? []).map((l) => ({
      id: l.id, type: "learning" as const, title: l.title, subtitle: l.status, href: "/learning",
    })),
    ...(ideas.data ?? []).map((i) => ({
      id: i.id, type: "idea" as const, title: i.title, subtitle: i.status, href: "/idea-vault",
    })),
    ...(events.data ?? []).map((e) => ({
      id: e.id, type: "event" as const, title: e.title, subtitle: e.date, href: "/calendar",
    })),
  ];

  return results;
}

/**
 * Fires a debounced, multi-table search once `query` is at least
 * MIN_QUERY_LENGTH characters. Below that, returns an empty result set
 * without hitting the network at all — avoids firing 7 queries per
 * keystroke on a 1-character search.
 *
 * `keepPreviousData` means the palette doesn't flash empty between
 * keystrokes while the next search is in flight — old results stay on
 * screen (slightly stale) until the new ones arrive.
 */
export function useGlobalSearch(query: string) {
  const supabase = useMemo(() => createClient(), []);
  const trimmed = query.trim();

  const key = trimmed.length >= MIN_QUERY_LENGTH ? ["global-search", trimmed] : null;

  const { data, isLoading } = useSWR(key, () => runSearch(supabase, trimmed), {
    keepPreviousData: true,
    dedupingInterval: 300,
  });

  return {
    results: data ?? [],
    isLoading: key !== null && isLoading,
    isActive: key !== null,
  };
}