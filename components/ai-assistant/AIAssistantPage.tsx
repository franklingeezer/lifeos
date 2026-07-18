"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { RefreshCw, Sparkles, Clock, AlertCircle, Search, FileText, CheckSquare, FolderKanban, BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/shell/Sidebar";

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

const TYPE_META: Record<SearchResult["type"], { label: string; icon: React.ElementType; href: string; color: string }> = {
  note: { label: "Note", icon: FileText, href: "/notes", color: "#5FA8D3" },
  task: { label: "Task", icon: CheckSquare, href: "/tasks", color: "rgb(var(--accent))" },
  project: { label: "Project", icon: FolderKanban, href: "/projects", color: "rgb(var(--gold))" },
  journal: { label: "Journal", icon: BookOpen, href: "/journal", color: "#8B7FD6" },
};

export default function AIAssistantPage() {
  const supabase = useMemo(() => createClient(), []);
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

  const today = new Date().toISOString().slice(0, 10);

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
        <div style={{ maxWidth: 760 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="font-display" style={{ fontSize: 24, fontWeight: 500 }}>AI Assistant</div>
            </div>
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

          <style>{`
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            .spin { animation: spin 0.8s linear infinite; }
          `}</style>

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

          <div style={{ marginTop: 24 }}>
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

          <div style={{ marginTop: 28 }}>
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