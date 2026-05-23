import React, { useState, useEffect } from "react";
import { PosLayout } from "../../layout/PosLayout.js";
import { Button } from "../../components/ui/Button.js";
import { useShiftStore } from "../../state/shift-store.js";
import { apiClient } from "../../core/api-client.js";

// ─── Types ────────────────────────────────────────────────────────────────────

type ShiftStats = {
  totalSales: number;
  totalOrders: number;
  avgTicket: number;
  byPaymentMethod: { method: string; amount: number }[];
  byCategory: { categoryName: string; amount: number }[];
};

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

// ─── Pie chart (SVG) ─────────────────────────────────────────────────────────

const PIE_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#ec4899", "#8b5cf6"];

function PieChart({ data }: { data: { label: string; value: number }[] }) {
  if (data.length === 0) return <EmptyChart />;
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <EmptyChart />;

  let topN = data.slice().sort((a, b) => b.value - a.value);
  let slices = topN;
  if (topN.length > 6) {
    const rest = topN.slice(6).reduce((s, d) => s + d.value, 0);
    slices = [...topN.slice(0, 6), { label: "Altri", value: rest }];
  }

  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = 60;

  let paths: React.ReactElement[] = [];
  let startAngle = -Math.PI / 2;
  for (let i = 0; i < slices.length; i++) {
    const pct = slices[i].value / total;
    const angle = pct * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const large = angle > Math.PI ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    paths.push(<path key={i} d={d} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="white" strokeWidth="2" />);
    startAngle = endAngle;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-lg)", flexWrap: "wrap" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        {paths}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "var(--text-sm)" }}>
            <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
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

function EmptyChart() {
  return <span style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-400)" }}>Nessun dato</span>;
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  if (data.length === 0) return <EmptyChart />;
  const max = Math.max(...data.map((d) => d.value), 0.01);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "var(--sp-sm)", fontSize: "var(--text-sm)" }}>
          <span style={{ width: "80px", flexShrink: 0, color: "var(--color-gray-600)", textAlign: "right", fontSize: "11px" }}>
            {d.label}
          </span>
          <div style={{ flex: 1, height: "20px", background: "var(--color-gray-100)", borderRadius: "4px", overflow: "hidden" }}>
            <div style={{
              width: `${(d.value / max) * 100}%`,
              height: "100%",
              background: "var(--color-brand)",
              borderRadius: "4px",
              transition: "width 0.3s ease",
            }} />
          </div>
          <span style={{ width: "64px", flexShrink: 0, color: "var(--color-gray-700)", fontWeight: 500, fontSize: "11px" }}>
            {fmt(d.value)}
          </span>
        </div>
      ))}
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

// ─── Shift tab ────────────────────────────────────────────────────────────────

function ShiftTab() {
  const currentShift = useShiftStore((s) => s.currentShift);
  const [stats, setStats] = useState<ShiftStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentShift) return;
    setLoading(true);
    apiClient.stats.shift(currentShift.id)
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [currentShift?.id]);

  if (!currentShift) {
    return (
      <div style={{ textAlign: "center", padding: "var(--sp-xl)", color: "var(--color-gray-400)" }}>
        Nessun turno aperto
      </div>
    );
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorBox msg={error} />;
  if (!stats) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-lg)" }}>
      <div style={{ display: "flex", gap: "var(--sp-md)", flexWrap: "wrap" }}>
        <KpiCard label="Totale vendite" value={fmt(stats.totalSales)} />
        <KpiCard label="Ordini" value={String(stats.totalOrders)} />
        <KpiCard label="Scontrino medio" value={fmt(stats.avgTicket)} />
      </div>
      {stats.byCategory.length > 0 && (
        <Section title="Per categoria">
          <PieChart data={stats.byCategory.map((c) => ({ label: c.categoryName, value: c.amount }))} />
        </Section>
      )}
      {stats.byPaymentMethod.length > 0 && (
        <Section title="Per metodo di pagamento">
          <BarChart data={stats.byPaymentMethod.map((p) => ({ label: p.method, value: p.amount }))} />
        </Section>
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
          <div style={{ display: "flex", gap: "var(--sp-md)", flexWrap: "wrap" }}>
            <KpiCard label="Totale vendite" value={fmt(stats.totalSales)} />
            <KpiCard label="Ordini" value={String(stats.totalOrders)} />
            <KpiCard label="Scontrino medio" value={fmt(stats.avgTicket)} />
          </div>
          {stats.byCategory.length > 0 && (
            <Section title="Per categoria">
              <PieChart data={stats.byCategory.map((c) => ({ label: c.categoryName, value: c.amount }))} />
            </Section>
          )}
          {stats.byDay.length > 0 && (
            <Section title="Per giorno">
              <BarChart data={stats.byDay.map((d) => ({ label: d.date.slice(5), value: d.sales }))} />
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
    { key: "shift", label: "Turno corrente" },
    { key: "period", label: "Periodo" },
  ];

  return (
    <PosLayout>
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "var(--sp-lg)", display: "flex", flexDirection: "column", gap: "var(--sp-lg)" }}>
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
