"use client";

import React, { useState, useMemo } from "react";
import { Inbox as InboxIcon, Archive, Trash2, ArchiveRestore, Search, ArrowRightCircle } from "lucide-react";
import Sidebar from "@/components/shell/Sidebar";
import InboxQuickCapture from "@/components/inbox/InboxQuickCapture";
import InboxProcessDrawer from "@/components/inbox/InboxProcessDrawer";
import { useInbox, type InboxItem, type InboxStatus } from "@/hooks/useInbox";

type FilterKey = "all" | InboxStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "inbox", label: "Unprocessed" },
  { key: "processed", label: "Processed" },
  { key: "archived", label: "Archived" },
];

// Relative time, not an absolute timestamp — a capture bucket is meant to
// be skimmed quickly ("a few minutes ago"), not read like a log.
function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

const CONVERTED_LABEL: Record<string, string> = {
  task: "→ Task", note: "→ Note", idea: "→ Idea", project: "→ Project", event: "→ Event", reminder: "→ Reminder",
};

export default function InboxPage() {
  const { items, isLoading, error, archiveItem, deleteItem } = useInbox();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [processing, setProcessing] = useState<InboxItem | null>(null);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (filter !== "all" && i.status !== filter) return false;
      if (search.trim() && !i.content.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [items, filter, search]);

  const unprocessedCount = items.filter((i) => i.status === "inbox").length;

  return (
    <div className="lifeos-shell" style={{ background: "rgb(var(--bg))", color: "rgb(var(--text))", minHeight: "600px", display: "flex", borderRadius: 20, overflow: "hidden", border: "1px solid rgb(var(--border))" }}>
      <style>{`.inbox-row:hover { background: rgb(var(--surface-2)); } .inbox-icon-btn:hover { background: rgb(var(--surface-2)); }`}</style>
      <Sidebar />

      <div className="lifeos-page-content" style={{ flex: 1, padding: "22px 26px", overflowY: "auto", maxHeight: "700px" }}>
        <div style={{ marginBottom: 18 }}>
          <h1 className="font-display" style={{ fontSize: 24, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
            <InboxIcon size={20} /> Inbox
            {unprocessedCount > 0 && (
              <span style={{ fontSize: 12, fontWeight: 600, padding: "2px 9px", borderRadius: 99, background: "rgb(var(--accent) / 0.15)", color: "rgb(var(--accent))" }}>
                {unprocessedCount} unprocessed
              </span>
            )}
          </h1>
          <p style={{ fontSize: 13, color: "rgb(var(--text-muted))", marginTop: 4 }}>
            Capture first, organize later. Nothing here needs a category yet.
          </p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <InboxQuickCapture autoFocus />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {FILTERS.map((f) => (
              <FilterPill key={f.key} label={f.label} active={filter === f.key} onClick={() => setFilter(f.key)} />
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", padding: "6px 10px", borderRadius: 8, background: "rgb(var(--surface-2))", border: "1px solid rgb(var(--border))" }}>
            <Search size={13} color="rgb(var(--text-muted))" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search captures…"
              style={{ background: "transparent", border: "none", outline: "none", color: "rgb(var(--text))", fontSize: 12.5, width: 160 }}
            />
          </div>
        </div>

        {isLoading && <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>Loading…</div>}
        {error && !isLoading && (
          <div style={{ fontSize: 13, color: "rgb(var(--danger))" }}>Couldn't load your Inbox — check your connection and try refreshing.</div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div style={{ padding: "40px 0", textAlign: "center", color: "rgb(var(--text-muted))", fontSize: 13 }}>
            {items.length === 0 ? "Nothing captured yet — type something above." : "Nothing matches this filter."}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {filtered.map((item) => (
            <InboxRow key={item.id} item={item} onArchive={() => archiveItem(item.id)} onDelete={() => deleteItem(item.id)} onProcess={() => setProcessing(item)} />
          ))}
        </div>
      </div>

      {processing && <InboxProcessDrawer item={processing} onClose={() => setProcessing(null)} />}
    </div>
  );
}

function InboxRow({ item, onArchive, onDelete, onProcess }: { item: InboxItem; onArchive: () => void; onDelete: () => void; onProcess: () => void }) {
  return (
    <div
      className="inbox-row"
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10 }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: "rgb(var(--text))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.content}
        </div>
        <div style={{ fontSize: 11, color: "rgb(var(--text-muted))", marginTop: 2, display: "flex", gap: 8 }}>
          <span>{relativeTime(item.created_at)}</span>
          {item.converted_type && <span style={{ color: "rgb(var(--accent))" }}>{CONVERTED_LABEL[item.converted_type]}</span>}
        </div>
      </div>

      {item.status === "inbox" && (
        <button onClick={onProcess} className="inbox-icon-btn" title="Process" style={{ ...iconBtnStyle, width: "auto", padding: "0 10px", gap: 5, background: "rgb(var(--accent) / 0.12)", border: "1px solid rgb(var(--accent) / 0.3)" }}>
          <ArrowRightCircle size={13} color="rgb(var(--accent))" />
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "rgb(var(--accent))" }}>Process</span>
        </button>
      )}

      {item.status !== "archived" ? (
        <button onClick={onArchive} className="inbox-icon-btn" title="Archive" style={iconBtnStyle}>
          <Archive size={13} color="rgb(var(--text-muted))" />
        </button>
      ) : (
        <button onClick={onDelete} className="inbox-icon-btn" title="Delete permanently" style={iconBtnStyle}>
          <Trash2 size={13} color="rgb(var(--danger))" />
        </button>
      )}
    </div>
  );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <span
      onClick={onClick}
      style={{
        fontSize: 11, padding: "4px 9px", borderRadius: 99, cursor: "pointer",
        background: active ? "rgb(var(--accent))" : "rgb(var(--surface-2))",
        color: active ? "rgb(var(--bg))" : "rgb(var(--text-muted))",
        fontWeight: active ? 600 : 500,
      }}
    >
      {label}
    </span>
  );
}

const iconBtnStyle: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 7, background: "transparent", border: "1px solid rgb(var(--border))",
  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
};