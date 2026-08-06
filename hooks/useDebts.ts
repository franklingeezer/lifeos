"use client";

import useSWR from "swr";
import { useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

export type Direction = "owed_to_me" | "i_owe";

export type Debt = {
  id: string;
  person_name: string;
  direction: Direction;
  amount_bdt: number;
  note: string | null;
  due_date: string | null;
  settled: boolean;
};

const DEBTS_KEY = "debts";

async function fetchDebts(supabase: ReturnType<typeof createClient>): Promise<Debt[]> {
  const { data, error } = await supabase
    .from("finance_debts")
    .select("id, person_name, direction, amount_bdt, note, due_date, settled")
    .order("settled", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Debt[];
}

export function useDebts() {
  const supabase = useMemo(() => createClient(), []);

  const { data, error, isLoading, mutate } = useSWR<Debt[]>(DEBTS_KEY, () => fetchDebts(supabase));

  const debts = data ?? [];

  const createDebt = useCallback(
    async (payload: Omit<Debt, "id">) => {
      const { data: created, error } = await supabase.from("finance_debts").insert(payload).select().single();
      if (error || !created) throw error ?? new Error("Insert returned no row");
      await mutate((current) => [created as Debt, ...(current ?? [])], { revalidate: false });
      return created as Debt;
    },
    [supabase, mutate]
  );

  const toggleSettled = useCallback(
    async (debt: Debt) => {
      await mutate(
        (current) => (current ?? []).map((d) => (d.id === debt.id ? { ...d, settled: !d.settled } : d)),
        { revalidate: false }
      );
      const { error } = await supabase.from("finance_debts").update({ settled: !debt.settled }).eq("id", debt.id);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  const deleteDebt = useCallback(
    async (id: string) => {
      await mutate((current) => (current ?? []).filter((d) => d.id !== id), { revalidate: false });
      const { error } = await supabase.from("finance_debts").delete().eq("id", id);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  return {
    debts,
    isLoading,
    error,
    createDebt,
    toggleSettled,
    deleteDebt,
    refresh: mutate,
  };
}