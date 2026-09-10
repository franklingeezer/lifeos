"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, X, CheckSquare, FolderKanban, Clock } from "lucide-react";
import Sidebar from "@/components/shell/Sidebar";
import { useCalendar, type Event } from "@/hooks/useCalendar";
import { useProjects } from "@/hooks/useProjects";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const SWATCHES = ["#5EA8A0", "#D4A857", "#C57B6B", "#6C8EF5", "#9B8AC4"];

const toISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Roadmap Phase 3, Part 3 — `time` columns come back from Postgres as
// "HH:MM:SS" (or "HH:MM" from a fresh <input type="time"> value before
// it round-trips through the DB). Only the hour/minute matter for
// display, so this tolerates either.
function formatTime(t: string | null): string {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return "";
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr} ${period}`;
}

function buildMonthGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = firstOfMonth.getDay(); // 0=Sun..6=Sat
  const offset = (firstWeekday + 6) % 7; // days to go back to reach Monday
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export default function CalendarPage() {
  const { events, tasksDue, projectDeadlines, isLoading, createEvent, updateEvent, deleteEvent } = useCalendar();
  const { projects } = useProjects();
  const router = useRouter();

  const [monthDate, setMonthDate] = useState(() => { const d = new Date(); d.setDate(1); return d; });

  const [showCreate, setShowCreate] = useState(false);
  const [createDate, setCreateDate] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createColor, setCreateColor] = useState(SWATCHES[0]);
  const [createProjectId, setCreateProjectId] = useState("");
  const [createAllDay, setCreateAllDay] = useState(true);
  const [createStartTime, setCreateStartTime] = useState("");
  const [createEndTime, setCreateEndTime] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editTimeError, setEditTimeError] = useState<string | null>(null);
  const [viewDayISO, setViewDayISO] = useState<string | null>(null);

  const today = new Date();
  const todayISO = toISODate(today);
  const grid = useMemo(() => buildMonthGrid(monthDate.getFullYear(), monthDate.getMonth()), [monthDate]);
  const monthLabel = monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const itemsForDay = (iso: string) => ({
    events: events.filter((e) => e.date === iso),
    tasks: tasksDue.filter((t) => t.due_date === iso),
    projects: projectDeadlines.filter((p) => p.deadline === iso),
  });

  const openCreate = (iso: string) => {
    setCreateDate(iso);
    setCreateTitle("");
    setCreateColor(SWATCHES[0]);
    setCreateAllDay(true);
    setCreateStartTime("");
    setCreateEndTime("");
    setCreateError(null);
    setShowCreate(true);
  };

  const handleCreateEvent = async () => {
    if (!createTitle.trim()) return;
    // Bug fix (LifeOS Changes To Make, #3): previously only checked both
    // times were *present*, never that start actually came before end —
    // a 5:00 PM \u2192 3:00 PM event would have saved without complaint.
    // All-day events skip this entirely; they carry no times at all.
    if (!createAllDay) {
      if (!createStartTime || !createEndTime) {
        setCreateError("Set both a start and end time, or switch to All day.");
        return;
      }
      if (createStartTime >= createEndTime) {
        setCreateError("End time must be after start time.");
        return;
      }
    }
    setCreateError(null);
    await createEvent({
      title: createTitle.trim(),
      date: createDate,
      color: createColor,
      all_day: createAllDay,
      project_id: createProjectId || null,
      start_time: createAllDay ? null : createStartTime,
      end_time: createAllDay ? null : createEndTime,
    });
    setShowCreate(false);
  };

  const handleDeleteEvent = (id: string) => {
    setEditingEvent(null);
    deleteEvent(id);
  };

  // Bug fix (LifeOS Changes To Make, #3, edit-modal half): a small wrapper
  // so every place that opens the edit modal also clears any validation
  // error left over from a previous edit session — without this, an error
  // shown while editing one event could still be sitting on screen after
  // closing and opening a different one.
  const openEditEvent = (e: Event) => {
    setEditTimeError(null);
    setEditingEvent(e);
  };

  // Edit modal fields are otherwise uncontrolled (defaultValue/defaultChecked
  // off the `editingEvent` snapshot, same pattern the existing color swatches
  // already used) — but the all-day toggle needs its own local mirror so
  // toggling it immediately shows/hides the time inputs instead of waiting
  // for the modal to be reopened.
  const updateEditingEvent = (patch: Partial<Event>) => {
    if (!editingEvent) return;
    setEditingEvent({ ...editingEvent, ...patch });
    updateEvent(editingEvent.id, patch);
  };

  // Bug fix (LifeOS Changes To Make, #3): the previous version called
  // updateEditingEvent directly from each time input's onChange, which
  // persisted every keystroke\u2014including a half-typed or inverted range\u2014
  // straight to Supabase with no check at all. This always mirrors what
  // was typed into the input (so it never fights what you're typing), but
  // only ever persists to the database once both times are set and
  // start < end; an incomplete or inverted range stays local-only with an
  // inline error instead of being saved.
  const handleEditTimeChange = (field: "start_time" | "end_time", value: string) => {
    if (!editingEvent) return;
    const next = { ...editingEvent, [field]: value || null };
    setEditingEvent(next);

    if (!next.start_time || !next.end_time) {
      setEditTimeError(null); // still mid-edit, not yet a contradiction worth flagging
      return;
    }
    if (next.start_time >= next.end_time) {
      setEditTimeError("End time must be after start time.");
      return;
    }
    setEditTimeError(null);
    updateEvent(editingEvent.id, { [field]: value || null });
  };

  return (
    <div className="lifeos-shell" style={{ background: "rgb(var(--bg))", color: "rgb(var(--text))", minHeight: "600px", display: "flex", borderRadius: 20, overflow: "hidden", border: "1px solid rgb(var(--border))", position: "relative" }}>
      <style>{`
        .lifeos-navbtn:hover { background: rgb(var(--surface-2)); }
        .cal-cell:hover { background: rgb(var(--surface-2)); }
        .cal-chip:hover { filter: brightness(1.15); }
        .icon-btn:hover { background: rgb(var(--surface-2)); }
      `}</style>

      <Sidebar />

      <div className="lifeos-page-content" style={{ flex: 1, padding: "22px 26px", overflowY: "auto", maxHeight: "700px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="font-display" style={{ fontSize: 24, fontWeight: 500, minWidth: 190 }}>{monthLabel}</div>
            <div style={{ display: "flex", gap: 4 }}>
              <button className="icon-btn" onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} style={iconBtnStyle}><ChevronLeft size={15} /></button>
              <button className="icon-btn" onClick={() => { const d = new Date(); d.setDate(1); setMonthDate(d); }} style={{ ...iconBtnStyle, width: "auto", padding: "0 10px", fontSize: 12 }}>Today</button>
              <button className="icon-btn" onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} style={iconBtnStyle}><ChevronRight size={15} /></button>
            </div>
          </div>
          <button
            onClick={() => openCreate(todayISO)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: "rgb(var(--accent))", color: "rgb(var(--bg))", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}
          >
            <Plus size={15} /> New event
          </button>
        </div>

        {isLoading ? (
          <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>Loading calendar…</div>
        ) : (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6, marginBottom: 6 }}>
              {WEEKDAYS.map((d, i) => (
                <div key={i} style={{ textAlign: "center", fontSize: 11, color: "rgb(var(--text-muted))", fontWeight: 600 }}>{d}</div>
              ))}
            </div>
            {/* minmax(0, 1fr) — not just 1fr — so a track can shrink below its
                content's natural width. Plain 1fr has an implicit min-width:
                auto, which means an unbreakable event label (whiteSpace:
                nowrap on .cal-chip) sets a column's minimum size to its full
                unwrapped text width, pushing the whole grid past the screen
                edge on narrow viewports before the chip's own ellipsis rule
                ever gets a chance to apply. */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gridAutoRows: "1fr", gap: 6 }}>
              {grid.map((date, i) => {
                const iso = toISODate(date);
                const inMonth = date.getMonth() === monthDate.getMonth();
                const isToday = iso === todayISO;
                const { events: dayEvents, tasks: dayTasks, projects: dayProjects } = itemsForDay(iso);
                const allItems = [
                  ...dayEvents.map((e) => ({
                    kind: "event" as const,
                    id: e.id,
                    label: e.all_day || !e.start_time ? e.title : `${formatTime(e.start_time)} ${e.title}`,
                    color: e.color,
                    ref: e,
                  })),
                  ...dayTasks.map((t) => ({ kind: "task" as const, id: t.id, label: t.title, color: "rgb(var(--text-muted))", ref: t })),
                  ...dayProjects.map((p) => ({ kind: "project" as const, id: p.id, label: p.name, color: "rgb(var(--danger))", ref: p })),
                ];
                const visible = allItems.slice(0, 3);
                const overflow = allItems.length - visible.length;

                return (
                  <div
                    key={i}
                    className="cal-cell"
                    onClick={() => openCreate(iso)}
                    style={{
                      minHeight: 84, borderRadius: 10, padding: 6, cursor: "pointer",
                      background: isToday ? "rgb(var(--accent) / 0.08)" : "rgb(var(--surface))",
                      border: `1px solid ${isToday ? "rgb(var(--accent) / 0.4)" : "rgb(var(--border))"}`,
                      opacity: inMonth ? 1 : 0.35,
                      display: "flex", flexDirection: "column", gap: 3,
                    }}
                  >
                    <span
                      className="font-mono"
                      style={{ fontSize: 11, fontWeight: isToday ? 700 : 500, color: isToday ? "rgb(var(--accent))" : "rgb(var(--text-muted))" }}
                    >
                      {date.getDate()}
                    </span>
                    {visible.map((item) => (
                      <div
                        key={`${item.kind}-${item.id}`}
                        className="cal-chip"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (item.kind === "event") openEditEvent(item.ref as Event);
                          // Deep-link instead of the old "synced, edit it
                          // from its own page" dead-end tooltip — this was
                          // the actual missing half of Tasks<->Calendar:
                          // Calendar could already SHOW a task's due date,
                          // but there was no way to act on it from here.
                          else if (item.kind === "task") router.push(`/tasks?open=${item.id}`);
                          else if (item.kind === "project") router.push(`/projects?open=${item.id}`);
                        }}
                        title={item.kind === "task" ? "Open this task" : item.kind === "project" ? "Open this project" : undefined}
                        style={{
                          fontSize: 10.5, padding: "2px 5px", borderRadius: 5, background: item.color, color: item.kind === "event" ? "rgb(var(--bg))" : "rgb(var(--surface))",
                          display: "flex", alignItems: "center", gap: 3, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                          cursor: "pointer", opacity: item.kind === "event" ? 1 : 0.85,
                        }}
                      >
                        {item.kind === "task" && <CheckSquare size={9} style={{ flexShrink: 0 }} />}
                        {item.kind === "project" && <FolderKanban size={9} style={{ flexShrink: 0 }} />}
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
                      </div>
                    ))}
                    {overflow > 0 && (
                      <span
                        onClick={(e) => { e.stopPropagation(); setViewDayISO(iso); }}
                        style={{ fontSize: 10, color: "rgb(var(--accent))", cursor: "pointer", fontWeight: 600 }}
                      >
                        +{overflow} more
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 14, fontSize: 11, color: "rgb(var(--text-muted))" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><CheckSquare size={11} /> Task due date</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><FolderKanban size={11} /> Project deadline</span>
              <span>— both sync automatically from Tasks / Projects, edit them there</span>
            </div>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div onClick={() => setShowCreate(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} className="lifeos-modal-box" style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 22, width: 340 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>New event</span>
              <X size={16} style={{ cursor: "pointer", color: "rgb(var(--text-muted))" }} onClick={() => setShowCreate(false)} />
            </div>
            <FormField label="Title">
              <input autoFocus value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateEvent()} placeholder="What's happening?" style={inputStyle} />
            </FormField>
            <FormField label="Date">
              <input type="date" value={createDate} onChange={(e) => setCreateDate(e.target.value)} style={inputStyle} />
            </FormField>
            <FormField label="">
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "rgb(var(--text))", cursor: "pointer" }}>
                <input type="checkbox" checked={createAllDay} onChange={(e) => { setCreateAllDay(e.target.checked); setCreateError(null); }} style={{ accentColor: "rgb(var(--accent))" }} />
                All day
              </label>
            </FormField>
            {!createAllDay && (
              <div style={{ display: "flex", gap: 10 }}>
                <FormField label="Starts">
                  <input type="time" value={createStartTime} onChange={(e) => { setCreateStartTime(e.target.value); setCreateError(null); }} style={inputStyle} />
                </FormField>
                <FormField label="Ends">
                  <input type="time" value={createEndTime} onChange={(e) => { setCreateEndTime(e.target.value); setCreateError(null); }} style={inputStyle} />
                </FormField>
              </div>
            )}
            {createError && <div style={{ fontSize: 12, color: "rgb(var(--danger))", marginTop: -6, marginBottom: 12 }}>{createError}</div>}
            <FormField label="Project">
              <select value={createProjectId} onChange={(e) => setCreateProjectId(e.target.value)} style={inputStyle}>
                <option value="">No project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FormField>
            <FormField label="Color">
              <div style={{ display: "flex", gap: 8 }}>
                {SWATCHES.map((c) => (
                  <div
                    key={c}
                    onClick={() => setCreateColor(c)}
                    style={{
                      width: 24, height: 24, borderRadius: 99, background: c, cursor: "pointer",
                      border: createColor === c ? "2px solid rgb(var(--text))" : "2px solid transparent",
                    }}
                  />
                ))}
              </div>
            </FormField>
            <button onClick={handleCreateEvent} style={{ width: "100%", marginTop: 8, padding: "10px", borderRadius: 10, background: "rgb(var(--accent))", color: "rgb(var(--bg))", fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer" }}>
              Create event
            </button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingEvent && (
        <div onClick={() => setEditingEvent(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div key={editingEvent.id} onClick={(e) => e.stopPropagation()} className="lifeos-modal-box" style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 22, width: 340 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Edit event</span>
              <X size={16} style={{ cursor: "pointer", color: "rgb(var(--text-muted))" }} onClick={() => setEditingEvent(null)} />
            </div>
            <FormField label="Title">
              <input defaultValue={editingEvent.title} onBlur={(e) => updateEvent(editingEvent.id, { title: e.target.value })} style={inputStyle} />
            </FormField>
            <FormField label="Date">
              <input type="date" defaultValue={editingEvent.date} onChange={(e) => updateEvent(editingEvent.id, { date: e.target.value })} style={inputStyle} />
            </FormField>
            <FormField label="">
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "rgb(var(--text))", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={editingEvent.all_day}
                  onChange={(e) => {
                    const allDay = e.target.checked;
                    setEditTimeError(null);
                    updateEditingEvent(allDay ? { all_day: true, start_time: null, end_time: null } : { all_day: false });
                  }}
                  style={{ accentColor: "rgb(var(--accent))" }}
                />
                All day
              </label>
            </FormField>
            {!editingEvent.all_day && (
              <div style={{ display: "flex", gap: 10 }}>
                <FormField label="Starts">
                  <input
                    type="time"
                    value={editingEvent.start_time ?? ""}
                    onChange={(e) => handleEditTimeChange("start_time", e.target.value)}
                    style={inputStyle}
                  />
                </FormField>
                <FormField label="Ends">
                  <input
                    type="time"
                    value={editingEvent.end_time ?? ""}
                    onChange={(e) => handleEditTimeChange("end_time", e.target.value)}
                    style={inputStyle}
                  />
                </FormField>
              </div>
            )}
            {editTimeError && <div style={{ fontSize: 12, color: "rgb(var(--danger))", marginTop: -6, marginBottom: 12 }}>{editTimeError}</div>}
            <FormField label="Project">
              <select
                value={editingEvent.project_id ?? ""}
                onChange={(e) => updateEvent(editingEvent.id, { project_id: e.target.value || null })}
                style={inputStyle}
              >
                <option value="">No project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FormField>
            <FormField label="Color">
              <div style={{ display: "flex", gap: 8 }}>
                {SWATCHES.map((c) => (
                  <div
                    key={c}
                    onClick={() => updateEvent(editingEvent.id, { color: c })}
                    style={{
                      width: 24, height: 24, borderRadius: 99, background: c, cursor: "pointer",
                      border: editingEvent.color === c ? "2px solid rgb(var(--text))" : "2px solid transparent",
                    }}
                  />
                ))}
              </div>
            </FormField>
            <button
              onClick={() => handleDeleteEvent(editingEvent.id)}
              style={{ width: "100%", marginTop: 12, padding: "10px", borderRadius: 10, background: "rgb(var(--danger) / 0.12)", color: "rgb(var(--danger))", fontWeight: 600, fontSize: 13, border: "1px solid rgb(var(--danger) / 0.3)", cursor: "pointer" }}
            >
              Delete event
            </button>
          </div>
        </div>
      )}

      {/* Day detail (full list, for days with overflow) */}
      {viewDayISO && (() => {
        const { events: dEvents, tasks: dTasks, projects: dProjects } = itemsForDay(viewDayISO);
        const label = new Date(viewDayISO + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
        return (
          <div onClick={() => setViewDayISO(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 45 }}>
            <div onClick={(e) => e.stopPropagation()} className="lifeos-modal-box" style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 22, width: 380, maxHeight: "70vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{label}</span>
                <X size={16} style={{ cursor: "pointer", color: "rgb(var(--text-muted))" }} onClick={() => setViewDayISO(null)} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                {dEvents.map((e) => (
                  <div
                    key={e.id}
                    onClick={() => { openEditEvent(e); setViewDayISO(null); }}
                    style={{ padding: "8px 10px", borderRadius: 8, background: e.color, color: "rgb(var(--bg))", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    {!e.all_day && e.start_time && (
                      <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, opacity: 0.85, flexShrink: 0 }}>
                        <Clock size={10} /> {formatTime(e.start_time)}
                      </span>
                    )}
                    {e.title}
                  </div>
                ))}
                {dTasks.map((t) => (
                  <div key={t.id} style={{ padding: "8px 10px", borderRadius: 8, background: "rgb(var(--surface-2))", color: "rgb(var(--text-muted))", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                    <CheckSquare size={13} /> {t.title}
                  </div>
                ))}
                {dProjects.map((p) => (
                  <div key={p.id} style={{ padding: "8px 10px", borderRadius: 8, background: "rgb(var(--danger) / 0.12)", color: "rgb(var(--danger))", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                    <FolderKanban size={13} /> {p.name}
                  </div>
                ))}
                {dEvents.length + dTasks.length + dProjects.length === 0 && (
                  <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>Nothing on this day.</div>
                )}
              </div>

              <button
                onClick={() => { setViewDayISO(null); openCreate(viewDayISO); }}
                style={{ width: "100%", padding: "10px", borderRadius: 10, background: "rgb(var(--accent))", color: "rgb(var(--bg))", fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <Plus size={14} /> Add another event
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <div style={{ fontSize: 11.5, color: "rgb(var(--text-muted))", marginBottom: 5 }}>{label}</div>}
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 8, background: "rgb(var(--surface-2))",
  border: "1px solid rgb(var(--border))", color: "rgb(var(--text))", fontSize: 13, outline: "none",
};

const iconBtnStyle: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 8, background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))",
  color: "rgb(var(--text))", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
};