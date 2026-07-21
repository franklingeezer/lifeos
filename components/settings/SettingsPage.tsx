"use client";

import React, { useState, useEffect, useMemo } from "react";
import { User, Palette, Coins, Trash2, Check, Sun, Moon, Database } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/shell/Sidebar";

type Settings = {
  display_name: string;
  currency_code: string;
  currency_symbol: string;
};

const THEME_KEY = "lifeos-theme";

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [settings, setSettings] = useState<Settings>({ display_name: "Chief", currency_code: "BDT", currency_symbol: "৳" });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const [theme, setThemeState] = useState<"dark" | "light">("dark");
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearedMsg, setClearedMsg] = useState<string | null>(null);

  useEffect(() => {
    const savedTheme = typeof window !== "undefined" ? localStorage.getItem(THEME_KEY) : null;
    setThemeState(savedTheme === "light" ? "light" : "dark");

    const load = async () => {
      const { data } = await supabase.from("app_settings").select("display_name, currency_code, currency_symbol").eq("id", 1).maybeSingle();
      if (data) setSettings(data as Settings);
      setLoading(false);
    };
    load();
  }, [supabase]);

  const applyTheme = (next: "dark" | "light") => {
    setThemeState(next);
    localStorage.setItem(THEME_KEY, next);
    document.documentElement.classList.toggle("light", next === "light");
  };

  const saveSettings = async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaved("saving");
    const { error } = await supabase.from("app_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", 1);
    setSaved(error ? "idle" : "saved");
    if (!error) setTimeout(() => setSaved("idle"), 1800);
  };

  const clearAiCache = async () => {
    if (!confirmingClear) {
      setConfirmingClear(true);
      return;
    }
    await Promise.all([
      supabase.from("ai_briefs").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      supabase.from("ai_reviews").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      supabase.from("ai_journal_insights").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
    ]);
    setConfirmingClear(false);
    setClearedMsg("Cleared. Morning Brief, Review, and Journal Insights will regenerate fresh next time you open them.");
    setTimeout(() => setClearedMsg(null), 5000);
  };

  return (
    <div
      style={{
        background: "rgb(var(--bg))", color: "rgb(var(--text))", minHeight: "600px",
        display: "flex", borderRadius: 20, overflow: "hidden", border: "1px solid rgb(var(--border))", position: "relative",
      }}
    >
      <Sidebar />

      <div style={{ flex: 1, padding: "22px 26px", overflowY: "auto", maxHeight: "700px" }}>
        <div style={{ maxWidth: 640 }}>
          <div className="font-display" style={{ fontSize: 24, fontWeight: 500, marginBottom: 20 }}>Settings</div>

          {loading && <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>Loading…</div>}

          {!loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Profile */}
              <SettingsCard icon={User} title="Profile">
                <FieldRow label="Display name" hint="Used by the AI Assistant — Morning Brief, Reviews, and Journal Insights all address you by this name.">
                  <input
                    key={settings.display_name}
                    defaultValue={settings.display_name}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== settings.display_name) saveSettings({ display_name: v });
                    }}
                    style={inputStyle}
                  />
                </FieldRow>
              </SettingsCard>

              {/* Appearance */}
              <SettingsCard icon={Palette} title="Appearance">
                <FieldRow label="Theme">
                  <div style={{ display: "flex", gap: 8 }}>
                    <ThemeButton icon={Moon} label="Dark" active={theme === "dark"} onClick={() => applyTheme("dark")} />
                    <ThemeButton icon={Sun} label="Light" active={theme === "light"} onClick={() => applyTheme("light")} />
                  </div>
                </FieldRow>
              </SettingsCard>

              {/* Currency */}
              <SettingsCard icon={Coins} title="Currency">
                <FieldRow label="Symbol" hint="Displayed in Finance and Debts & Loans.">
                  <input
                    key={settings.currency_symbol}
                    defaultValue={settings.currency_symbol}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== settings.currency_symbol) saveSettings({ currency_symbol: v });
                    }}
                    style={{ ...inputStyle, width: 80 }}
                  />
                </FieldRow>
                <FieldRow label="Code" hint="Reference only — not yet wired into every module.">
                  <input
                    key={settings.currency_code}
                    defaultValue={settings.currency_code}
                    onBlur={(e) => {
                      const v = e.target.value.trim().toUpperCase();
                      if (v && v !== settings.currency_code) saveSettings({ currency_code: v });
                    }}
                    style={{ ...inputStyle, width: 100 }}
                  />
                </FieldRow>
                <div style={{ fontSize: 11, color: "rgb(var(--text-muted))", marginTop: 4 }}>
                  Note: Finance and Debts & Loans currently display a hard-coded ৳ symbol regardless of this setting — updating them to read from here is a follow-up, not done yet.
                </div>
              </SettingsCard>

              {/* Data */}
              <SettingsCard icon={Database} title="AI data">
                <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))", marginBottom: 12, lineHeight: 1.5 }}>
                  Morning Brief, Reviews, and Journal Insights are cached to avoid unnecessary API calls. Clear the cache to force everything to regenerate next time you open it — useful after a display name change or if something looks stale.
                </div>
                <button
                  onClick={clearAiCache}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                    background: confirmingClear ? "rgb(var(--danger))" : "rgb(var(--danger) / 0.12)",
                    color: confirmingClear ? "rgb(var(--bg))" : "rgb(var(--danger))",
                    border: "1px solid rgb(var(--danger) / 0.3)",
                  }}
                >
                  <Trash2 size={13} /> {confirmingClear ? "Click again to confirm" : "Clear AI cache"}
                </button>
                {clearedMsg && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "rgb(var(--accent))", marginTop: 10 }}>
                    <Check size={13} /> {clearedMsg}
                  </div>
                )}
              </SettingsCard>

              {saved !== "idle" && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: saved === "saved" ? "rgb(var(--accent))" : "rgb(var(--text-muted))" }}>
                  {saved === "saved" ? <><Check size={13} /> Saved</> : "Saving…"}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsCard({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Icon size={15} color="rgb(var(--accent))" />
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
      </div>
      {children}
    </div>
  );
}

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 11, color: "rgb(var(--text-muted))", marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

function ThemeButton({ icon: Icon, label, active, onClick }: { icon: React.ElementType; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
        border: `1px solid ${active ? "rgb(var(--accent))" : "rgb(var(--border))"}`,
        background: active ? "rgb(var(--accent) / 0.12)" : "rgb(var(--surface-2))",
        color: active ? "rgb(var(--accent))" : "rgb(var(--text-muted))",
      }}
    >
      <Icon size={13} /> {label}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "9px 12px", borderRadius: 8, background: "rgb(var(--surface-2))",
  border: "1px solid rgb(var(--border))", color: "rgb(var(--text))", fontSize: 13, outline: "none", width: "100%", maxWidth: 320,
};