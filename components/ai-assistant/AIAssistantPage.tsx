"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { RefreshCw, Sparkles, Clock, AlertCircle, Search, FileText, CheckSquare, FolderKanban, BookOpen, ListOrdered, Check, NotebookPen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { todayISO } from "@/lib/date";
import Sidebar from "@/components/shell/Sidebar";

type TabKey = "brief" | "search" | "review" | "prioritize" | "journal";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "brief", label: "Morning Brief", icon: Sparkles },
  { key: "search", label: "Ask LifeOS", icon: Search },
  { key: "review", label: "Review", icon: RefreshCw },
  { key: "prioritize", label: "Prioritize", icon: ListOrdered },
  { key: "journal", label: "Journal Insights", icon: NotebookPen },
];

type PastBrief = {
  id: string;
  brief_date: string;
  content: string;
  created_at: string;
};

type SearchResult = {
  type: "note" | "task" | "project" | "journal";
  id: string;
  title: string;
  reason: string;
};

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

const PRIORITY_COLOR: Record<string, string> = {
  low: "rgb(var(--text-muted))",
  med: "rgb(var(--gold))",
  high: "rgb(var(--danger))",
};

const TYPE_META: Record<SearchResult["type"], { label: string; icon: React.ElementType; href: string; color: string }> = {
  note: { label: "Note", icon: FileText, href: "/notes", color: "#5FA8D3" },
  task: { label: "Task", icon: CheckSquare, href: "/tasks", color: "rgb(var(--accent))" },
  project: { label: "Project", icon: FolderKanban, href: "/projects", color: "rgb(var(--gold))" },
  journal: { label: "Journal", icon: BookOpen, href: "/journal", color: "#8B7FD6" },
};

export default function AIAssistantPage() {
  const supabase = useMemo(() => createClient(), []);
  const [activeTab, setActiveTab] = useState<TabKey>("brief");
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [history, setHistory] = useState<PastBrief[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchSummary, setSearchSummary] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);

  const runSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch("/api/natural-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSearchError(data.error || "Search failed.");
        setSearchResults(null);
      } else {
        setSearchSummary(data.summary);
        setSearchResults(data.results);
      }
    } catch {
      setSearchError("Couldn't reach the server. Is the dev server running?");
    } finally {
      setSearching(false);
    }
  }, [query]);

  const [reviewType, setReviewType] = useState<"weekly" | "monthly">("weekly");
  const [reviewContent, setReviewContent] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewRegenerating, setReviewRegenerating] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewPeriod, setReviewPeriod] = useState<{ start: string; end: string } | null>(null);

  const [priorityLoading, setPriorityLoading] = useState(false);
  const [priorityError, setPriorityError] = useState<string | null>(null);
  const [prioritySummary, setPrioritySummary] = useState<string | null>(null);
  const [prioritySuggestions, setPrioritySuggestions] = useState<PrioritySuggestion[] | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  const runPrioritize = useCallback(async () => {
    setPriorityLoading(true);
    setPriorityError(null);
    setAppliedIds(new Set());
    try {
      const res = await fetch("/api/prioritize-tasks", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setPriorityError(data.error || "Prioritization failed.");
        setPrioritySuggestions(null);
      } else {
        setPrioritySummary(data.summary);
        setPrioritySuggestions(data.suggestions);
      }
    } catch {
      setPriorityError("Couldn't reach the server. Is the dev server running?");
    } finally {
      setPriorityLoading(false);
    }
  }, []);

  const applySuggestion = useCallback(async (s: PrioritySuggestion) => {
    await supabase.from("tasks").update({ priority: s.suggested_priority }).eq("id", s.id);
    setAppliedIds((prev) => new Set(prev).add(s.id));
  }, [supabase]);

  const applyAll = useCallback(async () => {
    if (!prioritySuggestions) return;
    const toApply = prioritySuggestions.filter((s) => s.suggested_priority !== s.current_priority && !appliedIds.has(s.id));
    for (const s of toApply) {
      await supabase.from("tasks").update({ priority: s.suggested_priority }).eq("id", s.id);
    }
    setAppliedIds((prev) => new Set([...prev, ...toApply.map((s) => s.id)]));
  }, [prioritySuggestions, appliedIds, supabase]);

  const fetchReview = useCallback(async (type: "weekly" | "monthly", regenerate: boolean) => {
    regenerate ? setReviewRegenerating(true) : setReviewLoading(true);
    setReviewError(null);
    try {
      const res = await fetch(`/api/review?type=${type}${regenerate ? "&regenerate=true" : ""}`);
      const data = await res.json();
      if (!res.ok) {
        setReviewError(data.error || "Something went wrong generating the review.");
      } else {
        setReviewContent(data.content);
        setReviewPeriod(data.period);
      }
    } catch {
      setReviewError("Couldn't reach the server. Is the dev server running?");
    } finally {
      setReviewLoading(false);
      setReviewRegenerating(false);
    }
  }, []);

  useEffect(() => {
    fetchReview(reviewType, false);
  }, [reviewType, fetchReview]);

  const [journalRange, setJournalRange] = useState<"30d" | "90d" | "all">("30d");
  const [journalContent, setJournalContent] = useState<string | null>(null);
  const [journalEntryCount, setJournalEntryCount] = useState<number | null>(null);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalRegenerating, setJournalRegenerating] = useState(false);
  const [journalError, setJournalError] = useState<string | null>(null);
  const [journalPeriod, setJournalPeriod] = useState<{ start: string | null; end: string } | null>(null);

  const fetchJournalInsights = useCallback(async (range: "30d" | "90d" | "all", regenerate: boolean) => {
    regenerate ? setJournalRegenerating(true) : setJournalLoading(true);
    setJournalError(null);
    try {
      const res = await fetch(`/api/journal-insights?range=${range}${regenerate ? "&regenerate=true" : ""}`);
      const data = await res.json();
      if (!res.ok) {
        setJournalError(data.error || "Something went wrong generating journal insights.");
      } else {
        setJournalContent(data.content);
        setJournalEntryCount(data.entry_count);
        setJournalPeriod(data.period);
      }
    } catch {
      setJournalError("Couldn't reach the server. Is the dev server running?");
    } finally {
      setJournalLoading(false);
      setJournalRegenerating(false);
    }
  }, []);

  useEffect(() => {
    fetchJournalInsights(journalRange, false);
  }, [journalRange, fetchJournalInsights]);

  const fetchBrief = useCallback(async (regenerate: boolean) => {
    regenerate ? setRegenerating(true) : setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/morning-brief${regenerate ? "?regenerate=true" : ""}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong generating the brief.");
      } else {
        setContent(data.content);
        setGeneratedAt(data.created_at);
      }
    } catch (err) {
      setError("Couldn't reach the server. Is the dev server running?");
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from("ai_briefs")
      .select("id, brief_date, content, created_at")
      .order("brief_date", { ascending: false })
      .limit(14);
    if (data) setHistory(data as PastBrief[]);
  }, [supabase]);

  useEffect(() => {
    fetchBrief(false);
    loadHistory();
  }, [fetchBrief, loadHistory]);

  const displayed = selectedHistoryId
    ? history.find((h) => h.id === selectedHistoryId)?.content ?? content
    : content;

  const today = todayISO();

  return (
    <div
      style={{
        background: "rgb(var(--bg))", color: "rgb(var(--text))", minHeight: "600px",
        display: "flex", borderRadius: 20, overflow: "hidden", border: "1px solid rgb(var(--border))", position: "relative",
      }}
    >
      <style>{`
        .history-row:hover { background: rgb(var(--surface-2)); }
        .regen-btn:hover { background: rgb(var(--surface-2)); }
      `}</style>

      <Sidebar />

      <div style={{ flex: 1, padding: "22px 26px", overflowY: "auto", maxHeight: "700px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div className="font-display" style={{ fontSize: 24, fontWeight: 500, marginBottom: 16 }}>AI Assistant</div>

          <div style={{ display: "flex", gap: 6, marginBottom: 22, borderBottom: "1px solid rgb(var(--border))", overflowX: "auto" }}>
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                    background: "transparent", border: "none", whiteSpace: "nowrap",
                    color: active ? "rgb(var(--accent))" : "rgb(var(--text-muted))",
                    borderBottom: active ? "2px solid rgb(var(--accent))" : "2px solid transparent",
                    marginBottom: -1,
                  }}
                >
                  <Icon size={13} /> {t.label}
                </button>
              );
            })}
          </div>

          <style>{`
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            .spin { animation: spin 0.8s linear infinite; }
          `}</style>

          {activeTab === "brief" && (
          <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button
              className="regen-btn"
              onClick={() => fetchBrief(true)}
              disabled={regenerating || loading}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10,
                background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", color: "rgb(var(--text))",
                fontSize: 12.5, fontWeight: 600, cursor: regenerating || loading ? "default" : "pointer", opacity: regenerating ? 0.6 : 1,
              }}
            >
              <RefreshCw size={13} className={regenerating ? "spin" : ""} /> Regenerate
            </button>
          </div>

          <div style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 24, minHeight: 220 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgb(var(--accent))" }}>
                <Sparkles size={16} />
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                  {selectedHistoryId ? `Brief from ${history.find((h) => h.id === selectedHistoryId)?.brief_date}` : "Today's Morning Brief"}
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

            {(loading || regenerating) && (
              <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>
                {regenerating ? "Regenerating…" : "Loading your brief…"}
              </div>
            )}

            {!loading && !regenerating && error && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 14, borderRadius: 10, background: "rgb(var(--danger) / 0.1)", border: "1px solid rgb(var(--danger) / 0.3)" }}>
                <AlertCircle size={16} color="rgb(var(--danger))" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12.5, color: "rgb(var(--danger))", lineHeight: 1.5 }}>{error}</div>
              </div>
            )}

            {!loading && !regenerating && !error && displayed && (
              <div style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{displayed}</div>
            )}

            {generatedAt && !selectedHistoryId && !loading && !error && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 20, fontSize: 10.5, color: "rgb(var(--text-muted))" }}>
                <Clock size={11} /> Generated {new Date(generatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </div>
            )}
          </div>
          </div>
          )}

          {activeTab === "search" && (
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
                disabled={searching || !query.trim()}
                style={{
                  padding: "0 18px", borderRadius: 10, background: "rgb(var(--accent))", color: "rgb(var(--bg))",
                  fontSize: 13, fontWeight: 600, border: "none", cursor: searching ? "default" : "pointer", opacity: searching || !query.trim() ? 0.6 : 1,
                }}
              >
                {searching ? "Searching…" : "Search"}
              </button>
            </div>

            {searchError && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 14, borderRadius: 10, background: "rgb(var(--danger) / 0.1)", border: "1px solid rgb(var(--danger) / 0.3)", marginBottom: 12 }}>
                <AlertCircle size={16} color="rgb(var(--danger))" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12.5, color: "rgb(var(--danger))", lineHeight: 1.5 }}>{searchError}</div>
              </div>
            )}

            {searchSummary && !searchError && (
              <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))", marginBottom: 12 }}>{searchSummary}</div>
            )}

            {searchResults && searchResults.length === 0 && !searchError && (
              <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))", padding: 16, textAlign: "center", background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 12 }}>
                Nothing matched that query.
              </div>
            )}

            {searchResults && searchResults.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {searchResults.map((r) => {
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
          )}

          {activeTab === "review" && (
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
                <button
                  className="regen-btn"
                  onClick={() => fetchReview(reviewType, true)}
                  disabled={reviewRegenerating || reviewLoading}
                  style={{
                    display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 8,
                    background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", color: "rgb(var(--text))",
                    fontSize: 11.5, fontWeight: 600, cursor: reviewRegenerating || reviewLoading ? "default" : "pointer", opacity: reviewRegenerating ? 0.6 : 1,
                  }}
                >
                  <RefreshCw size={11} className={reviewRegenerating ? "spin" : ""} /> Regenerate
                </button>
              </div>
            </div>

            <div style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 20, minHeight: 160 }}>
              {reviewPeriod && !reviewLoading && (
                <div style={{ fontSize: 10.5, color: "rgb(var(--text-muted))", marginBottom: 12 }}>
                  {reviewPeriod.start} → {reviewPeriod.end}
                </div>
              )}

              {(reviewLoading || reviewRegenerating) && (
                <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>
                  {reviewRegenerating ? "Regenerating…" : "Loading review…"}
                </div>
              )}

              {!reviewLoading && !reviewRegenerating && reviewError && (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 14, borderRadius: 10, background: "rgb(var(--danger) / 0.1)", border: "1px solid rgb(var(--danger) / 0.3)" }}>
                  <AlertCircle size={16} color="rgb(var(--danger))" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 12.5, color: "rgb(var(--danger))", lineHeight: 1.5 }}>{reviewError}</div>
                </div>
              )}

              {!reviewLoading && !reviewRegenerating && !reviewError && reviewContent && (
                <ReviewContent content={reviewContent} />
              )}
            </div>
          </div>
          )}

          {activeTab === "prioritize" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Prioritize tasks</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {prioritySuggestions && prioritySuggestions.some((s) => s.suggested_priority !== s.current_priority && !appliedIds.has(s.id)) && (
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
                  disabled={priorityLoading}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10,
                    background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", color: "rgb(var(--text))",
                    fontSize: 12.5, fontWeight: 600, cursor: priorityLoading ? "default" : "pointer", opacity: priorityLoading ? 0.6 : 1,
                  }}
                >
                  <ListOrdered size={13} className={priorityLoading ? "spin" : ""} /> {priorityLoading ? "Thinking…" : "Suggest priorities"}
                </button>
              </div>
            </div>

            {!priorityLoading && !priorityError && !prioritySuggestions && (
              <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))", padding: 16, textAlign: "center", background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 12 }}>
                Click "Suggest priorities" to have LifeOS look at your open tasks, due dates, and workload — you decide what to apply.
              </div>
            )}

            {priorityLoading && (
              <div style={{ fontSize: 13, color: "rgb(var(--text-muted))", padding: 16 }}>Reviewing your open tasks…</div>
            )}

            {!priorityLoading && priorityError && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 14, borderRadius: 10, background: "rgb(var(--danger) / 0.1)", border: "1px solid rgb(var(--danger) / 0.3)" }}>
                <AlertCircle size={16} color="rgb(var(--danger))" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12.5, color: "rgb(var(--danger))", lineHeight: 1.5 }}>{priorityError}</div>
              </div>
            )}

            {!priorityLoading && prioritySuggestions && prioritySuggestions.length === 0 && (
              <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))", padding: 16, textAlign: "center", background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 12 }}>
                No open tasks to prioritize.
              </div>
            )}

            {!priorityLoading && prioritySuggestions && prioritySuggestions.length > 0 && (
              <>
                {prioritySummary && (
                  <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))", marginBottom: 12 }}>{prioritySummary}</div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {prioritySuggestions.map((s, i) => {
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
          )}

          {activeTab === "journal" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <NotebookPen size={15} color="rgb(var(--accent))" />
                <div style={{ fontSize: 13, fontWeight: 600 }}>Journal insights</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 999, padding: 3 }}>
                  {([
                    { key: "30d", label: "30 days" },
                    { key: "90d", label: "90 days" },
                    { key: "all", label: "All time" },
                  ] as const).map((r) => (
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
                <button
                  className="regen-btn"
                  onClick={() => fetchJournalInsights(journalRange, true)}
                  disabled={journalRegenerating || journalLoading}
                  style={{
                    display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 8,
                    background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", color: "rgb(var(--text))",
                    fontSize: 11.5, fontWeight: 600, cursor: journalRegenerating || journalLoading ? "default" : "pointer", opacity: journalRegenerating ? 0.6 : 1,
                  }}
                >
                  <RefreshCw size={11} className={journalRegenerating ? "spin" : ""} /> Regenerate
                </button>
              </div>
            </div>

            <div style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 20, minHeight: 140 }}>
              {journalPeriod && !journalLoading && journalEntryCount !== null && journalEntryCount > 0 && (
                <div style={{ fontSize: 10.5, color: "rgb(var(--text-muted))", marginBottom: 12 }}>
                  {journalPeriod.start ? `${journalPeriod.start} → ${journalPeriod.end}` : `through ${journalPeriod.end}`} · {journalEntryCount} {journalEntryCount === 1 ? "entry" : "entries"}
                </div>
              )}

              {(journalLoading || journalRegenerating) && (
                <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>
                  {journalRegenerating ? "Regenerating…" : "Loading insights…"}
                </div>
              )}

              {!journalLoading && !journalRegenerating && journalError && (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 14, borderRadius: 10, background: "rgb(var(--danger) / 0.1)", border: "1px solid rgb(var(--danger) / 0.3)" }}>
                  <AlertCircle size={16} color="rgb(var(--danger))" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 12.5, color: "rgb(var(--danger))", lineHeight: 1.5 }}>{journalError}</div>
                </div>
              )}

              {!journalLoading && !journalRegenerating && !journalError && journalContent && (
                <ReviewContent content={journalContent} />
              )}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Parses the plain-text review into visually distinct blocks: the opening
// line, ALL-CAPS section labels, bullets under each section, and any closing
// observation line — instead of dumping it as one flat whitespace-wrapped blob.
function ReviewContent({ content }: { content: string }) {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);

  const isSectionLabel = (line: string) =>
    line === line.toUpperCase() && /[A-Z]/.test(line) && !line.startsWith("•") && line.length < 30;

  const blocks: { type: "intro" | "label" | "bullet" | "text"; text: string }[] = [];
  lines.forEach((line, i) => {
    if (line.startsWith("•")) blocks.push({ type: "bullet", text: line.replace(/^•\s*/, "") });
    else if (isSectionLabel(line)) blocks.push({ type: "label", text: line });
    else blocks.push({ type: i === 0 ? "intro" : "text", text: line });
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {blocks.map((b, i) => {
        if (b.type === "intro") {
          return (
            <div key={i} style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
              {b.text}
            </div>
          );
        }
        if (b.type === "label") {
          return (
            <div
              key={i}
              className="font-mono"
              style={{
                fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, color: "rgb(var(--accent))",
                marginTop: i === 1 ? 4 : 18, marginBottom: 6,
              }}
            >
              {b.text}
            </div>
          );
        }
        if (b.type === "bullet") {
          return (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 13.5, lineHeight: 1.6, paddingLeft: 2 }}>
              <span style={{ color: "rgb(var(--text-muted))", flexShrink: 0 }}>•</span>
              <span>{b.text}</span>
            </div>
          );
        }
        return (
          <div key={i} style={{ fontSize: 13, lineHeight: 1.7, color: "rgb(var(--text-muted))", marginTop: 16, fontStyle: "italic" }}>
            {b.text}
          </div>
        );
      })}
    </div>
  );
}