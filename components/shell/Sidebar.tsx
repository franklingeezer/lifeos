"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid, FolderKanban, CheckSquare, Calendar, StickyNote, BookOpen,
  Flame, Wallet, Image as ImageIcon, GraduationCap, Lightbulb, Bot,
  BarChart3, Settings, ChevronsLeft, ChevronsRight,
} from "lucide-react";

const NAV = [
  { icon: LayoutGrid, label: "Dashboard", href: "/" },
  { icon: FolderKanban, label: "Projects", href: "/projects" },
  { icon: CheckSquare, label: "Tasks", href: "/tasks" },
  { icon: Calendar, label: "Calendar", href: "/calendar" },
  { icon: StickyNote, label: "Notes", href: null },
  { icon: BookOpen, label: "Journal", href: null },
  { icon: Flame, label: "Habits", href: null },
  { icon: Wallet, label: "Finance", href: null },
  { icon: ImageIcon, label: "Media Vault", href: null },
  { icon: GraduationCap, label: "Learning", href: null },
  { icon: Lightbulb, label: "Idea Vault", href: null },
  { icon: Bot, label: "AI Assistant", href: null },
  { icon: BarChart3, label: "Analytics", href: null },
  { icon: Settings, label: "Settings", href: null },
];

export default function Sidebar() {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();

  return (
    <div
      style={{
        width: expanded ? "196px" : "68px",
        background: "rgb(var(--surface))",
        borderRight: "1px solid rgb(var(--border))",
        transition: "width 0.25s ease",
        display: "flex",
        flexDirection: "column",
        padding: "16px 10px",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px 20px 8px" }}>
        <div
          style={{
            width: 26, height: 26, borderRadius: 7,
            background: "linear-gradient(135deg, rgb(var(--accent)), rgb(var(--gold)))",
            flexShrink: 0,
          }}
        />
        {expanded && <span className="font-display" style={{ fontSize: 16, fontWeight: 500 }}>LifeOS</span>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = item.href === pathname;
          const content = (
            <div
              className="lifeos-navbtn"
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 10px", borderRadius: 10, cursor: item.href ? "pointer" : "default",
                color: active ? "rgb(var(--text))" : "rgb(var(--text-muted))",
                background: active ? "rgb(var(--accent) / 0.15)" : "transparent",
                whiteSpace: "nowrap",
                opacity: item.href ? 1 : 0.55,
              }}
            >
              <Icon size={17} strokeWidth={1.7} style={{ color: active ? "rgb(var(--accent))" : "inherit", flexShrink: 0 }} />
              {expanded && <span style={{ fontSize: 13.5, fontWeight: active ? 600 : 500 }}>{item.label}</span>}
            </div>
          );
          return item.href ? (
            <Link key={item.label} href={item.href}>{content}</Link>
          ) : (
            <div key={item.label} title="Coming in a later phase">{content}</div>
          );
        })}
      </div>

      <div
        className="lifeos-navbtn"
        onClick={() => setExpanded((e) => !e)}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, cursor: "pointer", color: "rgb(var(--text-muted))" }}
      >
        {expanded ? <ChevronsLeft size={17} /> : <ChevronsRight size={17} />}
        {expanded && <span style={{ fontSize: 13 }}>Collapse</span>}
      </div>
    </div>
  );
}
