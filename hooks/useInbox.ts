"use client";

import useSWR from "swr";
import { useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

export type InboxStatus = "inbox" | "processed" | "archived";
export type ConvertedType = "task" | "note" | "idea" | "project" | "event" | "reminder";

export type InboxItem = {
  id: string;
  content: string;
  status: InboxStatus;
  priority: number | null;
  tags: string[];
  converted_type: ConvertedType | null;
  converted_id: string | null;
  created_at: string;
  processed_at: string | null;
};

const INBOX_KEY = "inbox_items";

async function fetchInboxItems(supabase: ReturnType<typeof createClient>): Promise<InboxItem[]> {
  const { data, error } = await supabase
    .from("inbox_items")
    .select("id, content, status, priority, tags, converted_type, converted_id, created_at, processed_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as InboxItem[];
}

export function useInbox() {
  const supabase = useMemo(() => createClient(), []);

  const { data, error, isLoading, mutate } = useSWR<InboxItem[]>(INBOX_KEY, () => fetchInboxItems(supabase));

  const items = data ?? [];
  const unprocessedCount = items.filter((i) => i.status === "inbox").length;

  // The one function meant to be called from anywhere in the app (Command
  // Palette, dashboard widget, keyboard shortcut in Part 4) — deliberately
  // takes just raw text and nothing else, matching the doc's "capture
  // first, decide later" principle. No type, no project, no due date.
  const capture = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return null;

      const payload = { content: trimmed, status: "inbox" as const };
      const { data: created, error } = await supabase.from("inbox_items").insert(payload).select().single();
      if (error || !created) throw error ?? new Error("Insert returned no row");

      await mutate((current) => [created as InboxItem, ...(current ?? [])], { revalidate: false });
      return created as InboxItem;
    },
    [supabase, mutate]
  );

  // Used by Part 3's processing drawer once conversion succeeds — records
  // what it became and where, per the doc's "traceable history" goal.
  const markProcessed = useCallback(
    async (id: string, convertedType: ConvertedType, convertedId: string) => {
      const patch = {
        status: "processed" as const,
        converted_type: convertedType,
        converted_id: convertedId,
        processed_at: new Date().toISOString(),
      };
      await mutate((current) => (current ?? []).map((i) => (i.id === id ? { ...i, ...patch } : i)), { revalidate: false });
      const { error } = await supabase.from("inbox_items").update(patch).eq("id", id);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  const archiveItem = useCallback(
    async (id: string) => {
      await mutate((current) => (current ?? []).map((i) => (i.id === id ? { ...i, status: "archived" as const } : i)), { revalidate: false });
      const { error } = await supabase.from("inbox_items").update({ status: "archived" }).eq("id", id);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      await mutate((current) => (current ?? []).filter((i) => i.id !== id), { revalidate: false });
      const { error } = await supabase.from("inbox_items").delete().eq("id", id);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  return {
    items,
    unprocessedCount,
    isLoading,
    error,
    capture,
    markProcessed,
    archiveItem,
    deleteItem,
    refresh: mutate,
  };
}