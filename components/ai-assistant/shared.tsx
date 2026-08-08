"use client";

import React from "react";
import { RefreshCw, AlertCircle } from "lucide-react";

export function AIErrorBox({ message }: { message: string }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 14, borderRadius: 10, background: "rgb(var(--danger) / 0.1)", border: "1px solid rgb(var(--danger) / 0.3)" }}>
      <AlertCircle size={16} color="rgb(var(--danger))" style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ fontSize: 12.5, color: "rgb(var(--danger))", lineHeight: 1.5 }}>{message}</div>
    </div>
  );
}

export function RegenerateButton({
  onClick, busy, size = "normal",
}: {
  onClick: () => void;
  busy: boolean;
  size?: "normal" | "small";
}) {
  const small = size === "small";
  return (
    <button
      className="regen-btn"
      onClick={onClick}
      disabled={busy}
      style={{
        display: "flex", alignItems: "center", gap: small ? 5 : 6, padding: small ? "6px 10px" : "8px 14px",
        borderRadius: small ? 8 : 10, background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))",
        color: "rgb(var(--text))", fontSize: small ? 11.5 : 12.5, fontWeight: 600,
        cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
      }}
    >
      <RefreshCw size={small ? 11 : 13} className={busy ? "spin" : ""} /> {busy ? "" : "Regenerate"}
    </button>
  );
}

// Parses the plain-text AI output into visually distinct blocks: the opening
// line, ALL-CAPS section labels, bullets under each section, and any closing
// observation line — instead of dumping it as one flat whitespace-wrapped
// blob. Shared by Review and Journal Insights, which both return this shape
// from their respective API routes.
export function AIContentBlocks({ content }: { content: string }) {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);

  const isSectionLabel = (line: string) =>
    line === line.toUpperCase() && /[A-Z]/.test(line) && !line.startsWith("•") && line.length < 30;

  const blocks: { type: "intro" | "label" | "bullet" | "text"; text: string }[] = [];
  lines.forEach((line, i) => {
    if (line.startsWith("•")) blocks.push({ type: "bullet", text: line.replace(/^•\s*/, "") });
    else if (isSectionLabel(line)) blocks.push({ type: "label", text: line });
    else blocks.push({ type: i === 0 ? "intro" : "text", text: line });
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {blocks.map((b, i) => {
        if (b.type === "intro") {
          return (
            <div key={i} style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
              {b.text}
            </div>
          );
        }
        if (b.type === "label") {
          return (
            <div
              key={i}
              className="font-mono"
              style={{
                fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, color: "rgb(var(--accent))",
                marginTop: i === 1 ? 4 : 18, marginBottom: 6,
              }}
            >
              {b.text}
            </div>
          );
        }
        if (b.type === "bullet") {
          return (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 13.5, lineHeight: 1.6, paddingLeft: 2 }}>
              <span style={{ color: "rgb(var(--text-muted))", flexShrink: 0 }}>•</span>
              <span>{b.text}</span>
            </div>
          );
        }
        return (
          <div key={i} style={{ fontSize: 13, lineHeight: 1.7, color: "rgb(var(--text-muted))", marginTop: 16, fontStyle: "italic" }}>
            {b.text}
          </div>
        );
      })}
    </div>
  );
}