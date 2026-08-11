"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const EXPORT_VERSION = 1;

// AI-generated content (briefs, reviews, journal insights) is deliberately
// excluded — it's regenerable cache, not source-of-truth user data, so
// including it would just bloat the file without protecting anything that
// can't be recreated with one click inside the app.
async function buildExport(supabase: ReturnType<typeof createClient>) {
  const [
    tasks, subtasks, projects, notes, habits, habitLogs,
    financeTransactions, financeDebts, events, journalEntries,
    learningItems, mediaItems, ideaVaultItems, appSettings,
  ] = await Promise.all([
    supabase.from("tasks").select("*").then((r) => r.data ?? []),
    supabase.from("subtasks").select("*").then((r) => r.data ?? []),
    supabase.from("projects").select("*").then((r) => r.data ?? []),
    supabase.from("notes").select("*").then((r) => r.data ?? []),
    supabase.from("habits").select("*").then((r) => r.data ?? []),
    supabase.from("habit_logs").select("*").then((r) => r.data ?? []),
    supabase.from("finance_transactions").select("*").then((r) => r.data ?? []),
    supabase.from("finance_debts").select("*").then((r) => r.data ?? []),
    supabase.from("events").select("*").then((r) => r.data ?? []),
    supabase.from("journal_entries").select("*").then((r) => r.data ?? []),
    supabase.from("learning_items").select("*").then((r) => r.data ?? []),
    // Media Vault: file metadata only (name, size, storage path) — the
    // actual file bytes live in Supabase Storage and aren't part of a
    // JSON export; re-download those separately if you ever need them.
    supabase.from("media_items").select("*").then((r) => r.data ?? []),
    supabase.from("idea_vault_items").select("*").then((r) => r.data ?? []),
    supabase.from("app_settings").select("display_name, currency_code, currency_symbol").eq("id", 1).maybeSingle().then((r) => r.data ?? null),
  ]);

  return {
    lifeos_export_version: EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    settings: appSettings,
    tasks,
    subtasks,
    projects,
    notes,
    habits,
    habit_logs: habitLogs,
    finance_transactions: financeTransactions,
    finance_debts: financeDebts,
    events,
    journal_entries: journalEntries,
    learning_items: learningItems,
    media_items: mediaItems,
    idea_vault_items: ideaVaultItems,
  };
}

function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function useDataExport() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportData = useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      const supabase = createClient();
      const data = await buildExport(supabase);
      const dateStamp = new Date().toISOString().slice(0, 10);
      downloadJSON(data, `lifeos-backup-${dateStamp}.json`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed — check your connection and try again.");
    } finally {
      setExporting(false);
    }
  }, []);

  return { exportData, exporting, error };
}