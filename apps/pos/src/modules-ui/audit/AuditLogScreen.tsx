import React, { useState, useEffect, useCallback } from "react";
import { PosLayout } from "../../layout/PosLayout.js";
import { Button } from "../../components/ui/Button.js";
import { adminApi, type AuditEntry } from "../../core/admin-api.js";

// ─── Config ───────────────────────────────────────────────────────────────────

const PAGE_SIZE = 100;

const EVENT_TYPES: { value: string; label: string; color: string; bg: string }[] = [
  { value: "",                  label: "Tutti",              color: "#374151", bg: "#f3f4f6" },
  { value: "order_created",     label: "Ordine creato",      color: "#1d4ed8", bg: "#dbeafe" },
  { value: "order_completed",   label: "Ordine completato",  color: "#065f46", bg: "#d1fae5" },
  { value: "order_cancelled",   label: "Ordine annullato",   color: "#991b1b", bg: "#fee2e2" },
  { value: "payment_completed", label: "Pagamento",          color: "#065f46", bg: "#d1fae5" },
  { value: "payment_refunded",  label: "Rimborso",           color: "#92400e", bg: "#fef3c7" },
  { value: "shift_opened",      label: "Turno aperto",       color: "#5b21b6", bg: "#ede9fe" },
  { value: "shift_closed",      label: "Turno chiuso",       color: "#374151", bg: "#e5e7eb" },
];

const TYPE_META = Object.fromEntries(EVENT_TYPES.filter((t) => t.value).map((t) => [t.value, t]));

const METHOD_LABELS: Record<string, string> = {
  cash: "Contanti",
  card: "Carta",
  digital_wallet: "Digitale",
  tab: "Conto",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTs(ts: number): string {
  return new Date(ts).toLocaleString("it-IT", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function fmtEur(n: unknown): string {
  return typeof n === "number" ? `€${n.toFixed(2)}` : "—";
}

function EventIcon({ type }: { type: AuditEntry["type"] }) {
  const icons: Record<AuditEntry["type"], string> = {
    order_created:     "🛒",
    order_completed:   "✅",
    order_cancelled:   "❌",
    payment_completed: "💳",
    payment_refunded:  "↩️",
    shift_opened:      "🔓",
    shift_closed:      "🔒",
  };
  return <span style={{ fontSize: "16px", lineHeight: 1 }}>{icons[type]}</span>;
}

function TypeBadge({ type }: { type: AuditEntry["type"] }) {
  const meta = TYPE_META[type] ?? { label: type, color: "#374151", bg: "#f3f4f6" };
  return (
    <span style={{
      padding: "2px 8px",
      borderRadius: "999px",
      background: meta.bg,
      color: meta.color,
      fontWeight: 600,
      fontSize: "11px",
      whiteSpace: "nowrap",
    }}>
      {meta.label}
    </span>
  );
}

function MetaCell({ entry }: { entry: AuditEntry }) {
  const m = entry.meta;
  switch (entry.type) {
    case "order_created":
    case "order_completed":
      return (
        <span>
          {m.receiptNumber ? <strong>#{String(m.receiptNumber)}</strong> : <span style={{ color: "#9ca3af" }}>—</span>}
          {" · "}{fmtEur(m.totalAmount)}
        </span>
      );
    case "order_cancelled":
      return <span>{fmtEur(m.totalAmount)}</span>;
    case "payment_completed":
    case "payment_refunded":
      return (
        <span>
          {fmtEur(m.amount)}{" · "}
          <span style={{ color: "#6b7280" }}>{METHOD_LABELS[String(m.method)] ?? String(m.method)}</span>
          {m.reference ? <span style={{ color: "#9ca3af" }}> · {String(m.reference)}</span> : null}
        </span>
      );
    case "shift_opened":
      return <span>Cassa iniziale {fmtEur(m.openingCash)}</span>;
    case "shift_closed":
      return (
        <span>
          {fmtEur(m.totalSales)} · {String(m.totalOrders)} ordini
          {m.notes ? <span style={{ color: "#9ca3af" }}> · {String(m.notes)}</span> : null}
        </span>
      );
    default:
      return null;
  }
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function AuditRow({ entry, isEven }: { entry: AuditEntry; isEven: boolean }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "28px 160px 1fr 1fr auto",
      alignItems: "center",
      gap: "12px",
      padding: "10px 16px",
      background: isEven ? "var(--color-white)" : "#f9fafb",
      borderBottom: "1px solid var(--color-gray-100)",
      fontSize: "var(--text-sm)",
    }}>
      <EventIcon type={entry.type} />

      <span style={{ color: "#6b7280", fontSize: "12px", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
        {fmtTs(entry.ts)}
      </span>

      <TypeBadge type={entry.type} />

      <span style={{ color: "var(--color-gray-700)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        <MetaCell entry={entry} />
      </span>

      <span style={{ color: "#9ca3af", fontSize: "11px", whiteSpace: "nowrap" }}>
        {entry.actorName
          ? <><span style={{ color: "var(--color-gray-600)", fontWeight: 600 }}>{entry.actorName}</span>{" · "}<span>{entry.actorRole}</span></>
          : <span>—</span>
        }
      </span>
    </div>
  );
}

// ─── Export CSV ───────────────────────────────────────────────────────────────

function exportCsv(entries: AuditEntry[]) {
  const header = "Timestamp,Tipo,EntityID,Attore,Ruolo,Dettaglio\n";
  const rows = entries.map((e) => {
    const detail = JSON.stringify(e.meta).replace(/"/g, "'");
    return [
      new Date(e.ts).toISOString(),
      e.type,
      e.entityId,
      e.actorName ?? "",
      e.actorRole ?? "",
      detail,
    ].map((v) => `"${v}"`).join(",");
  });
  const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main screen ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  height: "38px",
  padding: "0 10px",
  borderRadius: "var(--radius-md)",
  border: "2px solid var(--color-gray-200)",
  fontFamily: "var(--font)",
  fontSize: "var(--text-sm)",
  background: "var(--color-white)",
  color: "var(--color-gray-700)",
};

export function AuditLogScreen() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterType, setFilterType] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const load = useCallback((currentOffset = 0, append = false) => {
    setLoading(true);
    setError(null);
    const params: Parameters<typeof adminApi.auditLog.list>[0] = {
      limit: PAGE_SIZE,
      offset: currentOffset,
    };
    if (filterType) params.type = filterType;
    if (filterFrom) params.from = new Date(filterFrom).getTime();
    if (filterTo)   params.to   = new Date(filterTo + "T23:59:59").getTime();

    adminApi.auditLog.list(params)
      .then(({ entries: rows, total: tot }) => {
        setEntries((prev) => append ? [...prev, ...rows] : rows);
        setTotal(tot);
        setOffset(currentOffset + rows.length);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filterType, filterFrom, filterTo]);

  useEffect(() => { load(0, false); }, [load]);

  const hasMore = offset < total;

  function clearFilters() {
    setFilterType("");
    setFilterFrom("");
    setFilterTo("");
  }

  const hasFilters = filterType || filterFrom || filterTo;

  return (
    <PosLayout>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{
          padding: "var(--sp-lg) var(--sp-lg) var(--sp-md)",
          background: "var(--color-white)",
          borderBottom: "1px solid var(--color-gray-100)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--sp-md)" }}>
            <div>
              <h1 style={{ fontSize: "var(--text-xxl)", fontWeight: 700, color: "var(--color-gray-900)", margin: 0 }}>
                Audit Log
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: "var(--text-sm)", color: "var(--color-gray-500)" }}>
                {total > 0 ? `${total} eventi totali` : "Nessun evento"}
              </p>
            </div>
            <div style={{ display: "flex", gap: "var(--sp-sm)" }}>
              <Button size="sm" variant="ghost" onClick={() => exportCsv(entries)} disabled={entries.length === 0}>
                Esporta CSV
              </Button>
              <Button size="sm" variant="ghost" onClick={() => load(0, false)}>
                Aggiorna
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: "flex", gap: "var(--sp-sm)", flexWrap: "wrap", alignItems: "center" }}>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={inputStyle}>
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-500)", whiteSpace: "nowrap" }}>Da</span>
              <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-500)", whiteSpace: "nowrap" }}>A</span>
              <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} style={inputStyle} />
            </div>

            {hasFilters && (
              <Button size="sm" variant="ghost" onClick={clearFilters}>
                Cancella filtri
              </Button>
            )}
          </div>
        </div>

        {/* Table header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "28px 160px 1fr 1fr auto",
          gap: "12px",
          padding: "8px 16px",
          background: "#f9fafb",
          borderBottom: "1px solid var(--color-gray-200)",
          flexShrink: 0,
        }}>
          {["", "Timestamp", "Tipo", "Dettaglio", "Attore"].map((h) => (
            <span key={h} style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {h}
            </span>
          ))}
        </div>

        {/* Scrollable list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading && entries.length === 0 && (
            <div style={{ display: "flex", justifyContent: "center", padding: "var(--sp-xl)" }}>
              <span style={{ width: "32px", height: "32px", border: "3px solid var(--color-gray-200)", borderTopColor: "var(--color-brand)", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
            </div>
          )}

          {error && (
            <div style={{ margin: "var(--sp-lg)", padding: "var(--sp-md)", background: "#fef2f2", borderRadius: "var(--radius-lg)", color: "var(--color-danger)", fontSize: "var(--text-sm)" }}>
              {error}
            </div>
          )}

          {!loading && !error && entries.length === 0 && (
            <div style={{ textAlign: "center", padding: "var(--sp-xl)", color: "var(--color-gray-400)", fontSize: "var(--text-sm)" }}>
              Nessun evento trovato
            </div>
          )}

          {entries.map((entry, i) => (
            <AuditRow key={entry.id} entry={entry} isEven={i % 2 === 0} />
          ))}

          {hasMore && !loading && (
            <div style={{ textAlign: "center", padding: "var(--sp-md)" }}>
              <Button size="sm" variant="ghost" onClick={() => load(offset, true)}>
                Carica altri ({total - offset} rimanenti)
              </Button>
            </div>
          )}

          {loading && entries.length > 0 && (
            <div style={{ textAlign: "center", padding: "var(--sp-md)" }}>
              <span style={{ width: "24px", height: "24px", border: "3px solid var(--color-gray-200)", borderTopColor: "var(--color-brand)", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
            </div>
          )}
        </div>
      </div>
    </PosLayout>
  );
}
