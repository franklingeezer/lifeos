"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Search, FileText, CheckSquare, FolderKanban, BookOpen, Calendar, GraduationCap } from "lucide-react";
import { useAIAction } from "@/hooks/useAIAction";
import { AIErrorBox } from "./shared";

type SearchResult = {
  type: "note" | "task" | "project" | "journal" | "event" | "learning";
  id: string;
  title: string;
  reason: string;
};
type SearchResponse = { summary: string; results: SearchResult[] };

const TYPE_META: Record<SearchResult["type"], { label: string; icon: React.ElementType; href: string; color: string }> = {
  note: { label: "Note", icon: FileText, href: "/notes", color: "#5FA8D3" },
  task: { label: "Task", icon: CheckSquare, href: "/tasks", color: "rgb(var(--accent))" },
  project: { label: "Project", icon: FolderKanban, href: "/projects", color: "rgb(var(--gold))" },
  journal: { label: "Journal", icon: BookOpen, href: "/journal", color: "#8B7FD6" },
  event: { label: "Event", icon: Calendar, href: "/calendar", color: "#5EA8A0" },
  learning: { label: "Learning", icon: GraduationCap, href: "/learning", color: "#D48A5F" },
};

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
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{r.title}</span>
                    <span className="font-mono" style={{ fontSize: 9.5, color: meta.color, padding: "1px 6px", borderRadius: 999, background: `${meta.color}1F`, flexShrink: 0 }}>
                      {meta.label.toUpperCase()}
                    </span>
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