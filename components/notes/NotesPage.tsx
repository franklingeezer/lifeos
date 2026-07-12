"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Plus, Search, Pin, Trash2, Eye, Pencil, X, Folder as FolderIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/shell/Sidebar";

type Note = {
  id: string;
  title: string;
  content: string | null;
  folder: string | null;
  tags: string[] | null;
  pinned: boolean;
  updated_at: string;
};

const stripMd = (s: string) => s.replace(/[#*`_>\-\[\]]/g, "").replace(/\n+/g, " ").trim();

export default function NotesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all"); // "all" | "pinned" | folder name
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [tagInput, setTagInput] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">("idle");

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("notes")
      .select("id, title, content, folder, tags, pinned, updated_at")
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false });
    if (!error && data) {
      setNotes(data as Note[]);
      if (!activeId && data.length > 0) setActiveId(data[0].id);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const active = notes.find((n) => n.id === activeId) ?? null;

  const folders = Array.from(new Set(notes.map((n) => n.folder).filter(Boolean))) as string[];

  const filtered = notes.filter((n) => {
    if (filter === "pinned" && !n.pinned) return false;
    if (filter !== "all" && filter !== "pinned" && n.folder !== filter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return n.title.toLowerCase().includes(q) || (n.content ?? "").toLowerCase().includes(q);
  });

  const createNote = async () => {
    const payload = { title: "Untitled note", content: "", folder: null, tags: [], pinned: false };
    const { data, error } = await supabase.from("notes").insert(payload).select().single();
    if (!error && data) {
      setNotes((prev) => [data as Note, ...prev]);
      setActiveId(data.id);
      setMode("edit");
    }
  };

  const scheduleSave = (id: string, patch: Partial<Note>) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await supabase.from("notes").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
      setSaveStatus("saved");
    }, 700);
  };

  const togglePin = async (n: Note) => {
    setNotes((prev) => prev.map((x) => (x.id === n.id ? { ...x, pinned: !x.pinned } : x)));
    await supabase.from("notes").update({ pinned: !n.pinned }).eq("id", n.id);
  };

  const deleteNote = async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (activeId === id) setActiveId(null);
    await supabase.from("notes").delete().eq("id", id);
  };

  const addTag = (n: Note) => {
    if (!tagInput.trim()) return;
    const next = Array.from(new Set([...(n.tags ?? []), tagInput.trim()]));
    scheduleSave(n.id, { tags: next });
    setTagInput("");
  };

  const removeTag = (n: Note, tag: string) => {
    scheduleSave(n.id, { tags: (n.tags ?? []).filter((t) => t !== tag) });
  };

  return (
    <div style={{ background: "rgb(var(--bg))", color: "rgb(var(--text))", minHeight: "600px", display: "flex", borderRadius: 20, overflow: "hidden", border: "1px solid rgb(var(--border))" }}>
      <style>{`
        .lifeos-navbtn:hover { background: rgb(var(--surface-2)); }
        .note-row:hover { background: rgb(var(--surface-2)); }
        .icon-btn:hover { background: rgb(var(--surface-2)); }
        .md-preview h1 { font-size: 1.4em; font-weight: 600; margin: 0.6em 0 0.3em; }
        .md-preview h2 { font-size: 1.2em; font-weight: 600; margin: 0.6em 0 0.3em; }
        .md-preview h3 { font-size: 1.05em; font-weight: 600; margin: 0.5em 0 0.3em; }
        .md-preview p { margin: 0.4em 0; line-height: 1.6; }
        .md-preview ul, .md-preview ol { margin: 0.4em 0; padding-left: 1.4em; }
        .md-preview code { background: rgb(var(--surface-2)); padding: 1px 5px; border-radius: 4px; font-size: 0.9em; }
        .md-preview pre { background: rgb(var(--surface-2)); padding: 12px; border-radius: 8px; overflow-x: auto; }
        .md-preview pre code { background: none; padding: 0; }
        .md-preview table { border-collapse: collapse; width: 100%; margin: 0.6em 0; }
        .md-preview th, .md-preview td { border: 1px solid rgb(var(--border)); padding: 6px 10px; font-size: 0.9em; }
        .md-preview blockquote { border-left: 3px solid rgb(var(--accent)); padding-left: 10px; color: rgb(var(--text-muted)); margin: 0.4em 0; }
      `}</style>

      <Sidebar />

      {/* Notes list */}
      <div style={{ width: 280, borderRight: "1px solid rgb(var(--border))", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "18px 16px 12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div className="font-display" style={{ fontSize: 19, fontWeight: 500 }}>Notes</div>
            <button onClick={createNote} className="icon-btn" style={{ width: 28, height: 28, borderRadius: 8, background: "rgb(var(--accent))", color: "rgb(var(--bg))", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Plus size={15} />
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 8, padding: "6px 8px", marginBottom: 10 }}>
            <Search size={13} color="rgb(var(--text-muted))" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes…" style={{ background: "transparent", border: "none", outline: "none", color: "rgb(var(--text))", fontSize: 12.5, width: "100%" }} />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <FilterPill label="All" active={filter === "all"} onClick={() => setFilter("all")} />
            <FilterPill label="Pinned" active={filter === "pinned"} onClick={() => setFilter("pinned")} />
            {folders.map((f) => <FilterPill key={f} label={f} active={filter === f} onClick={() => setFilter(f)} />)}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 12px" }}>
          {loading && <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))", padding: "8px 8px" }}>Loading…</div>}
          {!loading && filtered.length === 0 && <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))", padding: "8px 8px" }}>No notes here.</div>}
          {filtered.map((n) => (
            <div
              key={n.id}
              className="note-row"
              onClick={() => { setActiveId(n.id); setMode("edit"); }}
              style={{
                padding: "10px 10px", borderRadius: 10, cursor: "pointer", marginBottom: 2,
                background: activeId === n.id ? "rgb(var(--accent) / 0.12)" : "transparent",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                {n.pinned && <Pin size={11} color="rgb(var(--gold))" fill="rgb(var(--gold))" />}
                <span style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title || "Untitled note"}</span>
              </div>
              <div style={{ fontSize: 11.5, color: "rgb(var(--text-muted))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {stripMd(n.content ?? "").slice(0, 60) || "No content yet"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {!active ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "rgb(var(--text-muted))", fontSize: 13 }}>
            Select a note, or create one.
          </div>
        ) : (
          <>
            <div style={{ padding: "16px 22px", borderBottom: "1px solid rgb(var(--border))" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                <input
                  value={active.title}
                  onChange={(e) => scheduleSave(active.id, { title: e.target.value })}
                  placeholder="Untitled note"
                  className="font-display"
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "rgb(var(--text))", fontSize: 21, fontWeight: 500 }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: "rgb(var(--text-muted))", marginRight: 4 }}>
                    {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : ""}
                  </span>
                  <button onClick={() => togglePin(active)} className="icon-btn" style={iconBtnStyle} title="Pin">
                    <Pin size={14} color={active.pinned ? "rgb(var(--gold))" : "rgb(var(--text-muted))"} fill={active.pinned ? "rgb(var(--gold))" : "none"} />
                  </button>
                  <button onClick={() => setMode(mode === "edit" ? "preview" : "edit")} className="icon-btn" style={iconBtnStyle} title="Toggle preview">
                    {mode === "edit" ? <Eye size={14} color="rgb(var(--text-muted))" /> : <Pencil size={14} color="rgb(var(--text-muted))" />}
                  </button>
                  <button onClick={() => deleteNote(active.id)} className="icon-btn" style={iconBtnStyle} title="Delete">
                    <Trash2 size={14} color="rgb(var(--danger))" />
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <FolderIcon size={12} color="rgb(var(--text-muted))" />
                  <input
                    value={active.folder ?? ""}
                    onChange={(e) => scheduleSave(active.id, { folder: e.target.value || null })}
                    placeholder="Folder"
                    style={{ background: "rgb(var(--surface-2))", border: "1px solid rgb(var(--border))", borderRadius: 6, padding: "3px 8px", fontSize: 11.5, color: "rgb(var(--text))", outline: "none", width: 110 }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                  {(active.tags ?? []).map((t) => (
                    <span key={t} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10.5, background: "rgb(var(--surface-2))", padding: "2px 6px", borderRadius: 99, color: "rgb(var(--text-muted))" }}>
                      {t}
                      <X size={9} style={{ cursor: "pointer" }} onClick={() => removeTag(active, t)} />
                    </span>
                  ))}
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTag(active)}
                    placeholder="+ tag"
                    style={{ background: "transparent", border: "none", outline: "none", fontSize: 11, color: "rgb(var(--text-muted))", width: 50 }}
                  />
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
              {mode === "edit" ? (
                <textarea
                  value={active.content ?? ""}
                  onChange={(e) => scheduleSave(active.id, { content: e.target.value })}
                  placeholder="Write in Markdown — # headers, **bold**, `code`, ```code blocks```, tables, > quotes…"
                  style={{
                    width: "100%", height: "100%", minHeight: 400, background: "transparent", border: "none", outline: "none",
                    color: "rgb(var(--text))", fontSize: 14, lineHeight: 1.6, resize: "none", fontFamily: "var(--font-inter)",
                  }}
                />
              ) : (
                <div className="md-preview">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{active.content || "*Nothing to preview yet.*"}</ReactMarkdown>
                </div>
              )}
            </div>
          </>
        )}
      </div>
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
  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
};