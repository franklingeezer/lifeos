"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search, CheckSquare, StickyNote, FolderKanban, Flame,
  GraduationCap, Lightbulb, Calendar, CornerDownLeft, ArrowUp, ArrowDown, Check, Inbox,
} from "lucide-react";
import { useGlobalSearch, type SearchResult, type SearchResultType } from "@/hooks/useGlobalSearch";
import { parseCommand, type PaletteCommand } from "@/hooks/usePaletteCommand";
import { useTasks } from "@/hooks/useTasks";
import { useNotes } from "@/hooks/useNotes";
import { useInbox } from "@/hooks/useInbox";

const TYPE_META: Record<SearchResultType, { label: string; icon: React.ElementType; color: string }> = {
  task: { label: "Task", icon: CheckSquare, color: "#5EA8A0" },
  note: { label: "Note", icon: StickyNote, color: "#D4A857" },
  project: { label: "Project", icon: FolderKanban, color: "#5FA8D3" },
  habit: { label: "Habit", icon: Flame, color: "#C57B6B" },
  learning: { label: "Learning", icon: GraduationCap, color: "#9B8AC4" },
  idea: { label: "Idea", icon: Lightbulb, color: "#EEC99B" },
  event: { label: "Event", icon: Calendar, color: "#6C8EF5" },
};

type ActionState = "idle" | "creating" | "done" | "error";

const COMMAND_META: Record<PaletteCommand["type"], { verb: string; noun: string; doneLabel: string; icon: React.ElementType; color: string }> = {
  "create-task": { verb: "Create task", noun: "New task", doneLabel: "Task created", icon: CheckSquare, color: "#5EA8A0" },
  "create-note": { verb: "Create note", noun: "New note", doneLabel: "Note created", icon: StickyNote, color: "#D4A857" },
  "create-inbox": { verb: "Capture to Inbox", noun: "New capture", doneLabel: "Captured", icon: Inbox, color: "#8AB0D9" },
};

export default function CommandPalette({
  open,
  onClose,
  initialQuery,
}: {
  open: boolean;
  onClose: () => void;
  // Pre-fills the input on open — used by the Ctrl/Cmd+Shift+I shortcut
  // (see Sidebar.tsx) to drop the user straight into "inbox: |" with the
  // cursor ready to type, instead of making them type the prefix
  // themselves every single time they want to capture something fast.
  initialQuery?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [actionState, setActionState] = useState<ActionState>("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  // Calling useTasks() here works because it's just an SWR hook keyed on
  // "tasks" — whichever component calls it shares the exact same cache,
  // so a task created from the palette on, say, the Journal page shows up
  // instantly on the Tasks page too, without any extra wiring.
  const { createTask } = useTasks();
  const { createNote } = useNotes();
  const { capture } = useInbox();

  const command = parseCommand(query);

  // A recognized command means the user is issuing an instruction, not
  // searching — skip the search entirely so unrelated matches don't show
  // up as noise underneath the action.
  const { results, isLoading, isActive } = useGlobalSearch(command ? "" : query);

  // Reset on open/close so the palette doesn't remember your last search.
  useEffect(() => {
    if (open) {
      setQuery(initialQuery ?? "");
      setSelectedIndex(0);
      setActionState("idle");
      // Small delay so the input exists in the DOM before we focus it.
      const t = setTimeout(() => {
        inputRef.current?.focus();
        // Cursor at the end (after "inbox: ") rather than the browser's
        // default of selecting/positioning at the start, so typing
        // continues naturally from where the prefix left off.
        inputRef.current?.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length);
      }, 10);
      return () => clearTimeout(t);
    }
  }, [open, initialQuery]);

  // Keep selection in bounds whenever the result set changes size.
  useEffect(() => {
    setSelectedIndex((i) => Math.min(i, Math.max(results.length - 1, 0)));
  }, [results.length]);

  // A stale "done"/"error" state shouldn't linger once the user starts
  // typing something new.
  useEffect(() => {
    setActionState("idle");
  }, [query]);

  const goToResult = (result: SearchResult) => {
    router.push(result.href);
    onClose();
  };

  const runCommand = async () => {
    if (!command || actionState === "creating") return;
    setActionState("creating");
    try {
      if (command.type === "create-task") {
        await createTask({ title: command.text, category: null, priority: "med", due_date: null });
      } else if (command.type === "create-note") {
        await createNote(command.text);
      } else if (command.type === "create-inbox") {
        await capture(command.text);
      }
      setActionState("done");
      setTimeout(() => onClose(), 700);
    } catch {
      setActionState("error");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (command) {
      if (e.key === "Enter") {
        e.preventDefault();
        runCommand();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const chosen = results[selectedIndex];
      if (chosen) goToResult(chosen);
      return;
    }
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      onKeyDown={handleKeyDown}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "12vh", paddingLeft: 16, paddingRight: 16, zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 560, background: "rgb(var(--surface))",
          border: "1px solid rgb(var(--border))", borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)", overflow: "hidden",
        }}
      >
        {/* Search input */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid rgb(var(--border))" }}>
          <Search size={16} color="rgb(var(--text-muted))" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search, or try 'task: ___' / 'note: ___' / 'inbox: ___'…"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "rgb(var(--text))", fontSize: 14.5,
            }}
          />
          <kbd style={kbdStyle}>Esc</kbd>
        </div>

        {/* Results / action */}
        <div style={{ maxHeight: "50vh", overflowY: "auto", padding: command || results.length > 0 ? "6px" : 0 }}>
          {command && (
            <div
              onClick={runCommand}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10,
                cursor: actionState === "creating" ? "default" : "pointer",
                background: `${COMMAND_META[command.type].color}18`,
                border: `1px solid ${COMMAND_META[command.type].color}4D`,
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                background: `${COMMAND_META[command.type].color}30`, flexShrink: 0,
              }}>
                {actionState === "done"
                  ? <Check size={14} color={COMMAND_META[command.type].color} />
                  : React.createElement(COMMAND_META[command.type].icon, { size: 14, color: COMMAND_META[command.type].color })}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5 }}>
                  {actionState === "done" && COMMAND_META[command.type].doneLabel}
                  {actionState === "creating" && `${COMMAND_META[command.type].verb.replace("Create", "Creating")}…`}
                  {(actionState === "idle" || actionState === "error") && (
                    <>{COMMAND_META[command.type].verb}: <strong>{command.text}</strong></>
                  )}
                </div>
                <div style={{ fontSize: 11, color: actionState === "error" ? "rgb(var(--danger))" : "rgb(var(--text-muted))" }}>
                  {actionState === "error" ? "Something went wrong — click to try again" : COMMAND_META[command.type].noun}
                </div>
              </div>
              {actionState === "idle" && <CornerDownLeft size={13} color="rgb(var(--text-muted))" style={{ flexShrink: 0 }} />}
            </div>
          )}

          {!command && !isActive && (
            <div style={{ padding: "20px 16px 16px" }}>
              <div style={{ textAlign: "center", fontSize: 13, color: "rgb(var(--text-muted))", marginBottom: 16 }}>
                Type at least 2 characters to search across your workspace.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(["create-task", "create-note", "create-inbox"] as const).map((type) => {
                  const prefix = type === "create-task" ? "task: " : type === "create-note" ? "note: " : "inbox: ";
                  return (
                    <div
                      key={type}
                      onClick={() => {
                        setQuery(prefix);
                        inputRef.current?.focus();
                      }}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 9, cursor: "pointer",
                        border: `1px solid ${COMMAND_META[type].color}33`,
                      }}
                    >
                      <kbd style={{ ...kbdStyle, color: COMMAND_META[type].color, borderColor: `${COMMAND_META[type].color}4D` }}>
                        {prefix.trim()}
                      </kbd>
                      <span style={{ fontSize: 12, color: "rgb(var(--text-muted))" }}>{COMMAND_META[type].verb.toLowerCase()} instantly</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!command && isActive && isLoading && results.length === 0 && (
            <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 13, color: "rgb(var(--text-muted))" }}>
              Searching…
            </div>
          )}

          {!command && isActive && !isLoading && results.length === 0 && (
            <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 13, color: "rgb(var(--text-muted))" }}>
              No results for "{query}".
            </div>
          )}

          {!command && results.map((r, i) => {
            const meta = TYPE_META[r.type];
            const Icon = meta.icon;
            const selected = i === selectedIndex;
            return (
              <div
                key={`${r.type}-${r.id}`}
                onMouseEnter={() => setSelectedIndex(i)}
                onClick={() => goToResult(r)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10,
                  cursor: "pointer", background: selected ? "rgb(var(--surface-2))" : "transparent",
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                  background: `${meta.color}22`, flexShrink: 0,
                }}>
                  <Icon size={14} color={meta.color} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: "rgb(var(--text-muted))" }}>
                    {meta.label}{r.subtitle ? ` · ${r.subtitle}` : ""}
                  </div>
                </div>
                {selected && <CornerDownLeft size={13} color="rgb(var(--text-muted))" style={{ flexShrink: 0 }} />}
              </div>
            );
          })}
        </div>

        {/* Footer hint bar */}
        <div className="lifeos-palette-footer" style={{
          display: "flex", alignItems: "center", gap: 16, padding: "9px 16px",
          borderTop: "1px solid rgb(var(--border))", fontSize: 11, color: "rgb(var(--text-muted))",
        }}>
          {command ? (
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><CornerDownLeft size={11} /> Create</span>
          ) : (
            <>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><ArrowUp size={11} /><ArrowDown size={11} /> Navigate</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><CornerDownLeft size={11} /> Open</span>
            </>
          )}
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>Esc Close</span>
        </div>
      </div>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  fontSize: 10.5, fontFamily: "var(--font-mono)", padding: "2px 6px", borderRadius: 5,
  background: "rgb(var(--surface-2))", border: "1px solid rgb(var(--border))", color: "rgb(var(--text-muted))",
};