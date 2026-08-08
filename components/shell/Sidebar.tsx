"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid, FolderKanban, CheckSquare, Calendar, StickyNote, BookOpen,
  Flame, Wallet, Image as ImageIcon, GraduationCap, Lightbulb, Bot,
  BarChart3, Settings, ChevronsLeft, ChevronsRight, LogOut, Search, Menu, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import CommandPalette from "@/components/shell/CommandPalette";

const NAV = [
  { icon: LayoutGrid, label: "Dashboard", href: "/" },
  { icon: FolderKanban, label: "Projects", href: "/projects" },
  { icon: CheckSquare, label: "Tasks", href: "/tasks" },
  { icon: Calendar, label: "Calendar", href: "/calendar" },
  { icon: StickyNote, label: "Notes", href: "/notes" },
  { icon: BookOpen, label: "Journal", href: "/journal" },
  { icon: Flame, label: "Habits", href: "/habits" },
  { icon: Wallet, label: "Finance", href: "/finance" },
  { icon: ImageIcon, label: "Media Vault", href: "/media" },
  { icon: GraduationCap, label: "Learning", href: "/learning" },
  { icon: Lightbulb, label: "Idea Vault", href: "/idea-vault" },
  { icon: Bot, label: "AI Assistant", href: "/ai-assistant" },
  { icon: BarChart3, label: "Analytics", href: "/analytics" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export default function Sidebar() {
  const [expanded, setExpanded] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  // Global Ctrl+K (Windows/Linux) / Cmd+K (Mac) — works from anywhere in the
  // app since Sidebar is mounted on every page. preventDefault stops the
  // browser's own address-bar shortcut from stealing focus instead.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close the mobile drawer automatically on navigation, so tapping a nav
  // item doesn't leave the drawer sitting open behind the new page.
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const openSearch = () => {
    setMobileMenuOpen(false);
    setPaletteOpen(true);
  };

  return (
    <>
      {/* ---------- Desktop icon rail — hidden below 641px via CSS ---------- */}
      <div
        className="lifeos-sidebar-rail"
        style={{
          width: expanded ? "196px" : "68px",
          background: "rgb(var(--surface))",
          borderRight: "1px solid rgb(var(--border))",
          transition: "width 0.25s ease",
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

        <div
          className="lifeos-navbtn"
          onClick={() => setPaletteOpen(true)}
          title="Search (Ctrl+K)"
          style={{
            display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10,
            cursor: "pointer", color: "rgb(var(--text-muted))", marginBottom: 8,
            border: "1px solid rgb(var(--border))", justifyContent: expanded ? "space-between" : "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Search size={17} strokeWidth={1.7} />
            {expanded && <span style={{ fontSize: 13.5 }}>Search</span>}
          </div>
          {expanded && <kbd style={{ fontSize: 10, fontFamily: "var(--font-mono)", padding: "1px 5px", borderRadius: 4, background: "rgb(var(--surface-2))", color: "rgb(var(--text-muted))" }}>Ctrl K</kbd>}
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
          onClick={handleSignOut}
          title="Sign out"
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, cursor: "pointer", color: "rgb(var(--text-muted))" }}
        >
          <LogOut size={17} strokeWidth={1.7} />
          {expanded && <span style={{ fontSize: 13 }}>Sign out</span>}
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

      {/* ---------- Mobile floating menu button — hidden above 640px via CSS ---------- */}
      <button
        className="lifeos-mobile-fab"
        onClick={() => setMobileMenuOpen(true)}
        aria-label="Open menu"
        style={{
          position: "fixed", bottom: 18, right: 18, width: 52, height: 52, borderRadius: 999,
          background: "rgb(var(--accent))", color: "rgb(var(--bg))", border: "none",
          alignItems: "center", justifyContent: "center", cursor: "pointer",
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)", zIndex: 80,
        }}
      >
        <Menu size={22} />
      </button>

      {/* ---------- Mobile full-screen drawer ---------- */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 90, display: "flex" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(78vw, 300px)", height: "100%", background: "rgb(var(--surface))",
              borderRight: "1px solid rgb(var(--border))", padding: "18px 14px", overflowY: "auto",
              display: "flex", flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 6px 18px 6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg, rgb(var(--accent)), rgb(var(--gold)))", flexShrink: 0 }} />
                <span className="font-display" style={{ fontSize: 16, fontWeight: 500 }}>LifeOS</span>
              </div>
              <X size={20} color="rgb(var(--text-muted))" style={{ cursor: "pointer" }} onClick={() => setMobileMenuOpen(false)} />
            </div>

            <div
              onClick={openSearch}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px",
                borderRadius: 10, border: "1px solid rgb(var(--border))", marginBottom: 10, cursor: "pointer", color: "rgb(var(--text-muted))",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Search size={17} strokeWidth={1.7} />
                <span style={{ fontSize: 14 }}>Search</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
              {NAV.map((item) => {
                const Icon = item.icon;
                const active = item.href === pathname;
                const content = (
                  <div
                    style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 10,
                      cursor: item.href ? "pointer" : "default",
                      color: active ? "rgb(var(--text))" : "rgb(var(--text-muted))",
                      background: active ? "rgb(var(--accent) / 0.15)" : "transparent",
                      opacity: item.href ? 1 : 0.55,
                    }}
                  >
                    <Icon size={19} strokeWidth={1.7} style={{ color: active ? "rgb(var(--accent))" : "inherit", flexShrink: 0 }} />
                    <span style={{ fontSize: 14.5, fontWeight: active ? 600 : 500 }}>{item.label}</span>
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
              onClick={handleSignOut}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 10, cursor: "pointer", color: "rgb(var(--text-muted))", marginTop: 8 }}
            >
              <LogOut size={19} strokeWidth={1.7} />
              <span style={{ fontSize: 14.5 }}>Sign out</span>
            </div>
          </div>
        </div>
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}