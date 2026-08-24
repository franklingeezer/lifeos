"use client";

import React from "react";
import { Compass, Clock, ListTodo, FolderKanban, Flame, StickyNote } from "lucide-react";
import { useAIContent } from "@/hooks/useAIContent";
import { AIErrorBox, RegenerateButton } from "./shared";

type FocusItem = {
  order: number;
  type: "task" | "project" | "habit" | "note";
  ref_id: string | null;
  title: string;
  reason: string;
};
type TodayFocus = { headline: string; focus_items: FocusItem[]; created_at: string };

// Each item's icon/color reflects which module it came from — the whole
// point of Today Brain is that one plan can draw from Tasks, Projects,
// Habits, and Journal at once, so it should still be visually obvious at
// a glance which is which, same as the color-by-priority pattern Prioritize
// already uses.
const TYPE_META: Record<FocusItem["type"], { icon: React.ElementType; color: string; label: string }> = {
  task: { icon: ListTodo, color: "rgb(var(--danger))", label: "Task" },
  project: { icon: FolderKanban, color: "rgb(var(--gold))", label: "Project" },
  habit: { icon: Flame, color: "rgb(var(--accent))", label: "Habit" },
  note: { icon: StickyNote, color: "rgb(var(--text-muted))", label: "Signal" },
};

export default function TodayTab() {
  const { data, error, isLoading, regenerating, regenerate } = useAIContent<TodayFocus>("/api/today-focus");

  const items = data?.focus_items ?? [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <RegenerateButton onClick={regenerate} busy={regenerating || isLoading} />
      </div>

      <div style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 24, minHeight: 220 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgb(var(--accent))", marginBottom: 16 }}>
          <Compass size={16} />
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>Today's Focus</span>
        </div>

        {(isLoading || regenerating) && (
          <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>
            {regenerating ? "Rebuilding your plan…" : "Reading across your day…"}
          </div>
        )}

        {!isLoading && !regenerating && error && <AIErrorBox message={error} />}

        {!isLoading && !regenerating && !error && data && (
          <>
            {data.headline && (
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 18 }}>{data.headline}</div>
            )}

            {items.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))", padding: 16, textAlign: "center" }}>
                Nothing urgent on the board right now.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((item) => {
                  const meta = TYPE_META[item.type];
                  const Icon = meta.icon;
                  return (
                    <div
                      key={`${item.type}-${item.ref_id ?? item.order}`}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderRadius: 10,
                        background: "rgb(var(--surface-2))", border: "1px solid rgb(var(--border))",
                      }}
                    >
                      <div
                        className="font-mono"
                        style={{ fontSize: 11, color: "rgb(var(--text-muted))", flexShrink: 0, marginTop: 2, width: 16, textAlign: "center" }}
                      >
                        {item.order}
                      </div>
                      <Icon size={15} color={meta.color} style={{ flexShrink: 0, marginTop: 1 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{item.title}</span>
                          <span
                            className="font-mono"
                            style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.4, color: meta.color, opacity: 0.85 }}
                          >
                            {meta.label.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: 11.5, color: "rgb(var(--text-muted))", marginTop: 2 }}>{item.reason}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {data?.created_at && !isLoading && !error && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 20, fontSize: 10.5, color: "rgb(var(--text-muted))" }}>
            <Clock size={11} /> Generated {new Date(data.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </div>
        )}
      </div>
    </div>
  );
}