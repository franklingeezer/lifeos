"use client";

import React, { useState } from "react";
import { NotebookPen } from "lucide-react";
import { useAIContent } from "@/hooks/useAIContent";
import { AIErrorBox, RegenerateButton, AIContentBlocks } from "./shared";

type JournalData = {
  content: string;
  entry_count: number;
  period: { start: string | null; end: string };
};
type JournalRange = "30d" | "90d" | "all";

const RANGES: { key: JournalRange; label: string }[] = [
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "all", label: "All time" },
];

export default function JournalInsightsTab() {
  const [journalRange, setJournalRange] = useState<JournalRange>("30d");

  const { data, error, isLoading, regenerating, regenerate } = useAIContent<JournalData>(
    `/api/journal-insights?range=${journalRange}`
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <NotebookPen size={15} color="rgb(var(--accent))" />
          <div style={{ fontSize: 13, fontWeight: 600 }}>Journal insights</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 999, padding: 3 }}>
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setJournalRange(r.key)}
                style={{
                  padding: "5px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, cursor: "pointer", border: "none",
                  background: journalRange === r.key ? "rgb(var(--accent))" : "transparent",
                  color: journalRange === r.key ? "rgb(var(--bg))" : "rgb(var(--text-muted))",
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
          <RegenerateButton onClick={regenerate} busy={regenerating || isLoading} size="small" />
        </div>
      </div>

      <div style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 20, minHeight: 140 }}>
        {data?.period && !isLoading && data.entry_count > 0 && (
          <div style={{ fontSize: 10.5, color: "rgb(var(--text-muted))", marginBottom: 12 }}>
            {data.period.start ? `${data.period.start} → ${data.period.end}` : `through ${data.period.end}`} · {data.entry_count} {data.entry_count === 1 ? "entry" : "entries"}
          </div>
        )}

        {(isLoading || regenerating) && (
          <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>
            {regenerating ? "Regenerating…" : "Loading insights…"}
          </div>
        )}

        {!isLoading && !regenerating && error && <AIErrorBox message={error} />}

        {!isLoading && !regenerating && !error && data?.content && <AIContentBlocks content={data.content} />}
      </div>
    </div>
  );
}