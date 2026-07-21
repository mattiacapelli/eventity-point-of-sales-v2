import React, { useState, useEffect } from "react";
import { PosLayout } from "../../layout/PosLayout.js";
import { Button } from "../../components/ui/Button.js";
import { useShiftStore } from "../../state/shift-store.js";
import { useTerminalStore } from "../../state/terminal-store.js";
import { apiClient, type ShiftFullStats, type PeriodStats } from "../../core/api-client.js";
import { adminApi } from "../../core/admin-api.js";
import { downloadCsv } from "../../core/csv-export.js";
import type { Shift } from "@pos/shared-types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) { return `€${n.toFixed(2)}`; }

function pct(part: number, total: number) {
  if (total === 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function startOf(period: "today" | "week" | "month"): Date {
  const d = new Date();
  if (period === "today") { d.setHours(0, 0, 0, 0); return d; }
  if (period === "week") {
    const diff = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - diff); d.setHours(0, 0, 0, 0); return d;
  }
  d.setDate(1); d.setHours(0, 0, 0, 0); return d;
}

function formatShiftLabel(shift: Shift): string {
  const opened = new Date(shift.openedAt).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  if (!shift.closedAt) return `${opened} — Aperto`;
  const closed = new Date(shift.closedAt).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return `${opened} → ${closed}`;
}

// ─── Palette per metodi/terminali ────────────────────────────────────────────

const PALETTE = ["#6366f1","#f59e0b","#10b981","#ef4444","#3b82f6","#ec4899","#8b5cf6","#06b6d4","#84cc16","#f97316"];

// ─── Blocchi UI riusabili ─────────────────────────────────────────────────────

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

// KPI grande — headline number con label
function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string | undefined }) {
  return (
    <div style={{
      background: "var(--color-white)",
      border: "1px solid var(--color-gray-100)",
      borderRadius: "var(--radius-xl)",
      padding: "var(--sp-md) var(--sp-lg)",
      display: "flex",
      flexDirection: "column",
      gap: "2px",
      flex: "1 1 140px",
      minWidth: 0,
    }}>
      <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div style={{ fontSize: "var(--text-xxl)", fontWeight: 700, color: "var(--color-brand)", lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", marginTop: "2px" }}>{sub}</div>
      )}
    </div>
  );
}

// Card generica con titolo
function Card({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "var(--color-white)",
      border: "1px solid var(--color-gray-100)",
      borderRadius: "var(--radius-xl)",
      padding: "var(--sp-lg)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--sp-md)",
      minWidth: 0,
      ...style,
    }}>
      <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// Riga con barra percentuale — usata per categorie, prodotti, ecc.
function BarRow({
  label, value, count, total, color = "var(--color-brand)",
}: {
  label: string; value: number; count?: number; total: number; color?: string;
}) {
  const p = total > 0 ? (value / total) * 100 : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "var(--sp-sm)" }}>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-700)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
          {label}
        </span>
        <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-gray-900)", whiteSpace: "nowrap" }}>
          {fmt(value)}
        </span>
        {count !== undefined && (
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", whiteSpace: "nowrap", minWidth: "28px", textAlign: "right" }}>
            ×{count}
          </span>
        )}
        <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", minWidth: "36px", textAlign: "right" }}>
          {pct(value, total)}
        </span>
      </div>
      <div style={{ height: "5px", borderRadius: "3px", background: "var(--color-gray-100)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${p}%`, background: color, borderRadius: "3px", transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

// Tabella oraria — 24 celle compatte
function HourGrid({ data }: { data: { hour: number; orders: number; amount: number }[] }) {
  const maxAmt = Math.max(...data.map((h) => h.amount), 1);
  const active = data.filter((h) => h.orders > 0);
  if (active.length === 0) return <span style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-400)" }}>Nessun dato</span>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "4px" }}>
      {data.map((h) => {
        const intensity = h.amount / maxAmt;
        const bg = h.orders > 0
          ? `rgba(99,102,241,${0.12 + intensity * 0.88})`
          : "var(--color-gray-50)";
        const textColor = intensity > 0.55 ? "white" : h.orders > 0 ? "#4338ca" : "var(--color-gray-300)";
        return (
          <div
            key={h.hour}
            title={h.orders > 0 ? `${String(h.hour).padStart(2,"0")}:00 — ${h.orders} ordini — ${fmt(h.amount)}` : `${String(h.hour).padStart(2,"0")}:00`}
            style={{
              background: bg,
              borderRadius: "6px",
              padding: "6px 2px",
              textAlign: "center",
              cursor: h.orders > 0 ? "default" : undefined,
            }}
          >
            <div style={{ fontSize: "10px", fontWeight: 600, color: textColor }}>
              {String(h.hour).padStart(2, "0")}
            </div>
            {h.orders > 0 && (
              <div style={{ fontSize: "9px", color: textColor, opacity: 0.85, marginTop: "1px" }}>
                {fmt(h.amount)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Tabella metodi pagamento per terminale
function TerminalPaymentMatrix({
  byTerminal,
}: {
  byTerminal: ShiftFullStats["byTerminal"];
}) {
  if (byTerminal.length === 0) return null;

  // Raccogli tutti i metodi distinti
  const methods = Array.from(new Set(byTerminal.flatMap((t) => t.byMethod.map((m) => m.method))));

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "6px 10px", color: "var(--color-gray-500)", fontWeight: 700, fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid var(--color-gray-100)" }}>
              Cassa
            </th>
            <th style={{ textAlign: "right", padding: "6px 10px", color: "var(--color-gray-500)", fontWeight: 700, fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid var(--color-gray-100)" }}>
              Ordini
            </th>
            <th style={{ textAlign: "right", padding: "6px 10px", color: "var(--color-gray-500)", fontWeight: 700, fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid var(--color-gray-100)" }}>
              Totale
            </th>
            {methods.map((m) => (
              <th key={m} style={{ textAlign: "right", padding: "6px 10px", color: "var(--color-gray-500)", fontWeight: 700, fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid var(--color-gray-100)", whiteSpace: "nowrap" }}>
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {byTerminal.map((t, ti) => (
            <tr key={t.terminalName} style={{ borderBottom: "1px solid var(--color-gray-50)" }}>
              <td style={{ padding: "8px 10px", fontWeight: 600, color: "var(--color-gray-800)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: PALETTE[ti % PALETTE.length], flexShrink: 0 }} />
                  {t.terminalName}
                </span>
              </td>
              <td style={{ padding: "8px 10px", textAlign: "right", color: "var(--color-gray-600)" }}>{t.count}</td>
              <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "var(--color-gray-900)" }}>{fmt(t.amount)}</td>
              {methods.map((m) => {
                const entry = t.byMethod.find((x) => x.method === m);
                return (
                  <td key={m} style={{ padding: "8px 10px", textAlign: "right", color: entry ? "var(--color-gray-700)" : "var(--color-gray-300)" }}>
                    {entry ? fmt(entry.amount) : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
          {/* Riga totali */}
          <tr style={{ borderTop: "2px solid var(--color-gray-100)", background: "var(--color-gray-50)" }}>
            <td style={{ padding: "8px 10px", fontWeight: 700, color: "var(--color-gray-700)", fontSize: "var(--text-xs)", textTransform: "uppercase" }}>Totale</td>
            <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "var(--color-gray-800)" }}>
              {byTerminal.reduce((s, t) => s + t.count, 0)}
            </td>
            <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "var(--color-brand)" }}>
              {fmt(byTerminal.reduce((s, t) => s + t.amount, 0))}
            </td>
            {methods.map((m) => {
              const total = byTerminal.reduce((s, t) => s + (t.byMethod.find((x) => x.method === m)?.amount ?? 0), 0);
              return (
                <td key={m} style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "var(--color-gray-800)" }}>
                  {total > 0 ? fmt(total) : "—"}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// Tabella prodotti completa con ricerca
function ProductsTable({ products }: { products: { name: string; quantity: number; amount: number }[] }) {
  const [search, setSearch] = useState("");
  const total = products.reduce((s, p) => s + p.amount, 0);
  const sorted = products.slice().sort((a, b) => b.amount - a.amount);
  const filtered = search.trim()
    ? sorted.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    : sorted;

  if (products.length === 0) return (
    <span style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-400)" }}>Nessun dato</span>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-sm)" }}>
      <input
        type="search"
        placeholder="Cerca prodotto…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          height: "36px", padding: "0 12px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-gray-200)",
          fontFamily: "var(--font)", fontSize: "var(--text-sm)",
          background: "var(--color-gray-50)", color: "var(--color-gray-900)",
          width: "100%", boxSizing: "border-box",
        }}
      />
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px 10px", color: "var(--color-gray-500)", fontWeight: 700, fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid var(--color-gray-100)" }}>
                Prodotto
              </th>
              <th style={{ textAlign: "right", padding: "6px 10px", color: "var(--color-gray-500)", fontWeight: 700, fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid var(--color-gray-100)" }}>
                Pz
              </th>
              <th style={{ textAlign: "right", padding: "6px 10px", color: "var(--color-gray-500)", fontWeight: 700, fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid var(--color-gray-100)" }}>
                Totale
              </th>
              <th style={{ textAlign: "right", padding: "6px 10px", color: "var(--color-gray-500)", fontWeight: 700, fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid var(--color-gray-100)" }}>
                % su vendite
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.name} style={{ borderBottom: "1px solid var(--color-gray-50)" }}>
                <td style={{ padding: "7px 10px", color: "var(--color-gray-800)", fontWeight: 500 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", minWidth: "20px" }}>#{i + 1}</span>
                    {p.name}
                  </span>
                </td>
                <td style={{ padding: "7px 10px", textAlign: "right", color: "var(--color-gray-600)" }}>{p.quantity}</td>
                <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, color: "var(--color-gray-900)" }}>{fmt(p.amount)}</td>
                <td style={{ padding: "7px 10px", textAlign: "right" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "flex-end" }}>
                    <div style={{ width: "48px", height: "4px", borderRadius: "2px", background: "var(--color-gray-100)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: pct(p.amount, total), background: "var(--color-brand)", borderRadius: "2px" }} />
                    </div>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-500)", minWidth: "32px", textAlign: "right" }}>
                      {pct(p.amount, total)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid var(--color-gray-100)", background: "var(--color-gray-50)" }}>
              <td style={{ padding: "7px 10px", fontWeight: 700, color: "var(--color-gray-700)", fontSize: "var(--text-xs)", textTransform: "uppercase" }}>
                Totale {filtered.length} prodotti
              </td>
              <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, color: "var(--color-gray-800)" }}>
                {filtered.reduce((s, p) => s + p.quantity, 0)}
              </td>
              <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, color: "var(--color-brand)" }}>
                {fmt(filtered.reduce((s, p) => s + p.amount, 0))}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// Card espansa per ogni cassa — visibile solo con "tutte le casse"
function TerminalSplitCard({ byTerminal, totalSales }: {
  byTerminal: ShiftFullStats["byTerminal"];
  totalSales: number;
}) {
  if (byTerminal.length === 0) return null;
  const grandTotal = byTerminal.reduce((s, t) => s + t.amount, 0);
  const grandOrders = byTerminal.reduce((s, t) => s + t.count, 0);

  return (
    <Card title={`Riepilogo per cassa (${byTerminal.length})`}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--sp-lg)" }}>
        {byTerminal.slice().sort((a, b) => b.amount - a.amount).map((t, ti) => {
          const color = PALETTE[ti % PALETTE.length];
          const avgTicket = t.count > 0 ? t.amount / t.count : 0;
          const share = grandTotal > 0 ? (t.amount / grandTotal) * 100 : 0;
          const methodsSorted = t.byMethod.slice().sort((a, b) => b.amount - a.amount);

          return (
            <div key={t.terminalName} style={{
              border: "1px solid var(--color-gray-100)",
              borderRadius: "var(--radius-lg)",
              overflow: "hidden",
            }}>
              {/* Header cassa */}
              <div style={{
                background: color,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <span style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "white" }}>
                  {t.terminalName}
                </span>
                <span style={{ fontSize: "var(--text-xs)", color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>
                  {Math.round(share)}% del totale
                </span>
              </div>

              {/* KPI mini */}
              <div style={{ display: "flex", borderBottom: "1px solid var(--color-gray-50)" }}>
                {[
                  { label: "Totale", value: fmt(t.amount) },
                  { label: "Ordini", value: String(t.count) },
                  { label: "Medio", value: fmt(avgTicket) },
                ].map((kpi) => (
                  <div key={kpi.label} style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRight: "1px solid var(--color-gray-50)",
                    textAlign: "center",
                  }}>
                    <div style={{ fontSize: "9px", fontWeight: 700, color: "var(--color-gray-400)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {kpi.label}
                    </div>
                    <div style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--color-gray-900)", marginTop: "2px" }}>
                      {kpi.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Barra quota su totale globale */}
              <div style={{ padding: "8px 14px 4px", display: "flex", flexDirection: "column", gap: "3px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--color-gray-400)", fontWeight: 600 }}>
                  <span>Quota vendite</span>
                  <span>{pct(t.amount, totalSales)}</span>
                </div>
                <div style={{ height: "6px", borderRadius: "3px", background: "var(--color-gray-100)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(t.amount / Math.max(totalSales, 1)) * 100}%`, background: color, borderRadius: "3px" }} />
                </div>
              </div>

              {/* Metodi pagamento */}
              {methodsSorted.length > 0 && (
                <div style={{ padding: "8px 14px 12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--color-gray-400)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>
                    Metodi
                  </div>
                  {methodsSorted.map((m) => (
                    <div key={m.method} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ flex: 1, height: "4px", borderRadius: "2px", background: "var(--color-gray-100)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${t.amount > 0 ? (m.amount / t.amount) * 100 : 0}%`, background: color, opacity: 0.65, borderRadius: "2px" }} />
                      </div>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-600)", minWidth: "72px" }}>{m.method}</span>
                      <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-800)", minWidth: "56px", textAlign: "right" }}>{fmt(m.amount)}</span>
                      <span style={{ fontSize: "10px", color: "var(--color-gray-400)", minWidth: "30px", textAlign: "right" }}>×{m.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer totale */}
      <div style={{
        borderTop: "1px solid var(--color-gray-100)",
        paddingTop: "var(--sp-md)",
        display: "flex",
        gap: "var(--sp-lg)",
        flexWrap: "wrap",
      }}>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)" }}>
          Totale globale: <strong style={{ color: "var(--color-brand)" }}>{fmt(grandTotal)}</strong>
        </span>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)" }}>
          Ordini totali: <strong style={{ color: "var(--color-gray-800)" }}>{grandOrders}</strong>
        </span>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)" }}>
          Scontrino medio globale: <strong style={{ color: "var(--color-gray-800)" }}>{fmt(grandOrders > 0 ? grandTotal / grandOrders : 0)}</strong>
        </span>
      </div>
    </Card>
  );
}

// Print report button
function PrintReportButton({ shiftId }: { shiftId: number }) {
  const [printing, setPrinting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  function handlePrint() {
    setPrinting(true); setResult(null);
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

function PdfShiftButton({ shiftId, terminalId }: { shiftId: number; terminalId?: number | undefined }) {
  const [loading, setPdfLoading] = useState(false);

  async function handlePdf() {
    setPdfLoading(true);
    try {
      const res = await apiClient.stats.pdfShift(shiftId, terminalId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `report-turno-${shiftId}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      // silently ignore
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <Button size="sm" variant="ghost" loading={loading} onClick={() => { void handlePdf(); }}>
      Esporta PDF
    </Button>
  );
}

function PdfPeriodButton({ from, to, terminalId }: { from: number; to: number; terminalId?: number | undefined }) {
  const [loading, setPdfLoading] = useState(false);

  async function handlePdf() {
    setPdfLoading(true);
    try {
      const res = await apiClient.stats.pdfPeriod(from, to, terminalId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `report-periodo-${new Date(from).toISOString().slice(0, 10)}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      // silently ignore
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <Button size="sm" variant="ghost" loading={loading} onClick={() => { void handlePdf(); }}>
      Esporta PDF
    </Button>
  );
}

// ─── Shift tab ────────────────────────────────────────────────────────────────

function ShiftTab({ terminalId }: { terminalId: number | null }) {
  const currentShift = useShiftStore((s) => s.currentShift);
  const [history, setHistory] = useState<Shift[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);
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
    setLoading(true); setError(null);
    apiClient.stats.shiftFull(selectedShiftId, terminalId ?? undefined)
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedShiftId, terminalId]);

  if (history.length === 0 && !currentShift) {
    return <div style={{ textAlign: "center", padding: "var(--sp-xl)", color: "var(--color-gray-400)" }}>Nessun turno disponibile</div>;
  }

  const s = stats;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-lg)" }}>
      {/* Selettore turno */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--sp-md)" }}>
        <select
          value={selectedShiftId ?? ""}
          onChange={(e) => setSelectedShiftId(e.target.value ? parseInt(e.target.value, 10) : null)}
          style={{ height: "36px", padding: "0 10px", borderRadius: "var(--radius-md)", border: "2px solid var(--color-gray-200)", fontFamily: "var(--font)", fontSize: "var(--text-sm)", minWidth: "240px" }}
        >
          {history.map((sh) => (
            <option key={sh.id} value={sh.id}>{formatShiftLabel(sh)}</option>
          ))}
        </select>
        {selectedShiftId && (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-md)" }}>
            <PrintReportButton shiftId={selectedShiftId} />
            <PdfShiftButton shiftId={selectedShiftId} terminalId={terminalId ?? undefined} />
          </div>
        )}
      </div>

      {loading && <Spinner />}
      {error && <ErrorBox msg={error} />}

      {!loading && !error && s && (
        <>
          {/* ── KPI strip ── */}
          <div style={{ display: "flex", gap: "var(--sp-md)", flexWrap: "wrap" }}>
            <KpiCard label="Totale vendite" value={fmt(s.summary.totalSales)} />
            <KpiCard label="Ordini" value={String(s.summary.totalOrders)} sub={s.summary.cancelledOrders > 0 ? `${s.summary.cancelledOrders} annullati` : undefined} />
            <KpiCard label="Scontrino medio" value={fmt(s.summary.avgTicket)} />
            <KpiCard label="Netto" value={fmt(s.summary.netSales)} />
            {s.summary.refundTotal > 0 && <KpiCard label="Storni" value={fmt(s.summary.refundTotal)} />}
            {s.summary.totalSalesExcluded > 0 && <KpiCard label="Escluso da totale" value={fmt(s.summary.totalSalesExcluded)} />}
          </div>

          {/* ── Card casse (solo quando non è filtrato per una cassa specifica) ── */}
          {terminalId === null && s.byTerminal.length > 0 && (
            <TerminalSplitCard byTerminal={s.byTerminal} totalSales={s.summary.totalSales} />
          )}

          {/* ── Layout a 2 colonne (collapse su schermi stretti) ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "var(--sp-lg)" }}>

            {/* Metodi di pagamento */}
            {s.byPaymentMethod.length > 0 && (
              <Card title="Metodi di pagamento">
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {s.byPaymentMethod.filter((p) => !p.excludeFromTotal).map((p, i) => (
                    <BarRow
                      key={p.method}
                      label={p.method}
                      value={p.amount}
                      count={p.count}
                      total={s.summary.totalSales}
                      color={PALETTE[i % PALETTE.length]}
                    />
                  ))}
                  {s.byPaymentMethod.some((p) => p.excludeFromTotal) && (
                    <>
                      <div style={{ borderTop: "1px dashed var(--color-gray-200)", paddingTop: "8px", fontSize: "var(--text-xs)", color: "var(--color-gray-400)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Esclusi dal totale
                      </div>
                      {s.byPaymentMethod.filter((p) => p.excludeFromTotal).map((p, i) => (
                        <BarRow
                          key={p.method}
                          label={p.method}
                          value={p.amount}
                          count={p.count}
                          total={s.byPaymentMethod.filter((x) => x.excludeFromTotal).reduce((acc, x) => acc + x.amount, 0)}
                          color={PALETTE[(i + 4) % PALETTE.length]}
                        />
                      ))}
                    </>
                  )}
                </div>
              </Card>
            )}

            {/* Categorie */}
            {s.byCategory.length > 0 && (
              <Card title="Per categoria">
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {s.byCategory.slice().sort((a, b) => b.amount - a.amount).map((c, i) => (
                    <BarRow
                      key={c.categoryName}
                      label={c.categoryName}
                      value={c.amount}
                      count={c.quantity}
                      total={s.summary.totalSales}
                      color={PALETTE[i % PALETTE.length]}
                    />
                  ))}
                </div>
              </Card>
            )}

            {/* Centri di produzione */}
            {s.byProductionCenter.length > 0 && (
              <Card title="Per centro di produzione">
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {s.byProductionCenter.slice().sort((a, b) => b.amount - a.amount).map((c, i) => (
                    <BarRow
                      key={c.centerName}
                      label={c.centerName}
                      value={c.amount}
                      count={c.quantity}
                      total={s.summary.totalSales}
                      color={PALETTE[i % PALETTE.length]}
                    />
                  ))}
                </div>
              </Card>
            )}

            {/* Top 10 prodotti nella colonna */}
            {s.topProducts.length > 0 && (
              <Card title="Top 10 prodotti">
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {s.topProducts.slice(0, 10).map((p, i) => (
                    <BarRow
                      key={p.name}
                      label={p.name}
                      value={p.amount}
                      count={p.quantity}
                      total={s.summary.totalSales}
                      color={PALETTE[i % PALETTE.length]}
                    />
                  ))}
                </div>
              </Card>
            )}

            {/* Fascia oraria — occupa tutta la larghezza */}
            {s.byHour.some((h) => h.orders > 0) && (
              <Card title="Distribuzione oraria" style={{ gridColumn: "1 / -1" }}>
                <HourGrid data={s.byHour} />
              </Card>
            )}

          </div>

          {/* Matrice casse × metodi — full width */}
          {s.byTerminal.length > 1 && (
            <Card title="Ripartizione per cassa e metodo di pagamento">
              <TerminalPaymentMatrix byTerminal={s.byTerminal} />
            </Card>
          )}

          {/* Elenco completo prodotti — full width */}
          {s.topProducts.length > 0 && (
            <Card title={`Tutti i prodotti venduti (${s.topProducts.length})`}>
              <ProductsTable products={s.topProducts} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─── Period tab ───────────────────────────────────────────────────────────────

type Preset = "today" | "week" | "month" | "custom";

function PeriodTab({ terminalId }: { terminalId: number | null }) {
  const [preset, setPreset] = useState<Preset>("today");
  const [customFrom, setCustomFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [stats, setStats] = useState<PeriodStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function getRangeMs(): [number, number] {
    if (preset === "custom") return [new Date(customFrom).getTime(), new Date(customTo + "T23:59:59").getTime()];
    return [startOf(preset as "today" | "week" | "month").getTime(), Date.now()];
  }

  function load() {
    const [from, to] = getRangeMs();
    setLoading(true); setError(null);
    apiClient.stats.period(from, to, terminalId ?? undefined)
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [preset, customFrom, customTo, terminalId]);

  function handleExportCsv() {
    if (!stats) return;
    const s = stats.summary;
    downloadCsv(
      `statistiche-periodo-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Voce", "Valore"],
      [
        ["Totale vendite", s.totalSales.toFixed(2)],
        ["Netto", s.netSales.toFixed(2)],
        ["Ordini", s.totalOrders],
        ["Annullati", s.cancelledOrders],
        ["Scontrino medio", s.avgTicket.toFixed(2)],
        ["Storni", s.refundTotal.toFixed(2)],
        ["", ""],
        ...stats.byPaymentMethod.map((p) => [p.method, p.amount.toFixed(2)]),
        ["", ""],
        ...stats.byCategory.map((c) => [c.categoryName, c.amount.toFixed(2)]),
        ["", ""],
        ...stats.byDay.map((d) => [`${d.date} (${d.orders} ordini)`, d.sales.toFixed(2)]),
        ["", ""],
        ...stats.topProducts.map((p, i) => [`#${i + 1} ${p.name} x${p.quantity}`, p.amount.toFixed(2)]),
      ],
    );
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
          <Button key={p.key} size="sm" variant={preset === p.key ? "primary" : "ghost"} onClick={() => setPreset(p.key)}>
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

      {!loading && !error && stats && (() => {
        const s = stats.summary;
        return (
          <>
            {/* ── KPI strip ── */}
            <div style={{ display: "flex", gap: "var(--sp-md)", flexWrap: "wrap", alignItems: "center" }}>
              <KpiCard label="Totale vendite" value={fmt(s.totalSales)} />
              <KpiCard label="Ordini" value={String(s.totalOrders)} sub={s.cancelledOrders > 0 ? `${s.cancelledOrders} annullati` : undefined} />
              <KpiCard label="Scontrino medio" value={fmt(s.avgTicket)} />
              <KpiCard label="Netto" value={fmt(s.netSales)} />
              {s.refundTotal > 0 && <KpiCard label="Storni" value={fmt(s.refundTotal)} />}
              {s.totalSalesExcluded > 0 && <KpiCard label="Escluso da totale" value={fmt(s.totalSalesExcluded)} />}
              <div style={{ marginLeft: "auto", display: "flex", gap: "var(--sp-sm)" }}>
                <Button size="sm" variant="ghost" onClick={handleExportCsv}>Esporta CSV</Button>
                <PdfPeriodButton from={getRangeMs()[0]} to={getRangeMs()[1]} terminalId={terminalId ?? undefined} />
              </div>
            </div>

            {/* ── Card casse (solo quando non filtrato per cassa specifica) ── */}
            {terminalId === null && stats.byTerminal.length > 0 && (
              <TerminalSplitCard byTerminal={stats.byTerminal} totalSales={s.totalSales} />
            )}

            {/* ── Grid principale ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "var(--sp-lg)" }}>

              {/* Metodi di pagamento */}
              {stats.byPaymentMethod.length > 0 && (
                <Card title="Metodi di pagamento">
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {stats.byPaymentMethod.filter((p) => !p.excludeFromTotal).map((p, i) => (
                      <BarRow key={p.method} label={p.method} value={p.amount} count={p.count}
                        total={s.totalSales} color={PALETTE[i % PALETTE.length]!} />
                    ))}
                    {stats.byPaymentMethod.some((p) => p.excludeFromTotal) && (
                      <>
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "4px" }}>
                          Esclusi dal totale
                        </div>
                        {stats.byPaymentMethod.filter((p) => p.excludeFromTotal).map((p, i) => (
                          <BarRow key={p.method} label={p.method} value={p.amount} count={p.count}
                            total={stats.byPaymentMethod.filter((x) => x.excludeFromTotal).reduce((sum, x) => sum + x.amount, 0)}
                            color={PALETTE[(i + 4) % PALETTE.length]!} />
                        ))}
                      </>
                    )}
                  </div>
                </Card>
              )}

              {/* Per categoria */}
              {stats.byCategory.length > 0 && (
                <Card title="Per categoria">
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {stats.byCategory.map((c, i) => (
                      <BarRow key={c.categoryName} label={c.categoryName} value={c.amount} count={c.quantity}
                        total={s.totalSales} color={PALETTE[i % PALETTE.length]!} />
                    ))}
                  </div>
                </Card>
              )}

              {/* Centri di produzione */}
              {stats.byProductionCenter.length > 0 && (
                <Card title="Centri di produzione">
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {stats.byProductionCenter.map((c, i) => (
                      <BarRow key={c.centerName} label={c.centerName} value={c.amount} count={c.quantity}
                        total={s.totalSales} color={PALETTE[i % PALETTE.length]!} />
                    ))}
                  </div>
                </Card>
              )}

              {/* Per giorno */}
              {stats.byDay.length > 0 && (
                <Card title="Per giorno">
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {stats.byDay.map((d, i) => (
                      <BarRow key={d.date} label={d.date.slice(5)} value={d.sales} count={d.orders}
                        total={s.totalSales} color={PALETTE[i % PALETTE.length]!} />
                    ))}
                  </div>
                </Card>
              )}

              {/* Distribuzione oraria */}
              {stats.byHour.some((h) => h.orders > 0) && (
                <Card title="Distribuzione oraria">
                  <HourGrid data={stats.byHour} />
                </Card>
              )}
            </div>

            {/* ── Matrice casse × metodi (se multi-terminal) ── */}
            {stats.byTerminal.length > 1 && (
              <TerminalPaymentMatrix byTerminal={stats.byTerminal} />
            )}

            {/* ── Tutti i prodotti ── */}
            {stats.topProducts.length > 0 && (
              <ProductsTable products={stats.topProducts} />
            )}
          </>
        );
      })()}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

type Tab = "shift" | "period";

export function StatsScreen() {
  const [tab, setTab] = useState<Tab>("shift");
  const [terminals, setTerminals] = useState<{ id: number; name: string }[]>([]);
  const [selectedTerminalId, setSelectedTerminalId] = useState<number | null>(
    () => useTerminalStore.getState().terminalId,
  );

  useEffect(() => {
    adminApi.terminals.list()
      .then((list) => setTerminals(list.map((t) => ({ id: t.id, name: t.name }))))
      .catch(() => {});
  }, []);

  const tabs: { key: Tab; label: string }[] = [
    { key: "shift", label: "Turno" },
    { key: "period", label: "Periodo" },
  ];

  return (
    <PosLayout>
      <div
        className="scrollable"
        style={{ height: "100%", overflowY: "auto", boxSizing: "border-box" }}
      >
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "var(--sp-lg)", display: "flex", flexDirection: "column", gap: "var(--sp-lg)" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--sp-md)" }}>
            <h1 style={{ fontSize: "var(--text-xxl)", fontWeight: 700, color: "var(--color-gray-900)", margin: 0 }}>
              Statistiche
            </h1>
            {terminals.length > 1 && (
              <select
                value={selectedTerminalId ?? ""}
                onChange={(e) => setSelectedTerminalId(e.target.value ? parseInt(e.target.value, 10) : null)}
                style={{ height: "36px", padding: "0 10px", borderRadius: "var(--radius-md)", border: "2px solid var(--color-gray-200)", fontFamily: "var(--font)", fontSize: "var(--text-sm)", minWidth: "160px" }}
              >
                <option value="">Tutti i terminali</option>
                {terminals.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: "4px", background: "var(--color-gray-100)", borderRadius: "var(--radius-lg)", padding: "4px", width: "fit-content" }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  padding: "8px 20px", borderRadius: "var(--radius-md)", border: "none",
                  fontFamily: "var(--font)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer",
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

          {tab === "shift" ? <ShiftTab terminalId={selectedTerminalId} /> : <PeriodTab terminalId={selectedTerminalId} />}
        </div>
      </div>
    </PosLayout>
  );
}
