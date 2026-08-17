"use client";

import React, { useState } from "react";
import { CheckSquare, StickyNote, Lightbulb, FolderKanban, Calendar, Bell, X, Loader2, type LucideIcon } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { useNotes } from "@/hooks/useNotes";
import { useIdeaVault } from "@/hooks/useIdeaVault";
import { useProjects } from "@/hooks/useProjects";
import { useCalendar } from "@/hooks/useCalendar";
import { useReminders } from "@/hooks/useReminders";
import { useInbox, type InboxItem, type ConvertedType } from "@/hooks/useInbox";

const TYPES: { key: ConvertedType; label: string; icon: LucideIcon }[] = [
  { key: "task", label: "Task", icon: CheckSquare },
  { key: "note", label: "Note", icon: StickyNote },
  { key: "idea", label: "Idea", icon: Lightbulb },
  { key: "project", label: "Project", icon: FolderKanban },
  { key: "event", label: "Event", icon: Calendar },
  { key: "reminder", label: "Reminder", icon: Bell },
];

/**
 * The doc's central feature: Inbox → Process → real LifeOS object. Each
 * target type gets exactly the fields it actually needs to exist (a Task
 * needs a priority, an Event needs a date, etc.) — deliberately minimal,
 * not a full creation form. The idea is "get it into the right bucket
 * fast," not "fill out every field right now" — the person can open the
 * real Task/Note/whatever afterward to flesh it out.
 */
export default function InboxProcessDrawer({ item, onClose }: { item: InboxItem; onClose: () => void }) {
  const [selected, setSelected] = useState<ConvertedType>("task");
  const [dueDate, setDueDate] = useState("");
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [scheduledAt, setScheduledAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { createTask } = useTasks();
  const { createNote } = useNotes();
  const { createIdea } = useIdeaVault();
  const { createProject } = useProjects();
  const { createEvent } = useCalendar();
  const { createReminder } = useReminders();
  const { markProcessed } = useInbox();

  const convert = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      let newId: string;

      switch (selected) {
        case "task": {
          const created = await createTask({ title: item.content, category: null, priority: "med", due_date: dueDate || null });
          newId = created.id;
          break;
        }
        case "note": {
          const created = await createNote(item.content);
          newId = created.id;
          break;
        }
        case "idea": {
          const created = await createIdea({ title: item.content, description: null, status: "spark", tags: [], potential: 3, converted_project_id: null });
          newId = created.id;
          break;
        }
        case "project": {
          const created = await createProject({ name: item.content, description: null, category: null, status: "active", priority: "med", start_date: null, deadline: null, github_repo: null, live_demo: null });
          newId = created.id;
          break;
        }
        case "event": {
          const created = await createEvent({ title: item.content, date: eventDate, color: "teal", all_day: true });
          newId = created.id;
          break;
        }
        case "reminder": {
          if (!scheduledAt) throw new Error("Pick a date and time for the reminder.");
          const created = await createReminder({
            title: item.content, description: null, related_type: null, related_id: null,
            scheduled_at: new Date(scheduledAt).toISOString(), repeat_rule: "none", priority: "med",
          });
          newId = created.id;
          break;
        }
      }

      await markProcessed(item.id, selected, newId);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Couldn't convert this item — try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgb(0 0 0 / 0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 440, background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 20 }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
          <div style={{ fontSize: 12, color: "rgb(var(--text-muted))", textTransform: "uppercase", letterSpacing: 0.4 }}>Process capture</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgb(var(--text-muted))" }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "rgb(var(--text))", marginBottom: 16 }}>{item.content}</div>

        <div style={{ fontSize: 12, color: "rgb(var(--text-muted))", marginBottom: 8 }}>Convert to:</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
          {TYPES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSelected(key)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "10px 6px", borderRadius: 10, cursor: "pointer",
                background: selected === key ? "rgb(var(--accent) / 0.12)" : "rgb(var(--surface-2))",
                border: `1px solid ${selected === key ? "rgb(var(--accent) / 0.4)" : "rgb(var(--border))"}`,
              }}
            >
              <Icon size={16} color={selected === key ? "rgb(var(--accent))" : "rgb(var(--text-muted))"} />
              <span style={{ fontSize: 11, fontWeight: 600, color: selected === key ? "rgb(var(--accent))" : "rgb(var(--text-muted))" }}>{label}</span>
            </button>
          ))}
        </div>

        {/* Only the one field each type actually needs to be created
            meaningfully — everything else is left to defaults, editable
            afterward from the real Task/Project/etc. page. */}
        {selected === "task" && (
          <Field label="Due date (optional)">
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
          </Field>
        )}
        {selected === "event" && (
          <Field label="Date">
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} style={inputStyle} />
          </Field>
        )}
        {selected === "reminder" && (
          <Field label="Remind me at">
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} style={inputStyle} />
          </Field>
        )}

        {errorMsg && <div style={{ fontSize: 12, color: "rgb(var(--danger))", marginTop: 4, marginBottom: 8 }}>{errorMsg}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: "rgb(var(--surface-2))", border: "1px solid rgb(var(--border))", color: "rgb(var(--text-muted))", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Keep in Inbox
          </button>
          <button
            onClick={convert}
            disabled={submitting}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", borderRadius: 10,
              background: "rgb(var(--accent))", color: "rgb(var(--bg))", border: "none", fontSize: 13, fontWeight: 600,
              cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? <Loader2 size={14} className="spin" /> : "Convert"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11.5, color: "rgb(var(--text-muted))", marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 10px", borderRadius: 8, background: "rgb(var(--surface-2))",
  border: "1px solid rgb(var(--border))", color: "rgb(var(--text))", fontSize: 13, outline: "none",
};