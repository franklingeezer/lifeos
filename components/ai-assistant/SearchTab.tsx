"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Search, FileText, CheckSquare, FolderKanban, BookOpen, Calendar, GraduationCap, Wallet } from "lucide-react";
import { useAIAction } from "@/hooks/useAIAction";
import { AIErrorBox } from "./shared";
import { PROJECT_HEALTH_META, type ProjectHealthState } from "@/lib/project-health";

type SearchResult = {
  type: "note" | "task" | "project" | "journal" | "event" | "learning" | "debt";
  id: string;
  title: string;
  reason: string;
  // Roadmap Phase 6, Part 2 — deterministic status badge (project health
  // label or "Overdue"), computed server-side from Context Engine /
  // Project Health data, not parsed out of the model's free-text reason.
  signal?: string | null;
};
type SearchResponse = { summary: string; results: SearchResult[] };

const TYPE_META: Record<SearchResult["type"], { label: string; icon: React.ElementType; href: string; color: string }> = {
  note: { label: "Note", icon: FileText, href: "/notes", color: "#5FA8D3" },
  task: { label: "Task", icon: CheckSquare, href: "/tasks", color: "rgb(var(--accent))" },
  project: { label: "Project", icon: FolderKanban, href: "/projects", color: "rgb(var(--gold))" },
  journal: { label: "Journal", icon: BookOpen, href: "/journal", color: "#8B7FD6" },
  event: { label: "Event", icon: Calendar, href: "/calendar", color: "#5EA8A0" },
  learning: { label: "Learning", icon: GraduationCap, href: "/learning", color: "#D48A5F" },
  debt: { label: "Debt", icon: Wallet, href: "/finance", color: "#C97F6B" },
};

// Reverse-lookup from the health label ("At Risk") back to its state, so
// the badge can reuse Project Health's own color coding instead of
// picking new colors that could drift out of sync with the Project Health
// cards elsewhere in the app.
const HEALTH_STATE_BY_LABEL = new Map<string, ProjectHealthState>(
  (Object.entries(PROJECT_HEALTH_META) as [ProjectHealthState, { label: string; color: string }][]).map(([state, meta]) => [meta.label, state])
);

function SignalBadge({ signal }: { signal: string }) {
  const healthState = HEALTH_STATE_BY_LABEL.get(signal);
  const color = healthState ? PROJECT_HEALTH_META[healthState].color : "rgb(var(--danger))"; // "Overdue" and any other non-health signal
  return (
    <span
      className="font-mono"
      style={{ fontSize: 9.5, color, padding: "1px 6px", borderRadius: 999, background: `${color}1F`, flexShrink: 0 }}
    >
      {signal.toUpperCase()}
    </span>
  );
}

export default function SearchTab() {
  const [query, setQuery] = useState("");
  const { result, loading, error, run } = useAIAction<SearchResponse, { query: string }>("/api/natural-search");

  const runSearch = () => {
    if (!query.trim()) return;
    run({ query: query.trim() });
  };

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Ask LifeOS</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 10, padding: "0 12px" }}>
          <Search size={14} color="rgb(var(--text-muted))" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="e.g. what did I write about the car project?"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "rgb(var(--text))", fontSize: 13, padding: "10px 0" }}
          />
        </div>
        <button
          onClick={runSearch}
          disabled={loading || !query.trim()}
          style={{
            padding: "0 18px", borderRadius: 10, background: "rgb(var(--accent))", color: "rgb(var(--bg))",
            fontSize: 13, fontWeight: 600, border: "none", cursor: loading ? "default" : "pointer", opacity: loading || !query.trim() ? 0.6 : 1,
          }}
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      {error && <div style={{ marginBottom: 12 }}><AIErrorBox message={error} /></div>}

      {result?.summary && !error && (
        <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))", marginBottom: 12 }}>{result.summary}</div>
      )}

      {result?.results && result.results.length === 0 && !error && (
        <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))", padding: 16, textAlign: "center", background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 12 }}>
          Nothing matched that query.
        </div>
      )}

      {result?.results && result.results.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {result.results.map((r) => {
            const meta = TYPE_META[r.type];
            const Icon = meta.icon;
            return (
              <Link
                key={`${r.type}-${r.id}`}
                href={meta.href}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 10,
                  background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", textDecoration: "none", color: "rgb(var(--text))",
                }}
              >
                <Icon size={14} color={meta.color} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{r.title}</span>
                    <span className="font-mono" style={{ fontSize: 9.5, color: meta.color, padding: "1px 6px", borderRadius: 999, background: `${meta.color}1F`, flexShrink: 0 }}>
                      {meta.label.toUpperCase()}
                    </span>
                    {r.signal && <SignalBadge signal={r.signal} />}
                  </div>
                  <div style={{ fontSize: 11.5, color: "rgb(var(--text-muted))", marginTop: 2 }}>{r.reason}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}