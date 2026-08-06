"use client";

import useSWR from "swr";
import { useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

export type Event = { id: string; title: string; date: string; color: string; all_day: boolean };
export type TaskDue = { id: string; title: string; due_date: string };
export type ProjectDeadline = { id: string; name: string; deadline: string };

export type CalendarData = { events: Event[]; tasksDue: TaskDue[]; projectDeadlines: ProjectDeadline[] };

const CALENDAR_KEY = "calendar";

async function fetchCalendarData(supabase: ReturnType<typeof createClient>): Promise<CalendarData> {
  const [{ data: ev }, { data: td }, { data: pd }] = await Promise.all([
    supabase.from("events").select("id, title, date, color, all_day"),
    supabase.from("tasks").select("id, title, due_date").not("due_date", "is", null),
    supabase.from("projects").select("id, name, deadline").not("deadline", "is", null),
  ]);
  return {
    events: (ev ?? []) as Event[],
    tasksDue: (td ?? []) as TaskDue[],
    projectDeadlines: (pd ?? []) as ProjectDeadline[],
  };
}

export function useCalendar() {
  const supabase = useMemo(() => createClient(), []);

  const { data, error, isLoading, mutate } = useSWR<CalendarData>(CALENDAR_KEY, () => fetchCalendarData(supabase));

  const events = data?.events ?? [];
  const tasksDue = data?.tasksDue ?? [];
  const projectDeadlines = data?.projectDeadlines ?? [];

  // Only events are owned/edited from this page — tasks and projects are
  // read-only overlays here, edited from their own pages.
  const createEvent = useCallback(
    async (payload: Omit<Event, "id">) => {
      const { data: created, error } = await supabase.from("events").insert(payload).select().single();
      if (error || !created) throw error ?? new Error("Insert returned no row");
      await mutate((current) => current && { ...current, events: [...current.events, created as Event] }, {
        revalidate: false,
      });
      return created as Event;
    },
    [supabase, mutate]
  );

  const updateEvent = useCallback(
    async (id: string, patch: Partial<Event>) => {
      await mutate(
        (current) => current && { ...current, events: current.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) },
        { revalidate: false }
      );
      const { error } = await supabase.from("events").update(patch).eq("id", id);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      await mutate((current) => current && { ...current, events: current.events.filter((e) => e.id !== id) }, {
        revalidate: false,
      });
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  return {
    events,
    tasksDue,
    projectDeadlines,
    isLoading,
    error,
    createEvent,
    updateEvent,
    deleteEvent,
    refresh: mutate,
  };
}