"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X, Repeat, Pause, Play, Pencil, Trash2 } from "lucide-react";
import { useTaskSeries, type TaskSeries } from "@/hooks/useTaskSeries";
import { useProjects } from "@/hooks/useProjects";
import type { Priority } from "@/hooks/useTasks";
import { describeSchedule, seriesStatus, type SeriesStatus } from "@/lib/series-schedule";

// Same durations the task forms offer — a series' estimate is copied onto
// every task it generates, so it should come from the same list.
const DURATION_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "No estimate" },
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "1 hr" },
  { value: "90", label: "1.5 hr" },
  { value: "120", label: "2 hr" },
  { value: "180", label: "3 hr" },
  { value: "240", label: "4 hr" },
];

// Index matches JS Date.getDay() (0=Sun..6=Sat), same as lib/recurrence.ts.
const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

const STATUS_META: Record<SeriesStatus, { label: string; color: string }> = {
  active: { label: "Active", color: "rgb(var(--accent))" },
  paused: { label: "Paused", color: "rgb(var(--gold))" },
  ended: { label: "Ended", color: "rgb(var(--text-muted))" },
};

const CONFIRM_DELETE_MS = 4000;

type EditForm = {
  title: string;
  category: string;
  priority: Priority;
  project_id: string;
  estimated_minutes: string;
  frequency: TaskSeries["frequency"];
  interval_count: string;
  days_of_week: number[];
  day_of_month: string;
  end_date: string;
};

const toForm = (s: TaskSeries): EditForm => ({
  title: s.title,
  category: s.category ?? "",
  priority: s.priority,
  project_id: s.project_id ?? "",
  estimated_minutes: s.estimated_minutes != null ? String(s.estimated_minutes) : "",
  frequency: s.frequency,
  interval_count: String(s.interval_count),
  days_of_week: s.days_of_week ?? [],
  day_of_month: s.day_of_month != null ? String(s.day_of_month) : "",
  end_date: s.end_date ?? "",
});

/**
 * Roadmap — Recurring Tasks, series management.
 *
 * Lists every repeating series with its schedule, next date, and status,
 * and lets you pause, resume, edit, or delete each one. Nothing here ever
 * rewrites or deletes tasks that were already generated — edits shape
 * future occurrences only, and deleting a series leaves its tasks in your
 * list as ordinary tasks.
 */
export default function SeriesManager({ onClose }: { onClose: () => void }) {
  const { series, isLoading, error, pauseSeries, resumeSeries, updateSeries, deleteSeries } = useTaskSeries();
  const { projects } = useProjects();
  const projectNameById = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  // Delete is destructive (of the series definition), so it gets the same
  // two-click confirmation the rest of the app uses, which wears off on
  // its own.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  useEffect(() => {
    if (!confirmDeleteId) return;
    const t = setTimeout(() => setConfirmDeleteId(null), CONFIRM_DELETE_MS);
    return () => clearTimeout(t);
  }, [confirmDeleteId]);

  const run = async (id: string, action: () => Promise<string | void>) => {
    setBusyId(id);
    setMessage(null);
    try {
      const ok = await action();
      if (ok) setMessage({ kind: "ok", text: ok });
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : "Something went wrong — try again." });
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = (s: TaskSeries) => {
    setEditingId(s.id);
    setForm(toForm(s));
    setMessage(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(null);
  };

  const saveEdit = (s: TaskSeries) => {
    if (!form) return;
    void run(s.id, async () => {
      const result = await updateSeries(s.id, {
        title: form.title,
        category: form.category.trim() || null,
        priority: form.priority,
        project_id: form.project_id || null,
        estimated_minutes: form.estimated_minutes ? parseInt(form.estimated_minutes, 10) : null,
        frequency: form.frequency,
        interval_count: parseInt(form.interval_count, 10) || 1,
        days_of_week: form.frequency === "weekly" && form.days_of_week.length > 0 ? form.days_of_week : null,
        day_of_month: form.frequency === "monthly" && form.day_of_month ? parseInt(form.day_of_month, 10) : null,
        end_date: form.end_date || null,
      });
      cancelEdit();
      return result.ended
        ? "Saved — but that end date is before the next occurrence, so this series has ended."
        : "Saved. Changes apply to future occurrences; tasks already created are untouched.";
    });
  };

  const handleDelete = (s: TaskSeries) => {
    if (confirmDeleteId !== s.id) {
      setConfirmDeleteId(s.id);
      return;
    }
    setConfirmDeleteId(null);
    void run(s.id, async () => {
      await deleteSeries(s.id);
      if (editingId === s.id) cancelEdit();
      return "Series deleted. Its existing tasks are still in your list.";
    });
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="lifeos-modal-box"
        style={{
          background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 22,
          width: 520, maxWidth: "100%", maxHeight: "85vh", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 600 }}>
            <Repeat size={15} color="rgb(var(--accent))" /> Repeating tasks
          </span>
          <X size={16} style={{ cursor: "pointer", color: "rgb(var(--text-muted))" }} onClick={onClose} />
        </div>
        <div style={{ fontSize: 11.5, color: "rgb(var(--text-muted))", marginBottom: 16 }}>
          Pausing, editing, or deleting a series never changes tasks it already created.
        </div>

        {isLoading && <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>Loading…</div>}
        {error && !isLoading && <div style={{ fontSize: 13, color: "rgb(var(--danger))" }}>Couldn't load your repeating tasks.</div>}

        {!isLoading && !error && series.length === 0 && (
          <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))", textAlign: "center", padding: "24px 0" }}>
            No repeating tasks yet. Turn on <b>Repeat</b> when you create a task.
          </div>
        )}

        {message && (
          <div style={{ fontSize: 12, marginBottom: 12, color: message.kind === "ok" ? "rgb(var(--accent))" : "rgb(var(--danger))" }}>{message.text}</div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {series.map((s) => {
            const status = seriesStatus(s);
            const meta = STATUS_META[status];
            const busy = busyId === s.id;
            const editing = editingId === s.id && form;

            return (
              <div key={s.id} style={{ padding: "12px 14px", borderRadius: 12, background: "rgb(var(--surface-2))", border: "1px solid rgb(var(--border))" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{s.title}</div>
                    <div style={{ fontSize: 11.5, color: "rgb(var(--text-muted))", marginTop: 2 }}>{describeSchedule(s)}</div>
                    <div className="font-mono" style={{ fontSize: 11, color: "rgb(var(--text-muted))", marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {status === "ended" ? <span>Ended {s.end_date}</span> : <span>Next: {s.next_due_date}</span>}
                      {s.end_date && status !== "ended" && <span>Until {s.end_date}</span>}
                      {s.estimated_minutes != null && <span>{s.estimated_minutes} min</span>}
                      {s.project_id && projectNameById.get(s.project_id) && <span>{projectNameById.get(s.project_id)}</span>}
                    </div>
                  </div>
                  <span
                    className="font-mono"
                    style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4, color: meta.color, border: `1px solid ${meta.color}`, borderRadius: 999, padding: "2px 8px", opacity: 0.9 }}
                  >
                    {meta.label.toUpperCase()}
                  </span>
                </div>

                {!editing && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                    {status === "active" && (
                      <SmallButton disabled={busy} onClick={() => run(s.id, async () => { await pauseSeries(s.id); return "Paused. No new tasks will be created until you resume."; })}>
                        <Pause size={11} /> Pause
                      </SmallButton>
                    )}
                    {status !== "active" && (
                      <SmallButton
                        accent
                        disabled={busy}
                        onClick={() => run(s.id, async () => { const r = await resumeSeries(s.id); return `Resumed. Next task: ${r.nextDueDate}.`; })}
                      >
                        <Play size={11} /> Resume
                      </SmallButton>
                    )}
                    <SmallButton disabled={busy} onClick={() => startEdit(s)}>
                      <Pencil size={11} /> Edit
                    </SmallButton>
                    <SmallButton danger={confirmDeleteId === s.id} disabled={busy} onClick={() => handleDelete(s)}>
                      <Trash2 size={11} /> {confirmDeleteId === s.id ? "Sure?" : "Delete"}
                    </SmallButton>
                  </div>
                )}

                {editing && form && (
                  <div style={{ marginTop: 12 }}>
                    <Field label="Title">
                      <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={inputStyle} />
                    </Field>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Field label="Category">
                        <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inputStyle} />
                      </Field>
                      <Field label="Priority">
                        <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })} style={inputStyle}>
                          <option value="low">Low</option>
                          <option value="med">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </Field>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Field label="Project">
                        <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} style={inputStyle}>
                          <option value="">No project</option>
                          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Estimated time">
                        <select value={form.estimated_minutes} onChange={(e) => setForm({ ...form, estimated_minutes: e.target.value })} style={inputStyle}>
                          {DURATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </Field>
                    </div>

                    <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", marginBottom: 12 }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Field label="Frequency">
                          <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as EditForm["frequency"] })} style={inputStyle}>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                          </select>
                        </Field>
                        <Field label={`Every ${form.interval_count || "1"} ${form.frequency === "daily" ? "day(s)" : form.frequency === "weekly" ? "week(s)" : "month(s)"}`}>
                          <input type="number" min={1} value={form.interval_count} onChange={(e) => setForm({ ...form, interval_count: e.target.value })} style={inputStyle} />
                        </Field>
                      </div>

                      {form.frequency === "weekly" && (
                        <Field label="On these days (none picked = the start date's weekday)">
                          <div style={{ display: "flex", gap: 6 }}>
                            {WEEKDAY_LABELS.map((label, idx) => {
                              const on = form.days_of_week.includes(idx);
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setForm({ ...form, days_of_week: on ? form.days_of_week.filter((d) => d !== idx) : [...form.days_of_week, idx] })}
                                  style={{
                                    width: 28, height: 28, borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
                                    background: on ? "rgb(var(--accent) / 0.15)" : "rgb(var(--surface-2))",
                                    border: `1px solid ${on ? "rgb(var(--accent) / 0.4)" : "rgb(var(--border))"}`,
                                    color: on ? "rgb(var(--accent))" : "rgb(var(--text-muted))",
                                  }}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </Field>
                      )}

                      {form.frequency === "monthly" && (
                        <Field label="Day of month (blank = the start date's day)">
                          <input type="number" min={1} max={31} value={form.day_of_month} onChange={(e) => setForm({ ...form, day_of_month: e.target.value })} style={inputStyle} />
                        </Field>
                      )}

                      <Field label="Ends on (optional)">
                        <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} style={inputStyle} />
                      </Field>

                      <div style={{ fontSize: 11, color: "rgb(var(--text-muted))" }}>
                        Started {s.start_date} (can't be changed — it anchors the schedule). Schedule changes take effect from the next occurrence.
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => saveEdit(s)}
                        disabled={busy}
                        style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: "rgb(var(--accent))", color: "rgb(var(--bg))", fontSize: 12.5, fontWeight: 600, border: "none", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}
                      >
                        {busy ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={busy}
                        style={{ padding: "8px 16px", borderRadius: 8, background: "transparent", color: "rgb(var(--text-muted))", fontSize: 12.5, fontWeight: 600, border: "1px solid rgb(var(--border))", cursor: "pointer" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SmallButton({
  children, onClick, disabled, accent, danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, fontSize: 11.5, fontWeight: 600,
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1,
        background: danger ? "rgb(var(--danger))" : accent ? "rgb(var(--accent) / 0.15)" : "transparent",
        color: danger ? "rgb(var(--bg))" : accent ? "rgb(var(--accent))" : "rgb(var(--text-muted))",
        border: `1px solid ${accent ? "rgb(var(--accent) / 0.4)" : "rgb(var(--border))"}`,
      }}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12, flex: 1, minWidth: 0 }}>
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