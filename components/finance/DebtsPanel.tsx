"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, X, Check, Trash2, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Direction = "owed_to_me" | "i_owe";

type Debt = {
  id: string;
  person_name: string;
  direction: Direction;
  amount_bdt: number;
  note: string | null;
  due_date: string | null;
  settled: boolean;
};

const emptyForm = {
  person_name: "",
  direction: "owed_to_me" as Direction,
  amount_bdt: "",
  note: "",
  due_date: "",
};

const bdt = (n: number) =>
  new Intl.NumberFormat("en-BD", { maximumFractionDigits: 0 }).format(Math.round(n));

export default function DebtsPanel() {
  const supabase = useMemo(() => createClient(), []);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showSettled, setShowSettled] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("finance_debts")
      .select("id, person_name, direction, amount_bdt, note, due_date, settled")
      .order("settled", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (!error && data) setDebts(data as Debt[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const visible = debts.filter((d) => showSettled || !d.settled);
  const owedToMe = visible.filter((d) => d.direction === "owed_to_me");
  const iOwe = visible.filter((d) => d.direction === "i_owe");

  const totalOwedToMe = debts.filter((d) => !d.settled && d.direction === "owed_to_me").reduce((s, d) => s + Number(d.amount_bdt), 0);
  const totalIOwe = debts.filter((d) => !d.settled && d.direction === "i_owe").reduce((s, d) => s + Number(d.amount_bdt), 0);

  const createDebt = async () => {
    const amount = parseFloat(form.amount_bdt);
    if (!form.person_name.trim() || !amount || amount <= 0) return;
    const payload = {
      person_name: form.person_name.trim(),
      direction: form.direction,
      amount_bdt: amount,
      note: form.note.trim() || null,
      due_date: form.due_date || null,
      settled: false,
    };
    const { data, error } = await supabase.from("finance_debts").insert(payload).select().single();
    if (!error && data) setDebts((prev) => [data as Debt, ...prev]);
    setForm(emptyForm);
    setShowCreate(false);
  };

  const toggleSettled = async (d: Debt) => {
    setDebts((prev) => prev.map((x) => (x.id === d.id ? { ...x, settled: !x.settled } : x)));
    await supabase.from("finance_debts").update({ settled: !d.settled }).eq("id", d.id);
  };

  const deleteDebt = async (id: string) => {
    setDebts((prev) => prev.filter((d) => d.id !== id));
    await supabase.from("finance_debts").delete().eq("id", id);
  };

  return (
    <div style={{ marginTop: 16 }}>
      <style>{`
        .debt-row:hover { background: rgb(var(--surface-2)); }
        .debt-icon-btn:hover { background: rgb(var(--surface-2)); }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Debts &amp; loans</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgb(var(--text-muted))", cursor: "pointer" }}>
            <input type="checkbox" checked={showSettled} onChange={(e) => setShowSettled(e.target.checked)} />
            Show settled
          </label>
          <button
            onClick={() => setShowCreate(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 10, background: "rgb(var(--accent))", color: "rgb(var(--bg))", fontSize: 12.5, fontWeight: 600, border: "none", cursor: "pointer" }}
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 14 }}>
        <div style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 14, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: "rgb(var(--text-muted))" }}>
            <ArrowDownLeft size={13} color="rgb(var(--accent))" />
            <span style={{ fontSize: 11.5 }}>Owed to me</span>
          </div>
          <div className="font-mono" style={{ fontSize: 17, fontWeight: 600, color: "rgb(var(--accent))" }}>৳{bdt(totalOwedToMe)}</div>
        </div>
        <div style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 14, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: "rgb(var(--text-muted))" }}>
            <ArrowUpRight size={13} color="rgb(var(--danger))" />
            <span style={{ fontSize: 11.5 }}>I owe</span>
          </div>
          <div className="font-mono" style={{ fontSize: 17, fontWeight: 600, color: "rgb(var(--danger))" }}>৳{bdt(totalIOwe)}</div>
        </div>
      </div>

      {loading && <div style={{ fontSize: 13, color: "rgb(var(--text-muted))" }}>Loading…</div>}

      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <DebtColumn title="Owed to me" items={owedToMe} accentColor="rgb(var(--accent))" onToggle={toggleSettled} onDelete={deleteDebt} />
          <DebtColumn title="I owe" items={iOwe} accentColor="rgb(var(--danger))" onToggle={toggleSettled} onDelete={deleteDebt} />
        </div>
      )}

      {showCreate && (
        <div onClick={() => setShowCreate(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 22, width: 380, maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Add debt / loan</span>
              <X size={16} style={{ cursor: "pointer", color: "rgb(var(--text-muted))" }} onClick={() => setShowCreate(false)} />
            </div>
            <FormField label="Person">
              <input autoFocus value={form.person_name} onChange={(e) => setForm({ ...form, person_name: e.target.value })} placeholder="e.g. Rafiq" style={inputStyle} />
            </FormField>
            <FormField label="Direction">
              <select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value as Direction })} style={inputStyle}>
                <option value="owed_to_me">They owe me</option>
                <option value="i_owe">I owe them</option>
              </select>
            </FormField>
            <FormField label="Amount (৳)">
              <input type="number" min="0" step="0.01" value={form.amount_bdt} onChange={(e) => setForm({ ...form, amount_bdt: e.target.value })} placeholder="0.00" style={inputStyle} />
            </FormField>
            <FormField label="Due date (optional)">
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} style={inputStyle} />
            </FormField>
            <FormField label="Note">
              <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
            </FormField>

            <button onClick={createDebt} style={{ width: "100%", marginTop: 8, padding: "10px", borderRadius: 10, background: "rgb(var(--accent))", color: "rgb(var(--bg))", fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer" }}>
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DebtColumn({
  title, items, accentColor, onToggle, onDelete,
}: {
  title: string;
  items: Debt[];
  accentColor: string;
  onToggle: (d: Debt) => void;
  onDelete: (id: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid rgb(var(--border))", fontSize: 12.5, fontWeight: 600, color: "rgb(var(--text-muted))" }}>
        {title}
      </div>
      {items.length === 0 && (
        <div style={{ padding: 16, fontSize: 12.5, color: "rgb(var(--text-muted))" }}>Nothing here.</div>
      )}
      {items.map((d) => {
        const overdue = !d.settled && d.due_date && d.due_date < today;
        return (
          <div key={d.id} className="debt-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid rgb(var(--border))" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, textDecoration: d.settled ? "line-through" : "none", opacity: d.settled ? 0.55 : 1 }}>
                  {d.person_name}
                </span>
                {overdue && (
                  <span className="font-mono" style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 99, background: "rgb(var(--danger) / 0.15)", color: "rgb(var(--danger))" }}>
                    OVERDUE
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: "rgb(var(--text-muted))" }}>
                {d.due_date ? `Due ${new Date(d.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "No due date"}
                {d.note ? ` · ${d.note}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, marginLeft: 10 }}>
              <span className="font-mono" style={{ fontSize: 13, fontWeight: 600, color: d.settled ? "rgb(var(--text-muted))" : accentColor }}>
                ৳{bdt(d.amount_bdt)}
              </span>
              <button className="debt-icon-btn" onClick={() => onToggle(d)} title={d.settled ? "Mark unsettled" : "Mark settled"} style={ghostBtnStyle}>
                <Check size={14} color={d.settled ? "rgb(var(--accent))" : "rgb(var(--text-muted))"} />
              </button>
              <button className="debt-icon-btn" onClick={() => onDelete(d.id)} title="Delete" style={ghostBtnStyle}>
                <Trash2 size={14} color="rgb(var(--text-muted))" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12, flex: 1 }}>
      <div style={{ fontSize: 11.5, color: "rgb(var(--text-muted))", marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 8, background: "rgb(var(--surface-2))",
  border: "1px solid rgb(var(--border))", color: "rgb(var(--text))", fontSize: 13, outline: "none",
};

const ghostBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24,
  borderRadius: 6, border: "none", background: "transparent", cursor: "pointer",
};