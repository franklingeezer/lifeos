"use client";

import useSWR from "swr";
import { useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { toLocalISODate } from "@/lib/date";

export type TxType = "income" | "expense" | "savings" | "investment";

export type Transaction = {
  id: string;
  type: TxType;
  category: string | null;
  amount_bdt: number;
  note: string | null;
  occurred_on: string;
};

async function fetchTransactions(
  supabase: ReturnType<typeof createClient>,
  year: number,
  month: number
): Promise<Transaction[]> {
  const start = toLocalISODate(new Date(year, month, 1));
  const end = toLocalISODate(new Date(year, month + 1, 0));
  const { data, error } = await supabase
    .from("finance_transactions")
    .select("id, type, category, amount_bdt, note, occurred_on")
    .gte("occurred_on", start)
    .lte("occurred_on", end)
    .order("occurred_on", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Transaction[];
}

/**
 * Keyed by [year, month] — SWR treats a different month as a different
 * cache entry entirely, so flipping back to a month you've already viewed
 * this session is instant (served from cache) instead of a re-fetch.
 */
export function useFinance(year: number, month: number) {
  const supabase = useMemo(() => createClient(), []);

  const key = useMemo(() => ["finance", year, month] as const, [year, month]);
  const { data, error, isLoading, mutate } = useSWR<Transaction[]>(key, () => fetchTransactions(supabase, year, month));

  const transactions = data ?? [];

  const createTransaction = useCallback(
    async (payload: Omit<Transaction, "id">) => {
      const { data: created, error } = await supabase.from("finance_transactions").insert(payload).select().single();
      if (error || !created) throw error ?? new Error("Insert returned no row");
      await mutate((current) => [created as Transaction, ...(current ?? [])], { revalidate: false });
      return created as Transaction;
    },
    [supabase, mutate]
  );

  const updateTransaction = useCallback(
    async (id: string, patch: Partial<Transaction>) => {
      await mutate((current) => (current ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t)), {
        revalidate: false,
      });
      const { error } = await supabase.from("finance_transactions").update(patch).eq("id", id);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      await mutate((current) => (current ?? []).filter((t) => t.id !== id), { revalidate: false });
      const { error } = await supabase.from("finance_transactions").delete().eq("id", id);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  return {
    transactions,
    isLoading,
    error,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    refresh: mutate,
  };
}