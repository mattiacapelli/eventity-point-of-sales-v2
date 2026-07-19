import React, { useState, useEffect, useCallback } from "react";
import { PosLayout } from "../../layout/PosLayout.js";
import { Button } from "../../components/ui/Button.js";
import { adminApi, type PrintLogRow } from "../../core/admin-api.js";

// ─── Config ───────────────────────────────────────────────────────────────────

const PAGE_SIZE = 200;

type EventValue = PrintLogRow["event"] | "";

const EVENT_OPTIONS: { value: EventValue; label: string; color: string; bg: string }[] = [
  { value: "",                 label: "Tutti gli eventi", color: "#374151", bg: "#f3f4f6" },
  { value: "queued",           label: "In coda",          color: "#1d4ed8", bg: "#dbeafe" },
  { value: "rendering",        label: "Rendering",        color: "#7c3aed", bg: "#ede9fe" },
  { value: "sent",             label: "Inviato",          color: "#0369a1", bg: "#e0f2fe" },
  { value: "ok",               label: "Stampato",         color: "#065f46", bg: "#d1fae5" },
  { value: "retry",            label: "Retry",            color: "#92400e", bg: "#fef3c7" },
  { value: "failed",           label: "Fallito",          color: "#991b1b", bg: "#fee2e2" },
  { value: "offline_fast_fail", label: "Fast-fail",       color: "#6b7280", bg: "#f3f4f6" },
];

const EVENT_META = Object.fromEntries(
  EVENT_OPTIONS.filter((e) => e.value).map((e) => [e.value, e])
) as Record<string, { label: string; color: string; bg: string }>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTs(ts: string | number): string {
  return new Date(ts).toLocaleString("it-IT", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function fmtBytes(b: number | null): string {
  if (b === null) return "—";
  if (b < 1024) return `${b} B`;
  return `${(b / 1024).toFixed(1)} KB`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EventBadge({ event }: { event: PrintLogRow["event"] }) {
  const meta = EVENT_META[event] ?? { label: event, color: "#374151", bg: "#f3f4f6" };
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

function JobTypeBadge({ type }: { type: "kitchen" | "receipt" }) {
  return (
    <span style={{
      padding: "2px 7px",
      borderRadius: "999px",
      background: type === "kitchen" ? "#fef9c3" : "#f0fdf4",
      color: type === "kitchen" ? "#713f12" : "#14532d",
      fontWeight: 600,
      fontSize: "11px",
      whiteSpace: "nowrap",
      border: `1px solid ${type === "kitchen" ? "#fde68a" : "#bbf7d0"}`,
    }}>
      {type === "kitchen" ? "Cucina" : "Scontrino"}
    </span>
  );
}

function PrinterCell({ row }: { row: PrintLogRow }) {
  if (!row.printerName) return <span style={{ color: "#9ca3af" }}>—</span>;
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
      <span style={{ fontWeight: 600, color: "var(--color-gray-800)", fontSize: "12px" }}>
        {row.printerName}
      </span>
      {row.printerHost && (
        <span style={{ color: "#9ca3af", fontSize: "11px", fontVariantNumeric: "tabular-nums" }}>
          {row.printerHost}{row.printerPort ? `:${row.printerPort}` : ""}
        </span>
      )}
    </span>
  );
}

function DetailCell({ row }: { row: PrintLogRow }) {
  const parts: string[] = [];
  if (row.centerName) parts.push(row.centerName);
  if (row.bytes !== null) parts.push(fmtBytes(row.bytes));
  if (row.attempt !== null) parts.push(`tentativo ${row.attempt}`);
  if (row.terminalIp) parts.push(row.terminalIp);
  return (
    <span style={{ fontSize: "12px", color: "#6b7280" }}>
      {row.errorMsg
        ? <span style={{ color: "#dc2626" }}>{row.errorMsg}</span>
        : parts.length > 0
          ? parts.join(" · ")
          : <span style={{ color: "#d1d5db" }}>—</span>
      }
    </span>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function PrintLogRowItem({ row, isEven }: { row: PrintLogRow; isEven: boolean }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "150px 80px 80px 1fr 1fr 1fr",
      alignItems: "center",
      gap: "10px",
      padding: "9px 16px",
      background: isEven ? "var(--color-white)" : "#f9fafb",
      borderBottom: "1px solid var(--color-gray-100)",
      fontSize: "var(--text-sm)",
      minWidth: 0,
    }}>
      <span style={{ color: "#6b7280", fontSize: "11px", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
        {fmtTs(row.ts)}
      </span>

      <EventBadge event={row.event} />

      <JobTypeBadge type={row.jobType} />

      <span style={{ color: "var(--color-gray-700)", fontSize: "12px", whiteSpace: "nowrap" }}>
        {row.orderId !== null ? <><span style={{ color: "#9ca3af" }}>#</span>{row.orderId}</> : <span style={{ color: "#9ca3af" }}>—</span>}
      </span>

      <PrinterCell row={row} />

      <DetailCell row={row} />
    </div>
  );
}

// ─── Export CSV ───────────────────────────────────────────────────────────────

function exportCsv(rows: PrintLogRow[]) {
  const header = "Timestamp,Evento,Tipo,OrdineID,Stampante,Host,TerminalIP,Centro,Bytes,Tentativo,Errore\n";
  const lines = rows.map((r) => [
    new Date(r.ts).toISOString(),
    r.event,
    r.jobType,
    r.orderId ?? "",
    r.printerName ?? "",
    r.printerHost ? `${r.printerHost}:${r.printerPort ?? ""}` : "",
    r.terminalIp ?? "",
    r.centerName ?? "",
    r.bytes ?? "",
    r.attempt ?? "",
    r.errorMsg ?? "",
  ].map((v) => `"${String(v).replace(/"/g, "'")}"`).join(","));
  const blob = new Blob([header + lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `print-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  height: "36px",
  padding: "0 10px",
  borderRadius: "var(--radius-md)",
  border: "2px solid var(--color-gray-200)",
  fontFamily: "var(--font)",
  fontSize: "var(--text-sm)",
  background: "var(--color-white)",
  color: "var(--color-gray-700)",
};

export function PrintLogScreen() {
  const [rows, setRows]         = useState<PrintLogRow[]>([]);
  const [offset, setOffset]     = useState(0);
  const [hasMore, setHasMore]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [filterEvent,     setFilterEvent]     = useState<EventValue>("");
  const [filterJobType,   setFilterJobType]   = useState<"" | "kitchen" | "receipt">("");
  const [filterOrderId,   setFilterOrderId]   = useState("");
  const [filterFrom,      setFilterFrom]      = useState("");
  const [filterTo,        setFilterTo]        = useState("");

  const load = useCallback((currentOffset = 0, append = false) => {
    setLoading(true);
    setError(null);

    const params: Parameters<typeof adminApi.printLog.list>[0] = {
      limit: PAGE_SIZE,
      offset: currentOffset,
    };
    if (filterEvent)                      params.event    = filterEvent;
    if (filterJobType)                    params.jobType  = filterJobType;
    if (filterOrderId.trim())             params.orderId  = parseInt(filterOrderId.trim(), 10);
    if (filterFrom)                       params.from     = new Date(filterFrom).getTime();
    if (filterTo)                         params.to       = new Date(filterTo + "T23:59:59").getTime();

    adminApi.printLog.list(params)
      .then(({ rows: fetched, limit }) => {
        setRows((prev) => append ? [...prev, ...fetched] : fetched);
        setOffset(currentOffset + fetched.length);
        setHasMore(fetched.length === limit);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filterEvent, filterJobType, filterOrderId, filterFrom, filterTo]);

  useEffect(() => { load(0, false); }, [load]);

  function clearFilters() {
    setFilterEvent("");
    setFilterJobType("");
    setFilterOrderId("");
    setFilterFrom("");
    setFilterTo("");
  }

  const hasFilters = filterEvent || filterJobType || filterOrderId || filterFrom || filterTo;

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
                Log stampe
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: "var(--text-sm)", color: "var(--color-gray-500)" }}>
                Traccia ogni job di stampa dall'ip/cassa alla stampante fisica
              </p>
            </div>
            <div style={{ display: "flex", gap: "var(--sp-sm)" }}>
              <Button size="sm" variant="ghost" onClick={() => exportCsv(rows)} disabled={rows.length === 0}>
                Esporta CSV
              </Button>
              <Button size="sm" variant="ghost" onClick={() => load(0, false)}>
                Aggiorna
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: "flex", gap: "var(--sp-sm)", flexWrap: "wrap", alignItems: "center" }}>
            <select value={filterEvent} onChange={(e) => setFilterEvent(e.target.value as EventValue)} style={inputStyle}>
              {EVENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <select value={filterJobType} onChange={(e) => setFilterJobType(e.target.value as "" | "kitchen" | "receipt")} style={inputStyle}>
              <option value="">Tipo: tutti</option>
              <option value="receipt">Scontrino</option>
              <option value="kitchen">Cucina</option>
            </select>

            <input
              type="number"
              placeholder="Ordine #"
              value={filterOrderId}
              onChange={(e) => setFilterOrderId(e.target.value)}
              style={{ ...inputStyle, width: "110px" }}
            />

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
          gridTemplateColumns: "150px 80px 80px 1fr 1fr 1fr",
          gap: "10px",
          padding: "7px 16px",
          background: "#f9fafb",
          borderBottom: "1px solid var(--color-gray-200)",
          flexShrink: 0,
        }}>
          {["Timestamp", "Evento", "Tipo", "Ordine", "Stampante", "Dettaglio"].map((h) => (
            <span key={h} style={{ fontSize: "10px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {h}
            </span>
          ))}
        </div>

        {/* Scrollable list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading && rows.length === 0 && (
            <div style={{ display: "flex", justifyContent: "center", padding: "var(--sp-xl)" }}>
              <span style={{ width: "32px", height: "32px", border: "3px solid var(--color-gray-200)", borderTopColor: "var(--color-brand)", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
            </div>
          )}

          {error && (
            <div style={{ margin: "var(--sp-lg)", padding: "var(--sp-md)", background: "#fef2f2", borderRadius: "var(--radius-lg)", color: "var(--color-danger)", fontSize: "var(--text-sm)" }}>
              {error}
            </div>
          )}

          {!loading && !error && rows.length === 0 && (
            <div style={{ textAlign: "center", padding: "var(--sp-xl)", color: "var(--color-gray-400)", fontSize: "var(--text-sm)" }}>
              Nessun evento trovato
            </div>
          )}

          {rows.map((row, i) => (
            <PrintLogRowItem key={row.id} row={row} isEven={i % 2 === 0} />
          ))}

          {hasMore && !loading && (
            <div style={{ textAlign: "center", padding: "var(--sp-md)" }}>
              <Button size="sm" variant="ghost" onClick={() => load(offset, true)}>
                Carica altri
              </Button>
            </div>
          )}

          {loading && rows.length > 0 && (
            <div style={{ textAlign: "center", padding: "var(--sp-md)" }}>
              <span style={{ width: "24px", height: "24px", border: "3px solid var(--color-gray-200)", borderTopColor: "var(--color-brand)", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
            </div>
          )}
        </div>
      </div>
    </PosLayout>
  );
}
