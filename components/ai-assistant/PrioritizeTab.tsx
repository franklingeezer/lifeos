"use client";

import React, { useCallback, useMemo, useState } from "react";
import { ListOrdered, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAIAction } from "@/hooks/useAIAction";
import { AIErrorBox } from "./shared";

type PrioritySuggestion = {
  id: string;
  title: string;
  tag: string | null;
  due_date: string | null;
  current_priority: "low" | "med" | "high";
  suggested_priority: "low" | "med" | "high";
  suggested_rank: number;
  reason: string;
};
type PrioritizeResponse = { summary: string; suggestions: PrioritySuggestion[] };

const PRIORITY_COLOR: Record<string, string> = {
  low: "rgb(var(--text-muted))",
  med: "rgb(var(--gold))",
  high: "rgb(var(--danger))",
};

export default function PrioritizeTab() {
  const supabase = useMemo(() => createClient(), []);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  const { result, loading, error, run } = useAIAction<PrioritizeResponse>("/api/prioritize-tasks");

  const runPrioritize = () => {
    setAppliedIds(new Set());
    run();
  };

  const applySuggestion = useCallback(
    async (s: PrioritySuggestion) => {
      await supabase.from("tasks").update({ priority: s.suggested_priority }).eq("id", s.id);
      setAppliedIds((prev) => new Set(prev).add(s.id));
    },
    [supabase]
  );

  const applyAll = useCallback(async () => {
    if (!result?.suggestions) return;
    const toApply = result.suggestions.filter((s) => s.suggested_priority !== s.current_priority && !appliedIds.has(s.id));
    for (const s of toApply) {
      await supabase.from("tasks").update({ priority: s.suggested_priority }).eq("id", s.id);
    }
    setAppliedIds((prev) => new Set([...prev, ...toApply.map((s) => s.id)]));
  }, [result, appliedIds, supabase]);

  const suggestions = result?.suggestions;
  const hasUnappliedChanges = suggestions?.some((s) => s.suggested_priority !== s.current_priority && !appliedIds.has(s.id));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Prioritize tasks</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {hasUnappliedChanges && (
            <button
              onClick={applyAll}
              style={{
                padding: "6px 12px", borderRadius: 8, background: "rgb(var(--accent))", color: "rgb(var(--bg))",
                fontSize: 11.5, fontWeight: 600, border: "none", cursor: "pointer",
              }}
            >
              Apply all changes
            </button>
          )}
          <button
            className="regen-btn"
            onClick={runPrioritize}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10,
              background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", color: "rgb(var(--text))",
              fontSize: 12.5, fontWeight: 600, cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1,
            }}
          >
            <ListOrdered size={13} className={loading ? "spin" : ""} /> {loading ? "Thinking…" : "Suggest priorities"}
          </button>
        </div>
      </div>

      {!loading && !error && !suggestions && (
        <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))", padding: 16, textAlign: "center", background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 12 }}>
          Click "Suggest priorities" to have LifeOS look at your open tasks, due dates, and workload — you decide what to apply.
        </div>
      )}

      {loading && (
        <div style={{ fontSize: 13, color: "rgb(var(--text-muted))", padding: 16 }}>Reviewing your open tasks…</div>
      )}

      {!loading && error && <AIErrorBox message={error} />}

      {!loading && suggestions && suggestions.length === 0 && (
        <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))", padding: 16, textAlign: "center", background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 12 }}>
          No open tasks to prioritize.
        </div>
      )}

      {!loading && suggestions && suggestions.length > 0 && (
        <>
          {result?.summary && (
            <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))", marginBottom: 12 }}>{result.summary}</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {suggestions.map((s, i) => {
              const changed = s.suggested_priority !== s.current_priority;
              const applied = appliedIds.has(s.id);
              return (
                <div
                  key={s.id}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderRadius: 10,
                    background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))",
                  }}
                >
                  <div className="font-mono" style={{ fontSize: 11, color: "rgb(var(--text-muted))", flexShrink: 0, marginTop: 2, width: 16, textAlign: "center" }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{s.title}</div>
                    <div style={{ fontSize: 11.5, color: "rgb(var(--text-muted))", marginTop: 2 }}>
                      {s.reason}
                      {s.due_date ? ` · due ${s.due_date}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span className="font-mono" style={{ fontSize: 9.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999, color: PRIORITY_COLOR[s.current_priority], background: `${PRIORITY_COLOR[s.current_priority]}1F` }}>
                      {s.current_priority.toUpperCase()}
                    </span>
                    {changed && (
                      <>
                        <span style={{ color: "rgb(var(--text-muted))", fontSize: 11 }}>→</span>
                        <span className="font-mono" style={{ fontSize: 9.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999, color: PRIORITY_COLOR[s.suggested_priority], background: `${PRIORITY_COLOR[s.suggested_priority]}1F` }}>
                          {s.suggested_priority.toUpperCase()}
                        </span>
                        {applied ? (
                          <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "rgb(var(--accent))" }}>
                            <Check size={12} /> Applied
                          </span>
                        ) : (
                          <button
                            onClick={() => applySuggestion(s)}
                            style={{
                              padding: "4px 10px", borderRadius: 7, background: "rgb(var(--accent))", color: "rgb(var(--bg))",
                              fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", whiteSpace: "nowrap",
                            }}
                          >
                            Apply
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}