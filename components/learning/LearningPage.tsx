"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, X, Search, ExternalLink, Award, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/shell/Sidebar";

type Status = "not_started" | "in_progress" | "completed";

type LearningItem = {
  id: string;
  title: string;
  category: string | null;
  status: Status;
  progress: number;
  hours_studied: number;
  resource_url: string | null;
  notes: string | null;
  quiz_score: number | null;
  has_certificate: boolean;
};

const STATUS_META: Record<Status, { label: string; bg: string; text: string }> = {
  not_started: { label: "Not started", bg: "rgb(var(--surface-2))", text: "rgb(var(--text-muted))" },
  in_progress: { label: "In progress", bg: "rgb(var(--accent))", text: "rgb(var(--bg))" },
  completed: { label: "Completed", bg: "rgb(var(--gold))", text: "rgb(var(--bg))" },
};

const emptyForm = {
  title: "", category: "", status: "in_progress" as Status, progress: 0,
  hours_studied: "0", resource_url: "", notes: "", quiz_score: "", has_certificate: false,
};

export default function LearningPage() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<LearningItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("learning_items")
      .select("id, title, category, status, progress, hours_studied, resource_url, notes, quiz_score, has_certificate")
      .order("created_at", { ascending: false });
    if (!error && data) setItems(data as LearningItem[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const editing = items.find((i) => i.id === editingId) ?? null;
  const categories = Array.from(new Set(items.map((i) => i.category).filter(Boolean))) as string[];

  const filtered = items.filter((i) => {
    if (categoryFilter !== "all" && i.category !== categoryFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return i.title.toLowerCase().includes(q) || (i.category ?? "").toLowerCase().includes(q);
  });

  const totalHours = items.reduce((a, i) => a + Number(i.hours_studied), 0);
  const completedCount = items.filter((i) => i.status === "completed").length;

  const createItem = async () => {
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      category: form.category.trim() || null,
      status: form.status,
      progress: form.status === "completed" ? 100 : form.progress,
      hours_studied: parseFloat(form.hours_studied) || 0,
      resource_url: form.resource_url.trim() || null,
      notes: form.notes.trim() || null,
      quiz_score: form.quiz_score ? parseFloat(form.quiz_score) : null,
      has_certificate: form.has_certificate,
    };
    const { data, error } = await supabase.from("learning_items").insert(payload).select().single();
    if (!error && data) setItems((prev) => [data as LearningItem, ...prev]);
    setForm(emptyForm);
    setShowCreate(false);
  };

  const updateItem = async (id: string, patch: Partial<LearningItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    await supabase.from("learning_items").update(patch).eq("id", id);
  };

  const deleteItem = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (editingId === id) setEditingId(null);
    await supabase.from("learning_items").delete().eq("id", id);
  };

  return (
    <div style={{ background: "rgb(var(--bg))", color: "rgb(var(--text))", minHeight: "600px", display: "flex", borderRadius: 20, overflow: "hidden", border: "1px solid rgb(var(--border))", position: "relative" }}>
      <style>{`
        .lifeos-navbtn:hover { background: rgb(var(--surface-2)); }
        .learn-card:hover { border-color: rgb(var(--accent) / 0.4); }
        .icon-btn:hover { background: rgb(var(--surface-2)); }
      `}</style>

      <Sidebar />

      <div style={{ flex: 1, padding: "22px 26px", overflowY: "auto", maxHeight: "700px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div className="font-display" style={{ fontSize: 24, fontWeight: 500 }}>Learning</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 10, padding: "7px 10px" }}>
              <Search size={14} color="rgb(var(--text-muted))" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" style={{ background: "transparent", border: "none", outline: "none", color: "rgb(var(--text))", fontSize: 13, width: 130 }} />
            </div>
            <button onClick={() => setShowCreate(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: "rgb(var(--accent))", color: "rgb(var(--bg))", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}>
              <Plus size={15} /> New item
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
          <MiniStat label="Total hours studied" value={totalHours.toFixed(1)} />
          <MiniStat label="Completed" value={`${completedCount} / ${items.length}`} />
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          <FilterPill label="All" active={categoryFilter === "all"} onClick={() => setCategoryFilter("all")} />
          {categories.map((c) => <FilterPill key={c} label={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)} />)}
        </div>

        {loading && <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>Loading…</div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
          {filtered.map((item) => {
            const meta = STATUS_META[item.status];
            return (
              <div key={item.id} className="learn-card" onClick={() => setEditingId(item.id)} style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 16, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{item.title}</div>
                  {item.has_certificate && <Award size={14} color="rgb(var(--gold))" />}
                </div>
                {item.category && <div style={{ fontSize: 11.5, color: "rgb(var(--text-muted))", marginBottom: 10 }}>{item.category}</div>}

                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgb(var(--text-muted))", marginBottom: 4 }}>
                    <span>Progress</span>
                    <span className="font-mono">{item.progress}%</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 99, background: "rgb(var(--surface-2))", overflow: "hidden" }}>
                    <div style={{ width: `${item.progress}%`, height: "100%", background: "rgb(var(--accent))", borderRadius: 99 }} />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="font-mono" style={{ fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 99, background: meta.bg, color: meta.text }}>{meta.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "rgb(var(--text-muted))" }}><Clock size={11} /> {item.hours_studied}h</span>
                    {item.resource_url && (
                      <a href={item.resource_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "rgb(var(--text-muted))", display: "flex" }}>
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {!loading && filtered.length === 0 && <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>Nothing here.</div>}
        </div>
      </div>

      {showCreate && (
        <div onClick={() => setShowCreate(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 22, width: 380, maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>New learning item</span>
              <X size={16} style={{ cursor: "pointer", color: "rgb(var(--text-muted))" }} onClick={() => setShowCreate(false)} />
            </div>
            <Field label="Title"><input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={inputStyle} /></Field>
            <Field label="Category"><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. AI, Cybersecurity, Books" style={inputStyle} /></Field>
            <div style={{ display: "flex", gap: 10 }}>
              <Field label="Status">
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Status })} style={inputStyle}>
                  <option value="not_started">Not started</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                </select>
              </Field>
              <Field label="Hours studied"><input type="number" step="0.5" value={form.hours_studied} onChange={(e) => setForm({ ...form, hours_studied: e.target.value })} style={inputStyle} /></Field>
            </div>
            <Field label="Resource URL"><input value={form.resource_url} onChange={(e) => setForm({ ...form, resource_url: e.target.value })} placeholder="https://…" style={inputStyle} /></Field>
            <Field label="Notes"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} /></Field>
            <div style={{ display: "flex", gap: 10 }}>
              <Field label="Quiz score (optional)"><input type="number" value={form.quiz_score} onChange={(e) => setForm({ ...form, quiz_score: e.target.value })} style={inputStyle} /></Field>
              <Field label="Certificate">
                <div onClick={() => setForm({ ...form, has_certificate: !form.has_certificate })} style={{ ...inputStyle, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" checked={form.has_certificate} readOnly /> Earned
                </div>
              </Field>
            </div>
            <button onClick={createItem} style={{ width: "100%", marginTop: 8, padding: "10px", borderRadius: 10, background: "rgb(var(--accent))", color: "rgb(var(--bg))", fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer" }}>Create</button>
          </div>
        </div>
      )}

      {editing && (
        <div style={{ position: "fixed", top: 0, right: 0, height: "100%", width: 360, background: "rgb(var(--surface))", borderLeft: "1px solid rgb(var(--border))", padding: 22, overflowY: "auto", zIndex: 50, boxShadow: "-8px 0 24px rgba(0,0,0,0.3)" }} key={editing.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "rgb(var(--text-muted))" }}>Edit item</span>
            <X size={16} style={{ cursor: "pointer", color: "rgb(var(--text-muted))" }} onClick={() => setEditingId(null)} />
          </div>
          <Field label="Title"><input defaultValue={editing.title} onBlur={(e) => updateItem(editing.id, { title: e.target.value })} style={inputStyle} /></Field>
          <Field label="Category"><input defaultValue={editing.category ?? ""} onBlur={(e) => updateItem(editing.id, { category: e.target.value || null })} style={inputStyle} /></Field>
          <Field label="Status">
            <select value={editing.status} onChange={(e) => updateItem(editing.id, { status: e.target.value as Status, progress: e.target.value === "completed" ? 100 : editing.progress })} style={inputStyle}>
              <option value="not_started">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          </Field>
          <Field label={`Progress — ${editing.progress}%`}>
            <input type="range" min={0} max={100} value={editing.progress} onChange={(e) => updateItem(editing.id, { progress: Number(e.target.value) })} style={{ width: "100%" }} />
          </Field>
          <Field label="Hours studied"><input type="number" step="0.5" defaultValue={editing.hours_studied} onBlur={(e) => updateItem(editing.id, { hours_studied: parseFloat(e.target.value) || 0 })} style={inputStyle} /></Field>
          <Field label="Resource URL"><input defaultValue={editing.resource_url ?? ""} onBlur={(e) => updateItem(editing.id, { resource_url: e.target.value || null })} style={inputStyle} /></Field>
          <Field label="Notes"><textarea defaultValue={editing.notes ?? ""} onBlur={(e) => updateItem(editing.id, { notes: e.target.value || null })} rows={3} style={{ ...inputStyle, resize: "vertical" }} /></Field>
          <Field label="Quiz score">
            <input type="number" defaultValue={editing.quiz_score ?? ""} onBlur={(e) => updateItem(editing.id, { quiz_score: e.target.value ? parseFloat(e.target.value) : null })} style={inputStyle} />
          </Field>
          <Field label="Certificate">
            <div onClick={() => updateItem(editing.id, { has_certificate: !editing.has_certificate })} style={{ ...inputStyle, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={editing.has_certificate} readOnly /> Earned
            </div>
          </Field>
          <button onClick={() => deleteItem(editing.id)} style={{ width: "100%", marginTop: 12, padding: "10px", borderRadius: 10, background: "rgb(var(--danger) / 0.12)", color: "rgb(var(--danger))", fontWeight: 600, fontSize: 13, border: "1px solid rgb(var(--danger) / 0.3)", cursor: "pointer" }}>Delete</button>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 12, padding: "10px 16px" }}>
      <div className="font-mono" style={{ fontSize: 18, fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: 11, color: "rgb(var(--text-muted))" }}>{label}</div>
    </div>
  );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <span onClick={onClick} style={{ fontSize: 11, padding: "4px 9px", borderRadius: 99, cursor: "pointer", background: active ? "rgb(var(--accent))" : "rgb(var(--surface-2))", color: active ? "rgb(var(--bg))" : "rgb(var(--text-muted))", fontWeight: active ? 600 : 500 }}>
      {label}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12, flex: 1 }}>
      <div style={{ fontSize: 11.5, color: "rgb(var(--text-muted))", marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 8, background: "rgb(var(--surface-2))",
  border: "1px solid rgb(var(--border))", color: "rgb(var(--text))", fontSize: 13, outline: "none",
};