"use client";

import React, { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Compass, Sparkles, Search, RefreshCw, ListOrdered, NotebookPen } from "lucide-react";
import Sidebar from "@/components/shell/Sidebar";
import TodayTab from "./TodayTab";
import MorningBriefTab from "./MorningBriefTab";
import SearchTab from "./SearchTab";
import ReviewTab from "./ReviewTab";
import PrioritizeTab from "./PrioritizeTab";
import JournalInsightsTab from "./JournalInsightsTab";

type TabKey = "today" | "brief" | "search" | "review" | "prioritize" | "journal";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "today", label: "Today", icon: Compass },
  { key: "brief", label: "Morning Brief", icon: Sparkles },
  { key: "search", label: "Ask LifeOS", icon: Search },
  { key: "review", label: "Review", icon: RefreshCw },
  { key: "prioritize", label: "Prioritize", icon: ListOrdered },
  { key: "journal", label: "Journal Insights", icon: NotebookPen },
];

const TAB_KEYS = new Set(TABS.map((t) => t.key));

export default function AIAssistantPage() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const initialTab: TabKey = requestedTab && TAB_KEYS.has(requestedTab as TabKey) ? (requestedTab as TabKey) : "today";
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  return (
    <div
      className="lifeos-shell"
      style={{
        background: "rgb(var(--bg))", color: "rgb(var(--text))", minHeight: "600px",
        display: "flex", borderRadius: 20, overflow: "hidden", border: "1px solid rgb(var(--border))", position: "relative",
      }}
    >
      <style>{`
        .history-row:hover { background: rgb(var(--surface-2)); }
        .regen-btn:hover { background: rgb(var(--surface-2)); }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>

      <Sidebar />

      <div className="lifeos-page-content" style={{ flex: 1, padding: "22px 26px", overflowY: "auto", maxHeight: "700px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div className="font-display" style={{ fontSize: 24, fontWeight: 500, marginBottom: 16 }}>AI Assistant</div>

          <div className="lifeos-ai-tabs" style={{ display: "flex", gap: 6, marginBottom: 22, borderBottom: "1px solid rgb(var(--border))", overflowX: "auto" }}>
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                    background: "transparent", border: "none", whiteSpace: "nowrap",
                    color: active ? "rgb(var(--accent))" : "rgb(var(--text-muted))",
                    borderBottom: active ? "2px solid rgb(var(--accent))" : "2px solid transparent",
                    marginBottom: -1,
                  }}
                >
                  <Icon size={13} /> {t.label}
                </button>
              );
            })}
          </div>

          {activeTab === "today" && <TodayTab />}
          {activeTab === "brief" && <MorningBriefTab />}
          {activeTab === "search" && <SearchTab />}
          {activeTab === "review" && <ReviewTab />}
          {activeTab === "prioritize" && <PrioritizeTab />}
          {activeTab === "journal" && <JournalInsightsTab />}
        </div>
      </div>
    </div>
  );
}