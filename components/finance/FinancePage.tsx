"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, X, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, PiggyBank, LineChart as LineChartIcon } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { createClient } from "@/lib/supabase/client";
import { todayISO, toLocalISODate } from "@/lib/date";
import Sidebar from "@/components/shell/Sidebar";
import DebtsPanel from "@/components/finance/DebtsPanel";

type TxType = "income" | "expense" | "savings" | "investment";

type Transaction = {
  id: string;
  type: TxType;
  category: string | null;
  amount_bdt: number;
  note: string | null;
  occurred_on: string;
};

const TYPE_META: Record<TxType, { label: string; color: string }> = {
  income: { label: "Income", color: "rgb(var(--accent))" },
  expense: { label: "Expense", color: "rgb(var(--danger))" },
  savings: { label: "Savings", color: "rgb(var(--gold))" },
  investment: { label: "Investment", color: "#8B7FD6" },
};

const emptyForm = {
  type: "expense" as TxType,
  category: "",
  amount_bdt: "",
  note: "",
  occurred_on: todayISO(),
};

const bdt = (n: number) =>
  new Intl.NumberFormat("en-BD", { maximumFractionDigits: 0 }).format(Math.round(n));

const monthLabel = (year: number, month: number) =>
  new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

export default function FinancePage() {
  const supabase = useMemo(() => createClient(), []);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    const start = toLocalISODate(new Date(cursor.year, cursor.month, 1));
    const end = toLocalISODate(new Date(cursor.year, cursor.month + 1, 0));
    const { data, error } = await supabase
      .from("finance_transactions")
      .select("id, type, category, amount_bdt, note, occurred_on")
      .gte("occurred_on", start)
      .lte("occurred_on", end)
      .order("occurred_on", { ascending: false });
    if (!error && data) setTransactions(data as Transaction[]);
    setLoading(false);
  }, [supabase, cursor]);

  useEffect(() => { load(); }, [load]);

  const editingTx = transactions.find((t) => t.id === editingId) ?? null;

  const totals = useMemo(() => {
    const acc: Record<TxType, number> = { income: 0, expense: 0, savings: 0, investment: 0 };
    for (const t of transactions) acc[t.type] += Number(t.amount_bdt);
    return acc;
  }, [transactions]);

  const net = totals.income - totals.expense - totals.savings - totals.investment;

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== "expense") continue;
      const key = t.category?.trim() || "Uncategorized";
      map.set(key, (map.get(key) ?? 0) + Number(t.amount_bdt));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  const pieColors = ["rgb(var(--accent))", "rgb(var(--gold))", "rgb(var(--danger))", "#8B7FD6", "#5FA8D3", "#C98A5B", "#7FB88A"];

  const createTx = async () => {
    const amount = parseFloat(form.amount_bdt);
    if (!amount || amount <= 0) return;
    const payload = {
      type: form.type,
      category: form.category.trim() || null,
      amount_bdt: amount,
      note: form.note.trim() || null,
      occurred_on: form.occurred_on,
    };
    const { data, error } = await supabase.from("finance_transactions").insert(payload).select().single();
    if (!error && data) {
      const tx = data as Transaction;
      const d = new Date(tx.occurred_on);
      if (d.getFullYear() === cursor.year && d.getMonth() === cursor.month) {
        setTransactions((prev) => [tx, ...prev]);
      }
    }
    setForm(emptyForm);
    setShowCreate(false);
  };

  const updateTx = async (id: string, patch: Partial<Transaction>) => {
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    await supabase.from("finance_transactions").update(patch).eq("id", id);
  };

  const deleteTx = async (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    if (editingId === id) setEditingId(null);
    await supabase.from("finance_transactions").delete().eq("id", id);
  };

  const shiftMonth = (delta: number) => {
    setCursor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  return (
    <div
      style={{
        background: "rgb(var(--bg))", color: "rgb(var(--text))", minHeight: "600px",
        display: "flex", borderRadius: 20, overflow: "hidden", border: "1px solid rgb(var(--border))", position: "relative",
      }}
    >
      <style>{`
        .lifeos-navbtn:hover { background: rgb(var(--surface-2)); }
        .tx-row:hover { background: rgb(var(--surface-2)); }
        .icon-btn:hover { background: rgb(var(--surface-2)); }
      `}</style>

      <Sidebar />

      <div style={{ flex: 1, padding: "22px 26px", overflowY: "auto", maxHeight: "700px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div className="font-display" style={{ fontSize: 24, fontWeight: 500 }}>Finance</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 10, padding: "4px" }}>
              <button className="icon-btn" onClick={() => shiftMonth(-1)} style={iconBtnStyle}><ChevronLeft size={15} /></button>
              <span className="font-mono" style={{ fontSize: 12.5, padding: "0 6px", minWidth: 116, textAlign: "center" }}>
                {monthLabel(cursor.year, cursor.month)}
              </span>
              <button className="icon-btn" onClick={() => shiftMonth(1)} style={iconBtnStyle}><ChevronRight size={15} /></button>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: "rgb(var(--accent))", color: "rgb(var(--bg))", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}
            >
              <Plus size={15} /> New transaction
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
          <SummaryCard icon={TrendingUp} label="Income" value={totals.income} color="rgb(var(--accent))" />
          <SummaryCard icon={TrendingDown} label="Expenses" value={totals.expense} color="rgb(var(--danger))" />
          <SummaryCard icon={PiggyBank} label="Savings" value={totals.savings} color="rgb(var(--gold))" />
          <SummaryCard icon={LineChartIcon} label="Investment" value={totals.investment} color="#8B7FD6" />
          <SummaryCard icon={net >= 0 ? TrendingUp : TrendingDown} label="Net" value={net} color={net >= 0 ? "rgb(var(--accent))" : "rgb(var(--danger))"} emphasized />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, alignItems: "start" }}>
          {/* Transaction list */}
          <div style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, overflow: "hidden" }}>
            {loading && <div style={{ padding: 16, fontSize: 13, color: "rgb(var(--text-muted))" }}>Loading transactions…</div>}
            {!loading && transactions.length === 0 && (
              <div style={{ padding: 16, fontSize: 13, color: "rgb(var(--text-muted))" }}>No transactions this month.</div>
            )}
            {!loading && transactions.map((t) => {
              const meta = TYPE_META[t.type];
              const sign = t.type === "income" ? "+" : "−";
              return (
                <div
                  key={t.id}
                  className="tx-row"
                  onClick={() => setEditingId(t.id)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid rgb(var(--border))", cursor: "pointer" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: meta.color, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {t.category || meta.label}
                      </div>
                      <div style={{ fontSize: 11, color: "rgb(var(--text-muted))" }}>
                        {new Date(t.occurred_on).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {t.note ? ` · ${t.note}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="font-mono" style={{ fontSize: 13.5, fontWeight: 600, color: meta.color, flexShrink: 0, marginLeft: 12 }}>
                    {sign}৳{bdt(t.amount_bdt)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Category breakdown pie */}
          <div style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Expenses by category</div>
            {categoryBreakdown.length === 0 && (
              <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))" }}>No expenses logged this month.</div>
            )}
            {categoryBreakdown.length > 0 && (
              <>
                <div style={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryBreakdown} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                        {categoryBreakdown.map((_, i) => (
                          <Cell key={i} fill={pieColors[i % pieColors.length]} stroke="rgb(var(--surface))" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [`৳${bdt(value)}`, "Amount"]}
                        contentStyle={{ background: "rgb(var(--surface-2))", border: "1px solid rgb(var(--border))", borderRadius: 8, fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  {categoryBreakdown.slice(0, 6).map((c, i) => (
                    <div key={c.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.5 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <span style={{ width: 7, height: 7, borderRadius: 99, background: pieColors[i % pieColors.length], flexShrink: 0 }} />
                        <span style={{ color: "rgb(var(--text-muted))", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                      </div>
                      <span className="font-mono" style={{ flexShrink: 0 }}>৳{bdt(c.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <DebtsPanel />
      </div>

      {/* Create modal */}
      {showCreate && (
        <div onClick={() => setShowCreate(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 22, width: 380, maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>New transaction</span>
              <X size={16} style={{ cursor: "pointer", color: "rgb(var(--text-muted))" }} onClick={() => setShowCreate(false)} />
            </div>
            <FormField label="Type">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as TxType })} style={inputStyle}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="savings">Savings</option>
                <option value="investment">Investment</option>
              </select>
            </FormField>
            <FormField label="Amount (৳)">
              <input type="number" min="0" step="0.01" autoFocus value={form.amount_bdt} onChange={(e) => setForm({ ...form, amount_bdt: e.target.value })} placeholder="0.00" style={inputStyle} />
            </FormField>
            <FormField label="Category">
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Groceries" style={inputStyle} />
            </FormField>
            <FormField label="Date">
              <input type="date" value={form.occurred_on} onChange={(e) => setForm({ ...form, occurred_on: e.target.value })} style={inputStyle} />
            </FormField>
            <FormField label="Note">
              <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
            </FormField>

            <button onClick={createTx} style={{ width: "100%", marginTop: 8, padding: "10px", borderRadius: 10, background: "rgb(var(--accent))", color: "rgb(var(--bg))", fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer" }}>
              Add transaction
            </button>
          </div>
        </div>
      )}

      {/* Edit drawer */}
      {editingTx && (
        <div key={editingTx.id} style={{ position: "fixed", top: 0, right: 0, height: "100%", width: 360, background: "rgb(var(--surface))", borderLeft: "1px solid rgb(var(--border))", padding: 22, overflowY: "auto", zIndex: 50, boxShadow: "-8px 0 24px rgba(0,0,0,0.3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "rgb(var(--text-muted))" }}>Edit transaction</span>
            <X size={16} style={{ cursor: "pointer", color: "rgb(var(--text-muted))" }} onClick={() => setEditingId(null)} />
          </div>

          <FormField label="Type">
            <select value={editingTx.type} onChange={(e) => updateTx(editingTx.id, { type: e.target.value as TxType })} style={inputStyle}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="savings">Savings</option>
              <option value="investment">Investment</option>
            </select>
          </FormField>
          <FormField label="Amount (৳)">
            <input type="number" min="0" step="0.01" defaultValue={editingTx.amount_bdt} onBlur={(e) => updateTx(editingTx.id, { amount_bdt: parseFloat(e.target.value) || 0 })} style={inputStyle} />
          </FormField>
          <FormField label="Category">
            <input defaultValue={editingTx.category ?? ""} onBlur={(e) => updateTx(editingTx.id, { category: e.target.value || null })} style={inputStyle} />
          </FormField>
          <FormField label="Date">
            <input type="date" defaultValue={editingTx.occurred_on} onChange={(e) => updateTx(editingTx.id, { occurred_on: e.target.value })} style={inputStyle} />
          </FormField>
          <FormField label="Note">
            <textarea defaultValue={editingTx.note ?? ""} onBlur={(e) => updateTx(editingTx.id, { note: e.target.value || null })} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
          </FormField>

          <button
            onClick={() => deleteTx(editingTx.id)}
            style={{ width: "100%", marginTop: 12, padding: "10px", borderRadius: 10, background: "rgb(var(--danger) / 0.12)", color: "rgb(var(--danger))", fontWeight: 600, fontSize: 13, border: "1px solid rgb(var(--danger) / 0.3)", cursor: "pointer" }}
          >
            Delete transaction
          </button>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color, emphasized }: { icon: React.ElementType; label: string; value: number; color: string; emphasized?: boolean }) {
  return (
    <div style={{ background: "rgb(var(--surface))", border: emphasized ? `1px solid ${color}` : "1px solid rgb(var(--border))", borderRadius: 14, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: "rgb(var(--text-muted))" }}>
        <Icon size={13} color={color} />
        <span style={{ fontSize: 11.5 }}>{label}</span>
      </div>
      <div className="font-mono" style={{ fontSize: 17, fontWeight: 600, color: emphasized ? color : "rgb(var(--text))" }}>
        ৳{bdt(value)}
      </div>
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

const iconBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24,
  borderRadius: 6, border: "none", background: "transparent", color: "rgb(var(--text-muted))", cursor: "pointer",
};