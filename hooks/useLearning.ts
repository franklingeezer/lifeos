"use client";

import useSWR from "swr";
import { useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

export type Status = "not_started" | "in_progress" | "completed";

export type LearningItem = {
  id: string;
  title: string;
  category: string | null;
  status: Status;
  progress: number;
  hours_studied: number;
  resource_url: string | null;
  notes: string | null;
  quiz_score: number | null;
  has_certificate: boolean;
};

const LEARNING_KEY = "learning";

async function fetchLearningItems(supabase: ReturnType<typeof createClient>): Promise<LearningItem[]> {
  const { data, error } = await supabase
    .from("learning_items")
    .select("id, title, category, status, progress, hours_studied, resource_url, notes, quiz_score, has_certificate")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LearningItem[];
}

export function useLearning() {
  const supabase = useMemo(() => createClient(), []);

  const { data, error, isLoading, mutate } = useSWR<LearningItem[]>(LEARNING_KEY, () => fetchLearningItems(supabase));

  const items = data ?? [];

  const createItem = useCallback(
    async (payload: Omit<LearningItem, "id">) => {
      const { data: created, error } = await supabase.from("learning_items").insert(payload).select().single();
      if (error || !created) throw error ?? new Error("Insert returned no row");
      await mutate((current) => [created as LearningItem, ...(current ?? [])], { revalidate: false });
      return created as LearningItem;
    },
    [supabase, mutate]
  );

  const updateItem = useCallback(
    async (id: string, patch: Partial<LearningItem>) => {
      await mutate((current) => (current ?? []).map((i) => (i.id === id ? { ...i, ...patch } : i)), {
        revalidate: false,
      });
      const { error } = await supabase.from("learning_items").update(patch).eq("id", id);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      await mutate((current) => (current ?? []).filter((i) => i.id !== id), { revalidate: false });
      const { error } = await supabase.from("learning_items").delete().eq("id", id);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  return {
    items,
    isLoading,
    error,
    createItem,
    updateItem,
    deleteItem,
    refresh: mutate,
  };
}