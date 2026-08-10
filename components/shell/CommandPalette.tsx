"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search, CheckSquare, StickyNote, FolderKanban, Flame,
  GraduationCap, Lightbulb, Calendar, CornerDownLeft, ArrowUp, ArrowDown,
} from "lucide-react";
import { useGlobalSearch, type SearchResult, type SearchResultType } from "@/hooks/useGlobalSearch";

const TYPE_META: Record<SearchResultType, { label: string; icon: React.ElementType; color: string }> = {
  task: { label: "Task", icon: CheckSquare, color: "#5EA8A0" },
  note: { label: "Note", icon: StickyNote, color: "#D4A857" },
  project: { label: "Project", icon: FolderKanban, color: "#5FA8D3" },
  habit: { label: "Habit", icon: Flame, color: "#C57B6B" },
  learning: { label: "Learning", icon: GraduationCap, color: "#9B8AC4" },
  idea: { label: "Idea", icon: Lightbulb, color: "#EEC99B" },
  event: { label: "Event", icon: Calendar, color: "#6C8EF5" },
};

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { results, isLoading, isActive } = useGlobalSearch(query);

  // Reset on open/close so the palette doesn't remember your last search.
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      // Small delay so the input exists in the DOM before we focus it.
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Keep selection in bounds whenever the result set changes size.
  useEffect(() => {
    setSelectedIndex((i) => Math.min(i, Math.max(results.length - 1, 0)));
  }, [results.length]);

  const goToResult = (result: SearchResult) => {
    router.push(result.href);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const chosen = results[selectedIndex];
      if (chosen) goToResult(chosen);
      return;
    }
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      onKeyDown={handleKeyDown}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "12vh", paddingLeft: 16, paddingRight: 16, zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 560, background: "rgb(var(--surface))",
          border: "1px solid rgb(var(--border))", borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)", overflow: "hidden",
        }}
      >
        {/* Search input */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid rgb(var(--border))" }}>
          <Search size={16} color="rgb(var(--text-muted))" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, notes, projects, habits…"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "rgb(var(--text))", fontSize: 14.5,
            }}
          />
          <kbd style={kbdStyle}>Esc</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: "50vh", overflowY: "auto", padding: results.length > 0 ? "6px" : 0 }}>
          {!isActive && (
            <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 13, color: "rgb(var(--text-muted))" }}>
              Type at least 2 characters to search across your workspace.
            </div>
          )}

          {isActive && isLoading && results.length === 0 && (
            <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 13, color: "rgb(var(--text-muted))" }}>
              Searching…
            </div>
          )}

          {isActive && !isLoading && results.length === 0 && (
            <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 13, color: "rgb(var(--text-muted))" }}>
              No results for "{query}".
            </div>
          )}

          {results.map((r, i) => {
            const meta = TYPE_META[r.type];
            const Icon = meta.icon;
            const selected = i === selectedIndex;
            return (
              <div
                key={`${r.type}-${r.id}`}
                onMouseEnter={() => setSelectedIndex(i)}
                onClick={() => goToResult(r)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10,
                  cursor: "pointer", background: selected ? "rgb(var(--surface-2))" : "transparent",
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                  background: `${meta.color}22`, flexShrink: 0,
                }}>
                  <Icon size={14} color={meta.color} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: "rgb(var(--text-muted))" }}>
                    {meta.label}{r.subtitle ? ` · ${r.subtitle}` : ""}
                  </div>
                </div>
                {selected && <CornerDownLeft size={13} color="rgb(var(--text-muted))" style={{ flexShrink: 0 }} />}
              </div>
            );
          })}
        </div>

        {/* Footer hint bar */}
        <div className="lifeos-palette-footer" style={{
          display: "flex", alignItems: "center", gap: 16, padding: "9px 16px",
          borderTop: "1px solid rgb(var(--border))", fontSize: 11, color: "rgb(var(--text-muted))",
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><ArrowUp size={11} /><ArrowDown size={11} /> Navigate</span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><CornerDownLeft size={11} /> Open</span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>Esc Close</span>
        </div>
      </div>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  fontSize: 10.5, fontFamily: "var(--font-mono)", padding: "2px 6px", borderRadius: 5,
  background: "rgb(var(--surface-2))", border: "1px solid rgb(var(--border))", color: "rgb(var(--text-muted))",
};