"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, X, Clock, AlertCircle, Flame, FolderKanban, Sparkles, CheckCheck, Plus, Trash2, CalendarClock,
} from "lucide-react";
import { useNotifications, type Notification, type NotificationType } from "@/hooks/useNotifications";
import { useReminders, type Reminder, type RelatedType, type RepeatRule, type Priority } from "@/hooks/useReminders";

const TYPE_META: Record<NotificationType, { icon: React.ElementType; color: string }> = {
  reminder: { icon: Clock, color: "#5FA8D3" },
  overdue_task: { icon: AlertCircle, color: "rgb(var(--danger))" },
  habit_slip: { icon: Flame, color: "rgb(var(--gold))" },
  project_inactive: { icon: FolderKanban, color: "#9B8AC4" },
  ai_insight: { icon: Sparkles, color: "rgb(var(--accent))" },
};

const RELATED_HREF: Record<RelatedType, string> = {
  task: "/tasks",
  event: "/calendar",
  project: "/projects",
  habit: "/habits",
  journal: "/journal",
  finance: "/finance",
};

const RELATED_LABEL: Record<RelatedType, string> = {
  task: "Task", event: "Event", project: "Project", habit: "Habit", journal: "Journal", finance: "Finance",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const datePart = sameDay ? "Today" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const timePart = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${datePart}, ${timePart}`;
}

const emptyForm = {
  title: "", description: "", related_type: "" as RelatedType | "", date: "", time: "",
  repeat_rule: "none" as RepeatRule, priority: "med" as Priority,
};

export default function NotificationCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { notifications, unreadCount, markRead, markAllRead, dismiss, sync } = useNotifications();
  const { reminders, createReminder, deleteReminder } = useReminders();

  const [tab, setTab] = useState<"notifications" | "reminders">("notifications");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);

  // Re-sync every time the panel is actually opened, not just on app load —
  // catches anything that's become overdue since the last check without
  // needing a page refresh.
  // Re-sync once whenever the panel is actually opened — NOT on every
  // re-render. `sync` is deliberately left out of the dependency array:
  // it calls mutate() internally, which can hand back a new function
  // reference on each cache update, and including it here would create a
  // self-triggering loop (sync -> mutate -> new `sync` reference -> effect
  // fires again -> forever). Same reasoning as the equivalent effect in
  // Sidebar.tsx.
  useEffect(() => {
    if (open) sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) {
      setShowCreate(false);
      setForm(emptyForm);
    }
  }, [open]);

  const handleOpenNotification = (n: Notification) => {
    if (!n.read_at) markRead(n.id);
    if (n.related_type) {
      router.push(RELATED_HREF[n.related_type]);
      onClose();
    }
  };

  const upcomingReminders = reminders
    .filter((r) => new Date(r.scheduled_at).getTime() > Date.now())
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  const handleCreateReminder = async () => {
    if (!form.title.trim() || !form.date || !form.time) return;
    const scheduled_at = new Date(`${form.date}T${form.time}`).toISOString();
    await createReminder({
      title: form.title.trim(),
      description: form.description.trim() || null,
      related_type: form.related_type || null,
      related_id: null,
      scheduled_at,
      repeat_rule: form.repeat_rule,
      priority: form.priority,
    });
    setForm(emptyForm);
    setShowCreate(false);
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "12vh", paddingLeft: 16, paddingRight: 16, zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 420, background: "rgb(var(--surface))",
          border: "1px solid rgb(var(--border))", borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)", overflow: "hidden",
          maxHeight: "75vh", display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Bell size={16} color="rgb(var(--text-muted))" />
            <span style={{ fontSize: 14.5, fontWeight: 600 }}>Notifications</span>
          </div>
          <X size={16} color="rgb(var(--text-muted))" style={{ cursor: "pointer" }} onClick={onClose} />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, padding: "0 12px 10px" }}>
          <button
            onClick={() => setTab("notifications")}
            style={{
              padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
              background: tab === "notifications" ? "rgb(var(--accent))" : "rgb(var(--surface-2))",
              color: tab === "notifications" ? "rgb(var(--bg))" : "rgb(var(--text-muted))",
            }}
          >
            Notifications{unreadCount > 0 ? ` · ${unreadCount}` : ""}
          </button>
          <button
            onClick={() => setTab("reminders")}
            style={{
              padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
              background: tab === "reminders" ? "rgb(var(--accent))" : "rgb(var(--surface-2))",
              color: tab === "reminders" ? "rgb(var(--bg))" : "rgb(var(--text-muted))",
            }}
          >
            Reminders{upcomingReminders.length > 0 ? ` · ${upcomingReminders.length}` : ""}
          </button>
          {tab === "notifications" && unreadCount > 0 && (
            <button
              onClick={markAllRead}
              title="Mark all read"
              style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "none", color: "rgb(var(--text-muted))", fontSize: 11, cursor: "pointer" }}
            >
              <CheckCheck size={13} /> Mark all read
            </button>
          )}
          {tab === "reminders" && !showCreate && (
            <button
              onClick={() => setShowCreate(true)}
              style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "none", color: "rgb(var(--accent))", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}
            >
              <Plus size={13} /> New reminder
            </button>
          )}
        </div>

        <div style={{ overflowY: "auto", padding: "0 6px 6px", flex: 1 }}>
          {tab === "notifications" && (
            <>
              {notifications.length === 0 && (
                <div style={{ padding: "36px 16px", textAlign: "center" }}>
                  <Bell size={22} color="rgb(var(--text-muted))" style={{ marginBottom: 10, opacity: 0.5 }} />
                  <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>You're all caught up.</div>
                </div>
              )}
              {notifications.map((n) => {
                const meta = TYPE_META[n.type];
                const Icon = meta.icon;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleOpenNotification(n)}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 10,
                      cursor: n.related_type ? "pointer" : "default",
                      background: n.read_at ? "transparent" : "rgb(var(--surface-2))",
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                      background: `${meta.color}22`, flexShrink: 0, marginTop: 1,
                    }}>
                      <Icon size={14} color={meta.color} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {!n.read_at && <span style={{ width: 6, height: 6, borderRadius: 99, background: "rgb(var(--accent))", flexShrink: 0 }} />}
                        <span style={{ fontSize: 13, fontWeight: n.read_at ? 500 : 600 }}>{n.title}</span>
                      </div>
                      {n.message && (
                        <div style={{ fontSize: 11.5, color: "rgb(var(--text-muted))", marginTop: 2 }}>{n.message}</div>
                      )}
                      <div style={{ fontSize: 10.5, color: "rgb(var(--text-muted))", marginTop: 3 }}>{timeAgo(n.scheduled_at)}</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                      title="Dismiss"
                      style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, flexShrink: 0, display: "flex" }}
                    >
                      <X size={13} color="rgb(var(--text-muted))" />
                    </button>
                  </div>
                );
              })}
            </>
          )}

          {tab === "reminders" && !showCreate && (
            <>
              {upcomingReminders.length === 0 && (
                <div style={{ padding: "36px 16px", textAlign: "center" }}>
                  <CalendarClock size={22} color="rgb(var(--text-muted))" style={{ marginBottom: 10, opacity: 0.5 }} />
                  <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>No upcoming reminders.</div>
                </div>
              )}
              {upcomingReminders.map((r) => (
                <div key={r.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgb(var(--accent) / 0.15)", flexShrink: 0, marginTop: 1,
                  }}>
                    <Clock size={14} color="rgb(var(--accent))" />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: "rgb(var(--text-muted))", marginTop: 2 }}>
                      {formatWhen(r.scheduled_at)}
                      {r.related_type ? ` · ${RELATED_LABEL[r.related_type]}` : ""}
                      {r.repeat_rule !== "none" ? ` · repeats ${r.repeat_rule}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteReminder(r.id)}
                    title="Cancel reminder"
                    style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, flexShrink: 0, display: "flex" }}
                  >
                    <Trash2 size={13} color="rgb(var(--text-muted))" />
                  </button>
                </div>
              ))}
            </>
          )}

          {tab === "reminders" && showCreate && (
            <div style={{ padding: "6px 10px 10px" }}>
              <FormField label="Title">
                <input
                  autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Work on LifeOS" style={inputStyle}
                />
              </FormField>
              <div style={{ display: "flex", gap: 8 }}>
                <FormField label="Date">
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={inputStyle} />
                </FormField>
                <FormField label="Time">
                  <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} style={inputStyle} />
                </FormField>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <FormField label="Related to">
                  <select value={form.related_type} onChange={(e) => setForm({ ...form, related_type: e.target.value as RelatedType | "" })} style={inputStyle}>
                    <option value="">Nothing specific</option>
                    <option value="task">Task</option>
                    <option value="event">Event</option>
                    <option value="project">Project</option>
                    <option value="habit">Habit</option>
                    <option value="journal">Journal</option>
                    <option value="finance">Finance</option>
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
              <FormField label="Repeat">
                <select value={form.repeat_rule} onChange={(e) => setForm({ ...form, repeat_rule: e.target.value as RepeatRule })} style={inputStyle}>
                  <option value="none">Doesn't repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </FormField>
              <FormField label="Description (optional)">
                <textarea
                  value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2} style={{ ...inputStyle, resize: "vertical" }}
                />
              </FormField>

              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button
                  onClick={() => { setShowCreate(false); setForm(emptyForm); }}
                  style={{ flex: 1, padding: "9px", borderRadius: 9, background: "rgb(var(--surface-2))", color: "rgb(var(--text-muted))", border: "1px solid rgb(var(--border))", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateReminder}
                  disabled={!form.title.trim() || !form.date || !form.time}
                  style={{
                    flex: 2, padding: "9px", borderRadius: 9, background: "rgb(var(--accent))", color: "rgb(var(--bg))",
                    border: "none", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                    opacity: !form.title.trim() || !form.date || !form.time ? 0.5 : 1,
                  }}
                >
                  Create reminder
                </button>
              </div>
              <div style={{ fontSize: 10, color: "rgb(var(--text-muted))", marginTop: 10 }}>
                Delivered in-app only for now — real browser/push notifications are a later phase.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10, flex: 1 }}>
      <div style={{ fontSize: 11, color: "rgb(var(--text-muted))", marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "7px 9px", borderRadius: 7, background: "rgb(var(--surface-2))",
  border: "1px solid rgb(var(--border))", color: "rgb(var(--text))", fontSize: 12.5, outline: "none",
};