"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Search, Plus, Trash2, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toLocalISODate } from "@/lib/date";
import Sidebar from "@/components/shell/Sidebar";

type Entry = {
  id: string;
  entry_date: string;
  mood: number;
  energy: number;
  stress: number;
  wins: string | null;
  failures: string | null;
  lessons: string | null;
  tomorrow_goals: string | null;
  gratitude: string | null;
};

// Same visual language as the rest of the app's status dots (danger ->
// gold -> accent), not emoji or plain numbers. Mood and Energy run low-to-
// high in the "bad to good" direction; Stress is intentionally reversed —
// calm (low) is the good end, overwhelmed (high) is the bad end, so its
// gradient runs the opposite way for that to read correctly at a glance.
const MOOD_META = [
  { label: "Rough", color: "rgb(var(--danger))" },
  { label: "Low", color: "#C98F6B" },
  { label: "Okay", color: "rgb(var(--gold))" },
  { label: "Good", color: "#8FB89A" },
  { label: "Great", color: "rgb(var(--accent))" },
];
const ENERGY_META = [
  { label: "Drained", color: "rgb(var(--danger))" },
  { label: "Low", color: "#C98F6B" },
  { label: "Steady", color: "rgb(var(--gold))" },
  { label: "Energized", color: "#8FB89A" },
  { label: "Peak", color: "rgb(var(--accent))" },
];
const STRESS_META = [
  { label: "Calm", color: "rgb(var(--accent))" },
  { label: "Mild", color: "#8FB89A" },
  { label: "Moderate", color: "rgb(var(--gold))" },
  { label: "High", color: "#C98F6B" },
  { label: "Overwhelmed", color: "rgb(var(--danger))" },
];
const MOOD_COLORS = MOOD_META.map((m) => m.color);
const toISODate = toLocalISODate;
const todayISO = toISODate(new Date());

export default function JournalPage() {
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("journal_entries")
      .select("id, entry_date, mood, energy, stress, wins, failures, lessons, tomorrow_goals, gratitude")
      .order("entry_date", { ascending: false });
    if (!error && data) {
      setEntries(data as Entry[]);
      const todays = data.find((e: Entry) => e.entry_date === todayISO);
      if (todays) setActiveId(todays.id);
      else if (data.length > 0) setActiveId(data[0].id);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const active = entries.find((e) => e.id === activeId) ?? null;
  const hasToday = entries.some((e) => e.entry_date === todayISO);

  const filtered = entries.filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [e.wins, e.failures, e.lessons, e.tomorrow_goals, e.gratitude].some((f) => (f ?? "").toLowerCase().includes(q));
  });

  const createToday = async () => {
    const payload = { entry_date: todayISO, mood: 3, energy: 3, stress: 3 };
    const { data, error } = await supabase.from("journal_entries").insert(payload).select().single();
    if (!error && data) {
      setEntries((prev) => [data as Entry, ...prev]);
      setActiveId(data.id);
    }
  };

  const scheduleSave = (id: string, patch: Partial<Entry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await supabase.from("journal_entries").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
      setSaveStatus("saved");
    }, 700);
  };

  const setScale = async (id: string, field: "mood" | "energy" | "stress", value: number) => {
    const prevEntries = entries;
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
    const { error } = await supabase.from("journal_entries").update({ [field]: value }).eq("id", id);
    if (error) {
      console.error(`Failed to save ${field}:`, error.message);
      setEntries(prevEntries); // revert the optimistic update since it didn't actually persist
    }
  };

  const deleteEntry = async (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (activeId === id) setActiveId(null);
    await supabase.from("journal_entries").delete().eq("id", id);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    const isToday = iso === todayISO;
    return isToday ? `Today — ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="lifeos-shell" style={{ background: "rgb(var(--bg))", color: "rgb(var(--text))", minHeight: "600px", display: "flex", borderRadius: 20, overflow: "hidden", border: "1px solid rgb(var(--border))" }}>
      <style>{`
        .lifeos-navbtn:hover { background: rgb(var(--surface-2)); }
        .entry-row:hover { background: rgb(var(--surface-2)); }
        .icon-btn:hover { background: rgb(var(--surface-2)); }
        .scale-btn:hover { transform: scale(1.08); }
      `}</style>

      <Sidebar />

      {/* Entry list */}
      <div className={`lifeos-journal-list${active ? " lifeos-hide-mobile" : ""}`} style={{ width: 260, borderRight: "1px solid rgb(var(--border))", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "18px 16px 12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div className="font-display" style={{ fontSize: 19, fontWeight: 500 }}>Journal</div>
            {!hasToday && (
              <button onClick={createToday} className="icon-btn" style={{ width: 28, height: 28, borderRadius: 8, background: "rgb(var(--accent))", color: "rgb(var(--bg))", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <Plus size={15} />
              </button>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 8, padding: "6px 8px" }}>
            <Search size={13} color="rgb(var(--text-muted))" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search entries…" style={{ background: "transparent", border: "none", outline: "none", color: "rgb(var(--text))", fontSize: 12.5, width: "100%" }} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 12px" }}>
          {loading && <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))", padding: 8 }}>Loading…</div>}
          {!loading && filtered.length === 0 && <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))", padding: 8 }}>No entries yet.</div>}
          {filtered.map((e) => (
            <div
              key={e.id}
              className="entry-row"
              onClick={() => setActiveId(e.id)}
              style={{ padding: "10px 10px", borderRadius: 10, cursor: "pointer", marginBottom: 2, background: activeId === e.id ? "rgb(var(--accent) / 0.12)" : "transparent" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: MOOD_COLORS[e.mood - 1], flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, fontWeight: 500 }}>{formatDate(e.entry_date)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className={`lifeos-journal-editor${active ? " lifeos-show-mobile" : ""}`} style={{ flex: 1, overflowY: "auto", padding: "22px 26px" }}>
        {!active ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, color: "rgb(var(--text-muted))" }}>
            <span style={{ fontSize: 13 }}>No entry for today yet.</span>
            <button onClick={createToday} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: "rgb(var(--accent))", color: "rgb(var(--bg))", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}>
              <Plus size={15} /> Start today's entry
            </button>
          </div>
        ) : (
          <React.Fragment key={active.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <button
                  className="lifeos-journal-back-btn icon-btn"
                  onClick={() => setActiveId(null)}
                  style={{ width: 28, height: 28, borderRadius: 8, background: "transparent", border: "1px solid rgb(var(--border))", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
                  title="Back to entries"
                >
                  <ArrowLeft size={13} color="rgb(var(--text-muted))" />
                </button>
                <div className="font-display" style={{ fontSize: 21, fontWeight: 500 }}>{formatDate(active.entry_date)}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, color: "rgb(var(--text-muted))" }}>
                  {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : ""}
                </span>
                <button onClick={() => deleteEntry(active.id)} className="icon-btn" style={{ width: 28, height: 28, borderRadius: 8, background: "transparent", border: "1px solid rgb(var(--border))", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <Trash2 size={13} color="rgb(var(--danger))" />
                </button>
              </div>
            </div>

            <div className="lifeos-journal-scales" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
              <ScaleTrackField label="Mood" meta={MOOD_META} value={active.mood} onChange={(v) => setScale(active.id, "mood", v)} />
              <ScaleTrackField label="Energy" meta={ENERGY_META} value={active.energy} onChange={(v) => setScale(active.id, "energy", v)} />
              <ScaleTrackField label="Stress" meta={STRESS_META} value={active.stress} onChange={(v) => setScale(active.id, "stress", v)} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <JournalField label="Today's wins" value={active.wins} onChange={(v) => scheduleSave(active.id, { wins: v })} />
              <JournalField label="Today's failures" value={active.failures} onChange={(v) => scheduleSave(active.id, { failures: v })} />
              <JournalField label="Lessons learned" value={active.lessons} onChange={(v) => scheduleSave(active.id, { lessons: v })} />
              <JournalField label="Tomorrow's goals" value={active.tomorrow_goals} onChange={(v) => scheduleSave(active.id, { tomorrow_goals: v })} />
              <JournalField label="Gratitude" value={active.gratitude} onChange={(v) => scheduleSave(active.id, { gratitude: v })} />
            </div>
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

type ScaleMeta = { label: string; color: string };

function ScaleTrackField({
  label, meta, value, onChange,
}: {
  label: string;
  meta: ScaleMeta[];
  value: number;
  onChange: (v: number) => void;
}) {
  const active = meta[value - 1];
  return (
    <div style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 12, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <span style={{ fontSize: 11.5, color: "rgb(var(--text-muted))" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: active.color, transition: "color 0.2s ease" }}>{active.label}</span>
      </div>
      <div style={{ position: "relative", height: 26 }}>
        {/* gradient track */}
        <div
          style={{
            position: "absolute", top: "50%", left: 3, right: 3, height: 3, borderRadius: 99, transform: "translateY(-50%)",
            background: `linear-gradient(90deg, ${meta.map((m) => m.color).join(", ")})`,
            opacity: 0.3,
          }}
        />
        {/* nodes */}
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", height: "100%" }}>
          {meta.map((m, i) => {
            const n = i + 1;
            const isActive = value === n;
            return (
              <div
                key={n}
                onClick={() => onChange(n)}
                title={m.label}
                style={{
                  width: isActive ? 22 : 14, height: isActive ? 22 : 14, borderRadius: 99, cursor: "pointer", flexShrink: 0,
                  background: isActive ? m.color : "rgb(var(--surface-2))",
                  border: `2px solid ${isActive ? m.color : "rgb(var(--border))"}`,
                  boxShadow: isActive ? `0 0 0 4px ${m.color}22` : "none",
                  transition: "width 0.18s cubic-bezier(.34,1.56,.64,1), height 0.18s cubic-bezier(.34,1.56,.64,1), background 0.18s ease, box-shadow 0.18s ease",
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function JournalField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string) => void }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "rgb(var(--text-muted))", marginBottom: 6, fontWeight: 500 }}>{label}</div>
      <textarea
        defaultValue={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder="…"
        style={{
          width: "100%", background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 10,
          padding: "10px 12px", color: "rgb(var(--text))", fontSize: 13.5, lineHeight: 1.5, outline: "none", resize: "vertical",
        }}
      />
    </div>
  );
}