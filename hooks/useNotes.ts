"use client";

import useSWR from "swr";
import { useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

export type Note = {
  id: string;
  title: string;
  content: string | null;
  folder: string | null;
  tags: string[] | null;
  pinned: boolean;
  updated_at: string;
};

const NOTES_KEY = "notes";

async function fetchNotes(supabase: ReturnType<typeof createClient>): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("id, title, content, folder, tags, pinned, updated_at")
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Note[];
}

export function useNotes() {
  const supabase = useMemo(() => createClient(), []);

  const { data, error, isLoading, mutate } = useSWR<Note[]>(NOTES_KEY, () => fetchNotes(supabase));

  const notes = data ?? [];

  const createNote = useCallback(async () => {
    const payload = { title: "Untitled note", content: "", folder: null, tags: [], pinned: false };
    const { data: created, error } = await supabase.from("notes").insert(payload).select().single();
    if (error || !created) throw error ?? new Error("Insert returned no row");

    await mutate((current) => [created as Note, ...(current ?? [])], { revalidate: false });
    return created as Note;
  }, [supabase, mutate]);

  // No debounce in here on purpose — the editor is what decides *when* to
  // call this (see NotesPage's scheduleSave). The hook just does one clean
  // optimistic update + write per call.
  const updateNote = useCallback(
    async (id: string, patch: Partial<Note>) => {
      const withTimestamp = { ...patch, updated_at: new Date().toISOString() };
      await mutate(
        (current) => (current ?? []).map((n) => (n.id === id ? { ...n, ...withTimestamp } : n)),
        { revalidate: false }
      );
      const { error } = await supabase.from("notes").update(withTimestamp).eq("id", id);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  const togglePin = useCallback(
    async (note: Note) => {
      await mutate(
        (current) => (current ?? []).map((n) => (n.id === note.id ? { ...n, pinned: !n.pinned } : n)),
        { revalidate: false }
      );
      const { error } = await supabase.from("notes").update({ pinned: !note.pinned }).eq("id", note.id);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  const deleteNote = useCallback(
    async (id: string) => {
      await mutate((current) => (current ?? []).filter((n) => n.id !== id), { revalidate: false });
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  return {
    notes,
    isLoading,
    error,
    createNote,
    updateNote,
    togglePin,
    deleteNote,
    refresh: mutate,
  };
}