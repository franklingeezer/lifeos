"use client";

import useSWR from "swr";
import { useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

export type Priority = "low" | "med" | "high";
export type Status = "todo" | "in_progress" | "done";
export type Subtask = { id: string; title: string; done: boolean; position: number };
export type Task = {
  id: string;
  title: string;
  category: string | null;
  priority: Priority;
  status: Status;
  due_date: string | null;
  project_id: string | null;
  subtasks: Subtask[];
};

// The SWR cache key for this resource. Keep it a plain string (or a stable
// array) — SWR uses it for dedup + as the identity every `mutate()` call
// below needs to target the right cache slot.
const TASKS_KEY = "tasks";

async function fetchTasks(supabase: ReturnType<typeof createClient>): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, category, priority, status, due_date, project_id, subtasks(id, title, done, position)")
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((t: any) => ({
    ...t,
    subtasks: (t.subtasks ?? []).sort((a: Subtask, b: Subtask) => a.position - b.position),
  }));
}

/**
 * Drop-in replacement for the old useState + useEffect + loadTasks()
 * pattern. Every mutation here does the same three things:
 *   1. optimistically update the local SWR cache (instant UI feedback)
 *   2. fire the Supabase write
 *   3. on failure, re-fetch from the server so the UI doesn't stay wrong
 *
 * To build the same hook for another module (Notes, Finance, etc.), copy
 * this file, swap the table name / columns / mutation shapes, and change
 * TASKS_KEY to something like "notes".
 */
export function useTasks() {
  const supabase = useMemo(() => createClient(), []);

  const { data, error, isLoading, mutate } = useSWR<Task[]>(TASKS_KEY, () => fetchTasks(supabase));

  const tasks = data ?? [];

  const createTask = useCallback(
    async (input: { title: string; category: string | null; priority: Priority; due_date: string | null; project_id?: string | null }) => {
      const payload = { ...input, project_id: input.project_id ?? null, status: "todo" as Status };
      const { data: created, error } = await supabase.from("tasks").insert(payload).select().single();
      if (error || !created) throw error ?? new Error("Insert returned no row");

      await mutate((current) => [...(current ?? []), { ...created, subtasks: [] } as Task], {
        revalidate: false,
      });
      return created as Task;
    },
    [supabase, mutate]
  );

  const updateTask = useCallback(
    async (id: string, patch: Partial<Task>) => {
      await mutate((current) => (current ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t)), {
        revalidate: false,
      });
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) await mutate(); // roll back to server truth on failure
    },
    [supabase, mutate]
  );

  const deleteTask = useCallback(
    async (id: string) => {
      await mutate((current) => (current ?? []).filter((t) => t.id !== id), { revalidate: false });
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  const moveTask = useCallback((id: string, status: Status) => updateTask(id, { status }), [updateTask]);

  const addSubtask = useCallback(
    async (taskId: string, title: string) => {
      const task = tasks.find((t) => t.id === taskId);
      const position = task?.subtasks.length ?? 0;
      const { data: created, error } = await supabase
        .from("subtasks")
        .insert({ task_id: taskId, title, position })
        .select()
        .single();
      if (error || !created) throw error ?? new Error("Insert returned no row");

      await mutate(
        (current) =>
          (current ?? []).map((t) =>
            t.id === taskId ? { ...t, subtasks: [...t.subtasks, created as Subtask] } : t
          ),
        { revalidate: false }
      );
    },
    [supabase, mutate, tasks]
  );

  const toggleSubtask = useCallback(
    async (taskId: string, subId: string, done: boolean) => {
      await mutate(
        (current) =>
          (current ?? []).map((t) =>
            t.id === taskId
              ? { ...t, subtasks: t.subtasks.map((s) => (s.id === subId ? { ...s, done: !done } : s)) }
              : t
          ),
        { revalidate: false }
      );
      const { error } = await supabase.from("subtasks").update({ done: !done }).eq("id", subId);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  const deleteSubtask = useCallback(
    async (taskId: string, subId: string) => {
      await mutate(
        (current) =>
          (current ?? []).map((t) =>
            t.id === taskId ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subId) } : t
          ),
        { revalidate: false }
      );
      const { error } = await supabase.from("subtasks").delete().eq("id", subId);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  return {
    tasks,
    isLoading,
    error,
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    refresh: mutate,
  };
}