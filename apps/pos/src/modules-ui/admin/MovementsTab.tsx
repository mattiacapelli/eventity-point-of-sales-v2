import { useEffect, useState } from "react";
import { adminApi } from "../../core/admin-api.js";
import type { InventoryMovementRecord } from "../../core/admin-api.js";
import { inputStyle, tableHeaderStyle, tableCellStyle } from "./shared.js";

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  sale: "Vendita",
  restock: "Rifornimento",
  manual: "Manuale",
  waste: "Scarto",
};

export function MovementsTab() {
  const [movements, setMovements] = useState<InventoryMovementRecord[]>([]);
  const [loading_, setLoading_] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("");

  async function load(type?: string) {
    setLoading_(true);
    try {
      const data = await adminApi.inventory.listMovements(type ? { type } : undefined);
      setMovements(data);
    } catch { /* ignore */ } finally { setLoading_(false); }
  }

  useEffect(() => { void load(typeFilter || undefined); }, [typeFilter]);

  return (
    <div style={{ padding: "var(--sp-lg)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "var(--sp-lg)" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-800)", margin: 0 }}>Movimenti inventario</h2>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{ ...inputStyle, width: "160px", height: "38px", fontSize: "var(--text-sm)" }}
        >
          <option value="">Tutti i tipi</option>
          <option value="sale">Vendita</option>
          <option value="restock">Rifornimento</option>
          <option value="manual">Manuale</option>
          <option value="waste">Scarto</option>
        </select>
      </div>
      <div style={{ background: "var(--color-white)", borderRadius: "var(--radius-xl)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        {loading_ ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--color-gray-400)", fontSize: "var(--text-sm)" }}>Caricamento...</div>
        ) : movements.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--color-gray-400)", fontSize: "var(--text-sm)" }}>Nessun movimento registrato.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>Data</th>
                <th style={tableHeaderStyle}>Tipo</th>
                <th style={{ ...tableHeaderStyle, textAlign: "right" }}>Quantità</th>
                <th style={tableHeaderStyle}>Motivo / Ordine</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td style={tableCellStyle}>{new Date(m.createdAt * 1000).toLocaleString("it-IT")}</td>
                  <td style={tableCellStyle}>
                    <span style={{
                      fontSize: "var(--text-xs)", fontWeight: 600, padding: "2px 8px", borderRadius: "999px",
                      background: m.type === "sale" ? "rgba(239,68,68,0.1)" : m.type === "restock" ? "rgba(34,197,94,0.1)" : "var(--color-gray-100)",
                      color: m.type === "sale" ? "#DC2626" : m.type === "restock" ? "#15803D" : "var(--color-gray-600)",
                    }}>
                      {MOVEMENT_TYPE_LABELS[m.type] ?? m.type}
                    </span>
                  </td>
                  <td style={{ ...tableCellStyle, textAlign: "right", fontWeight: 600, color: m.quantity < 0 ? "#DC2626" : "#15803D" }}>
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </td>
                  <td style={{ ...tableCellStyle, color: "var(--color-gray-500)" }}>
                    {m.reason ?? (m.orderId ? `Ordine #${m.orderId}` : "—")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
