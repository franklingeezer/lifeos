"use client";

import React, { useState } from "react";
import { useAIContent } from "@/hooks/useAIContent";
import { AIErrorBox, RegenerateButton, AIContentBlocks } from "./shared";

type ReviewData = { content: string; period: { start: string; end: string } };
type ReviewType = "weekly" | "monthly";

export default function ReviewTab() {
  const [reviewType, setReviewType] = useState<ReviewType>("weekly");

  const { data, error, isLoading, regenerating, regenerate } = useAIContent<ReviewData>(
    `/api/review?type=${reviewType}`
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Review</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 999, padding: 3 }}>
            {(["weekly", "monthly"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setReviewType(t)}
                style={{
                  padding: "5px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, cursor: "pointer", border: "none",
                  background: reviewType === t ? "rgb(var(--accent))" : "transparent",
                  color: reviewType === t ? "rgb(var(--bg))" : "rgb(var(--text-muted))",
                }}
              >
                {t === "weekly" ? "Weekly" : "Monthly"}
              </button>
            ))}
          </div>
          <RegenerateButton onClick={regenerate} busy={regenerating || isLoading} size="small" />
        </div>
      </div>

      <div style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 20, minHeight: 160 }}>
        {data?.period && !isLoading && (
          <div style={{ fontSize: 10.5, color: "rgb(var(--text-muted))", marginBottom: 12 }}>
            {data.period.start} → {data.period.end}
          </div>
        )}

        {(isLoading || regenerating) && (
          <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>
            {regenerating ? "Regenerating…" : "Loading review…"}
          </div>
        )}

        {!isLoading && !regenerating && error && <AIErrorBox message={error} />}

        {!isLoading && !regenerating && !error && data?.content && <AIContentBlocks content={data.content} />}
      </div>
    </div>
  );
}