"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Upload, X, Trash2, Search, FileText, Film, ImageIcon, File as FileIcon, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/shell/Sidebar";

type FileKind = "image" | "video" | "document" | "other";

type MediaItem = {
  id: string;
  storage_path: string;
  file_name: string;
  file_type: FileKind;
  mime_type: string | null;
  size_bytes: number | null;
  caption: string | null;
  tags: string[];
  created_at: string;
  url?: string;
};

const BUCKET = "media";
const SIGNED_URL_TTL = 60 * 60; // 1 hour

const kindFromMime = (mime: string): FileKind => {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf" || mime.startsWith("text/") || mime.includes("document")) return "document";
  return "other";
};

const formatSize = (bytes: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const KIND_ICON: Record<FileKind, React.ElementType> = {
  image: ImageIcon,
  video: Film,
  document: FileText,
  other: FileIcon,
};

export default function MediaVaultPage() {
  const supabase = useMemo(() => createClient(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<"all" | FileKind>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [pendingTags, setPendingTags] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("media_items")
      .select("id, storage_path, file_name, file_type, mime_type, size_bytes, caption, tags, created_at")
      .order("created_at", { ascending: false });

    if (error || !data) {
      setLoading(false);
      return;
    }

    const withUrls = await Promise.all(
      (data as MediaItem[]).map(async (item) => {
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(item.storage_path, SIGNED_URL_TTL);
        return { ...item, url: signed?.signedUrl };
      })
    );
    setItems(withUrls);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((item) => {
    if (filter !== "all" && item.file_type !== filter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const inName = item.file_name.toLowerCase().includes(q);
      const inTags = item.tags.some((t) => t.toLowerCase().includes(q));
      const inCaption = item.caption?.toLowerCase().includes(q);
      if (!inName && !inTags && !inCaption) return false;
    }
    return true;
  });

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    const tags = pendingTags.split(",").map((t) => t.trim()).filter(Boolean);

    for (const file of Array.from(fileList)) {
      const kind = kindFromMime(file.type);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
      if (uploadError) {
        console.error("Upload failed:", uploadError);
        alert(`Failed to upload ${file.name}: ${uploadError.message}`);
        continue;
      }

      const { error: insertError } = await supabase.from("media_items").insert({
        storage_path: path,
        file_name: file.name,
        file_type: kind,
        mime_type: file.type || null,
        size_bytes: file.size,
        tags,
      });
      if (insertError) {
        console.error("Metadata insert failed:", insertError);
        alert(`Uploaded ${file.name} but failed to save its info: ${insertError.message}`);
      }
    }

    setUploading(false);
    setPendingTags("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    load();
  };

  const deleteItem = async (item: MediaItem) => {
    await supabase.storage.from(BUCKET).remove([item.storage_path]);
    await supabase.from("media_items").delete().eq("id", item.id);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    if (selected?.id === item.id) setSelected(null);
  };

  const updateCaption = async (item: MediaItem, caption: string) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, caption } : i)));
    await supabase.from("media_items").update({ caption: caption || null }).eq("id", item.id);
  };

  const FILTERS: { key: "all" | FileKind; label: string }[] = [
    { key: "all", label: "All" },
    { key: "image", label: "Images" },
    { key: "video", label: "Videos" },
    { key: "document", label: "Documents" },
    { key: "other", label: "Other" },
  ];

  return (
    <div
      style={{
        background: "rgb(var(--bg))", color: "rgb(var(--text))", minHeight: "600px",
        display: "flex", borderRadius: 20, overflow: "hidden", border: "1px solid rgb(var(--border))", position: "relative",
      }}
    >
      <style>{`
        .filter-chip:hover { background: rgb(var(--surface-2)); }
        .media-card:hover { border-color: rgb(var(--accent) / 0.5); }
        .media-icon-btn:hover { background: rgb(var(--surface-2)); }
      `}</style>

      <Sidebar />

      <div style={{ flex: 1, padding: "22px 26px", overflowY: "auto", maxHeight: "700px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div className="font-display" style={{ fontSize: 24, fontWeight: 500 }}>Media Vault</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 10, padding: "0 10px" }}>
              <Search size={14} color="rgb(var(--text-muted))" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, tag, caption…"
                style={{ background: "transparent", border: "none", outline: "none", color: "rgb(var(--text))", fontSize: 12.5, padding: "8px 0", width: 180 }}
              />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              style={{ display: "none" }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: "rgb(var(--accent))", color: "rgb(var(--bg))", fontSize: 13, fontWeight: 600, border: "none", cursor: uploading ? "default" : "pointer", opacity: uploading ? 0.6 : 1 }}
            >
              <Upload size={15} /> {uploading ? "Uploading…" : "Upload"}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <input
            value={pendingTags}
            onChange={(e) => setPendingTags(e.target.value)}
            placeholder="Tags for next upload (comma separated, optional) — e.g. receipts, 2026, trip"
            style={{
              width: "100%", padding: "8px 10px", borderRadius: 8, background: "rgb(var(--surface))",
              border: "1px solid rgb(var(--border))", color: "rgb(var(--text))", fontSize: 12.5, outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className="filter-chip"
              onClick={() => setFilter(f.key)}
              style={{
                padding: "6px 12px", borderRadius: 999, fontSize: 12, cursor: "pointer",
                border: `1px solid ${filter === f.key ? "rgb(var(--accent))" : "rgb(var(--border))"}`,
                background: filter === f.key ? "rgb(var(--accent) / 0.12)" : "rgb(var(--surface))",
                color: filter === f.key ? "rgb(var(--accent))" : "rgb(var(--text-muted))",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading && <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>Loading media…</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ fontSize: 13, color: "rgb(var(--text-muted))", padding: 24, textAlign: "center", background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16 }}>
            {items.length === 0 ? "No files yet. Upload something to get started." : "Nothing matches this filter."}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
            {filtered.map((item) => {
              const Icon = KIND_ICON[item.file_type];
              return (
                <div
                  key={item.id}
                  className="media-card"
                  onClick={() => setSelected(item)}
                  style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 12, overflow: "hidden", cursor: "pointer" }}
                >
                  <div style={{ aspectRatio: "1 / 1", background: "rgb(var(--surface-2))", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {item.file_type === "image" && item.url ? (
                      <img src={item.url} alt={item.file_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : item.file_type === "video" && item.url ? (
                      <video src={item.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                    ) : (
                      <Icon size={28} color="rgb(var(--text-muted))" />
                    )}
                  </div>
                  <div style={{ padding: "8px 10px" }}>
                    <div style={{ fontSize: 11.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.file_name}
                    </div>
                    <div style={{ fontSize: 10, color: "rgb(var(--text-muted))" }}>{formatSize(item.size_bytes)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 20, width: 480, maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selected.file_name}</span>
              <X size={16} style={{ cursor: "pointer", color: "rgb(var(--text-muted))", flexShrink: 0, marginLeft: 10 }} onClick={() => setSelected(null)} />
            </div>

            <div style={{ background: "rgb(var(--surface-2))", borderRadius: 10, overflow: "hidden", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
              {selected.file_type === "image" && selected.url && (
                <img src={selected.url} alt={selected.file_name} style={{ width: "100%", maxHeight: 360, objectFit: "contain" }} />
              )}
              {selected.file_type === "video" && selected.url && (
                <video src={selected.url} controls style={{ width: "100%", maxHeight: 360 }} />
              )}
              {(selected.file_type === "document" || selected.file_type === "other") && (
                <div style={{ padding: 40, textAlign: "center", color: "rgb(var(--text-muted))" }}>
                  <FileText size={36} style={{ marginBottom: 8 }} />
                  <div style={{ fontSize: 12.5 }}>No preview available</div>
                </div>
              )}
            </div>

            <div style={{ fontSize: 11.5, color: "rgb(var(--text-muted))", marginBottom: 10 }}>
              {formatSize(selected.size_bytes)} · {new Date(selected.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11.5, color: "rgb(var(--text-muted))", marginBottom: 5 }}>Caption</div>
              <textarea
                defaultValue={selected.caption ?? ""}
                onBlur={(e) => updateCaption(selected, e.target.value)}
                rows={2}
                placeholder="Add a caption…"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: "rgb(var(--surface-2))", border: "1px solid rgb(var(--border))", color: "rgb(var(--text))", fontSize: 13, outline: "none", resize: "vertical" }}
              />
            </div>

            {selected.tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                {selected.tags.map((tag) => (
                  <span key={tag} className="font-mono" style={{ fontSize: 10.5, padding: "3px 8px", borderRadius: 999, background: "rgb(var(--surface-2))", color: "rgb(var(--text-muted))" }}>
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              {selected.url && (
                <a
                  href={selected.url}
                  download={selected.file_name}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", borderRadius: 10, background: "rgb(var(--surface-2))", color: "rgb(var(--text))", fontWeight: 600, fontSize: 13, textDecoration: "none" }}
                >
                  <Download size={14} /> Download
                </a>
              )}
              <button
                onClick={() => deleteItem(selected)}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", borderRadius: 10, background: "rgb(var(--danger) / 0.12)", color: "rgb(var(--danger))", fontWeight: 600, fontSize: 13, border: "1px solid rgb(var(--danger) / 0.3)", cursor: "pointer" }}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}