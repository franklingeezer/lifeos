"use client";

import useSWR from "swr";
import { useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

export type Status = "active" | "paused" | "done" | "archived";
export type Priority = "low" | "med" | "high";

export type Project = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  status: Status;
  priority: Priority;
  start_date: string | null;
  deadline: string | null;
  progress: number;
  github_repo: string | null;
  live_demo: string | null;
};

const PROJECTS_KEY = "projects";

async function fetchProjects(supabase: ReturnType<typeof createClient>): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, description, category, status, priority, start_date, deadline, progress, github_repo, live_demo")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Project[];
}

export function useProjects() {
  const supabase = useMemo(() => createClient(), []);

  const { data, error, isLoading, mutate } = useSWR<Project[]>(PROJECTS_KEY, () => fetchProjects(supabase));

  const projects = data ?? [];

  const createProject = useCallback(
    async (payload: Omit<Project, "id" | "progress">) => {
      const { data: created, error } = await supabase
        .from("projects")
        .insert(payload)
        .select()
        .single();
      if (error || !created) throw error ?? new Error("Insert returned no row");
      await mutate((current) => [...(current ?? []), created as Project], { revalidate: false });
      return created as Project;
    },
    [supabase, mutate]
  );

  const updateProject = useCallback(
    async (id: string, patch: Partial<Project>) => {
      await mutate((current) => (current ?? []).map((p) => (p.id === id ? { ...p, ...patch } : p)), {
        revalidate: false,
      });
      const { error } = await supabase.from("projects").update(patch).eq("id", id);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  const deleteProject = useCallback(
    async (id: string) => {
      await mutate((current) => (current ?? []).filter((p) => p.id !== id), { revalidate: false });
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  return {
    projects,
    isLoading,
    error,
    createProject,
    updateProject,
    deleteProject,
    refresh: mutate,
  };
}