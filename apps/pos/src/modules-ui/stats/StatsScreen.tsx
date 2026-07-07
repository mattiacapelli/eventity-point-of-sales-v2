import React, { useState, useEffect } from "react";
import {
  ResponsiveContainer, PieChart as RePieChart, Pie, Cell,
  BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { PosLayout } from "../../layout/PosLayout.js";
import { Button } from "../../components/ui/Button.js";
import { useShiftStore } from "../../state/shift-store.js";
import { apiClient, type ShiftFullStats } from "../../core/api-client.js";
import { adminApi } from "../../core/admin-api.js";
import { downloadCsv } from "../../core/csv-export.js";
import type { Shift } from "@pos/shared-types";

// ─── Types ────────────────────────────────────────────────────────────────────

type PeriodStats = {
  totalSales: number;
  totalOrders: number;
  avgTicket: number;
  byCategory: { categoryName: string; amount: number }[];
  byDay: { date: string; sales: number }[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `€${n.toFixed(2)}`;
}

function startOf(period: "today" | "week" | "month"): Date {
  const d = new Date();
  if (period === "today") { d.setHours(0, 0, 0, 0); return d; }
  if (period === "week") {
    const day = d.getDay(); const diff = (day + 6) % 7;
    d.setDate(d.getDate() - diff); d.setHours(0, 0, 0, 0); return d;
  }
  d.setDate(1); d.setHours(0, 0, 0, 0); return d;
}

// ─── Charts (recharts) ─────────────────────────────────────────────────────────

const CHART_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#ec4899", "#8b5cf6"];

function EmptyChart() {
  return <span style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-400)" }}>Nessun dato</span>;
}

function DistributionPieChart({ data }: { data: { label: string; value: number }[] }) {
  if (data.length === 0) return <EmptyChart />;
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <EmptyChart />;

  const sorted = data.slice().sort((a, b) => b.value - a.value);
  let slices = sorted;
  if (sorted.length > 6) {
    const rest = sorted.slice(6).reduce((s, d) => s + d.value, 0);
    slices = [...sorted.slice(0, 6), { label: "Altri", value: rest }];
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-lg)", flexWrap: "wrap" }}>
      <div style={{ width: 160, height: 160, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RePieChart>
            <Pie data={slices} dataKey="value" nameKey="label" innerRadius={0} outerRadius={70} stroke="white" strokeWidth={2}>
              {slices.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => fmt(Number(v))} />
          </RePieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "var(--text-sm)" }}>
            <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
            <span style={{ color: "var(--color-gray-700)" }}>{s.label}</span>
            <span style={{ color: "var(--color-gray-400)", marginLeft: "auto", paddingLeft: "var(--sp-sm)" }}>
              {Math.round(s.value / total * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DistributionBarChart({ data, height = 220 }: { data: { label: string; value: number }[]; height?: number }) {
  if (data.length === 0) return <EmptyChart />;
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ReBarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-gray-100)" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => fmt(Number(v))} />
          <Bar dataKey="value" fill="var(--color-brand, #6366f1)" radius={[4, 4, 0, 0]} />
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: "var(--color-white)",
      border: "1px solid var(--color-gray-100)",
      borderRadius: "var(--radius-xl)",
      boxShadow: "var(--shadow-sm)",
      padding: "var(--sp-md) var(--sp-lg)",
      flex: "1 1 140px",
    }}>
      <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-500)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
        {label}
      </div>
      <div style={{ fontSize: "var(--text-xxl)", fontWeight: 700, color: "var(--color-brand)" }}>
        {value}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--color-white)",
      border: "1px solid var(--color-gray-100)",
      borderRadius: "var(--radius-xl)",
      boxShadow: "var(--shadow-sm)",
      padding: "var(--sp-lg)",
    }}>
      <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-gray-500)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--sp-md)" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// ─── Print report button ───────────────────────────────────────────────────────

function PrintReportButton({ shiftId }: { shiftId: string }) {
  const [printing, setPrinting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  function handlePrint() {
    setPrinting(true);
    setResult(null);
    apiClient.stats.printShiftReport(shiftId)
      .then((res) => setResult({ ok: res.ok, msg: res.message ?? (res.ok ? "Report stampato" : "Stampa non riuscita") }))
      .catch((e) => setResult({ ok: false, msg: e.message }))
      .finally(() => setPrinting(false));
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-md)" }}>
      <Button size="sm" variant="ghost" loading={printing} onClick={handlePrint}>Stampa report</Button>
      {result && (
        <span style={{ fontSize: "var(--text-sm)", color: result.ok ? "var(--color-gray-600)" : "var(--color-danger)" }}>
          {result.msg}
        </span>
      )}
    </div>
  );
}

// ─── Shift selector ─────────────────────────────────────────────────────────────

function formatShiftLabel(shift: Shift): string {
  const opened = new Date(shift.openedAt).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  if (!shift.closedAt) return `${opened} — Aperto`;
  const closed = new Date(shift.closedAt).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return `${opened} → ${closed} — Chiuso`;
}

// ─── Shift tab ────────────────────────────────────────────────────────────────

function ShiftTab() {
  const currentShift = useShiftStore((s) => s.currentShift);
  const [history, setHistory] = useState<Shift[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [stats, setStats] = useState<ShiftFullStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.shifts.history()
      .then((shifts) => {
        setHistory(shifts);
        setSelectedShiftId((prev) => prev ?? currentShift?.id ?? shifts[0]?.id ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedShiftId) return;
    setLoading(true);
    setError(null);
    apiClient.stats.shiftFull(selectedShiftId)
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedShiftId]);

  if (history.length === 0 && !currentShift) {
    return (
      <div style={{ textAlign: "center", padding: "var(--sp-xl)", color: "var(--color-gray-400)" }}>
        Nessun turno disponibile
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-lg)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--sp-md)" }}>
        <select
          value={selectedShiftId ?? ""}
          onChange={(e) => setSelectedShiftId(e.target.value)}
          style={{ height: "36px", padding: "0 10px", borderRadius: "var(--radius-md)", border: "2px solid var(--color-gray-200)", fontFamily: "var(--font)", fontSize: "var(--text-sm)" }}
        >
          {history.map((s) => (
            <option key={s.id} value={s.id}>{formatShiftLabel(s)}</option>
          ))}
        </select>
        {selectedShiftId && <PrintReportButton shiftId={selectedShiftId} />}
      </div>

      {loading && <Spinner />}
      {error && <ErrorBox msg={error} />}
      {!loading && !error && stats && (
        <>
          <div style={{ display: "flex", gap: "var(--sp-md)", flexWrap: "wrap" }}>
            <KpiCard label="Totale generale" value={fmt(stats.summary.totalSales)} />
            <KpiCard label="Ordini" value={String(stats.summary.totalOrders)} />
            <KpiCard label="Scontrino medio" value={fmt(stats.summary.avgTicket)} />
            <KpiCard label="Netto" value={fmt(stats.summary.netSales)} />
            {stats.summary.totalSalesExcluded > 0 && (
              <KpiCard label="Escluso dal totale" value={fmt(stats.summary.totalSalesExcluded)} />
            )}
          </div>

          {stats.byHour.some((h) => h.orders > 0) && (
            <Section title="Per fascia oraria">
              <DistributionBarChart data={stats.byHour.map((h) => ({ label: `${String(h.hour).padStart(2, "0")}h`, value: h.amount }))} />
            </Section>
          )}

          {stats.byCategory.length > 0 && (
            <Section title="Per categoria">
              <DistributionPieChart data={stats.byCategory.map((c) => ({ label: c.categoryName, value: c.amount }))} />
            </Section>
          )}

          {stats.byProductionCenter.length > 0 && (
            <Section title="Per centro di produzione">
              <DistributionPieChart data={stats.byProductionCenter.map((c) => ({ label: c.centerName, value: c.amount }))} />
            </Section>
          )}

          {stats.byPaymentMethod.some((p) => !p.excludeFromTotal) && (
            <Section title="Per metodo di pagamento">
              <DistributionBarChart data={stats.byPaymentMethod.filter((p) => !p.excludeFromTotal).map((p) => ({ label: p.method, value: p.amount }))} />
            </Section>
          )}

          {stats.byPaymentMethod.some((p) => p.excludeFromTotal) && (
            <Section title="Metodi esclusi dal totale generale">
              <DistributionBarChart data={stats.byPaymentMethod.filter((p) => p.excludeFromTotal).map((p) => ({ label: p.method, value: p.amount }))} />
              <div style={{ marginTop: "var(--sp-sm)", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-600)" }}>
                Subtotale escluso: {fmt(stats.byPaymentMethod.filter((p) => p.excludeFromTotal).reduce((s, p) => s + p.amount, 0))}
              </div>
            </Section>
          )}

          {stats.byTerminal.length > 1 && (
            <Section title="Per terminale">
              <DistributionBarChart data={stats.byTerminal.map((t) => ({ label: t.terminalName, value: t.amount }))} />
            </Section>
          )}

          {stats.topProducts.length > 0 && (
            <Section title="Top prodotti">
              <DistributionBarChart data={stats.topProducts.map((p) => ({ label: p.name, value: p.amount }))} />
            </Section>
          )}
        </>
      )}
    </div>
  );
}

// ─── Period tab ───────────────────────────────────────────────────────────────

type Preset = "today" | "week" | "month" | "custom";

function PeriodTab() {
  const [preset, setPreset] = useState<Preset>("today");
  const [customFrom, setCustomFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [stats, setStats] = useState<PeriodStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function getRangeMs(): [number, number] {
    if (preset === "custom") {
      return [new Date(customFrom).getTime(), new Date(customTo + "T23:59:59").getTime()];
    }
    const from = startOf(preset as "today" | "week" | "month").getTime();
    const to = Date.now();
    return [from, to];
  }

  function load() {
    const [from, to] = getRangeMs();
    setLoading(true);
    setError(null);
    apiClient.stats.period(from, to)
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [preset, customFrom, customTo]);

  function handleExportCsv() {
    if (!stats) return;
    const rows: (string | number)[][] = [
      ["KPI", ""],
      ["Totale vendite", stats.totalSales.toFixed(2)],
      ["Ordini", stats.totalOrders],
      ["Scontrino medio", stats.avgTicket.toFixed(2)],
      ["", ""],
      ["Per categoria", ""],
      ...stats.byCategory.map((c) => [c.categoryName, c.amount.toFixed(2)]),
      ["", ""],
      ["Per giorno", ""],
      ...stats.byDay.map((d) => [d.date, d.sales.toFixed(2)]),
    ];
    downloadCsv(`statistiche-periodo-${new Date().toISOString().slice(0, 10)}.csv`, ["Voce", "Valore"], rows);
  }

  const presets: { key: Preset; label: string }[] = [
    { key: "today", label: "Oggi" },
    { key: "week", label: "Settimana" },
    { key: "month", label: "Mese" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-lg)" }}>
      <div style={{ display: "flex", gap: "var(--sp-sm)", flexWrap: "wrap", alignItems: "center" }}>
        {presets.map((p) => (
          <Button
            key={p.key}
            size="sm"
            variant={preset === p.key ? "primary" : "ghost"}
            onClick={() => setPreset(p.key)}
          >
            {p.label}
          </Button>
        ))}
        {preset === "custom" && (
          <>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
              style={{ height: "36px", padding: "0 10px", borderRadius: "var(--radius-md)", border: "2px solid var(--color-gray-200)", fontFamily: "var(--font)", fontSize: "var(--text-sm)" }} />
            <span style={{ color: "var(--color-gray-400)" }}>→</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
              style={{ height: "36px", padding: "0 10px", borderRadius: "var(--radius-md)", border: "2px solid var(--color-gray-200)", fontFamily: "var(--font)", fontSize: "var(--text-sm)" }} />
          </>
        )}
      </div>

      {loading && <Spinner />}
      {error && <ErrorBox msg={error} />}
      {!loading && !error && stats && (
        <>
          <div style={{ display: "flex", gap: "var(--sp-md)", flexWrap: "wrap", alignItems: "center" }}>
            <KpiCard label="Totale vendite" value={fmt(stats.totalSales)} />
            <KpiCard label="Ordini" value={String(stats.totalOrders)} />
            <KpiCard label="Scontrino medio" value={fmt(stats.avgTicket)} />
            <Button size="sm" variant="ghost" onClick={handleExportCsv}>Esporta CSV</Button>
          </div>
          {stats.byCategory.length > 0 && (
            <Section title="Per categoria">
              <DistributionPieChart data={stats.byCategory.map((c) => ({ label: c.categoryName, value: c.amount }))} />
            </Section>
          )}
          {stats.byDay.length > 0 && (
            <Section title="Per giorno">
              <DistributionBarChart data={stats.byDay.map((d) => ({ label: d.date.slice(5), value: d.sales }))} />
            </Section>
          )}
        </>
      )}
    </div>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "var(--sp-xl)" }}>
      <span style={{ width: "32px", height: "32px", border: "3px solid var(--color-gray-200)", borderTopColor: "var(--color-brand)", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{ padding: "var(--sp-md)", background: "#fef2f2", borderRadius: "var(--radius-lg)", color: "var(--color-danger)", fontSize: "var(--text-sm)" }}>
      {msg}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

type Tab = "shift" | "period";

export function StatsScreen() {
  const [tab, setTab] = useState<Tab>("shift");

  const tabs: { key: Tab; label: string }[] = [
    { key: "shift", label: "Turno" },
    { key: "period", label: "Periodo" },
  ];

  return (
    <PosLayout>
      <div
        className="scrollable"
        style={{ height: "100%", overflowY: "auto", boxSizing: "border-box", maxWidth: "720px", margin: "0 auto", padding: "var(--sp-lg)", display: "flex", flexDirection: "column", gap: "var(--sp-lg)" }}
      >
        <h1 style={{ fontSize: "var(--text-xxl)", fontWeight: 700, color: "var(--color-gray-900)", margin: 0 }}>
          Statistiche
        </h1>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "4px", background: "var(--color-gray-100)", borderRadius: "var(--radius-lg)", padding: "4px", width: "fit-content" }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "8px 20px",
                borderRadius: "var(--radius-md)",
                border: "none",
                fontFamily: "var(--font)",
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                cursor: "pointer",
                background: tab === t.key ? "var(--color-white)" : "transparent",
                color: tab === t.key ? "var(--color-brand)" : "var(--color-gray-500)",
                boxShadow: tab === t.key ? "var(--shadow-sm)" : "none",
                transition: "var(--transition)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "shift" ? <ShiftTab /> : <PeriodTab />}
      </div>
    </PosLayout>
  );
}
