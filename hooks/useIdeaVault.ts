"use client";

import useSWR from "swr";
import { useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

export type Status = "spark" | "developing" | "validated" | "archived";

export type Idea = {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  tags: string[];
  potential: number;
  converted_project_id: string | null;
  created_at: string;
  updated_at: string;
};

const IDEAS_KEY = "ideas";

async function fetchIdeas(supabase: ReturnType<typeof createClient>): Promise<Idea[]> {
  const { data, error } = await supabase
    .from("idea_vault_items")
    .select("id, title, description, status, tags, potential, converted_project_id, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Idea[];
}

export function useIdeaVault() {
  const supabase = useMemo(() => createClient(), []);

  const { data, error, isLoading, mutate } = useSWR<Idea[]>(IDEAS_KEY, () => fetchIdeas(supabase));

  const ideas = data ?? [];

  const createIdea = useCallback(
    async (payload: Omit<Idea, "id" | "created_at" | "updated_at">) => {
      const { data: created, error } = await supabase.from("idea_vault_items").insert(payload).select().single();
      if (error || !created) throw error ?? new Error("Insert returned no row");
      await mutate((current) => [created as Idea, ...(current ?? [])], { revalidate: false });
      return created as Idea;
    },
    [supabase, mutate]
  );

  const updateIdea = useCallback(
    async (id: string, patch: Partial<Idea>) => {
      await mutate((current) => (current ?? []).map((i) => (i.id === id ? { ...i, ...patch } : i)), {
        revalidate: false,
      });
      const { error } = await supabase
        .from("idea_vault_items")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  const deleteIdea = useCallback(
    async (id: string) => {
      await mutate((current) => (current ?? []).filter((i) => i.id !== id), { revalidate: false });
      const { error } = await supabase.from("idea_vault_items").delete().eq("id", id);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  return {
    ideas,
    isLoading,
    error,
    createIdea,
    updateIdea,
    deleteIdea,
    refresh: mutate,
  };
}