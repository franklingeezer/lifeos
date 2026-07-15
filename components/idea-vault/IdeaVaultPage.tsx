"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, X, Trash2, Search, Star, Lightbulb, Sprout, TrendingUp, CheckCircle2, Archive } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/shell/Sidebar";

type Status = "spark" | "developing" | "validated" | "archived";

type Idea = {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  tags: string[];
  potential: number;
  created_at: string;
  updated_at: string;
};

const emptyForm = {
  title: "",
  description: "",
  tags: "",
  potential: 3,
  status: "spark" as Status,
};

const STATUS_META: Record<Status, { label: string; color: string; icon: React.ElementType }> = {
  spark: { label: "Spark", color: "rgb(var(--gold))", icon: Sprout },
  developing: { label: "Developing", color: "#5FA8D3", icon: TrendingUp },
  validated: { label: "Validated", color: "rgb(var(--accent))", icon: CheckCircle2 },
  archived: { label: "Archived", color: "rgb(var(--text-muted))", icon: Archive },
};

const STATUS_ORDER: Status[] = ["spark", "developing", "validated", "archived"];

export default function IdeaVaultPage() {
  const supabase = useMemo(() => createClient(), []);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("idea_vault_items")
      .select("id, title, description, status, tags, potential, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (!error && data) setIdeas(data as Idea[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const editingIdea = ideas.find((i) => i.id === editingId) ?? null;

  const filtered = ideas.filter((idea) => {
    if (filter !== "all" && idea.status !== filter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const inTitle = idea.title.toLowerCase().includes(q);
      const inDesc = idea.description?.toLowerCase().includes(q);
      const inTags = idea.tags.some((t) => t.toLowerCase().includes(q));
      if (!inTitle && !inDesc && !inTags) return false;
    }
    return true;
  });

  const counts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = ideas.filter((i) => i.status === s).length;
    return acc;
  }, {} as Record<Status, number>);

  const createIdea = async () => {
    if (!form.title.trim()) return;
    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
      tags,
      potential: form.potential,
    };
    const { data, error } = await supabase.from("idea_vault_items").insert(payload).select().single();
    if (!error && data) setIdeas((prev) => [data as Idea, ...prev]);
    setForm(emptyForm);
    setShowCreate(false);
  };

  const updateIdea = async (id: string, patch: Partial<Idea>) => {
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    await supabase.from("idea_vault_items").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  };

  const requestDelete = (id: string) => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    deleteIdea(id);
  };

  const deleteIdea = async (id: string) => {
    setIdeas((prev) => prev.filter((i) => i.id !== id));
    setConfirmingDelete(false);
    if (editingId === id) setEditingId(null);
    await supabase.from("idea_vault_items").delete().eq("id", id);
  };

  return (
    <div
      style={{
        background: "rgb(var(--bg))", color: "rgb(var(--text))", minHeight: "600px",
        display: "flex", borderRadius: 20, overflow: "hidden", border: "1px solid rgb(var(--border))", position: "relative",
      }}
    >
      <style>{`
        .filter-chip:hover { background: rgb(var(--surface-2)); }
        .idea-card:hover { border-color: rgb(var(--accent) / 0.5); }
        .star-btn:hover { transform: scale(1.15); }
      `}</style>

      <Sidebar />

      <div style={{ flex: 1, padding: "22px 26px", overflowY: "auto", maxHeight: "700px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div className="font-display" style={{ fontSize: 24, fontWeight: 500 }}>Idea Vault</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 10, padding: "0 10px" }}>
              <Search size={14} color="rgb(var(--text-muted))" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ideas, tags…"
                style={{ background: "transparent", border: "none", outline: "none", color: "rgb(var(--text))", fontSize: 12.5, padding: "8px 0", width: 170 }}
              />
            </div>
            <button
              onClick={() => setShowCreate(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: "rgb(var(--accent))", color: "rgb(var(--bg))", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}
            >
              <Plus size={15} /> New idea
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          <button
            className="filter-chip"
            onClick={() => setFilter("all")}
            style={chipStyle(filter === "all", "rgb(var(--accent))")}
          >
            All ({ideas.length})
          </button>
          {STATUS_ORDER.map((s) => {
            const meta = STATUS_META[s];
            return (
              <button key={s} className="filter-chip" onClick={() => setFilter(s)} style={chipStyle(filter === s, meta.color)}>
                {meta.label} ({counts[s] ?? 0})
              </button>
            );
          })}
        </div>

        {loading && <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>Loading ideas…</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ fontSize: 13, color: "rgb(var(--text-muted))", padding: 32, textAlign: "center", background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16 }}>
            <Lightbulb size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
            <div>{ideas.length === 0 ? "No ideas captured yet. Add your first spark." : "Nothing matches this filter."}</div>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {filtered.map((idea) => {
              const meta = STATUS_META[idea.status];
              const StatusIcon = meta.icon;
              return (
                <div
                  key={idea.id}
                  className="idea-card"
                  onClick={() => { setEditingId(idea.id); setConfirmingDelete(false); }}
                  style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 14, padding: 14, cursor: "pointer", display: "flex", flexDirection: "column", gap: 8 }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span
                      className="font-mono"
                      style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 700, color: meta.color, padding: "3px 8px", borderRadius: 999, background: `${meta.color}1F` }}
                    >
                      <StatusIcon size={10} /> {meta.label.toUpperCase()}
                    </span>
                    <div style={{ display: "flex", gap: 1 }}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={11} fill={i < idea.potential ? "rgb(var(--gold))" : "none"} color="rgb(var(--gold))" />
                      ))}
                    </div>
                  </div>

                  <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{idea.title}</div>

                  {idea.description && (
                    <div style={{ fontSize: 12, color: "rgb(var(--text-muted))", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {idea.description}
                    </div>
                  )}

                  {idea.tags.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: "auto" }}>
                      {idea.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="font-mono" style={{ fontSize: 9.5, padding: "2px 7px", borderRadius: 999, background: "rgb(var(--surface-2))", color: "rgb(var(--text-muted))" }}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div onClick={() => setShowCreate(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 22, width: 400, maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>New idea</span>
              <X size={16} style={{ cursor: "pointer", color: "rgb(var(--text-muted))" }} onClick={() => setShowCreate(false)} />
            </div>

            <FormField label="Title">
              <input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Weekly review automation" style={inputStyle} />
            </FormField>
            <FormField label="Description">
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="What's the idea? Why does it matter?" style={{ ...inputStyle, resize: "vertical" }} />
            </FormField>
            <FormField label="Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Status })} style={inputStyle}>
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{STATUS_META[s].label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Potential">
              <StarPicker value={form.potential} onChange={(v) => setForm({ ...form, potential: v })} />
            </FormField>
            <FormField label="Tags">
              <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="comma separated, e.g. automation, side-project" style={inputStyle} />
            </FormField>

            <button onClick={createIdea} style={{ width: "100%", marginTop: 8, padding: "10px", borderRadius: 10, background: "rgb(var(--accent))", color: "rgb(var(--bg))", fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer" }}>
              Add idea
            </button>
          </div>
        </div>
      )}

      {/* Edit drawer */}
      {editingIdea && (
        <div key={editingIdea.id} style={{ position: "fixed", top: 0, right: 0, height: "100%", width: 380, background: "rgb(var(--surface))", borderLeft: "1px solid rgb(var(--border))", padding: 22, overflowY: "auto", zIndex: 50, boxShadow: "-8px 0 24px rgba(0,0,0,0.3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "rgb(var(--text-muted))" }}>Edit idea</span>
            <X size={16} style={{ cursor: "pointer", color: "rgb(var(--text-muted))" }} onClick={() => { setEditingId(null); setConfirmingDelete(false); }} />
          </div>

          <FormField label="Title">
            <input
              key={`${editingIdea.id}-title`}
              defaultValue={editingIdea.title}
              onBlur={(e) => updateIdea(editingIdea.id, { title: e.target.value })}
              style={inputStyle}
            />
          </FormField>
          <FormField label="Description">
            <textarea
              key={`${editingIdea.id}-desc`}
              defaultValue={editingIdea.description ?? ""}
              onBlur={(e) => updateIdea(editingIdea.id, { description: e.target.value || null })}
              rows={4}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </FormField>

          <FormField label="Status">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {STATUS_ORDER.map((s) => {
                const meta = STATUS_META[s];
                const active = editingIdea.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => updateIdea(editingIdea.id, { status: s })}
                    style={{
                      display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, padding: "6px 10px", borderRadius: 999, cursor: "pointer",
                      border: `1px solid ${active ? meta.color : "rgb(var(--border))"}`,
                      background: active ? `${meta.color}1F` : "transparent",
                      color: active ? meta.color : "rgb(var(--text-muted))",
                    }}
                  >
                    <meta.icon size={11} /> {meta.label}
                  </button>
                );
              })}
            </div>
          </FormField>

          <FormField label="Potential">
            <StarPicker value={editingIdea.potential} onChange={(v) => updateIdea(editingIdea.id, { potential: v })} />
          </FormField>

          <FormField label="Tags">
            <input
              key={`${editingIdea.id}-tags`}
              defaultValue={editingIdea.tags.join(", ")}
              onBlur={(e) => updateIdea(editingIdea.id, { tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
              placeholder="comma separated"
              style={inputStyle}
            />
          </FormField>

          <div style={{ fontSize: 10.5, color: "rgb(var(--text-muted))", margin: "8px 0 16px" }}>
            Captured {new Date(editingIdea.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </div>

          <button
            onClick={() => requestDelete(editingIdea.id)}
            style={{
              width: "100%", padding: "10px", borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: "pointer",
              background: confirmingDelete ? "rgb(var(--danger))" : "rgb(var(--danger) / 0.12)",
              color: confirmingDelete ? "rgb(var(--bg))" : "rgb(var(--danger))",
              border: "1px solid rgb(var(--danger) / 0.3)",
            }}
          >
            {confirmingDelete ? "Click again to confirm" : "Delete idea"}
          </button>
        </div>
      )}
    </div>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <button
          key={i}
          className="star-btn"
          onClick={() => onChange(i + 1)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, transition: "transform 0.1s" }}
        >
          <Star size={18} fill={i < value ? "rgb(var(--gold))" : "none"} color="rgb(var(--gold))" />
        </button>
      ))}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14, flex: 1 }}>
      <div style={{ fontSize: 11.5, color: "rgb(var(--text-muted))", marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

function chipStyle(active: boolean, color: string): React.CSSProperties {
  return {
    padding: "6px 12px", borderRadius: 999, fontSize: 12, cursor: "pointer",
    border: `1px solid ${active ? color : "rgb(var(--border))"}`,
    background: active ? `${color}1F` : "rgb(var(--surface))",
    color: active ? color : "rgb(var(--text-muted))",
  };
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 8, background: "rgb(var(--surface-2))",
  border: "1px solid rgb(var(--border))", color: "rgb(var(--text))", fontSize: 13, outline: "none",
};