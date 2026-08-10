"use client";

import React, { useState, useRef } from "react";
import { Upload, X, Trash2, Search, FileText, Film, ImageIcon, File as FileIcon, Download } from "lucide-react";
import Sidebar from "@/components/shell/Sidebar";
import { useMediaVault, type MediaItem, type FileKind } from "@/hooks/useMediaVault";

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
  const { items, isLoading, uploadFiles, deleteItem, updateCaption, renameFile } = useMediaVault();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<"all" | FileKind>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [pendingTags, setPendingTags] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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

    const failures = await uploadFiles(fileList, tags);
    if (failures.length > 0) {
      alert(`Some uploads had issues:\n\n${failures.join("\n")}`);
    }

    setUploading(false);
    setPendingTags("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const requestDelete = (item: MediaItem) => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    deleteItem(item);
    setConfirmingDelete(false);
    setSelected(null);
  };

  const downloadFile = async (item: MediaItem) => {
    if (!item.url) return;
    setDownloading(true);
    try {
      const res = await fetch(item.url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = item.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Download failed — the signed URL may have expired. Try reopening the file.");
    } finally {
      setDownloading(false);
    }
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
      className="lifeos-shell"
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

      <div className="lifeos-page-content" style={{ flex: 1, padding: "22px 26px", overflowY: "auto", maxHeight: "700px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div className="font-display" style={{ fontSize: 24, fontWeight: 500 }}>Media Vault</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
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

        {isLoading && <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>Loading media…</div>}
        {!isLoading && filtered.length === 0 && (
          <div style={{ fontSize: 13, color: "rgb(var(--text-muted))", padding: 24, textAlign: "center", background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16 }}>
            {items.length === 0 ? "No files yet. Upload something to get started." : "Nothing matches this filter."}
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
            {filtered.map((item) => {
              const Icon = KIND_ICON[item.file_type];
              return (
                <div
                  key={item.id}
                  className="media-card"
                  onClick={() => { setSelected(item); setConfirmingDelete(false); }}
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
        <div onClick={() => { setSelected(null); setConfirmingDelete(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 20, width: 480, maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10 }}>
              <input
                key={selected.id}
                defaultValue={selected.file_name}
                onBlur={(e) => renameFile(selected, e.target.value)}
                style={{
                  flex: 1, fontSize: 14, fontWeight: 600, background: "transparent", border: "none", outline: "none",
                  color: "rgb(var(--text))", padding: "4px 6px", borderRadius: 6, minWidth: 0,
                }}
                onFocus={(e) => (e.target.style.background = "rgb(var(--surface-2))")}
              />
              <X size={16} style={{ cursor: "pointer", color: "rgb(var(--text-muted))", flexShrink: 0 }} onClick={() => { setSelected(null); setConfirmingDelete(false); }} />
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
                <button
                  onClick={() => downloadFile(selected)}
                  disabled={downloading}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", borderRadius: 10, background: "rgb(var(--surface-2))", color: "rgb(var(--text))", fontWeight: 600, fontSize: 13, border: "none", cursor: downloading ? "default" : "pointer", opacity: downloading ? 0.6 : 1 }}
                >
                  <Download size={14} /> {downloading ? "Downloading…" : "Download"}
                </button>
              )}
              <button
                onClick={() => requestDelete(selected)}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", borderRadius: 10,
                  background: confirmingDelete ? "rgb(var(--danger))" : "rgb(var(--danger) / 0.12)",
                  color: confirmingDelete ? "rgb(var(--bg))" : "rgb(var(--danger))",
                  fontWeight: 600, fontSize: 13, border: "1px solid rgb(var(--danger) / 0.3)", cursor: "pointer",
                }}
              >
                <Trash2 size={14} /> {confirmingDelete ? "Click again to confirm" : "Delete"}
              </button>
            </div>
            {confirmingDelete && (
              <div style={{ fontSize: 11, color: "rgb(var(--text-muted))", marginTop: 8, textAlign: "center" }}>
                This permanently deletes the file. Click "Delete" once more to confirm, or close this window to cancel.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}