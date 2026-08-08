"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import { Sparkles, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { todayISO } from "@/lib/date";
import { useAIContent } from "@/hooks/useAIContent";
import { AIErrorBox, RegenerateButton } from "./shared";

type Brief = { content: string; created_at: string };
type PastBrief = { id: string; brief_date: string; content: string; created_at: string };

async function fetchHistory(supabase: ReturnType<typeof createClient>): Promise<PastBrief[]> {
  const { data } = await supabase
    .from("ai_briefs")
    .select("id, brief_date, content, created_at")
    .order("brief_date", { ascending: false })
    .limit(14);
  return (data ?? []) as PastBrief[];
}

export default function MorningBriefTab() {
  const supabase = useMemo(() => createClient(), []);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  const { data, error, isLoading, regenerating, regenerate } = useAIContent<Brief>("/api/morning-brief");
  const { data: history = [] } = useSWR("ai-briefs-history", () => fetchHistory(supabase));

  const today = todayISO();
  const selected = selectedHistoryId ? history.find((h) => h.id === selectedHistoryId) : null;
  const displayed = selected ? selected.content : data?.content;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <RegenerateButton onClick={regenerate} busy={regenerating || isLoading} />
      </div>

      <div style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 24, minHeight: 220 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgb(var(--accent))" }}>
            <Sparkles size={16} />
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>
              {selected ? `Brief from ${selected.brief_date}` : "Today's Morning Brief"}
            </span>
          </div>

          {history.length > 1 && (
            <div style={{ display: "flex", gap: 6, overflowX: "auto", maxWidth: "100%" }}>
              <button
                onClick={() => setSelectedHistoryId(null)}
                style={{
                  padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                  border: `1px solid ${selectedHistoryId === null ? "rgb(var(--accent))" : "rgb(var(--border))"}`,
                  background: selectedHistoryId === null ? "rgb(var(--accent) / 0.12)" : "transparent",
                  color: selectedHistoryId === null ? "rgb(var(--accent))" : "rgb(var(--text-muted))",
                }}
              >
                Today
              </button>
              {history.filter((h) => h.brief_date !== today).map((h) => (
                <button
                  key={h.id}
                  onClick={() => setSelectedHistoryId(h.id)}
                  style={{
                    padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                    border: `1px solid ${selectedHistoryId === h.id ? "rgb(var(--accent))" : "rgb(var(--border))"}`,
                    background: selectedHistoryId === h.id ? "rgb(var(--accent) / 0.12)" : "transparent",
                    color: selectedHistoryId === h.id ? "rgb(var(--accent))" : "rgb(var(--text-muted))",
                  }}
                >
                  {h.brief_date.slice(5)}
                </button>
              ))}
            </div>
          )}
        </div>

        {(isLoading || regenerating) && (
          <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>
            {regenerating ? "Regenerating…" : "Loading your brief…"}
          </div>
        )}

        {!isLoading && !regenerating && error && <AIErrorBox message={error} />}

        {!isLoading && !regenerating && !error && displayed && (
          <div style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{displayed}</div>
        )}

        {data?.created_at && !selectedHistoryId && !isLoading && !error && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 20, fontSize: 10.5, color: "rgb(var(--text-muted))" }}>
            <Clock size={11} /> Generated {new Date(data.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </div>
        )}
      </div>
    </div>
  );
}