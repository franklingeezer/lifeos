"use client";

import React, { useState, useEffect, useMemo } from "react";
import { User, Palette, Coins, Trash2, Check, Sun, Moon, Database, AlertTriangle, Loader2 } from "lucide-react";
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
      <style>{`
        .settings-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 760px) {
          .settings-grid { grid-template-columns: 1fr; }
        }
        .settings-card.full { grid-column: 1 / -1; }
        .settings-card { container-type: inline-size; container-name: settings-card; }

        .settings-row {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 14px 0;
          border-bottom: 1px solid rgb(var(--border));
        }
        .settings-row:last-child { border-bottom: none; padding-bottom: 0; }
        .settings-row:first-child { padding-top: 0; }

        /* Side-by-side label/control once a card actually has room for it —
           keyed to the card's own width, not the viewport, so it never
           squeezes the label into a wrapped ribbon inside a narrow grid cell. */
        @container settings-card (min-width: 480px) {
          .settings-row {
            flex-direction: row;
            align-items: flex-start;
            justify-content: space-between;
            gap: 20px;
          }
          .settings-row-label { max-width: 280px; flex-shrink: 0; }
          .settings-row-control { flex-shrink: 0; }
        }

        .settings-input {
          padding: 9px 12px;
          border-radius: 8px;
          background: rgb(var(--surface-2));
          border: 1px solid rgb(var(--border));
          color: rgb(var(--text));
          font-size: 13px;
          outline: none;
          width: 100%;
          max-width: 320px;
          transition: border-color .15s ease, box-shadow .15s ease;
        }
        .settings-input:hover { border-color: rgb(var(--text-muted) / 0.5); }
        .settings-input:focus { border-color: rgb(var(--accent)); box-shadow: 0 0 0 3px rgb(var(--accent) / 0.15); }
        .settings-input.narrow { width: 88px; text-align: center; }

        .theme-btn {
          display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 9px;
          font-size: 12.5px; font-weight: 600; cursor: pointer; transition: all .15s ease;
        }
        .theme-btn:not(.active):hover { background: rgb(var(--surface-2)); color: rgb(var(--text)); }

        .clear-cache-btn { transition: filter .15s ease, transform .1s ease; }
        .clear-cache-btn:hover { filter: brightness(1.08); }
        .clear-cache-btn:active { transform: scale(0.98); }

        .save-badge {
          display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px;
          font-size: 12px; font-weight: 500; animation: save-badge-in .18s ease;
        }
        @keyframes save-badge-in {
          from { opacity: 0; transform: translateY(-3px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>

      <Sidebar />

      <div style={{ flex: 1, padding: "22px 26px", overflowY: "auto", maxHeight: "700px" }}>
        <div style={{ maxWidth: 720 }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 24 }}>
            <div>
              <div className="font-display" style={{ fontSize: 24, fontWeight: 500, marginBottom: 4 }}>Settings</div>
              <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))" }}>
                Personalize how LifeOS looks, feels, and talks to you.
              </div>
            </div>

            {saved !== "idle" && (
              <div
                className="save-badge"
                style={{
                  background: saved === "saved" ? "rgb(var(--accent) / 0.12)" : "rgb(var(--surface-2))",
                  color: saved === "saved" ? "rgb(var(--accent))" : "rgb(var(--text-muted))",
                  border: `1px solid ${saved === "saved" ? "rgb(var(--accent) / 0.3)" : "rgb(var(--border))"}`,
                }}
              >
                {saved === "saved" ? <Check size={13} /> : <Loader2 size={13} className="spin" />}
                {saved === "saved" ? "Saved" : "Saving…"}
              </div>
            )}
          </div>

          {loading && <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>Loading…</div>}

          {!loading && (
            <div className="settings-grid">
              {/* Profile */}
              <SettingsCard icon={User} title="Profile" description="How the AI Assistant refers to you">
                <SettingsRow label="Display name" hint="Used by Morning Brief, Reviews, and Journal Insights.">
                  <input
                    key={settings.display_name}
                    defaultValue={settings.display_name}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== settings.display_name) saveSettings({ display_name: v });
                    }}
                    className="settings-input"
                  />
                </SettingsRow>
              </SettingsCard>

              {/* Appearance */}
              <SettingsCard icon={Palette} title="Appearance" description="Light or dark, your call">
                <SettingsRow label="Theme">
                  <div style={{ display: "flex", gap: 8 }}>
                    <ThemeButton icon={Moon} label="Dark" active={theme === "dark"} onClick={() => applyTheme("dark")} />
                    <ThemeButton icon={Sun} label="Light" active={theme === "light"} onClick={() => applyTheme("light")} />
                  </div>
                </SettingsRow>
              </SettingsCard>

              {/* Currency */}
              <SettingsCard icon={Coins} title="Currency" description="Used across Finance and Debts & Loans">
                <SettingsRow label="Symbol" hint="Shown before every amount.">
                  <input
                    key={settings.currency_symbol}
                    defaultValue={settings.currency_symbol}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== settings.currency_symbol) saveSettings({ currency_symbol: v });
                    }}
                    className="settings-input narrow"
                  />
                </SettingsRow>
                <SettingsRow label="Code" hint="Reference only — not yet wired into every module.">
                  <input
                    key={settings.currency_code}
                    defaultValue={settings.currency_code}
                    onBlur={(e) => {
                      const v = e.target.value.trim().toUpperCase();
                      if (v && v !== settings.currency_code) saveSettings({ currency_code: v });
                    }}
                    className="settings-input narrow"
                    style={{ width: 100 }}
                  />
                </SettingsRow>
                <div style={{
                  display: "flex", gap: 8, fontSize: 11, color: "rgb(var(--text-muted))",
                  marginTop: 14, padding: "10px 12px", background: "rgb(var(--surface-2))", borderRadius: 8, lineHeight: 1.5,
                }}>
                  <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>Finance and Debts &amp; Loans currently show a hard-coded ৳ symbol regardless of this setting — wiring them up is a follow-up.</span>
                </div>
              </SettingsCard>

              {/* Data / danger zone */}
              <SettingsCard icon={Database} title="AI data" description="Cached brief, review & insight data" danger>
                <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))", marginBottom: 14, lineHeight: 1.55 }}>
                  Morning Brief, Reviews, and Journal Insights are cached to avoid unnecessary API calls. Clear the cache to force everything to regenerate next time you open it.
                </div>
                <button
                  onClick={clearAiCache}
                  className="clear-cache-btn"
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsCard({
  icon: Icon, title, description, danger, children,
}: {
  icon: React.ElementType; title: string; description?: string; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <div
      className="settings-card"
      style={{
        background: "rgb(var(--surface))",
        border: `1px solid ${danger ? "rgb(var(--danger) / 0.25)" : "rgb(var(--border))"}`,
        borderRadius: 16,
        padding: "20px 22px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div
          style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: danger ? "rgb(var(--danger) / 0.12)" : "rgb(var(--accent) / 0.12)",
          }}
        >
          <Icon size={16} color={danger ? "rgb(var(--danger))" : "rgb(var(--accent))"} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{title}</div>
          {description && <div style={{ fontSize: 11.5, color: "rgb(var(--text-muted))", marginTop: 1 }}>{description}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function SettingsRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="settings-row">
      <div className="settings-row-label">
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: "rgb(var(--text-muted))", marginTop: 4, lineHeight: 1.5 }}>{hint}</div>}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

function ThemeButton({ icon: Icon, label, active, onClick }: { icon: React.ElementType; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`theme-btn${active ? " active" : ""}`}
      style={{
        border: `1px solid ${active ? "rgb(var(--accent))" : "rgb(var(--border))"}`,
        background: active ? "rgb(var(--accent) / 0.12)" : "rgb(var(--surface-2))",
        color: active ? "rgb(var(--accent))" : "rgb(var(--text-muted))",
      }}
    >
      <Icon size={13} /> {label}
    </button>
  );
}