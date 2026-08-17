"use client";

import React, { useState, useRef } from "react";
import { Inbox as InboxIcon, Loader2 } from "lucide-react";
import { useInbox } from "@/hooks/useInbox";

/**
 * The doc's core principle in component form: one text field, one button,
 * zero required decisions. Deliberately does NOT ask for a type, project,
 * or due date here — that's the whole point of Inbox vs. the existing
 * Command Palette `task: ___` / `note: ___` quick-create, which already
 * require picking a type up front.
 *
 * autoFocus is opt-in (not on by default) so this can be dropped into a
 * dashboard card without stealing focus from the page on load — Part 4's
 * Command Palette / keyboard-shortcut usage will want it true.
 */
export default function InboxQuickCapture({
  autoFocus = false,
  onCaptured,
  placeholder = "What's on your mind?",
}: {
  autoFocus?: boolean;
  onCaptured?: () => void;
  placeholder?: string;
}) {
  const { capture } = useInbox();
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await capture(trimmed);
      setValue("");
      onCaptured?.();
      inputRef.current?.focus(); // keep capturing without re-clicking — speed is the whole point
    } catch {
      // Left in the input on failure rather than cleared, so nothing
      // typed is ever silently lost.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      style={{ display: "flex", alignItems: "center", gap: 8 }}
    >
      <div
        style={{
          flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10,
          background: "rgb(var(--surface-2))", border: "1px solid rgb(var(--border))",
        }}
      >
        <InboxIcon size={15} color="rgb(var(--text-muted))" style={{ flexShrink: 0 }} />
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "rgb(var(--text))", fontSize: 13.5 }}
        />
      </div>
      <button
        type="submit"
        disabled={!value.trim() || submitting}
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 10,
          background: "rgb(var(--accent))", color: "rgb(var(--bg))", fontSize: 13, fontWeight: 600, border: "none",
          cursor: !value.trim() || submitting ? "default" : "pointer", opacity: !value.trim() || submitting ? 0.6 : 1, flexShrink: 0,
        }}
      >
        {submitting ? <Loader2 size={14} className="spin" /> : "Capture"}
      </button>
    </form>
  );
}