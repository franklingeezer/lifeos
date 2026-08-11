"use client";

import useSWR from "swr";
import { useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

// Exported so SettingsPage can invalidate/update this exact cache entry
// after a successful save, without needing its own SWR migration — see
// the `mutate(CURRENCY_SYMBOL_KEY, ...)` call in SettingsPage.tsx.
export const CURRENCY_SYMBOL_KEY = "app-settings-currency-symbol";

const DEFAULT_SYMBOL = "৳";

async function fetchCurrencySymbol(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data } = await supabase.from("app_settings").select("currency_symbol").eq("id", 1).maybeSingle();
  return data?.currency_symbol || DEFAULT_SYMBOL;
}

/**
 * Read-only — Finance, Debts & Loans, and Dashboard all just need to
 * *display* the symbol, not edit it (that stays Settings' job). Falls
 * back to ৳ while loading or if the row/column is somehow empty, so
 * nothing ever renders a blank currency symbol.
 */
export function useCurrencySymbol(): string {
  const supabase = useMemo(() => createClient(), []);
  const { data } = useSWR(CURRENCY_SYMBOL_KEY, () => fetchCurrencySymbol(supabase));
  return data ?? DEFAULT_SYMBOL;
}