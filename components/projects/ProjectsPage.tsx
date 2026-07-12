"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Search, X, Github, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/shell/Sidebar";

type Status = "active" | "paused" | "done" | "archived";
type Priority = "low" | "med" | "high";

type Project = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  status: Status;
  priority: Priority;
  start_date: string | null;
  deadline: string | null;
  progress: number;
  github_repo: string | null;
  live_demo: string | null;
};

const STATUS_META: Record<Status, { label: string; bg: string; text: string }> = {
  active: { label: "Active", bg: "rgb(var(--accent))", text: "rgb(var(--bg))" },
  paused: { label: "Paused", bg: "rgb(var(--gold))", text: "rgb(var(--bg))" },
  done: { label: "Done", bg: "rgb(var(--surface-2))", text: "rgb(var(--text-muted))" },
  archived: { label: "Archived", bg: "rgb(var(--surface-2))", text: "rgb(var(--text-muted))" },
};

const priorityColor = (p: Priority) =>
  p === "high" ? "rgb(var(--danger))" : p === "med" ? "rgb(var(--gold))" : "rgb(var(--text-muted))";

const emptyForm = {
  name: "", description: "", category: "", status: "active" as Status, priority: "med" as Priority,
  start_date: "", deadline: "", github_repo: "", live_demo: "",
};

export default function ProjectsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, description, category, status, priority, start_date, deadline, progress, github_repo, live_demo")
      .order("created_at", { ascending: true });
    if (!error && data) setProjects(data as Project[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const editingProject = projects.find((p) => p.id === editingId) ?? null;

  const filtered = projects.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.category ?? "").toLowerCase().includes(q);
  });

  const createProject = async () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || null,
      status: form.status,
      priority: form.priority,
      start_date: form.start_date || null,
      deadline: form.deadline || null,
      github_repo: form.github_repo.trim() || null,
      live_demo: form.live_demo.trim() || null,
    };
    const { data, error } = await supabase.from("projects").insert(payload).select().single();
    if (!error && data) setProjects((prev) => [...prev, data as Project]);
    setForm(emptyForm);
    setShowCreate(false);
  };

  const updateProject = async (id: string, patch: Partial<Project>) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    await supabase.from("projects").update(patch).eq("id", id);
  };

  const deleteProject = async (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (editingId === id) setEditingId(null);
    await supabase.from("projects").delete().eq("id", id);
  };

  return (
    <div
      style={{
        background: "rgb(var(--bg))", color: "rgb(var(--text))", minHeight: "600px",
        display: "flex", borderRadius: 20, overflow: "hidden", border: "1px solid rgb(var(--border))", position: "relative",
      }}
    >
      <style>{`
        .lifeos-navbtn:hover { background: rgb(var(--surface-2)); }
        .project-card:hover { border-color: rgb(var(--accent) / 0.4); }
        .icon-btn:hover { background: rgb(var(--surface-2)); }
      `}</style>

      <Sidebar />

      <div style={{ flex: 1, padding: "22px 26px", overflowY: "auto", maxHeight: "700px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div className="font-display" style={{ fontSize: 24, fontWeight: 500 }}>Projects</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 10, padding: "7px 10px" }}>
              <Search size={14} color="rgb(var(--text-muted))" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects…"
                style={{ background: "transparent", border: "none", outline: "none", color: "rgb(var(--text))", fontSize: 13, width: 140 }}
              />
            </div>
            <button
              onClick={() => setShowCreate(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: "rgb(var(--accent))", color: "rgb(var(--bg))", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}
            >
              <Plus size={15} /> New project
            </button>
          </div>
        </div>

        {loading && <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>Loading projects…</div>}

        {!loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
            {filtered.map((p) => {
              const meta = STATUS_META[p.status];
              return (
                <div
                  key={p.id}
                  className="project-card"
                  onClick={() => setEditingId(p.id)}
                  style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 16, cursor: "pointer" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{p.name}</div>
                    <span style={{ width: 7, height: 7, borderRadius: 99, background: priorityColor(p.priority), marginTop: 5, flexShrink: 0 }} />
                  </div>

                  {p.category && <div style={{ fontSize: 11.5, color: "rgb(var(--text-muted))", marginBottom: 8 }}>{p.category}</div>}
                  {p.description && (
                    <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))", marginBottom: 12, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {p.description}
                    </div>
                  )}

                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgb(var(--text-muted))", marginBottom: 4 }}>
                      <span>Progress</span>
                      <span className="font-mono">{p.progress}%</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 99, background: "rgb(var(--surface-2))", overflow: "hidden" }}>
                      <div style={{ width: `${p.progress}%`, height: "100%", background: "rgb(var(--accent))", borderRadius: 99 }} />
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span
                      className="font-mono"
                      style={{ fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 99, background: meta.bg, color: meta.text }}
                    >
                      {meta.label}
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                      {p.github_repo && (
                        <a href={`https://github.com/${p.github_repo}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "rgb(var(--text-muted))", display: "flex" }}>
                          <Github size={14} />
                        </a>
                      )}
                      {p.live_demo && (
                        <a href={p.live_demo} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "rgb(var(--text-muted))", display: "flex" }}>
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>No projects match.</div>}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div onClick={() => setShowCreate(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 22, width: 380, maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>New project</span>
              <X size={16} style={{ cursor: "pointer", color: "rgb(var(--text-muted))" }} onClick={() => setShowCreate(false)} />
            </div>
            <FormField label="Name">
              <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
            </FormField>
            <FormField label="Description">
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
            </FormField>
            <FormField label="Category">
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Full-stack" style={inputStyle} />
            </FormField>
            <div style={{ display: "flex", gap: 10 }}>
              <FormField label="Status">
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Status })} style={inputStyle}>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="done">Done</option>
                  <option value="archived">Archived</option>
                </select>
              </FormField>
              <FormField label="Priority">
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })} style={inputStyle}>
                  <option value="low">Low</option>
                  <option value="med">Medium</option>
                  <option value="high">High</option>
                </select>
              </FormField>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <FormField label="Start date">
                <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} style={inputStyle} />
              </FormField>
              <FormField label="Deadline">
                <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} style={inputStyle} />
              </FormField>
            </div>
            <FormField label="GitHub repo (owner/repo)">
              <input value={form.github_repo} onChange={(e) => setForm({ ...form, github_repo: e.target.value })} placeholder="franklingeezer/lifeos" style={inputStyle} />
            </FormField>
            <FormField label="Live demo URL">
              <input value={form.live_demo} onChange={(e) => setForm({ ...form, live_demo: e.target.value })} placeholder="https://…" style={inputStyle} />
            </FormField>

            <button onClick={createProject} style={{ width: "100%", marginTop: 8, padding: "10px", borderRadius: 10, background: "rgb(var(--accent))", color: "rgb(var(--bg))", fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer" }}>
              Create project
            </button>
          </div>
        </div>
      )}

      {/* Edit drawer */}
      {editingProject && (
        <div key={editingProject.id} style={{ position: "fixed", top: 0, right: 0, height: "100%", width: 360, background: "rgb(var(--surface))", borderLeft: "1px solid rgb(var(--border))", padding: 22, overflowY: "auto", zIndex: 50, boxShadow: "-8px 0 24px rgba(0,0,0,0.3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "rgb(var(--text-muted))" }}>Edit project</span>
            <X size={16} style={{ cursor: "pointer", color: "rgb(var(--text-muted))" }} onClick={() => setEditingId(null)} />
          </div>

          <FormField label="Name">
            <input defaultValue={editingProject.name} onBlur={(e) => updateProject(editingProject.id, { name: e.target.value })} style={inputStyle} />
          </FormField>
          <FormField label="Description">
            <textarea defaultValue={editingProject.description ?? ""} onBlur={(e) => updateProject(editingProject.id, { description: e.target.value || null })} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </FormField>
          <FormField label="Category">
            <input defaultValue={editingProject.category ?? ""} onBlur={(e) => updateProject(editingProject.id, { category: e.target.value || null })} style={inputStyle} />
          </FormField>
          <FormField label="Status">
            <select value={editingProject.status} onChange={(e) => updateProject(editingProject.id, { status: e.target.value as Status })} style={inputStyle}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="done">Done</option>
              <option value="archived">Archived</option>
            </select>
          </FormField>
          <FormField label="Priority">
            <select value={editingProject.priority} onChange={(e) => updateProject(editingProject.id, { priority: e.target.value as Priority })} style={inputStyle}>
              <option value="low">Low</option>
              <option value="med">Medium</option>
              <option value="high">High</option>
            </select>
          </FormField>
          <FormField label={`Progress — ${editingProject.progress}%`}>
            <input
              type="range" min={0} max={100} value={editingProject.progress}
              onChange={(e) => updateProject(editingProject.id, { progress: Number(e.target.value) })}
              style={{ width: "100%" }}
            />
          </FormField>
          <FormField label="Deadline">
            <input type="date" defaultValue={editingProject.deadline ?? ""} onChange={(e) => updateProject(editingProject.id, { deadline: e.target.value || null })} style={inputStyle} />
          </FormField>
          <FormField label="GitHub repo">
            <input defaultValue={editingProject.github_repo ?? ""} onBlur={(e) => updateProject(editingProject.id, { github_repo: e.target.value || null })} style={inputStyle} />
          </FormField>
          <FormField label="Live demo URL">
            <input defaultValue={editingProject.live_demo ?? ""} onBlur={(e) => updateProject(editingProject.id, { live_demo: e.target.value || null })} style={inputStyle} />
          </FormField>

          <button
            onClick={() => deleteProject(editingProject.id)}
            style={{ width: "100%", marginTop: 12, padding: "10px", borderRadius: 10, background: "rgb(var(--danger) / 0.12)", color: "rgb(var(--danger))", fontWeight: 600, fontSize: 13, border: "1px solid rgb(var(--danger) / 0.3)", cursor: "pointer" }}
          >
            Delete project
          </button>
        </div>
      )}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
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