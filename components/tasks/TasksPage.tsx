"use client";

import React, { useState, useRef } from "react";
import {
  Plus, Search, LayoutList, Columns3, X, Trash2, Circle, CheckCircle2,
} from "lucide-react";
import Sidebar from "@/components/shell/Sidebar";
import { useTasks, type Priority, type Status } from "@/hooks/useTasks";

const COLUMNS: { key: Status; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];

const priorityColor = (p: Priority) =>
  p === "high" ? "rgb(var(--danger))" : p === "med" ? "rgb(var(--gold))" : "rgb(var(--text-muted))";

export default function TasksPage() {
  const {
    tasks, isLoading, error,
    createTask, updateTask, deleteTask, moveTask,
    addSubtask, toggleSubtask, deleteSubtask,
  } = useTasks();

  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<Status | null>(null);
  const [activeCol, setActiveCol] = useState(0);
  const kanbanRef = useRef<HTMLDivElement>(null);

  const scrollToColumn = (index: number) => {
    setActiveCol(index);
    const child = kanbanRef.current?.children[index] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  };

  const handleKanbanScroll = () => {
    const el = kanbanRef.current;
    if (!el) return;
    // Figure out which column is most visible right now, so the tab row
    // below can highlight the right one as the user swipes — this only
    // matters on mobile; the tabs themselves are CSS-hidden on desktop.
    let closest = 0;
    let closestDist = Infinity;
    Array.from(el.children).forEach((child, i) => {
      const dist = Math.abs((child as HTMLElement).offsetLeft - el.scrollLeft);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });
    setActiveCol(closest);
  };

  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("med");
  const [newDue, setNewDue] = useState("");

  const [subtaskInput, setSubtaskInput] = useState("");

  const editingTask = tasks.find((t) => t.id === editingId) ?? null;

  const filtered = tasks.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return t.title.toLowerCase().includes(q) || (t.category ?? "").toLowerCase().includes(q);
  });

  // ---- form handlers (the hook owns the actual mutations now) ----
  const handleCreateTask = async () => {
    if (!newTitle.trim()) return;
    await createTask({
      title: newTitle.trim(),
      category: newCategory.trim() || null,
      priority: newPriority,
      due_date: newDue || null,
    });
    setNewTitle("");
    setNewCategory("");
    setNewPriority("med");
    setNewDue("");
    setShowCreate(false);
  };

  const handleDeleteTask = (id: string) => {
    if (editingId === id) setEditingId(null);
    deleteTask(id);
  };

  const handleAddSubtask = (taskId: string) => {
    if (!subtaskInput.trim()) return;
    addSubtask(taskId, subtaskInput.trim());
    setSubtaskInput("");
  };

  return (
    <div
      className="lifeos-shell"
      style={{
        background: "rgb(var(--bg))",
        color: "rgb(var(--text))",
        minHeight: "600px",
        display: "flex",
        borderRadius: 20,
        overflow: "hidden",
        border: "1px solid rgb(var(--border))",
        position: "relative",
      }}
    >
      <style>{`
        .lifeos-navbtn:hover { background: rgb(var(--surface-2)); }
        .task-card:hover { border-color: rgb(var(--accent) / 0.4); }
        .icon-btn:hover { background: rgb(var(--surface-2)); }
      `}</style>

      <Sidebar />

      <div className="lifeos-page-content" style={{ flex: 1, padding: "22px 26px", overflowY: "auto", maxHeight: "700px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div className="font-display" style={{ fontSize: 24, fontWeight: 500 }}>Tasks</div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 10, padding: "7px 10px" }}>
              <Search size={14} color="rgb(var(--text-muted))" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks…"
                style={{ background: "transparent", border: "none", outline: "none", color: "rgb(var(--text))", fontSize: 13, width: 140 }}
              />
            </div>

            <div style={{ display: "flex", border: "1px solid rgb(var(--border))", borderRadius: 10, overflow: "hidden" }}>
              <button
                onClick={() => setView("kanban")}
                className="icon-btn"
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", fontSize: 13, background: view === "kanban" ? "rgb(var(--accent) / 0.15)" : "transparent", color: view === "kanban" ? "rgb(var(--accent))" : "rgb(var(--text-muted))", border: "none", cursor: "pointer" }}
              >
                <Columns3 size={14} /> Kanban
              </button>
              <button
                onClick={() => setView("list")}
                className="icon-btn"
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", fontSize: 13, background: view === "list" ? "rgb(var(--accent) / 0.15)" : "transparent", color: view === "list" ? "rgb(var(--accent))" : "rgb(var(--text-muted))", border: "none", cursor: "pointer" }}
              >
                <LayoutList size={14} /> List
              </button>
            </div>

            <button
              onClick={() => setShowCreate(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: "rgb(var(--accent))", color: "rgb(var(--bg))", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}
            >
              <Plus size={15} /> New task
            </button>
          </div>
        </div>

        {isLoading && <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>Loading tasks…</div>}
        {error && !isLoading && (
          <div style={{ fontSize: 13, color: "rgb(var(--danger))" }}>
            Couldn't load tasks — check your connection and try refreshing.
          </div>
        )}

        {/* Kanban view */}
        {!isLoading && view === "kanban" && (
          <>
          <div className="lifeos-kanban-tabs">
            {COLUMNS.map((col, i) => (
              <button
                key={col.key}
                onClick={() => scrollToColumn(i)}
                style={{
                  flex: 1, padding: "8px 6px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
                  background: activeCol === i ? "rgb(var(--accent))" : "rgb(var(--surface))",
                  color: activeCol === i ? "rgb(var(--bg))" : "rgb(var(--text-muted))",
                }}
              >
                {col.label} · {filtered.filter((t) => t.status === col.key).length}
              </button>
            ))}
          </div>

          <div className="lifeos-kanban-grid" ref={kanbanRef} onScroll={handleKanbanScroll}>
            {COLUMNS.map((col) => {
              const colTasks = filtered.filter((t) => t.status === col.key);
              return (
                <div
                  key={col.key}
                  onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key); }}
                  onDragLeave={() => setDragOverCol((c) => (c === col.key ? null : c))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain");
                    if (id) moveTask(id, col.key);
                    setDragOverCol(null);
                  }}
                  style={{
                    background: dragOverCol === col.key ? "rgb(var(--accent) / 0.06)" : "rgb(var(--surface))",
                    border: `1px solid ${dragOverCol === col.key ? "rgb(var(--accent) / 0.5)" : "rgb(var(--border))"}`,
                    borderRadius: 16, padding: 14, minHeight: 320, transition: "background 0.15s ease, border-color 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "rgb(var(--text-muted))" }}>{col.label}</span>
                    <span className="font-mono" style={{ fontSize: 11, color: "rgb(var(--text-muted))" }}>{colTasks.length}</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {colTasks.map((t) => (
                      <div
                        key={t.id}
                        className="task-card"
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                        onClick={() => setEditingId(t.id)}
                        style={{
                          background: "rgb(var(--surface-2))", border: "1px solid rgb(var(--border))", borderRadius: 12,
                          padding: 12, cursor: "grab",
                        }}
                      >
                        <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 6 }}>{t.title}</div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 6, height: 6, borderRadius: 99, background: priorityColor(t.priority) }} />
                            {t.category && <span style={{ fontSize: 10.5, color: "rgb(var(--text-muted))" }}>{t.category}</span>}
                          </div>
                          {t.subtasks.length > 0 && (
                            <span className="font-mono" style={{ fontSize: 10.5, color: "rgb(var(--text-muted))" }}>
                              {t.subtasks.filter((s) => s.done).length}/{t.subtasks.length}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {colTasks.length === 0 && (
                      <div style={{ fontSize: 12, color: "rgb(var(--text-muted))", textAlign: "center", padding: "20px 0" }}>Drop tasks here</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </>
        )}

        {/* List view */}
        {!isLoading && view === "list" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {filtered.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10,
                  background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", cursor: "pointer",
                }}
                onClick={() => setEditingId(t.id)}
              >
                <div
                  onClick={(e) => { e.stopPropagation(); moveTask(t.id, t.status === "done" ? "todo" : "done"); }}
                  style={{ display: "flex" }}
                >
                  {t.status === "done" ? <CheckCircle2 size={17} color="rgb(var(--accent))" /> : <Circle size={17} color="rgb(var(--text-muted))" />}
                </div>
                <span style={{ fontSize: 13.5, flex: 1, textDecoration: t.status === "done" ? "line-through" : "none", opacity: t.status === "done" ? 0.55 : 1 }}>{t.title}</span>
                {t.subtasks.length > 0 && (
                  <span className="font-mono" style={{ fontSize: 11, color: "rgb(var(--text-muted))" }}>
                    {t.subtasks.filter((s) => s.done).length}/{t.subtasks.length}
                  </span>
                )}
                {t.due_date && <span className="font-mono" style={{ fontSize: 11, color: "rgb(var(--text-muted))" }}>{t.due_date}</span>}
                <span style={{ width: 6, height: 6, borderRadius: 99, background: priorityColor(t.priority), flexShrink: 0 }} />
                {t.category && <span style={{ fontSize: 11, color: "rgb(var(--text-muted))", minWidth: 90, textAlign: "right" }}>{t.category}</span>}
                <button
                  className="icon-btn"
                  onClick={(e) => { e.stopPropagation(); handleDeleteTask(t.id); }}
                  style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex" }}
                >
                  <Trash2 size={14} color="rgb(var(--text-muted))" />
                </button>
              </div>
            ))}
            {filtered.length === 0 && <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>No tasks match.</div>}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div
          onClick={() => setShowCreate(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 22, width: 360 }}
            className="lifeos-modal-box"
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>New task</span>
              <X size={16} style={{ cursor: "pointer", color: "rgb(var(--text-muted))" }} onClick={() => setShowCreate(false)} />
            </div>

            <FormField label="Title">
              <input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateTask()}
                placeholder="What needs doing?" style={inputStyle} />
            </FormField>
            <FormField label="Category">
              <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="e.g. LifeOS" style={inputStyle} />
            </FormField>
            <FormField label="Priority">
              <select value={newPriority} onChange={(e) => setNewPriority(e.target.value as Priority)} style={inputStyle}>
                <option value="low">Low</option>
                <option value="med">Medium</option>
                <option value="high">High</option>
              </select>
            </FormField>
            <FormField label="Due date">
              <input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} style={inputStyle} />
            </FormField>

            <button
              onClick={handleCreateTask}
              style={{ width: "100%", marginTop: 8, padding: "10px", borderRadius: 10, background: "rgb(var(--accent))", color: "rgb(var(--bg))", fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer" }}
            >
              Create task
            </button>
          </div>
        </div>
      )}

      {/* Edit drawer */}
      {editingTask && (
        <div
          key={editingTask.id}
          className="lifeos-edit-drawer"
          style={{
            position: "fixed", top: 0, right: 0, height: "100%", width: 340,
            background: "rgb(var(--surface))", borderLeft: "1px solid rgb(var(--border))",
            padding: 22, overflowY: "auto", zIndex: 50, boxShadow: "-8px 0 24px rgba(0,0,0,0.3)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "rgb(var(--text-muted))" }}>Edit task</span>
            <X size={16} style={{ cursor: "pointer", color: "rgb(var(--text-muted))" }} onClick={() => setEditingId(null)} />
          </div>

          <FormField label="Title">
            <input
              defaultValue={editingTask.title}
              onBlur={(e) => updateTask(editingTask.id, { title: e.target.value })}
              style={inputStyle}
            />
          </FormField>
          <FormField label="Category">
            <input
              defaultValue={editingTask.category ?? ""}
              onBlur={(e) => updateTask(editingTask.id, { category: e.target.value || null })}
              style={inputStyle}
            />
          </FormField>
          <FormField label="Priority">
            <select
              value={editingTask.priority}
              onChange={(e) => updateTask(editingTask.id, { priority: e.target.value as Priority })}
              style={inputStyle}
            >
              <option value="low">Low</option>
              <option value="med">Medium</option>
              <option value="high">High</option>
            </select>
          </FormField>
          <FormField label="Status">
            <select
              value={editingTask.status}
              onChange={(e) => updateTask(editingTask.id, { status: e.target.value as Status })}
              style={inputStyle}
            >
              {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </FormField>
          <FormField label="Due date">
            <input
              type="date"
              defaultValue={editingTask.due_date ?? ""}
              onChange={(e) => updateTask(editingTask.id, { due_date: e.target.value || null })}
              style={inputStyle}
            />
          </FormField>

          <div style={{ marginTop: 18, marginBottom: 8, fontSize: 12, color: "rgb(var(--text-muted))" }}>Subtasks</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
            {editingTask.subtasks.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div onClick={() => toggleSubtask(editingTask.id, s.id, s.done)} style={{ cursor: "pointer", display: "flex" }}>
                  {s.done ? <CheckCircle2 size={14} color="rgb(var(--accent))" /> : <Circle size={14} color="rgb(var(--text-muted))" />}
                </div>
                <span style={{ fontSize: 13, flex: 1, textDecoration: s.done ? "line-through" : "none", opacity: s.done ? 0.5 : 1 }}>{s.title}</span>
                <X size={13} style={{ cursor: "pointer", color: "rgb(var(--text-muted))" }} onClick={() => deleteSubtask(editingTask.id, s.id)} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={subtaskInput}
              onChange={(e) => setSubtaskInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddSubtask(editingTask.id)}
              placeholder="Add subtask…"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              onClick={() => handleAddSubtask(editingTask.id)}
              style={{ padding: "0 12px", borderRadius: 8, background: "rgb(var(--surface-2))", border: "1px solid rgb(var(--border))", color: "rgb(var(--text))", cursor: "pointer" }}
            >
              <Plus size={14} />
            </button>
          </div>

          <button
            onClick={() => handleDeleteTask(editingTask.id)}
            style={{
              width: "100%", marginTop: 24, padding: "10px", borderRadius: 10, background: "rgb(var(--danger) / 0.12)",
              color: "rgb(var(--danger))", fontWeight: 600, fontSize: 13, border: "1px solid rgb(var(--danger) / 0.3)", cursor: "pointer",
            }}
          >
            Delete task
          </button>
        </div>
      )}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11.5, color: "rgb(var(--text-muted))", marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  background: "rgb(var(--surface-2))",
  border: "1px solid rgb(var(--border))",
  color: "rgb(var(--text))",
  fontSize: 13,
  outline: "none",
};