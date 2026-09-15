import { useEffect, useState } from "react";
import { adminApi } from "../../core/admin-api.js";
import type { InventoryMovementRecord } from "../../core/admin-api.js";
import { AdminTablePage } from "./shared.js";

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  sale: "Vendita",
  restock: "Rifornimento",
  manual: "Manuale",
  waste: "Scarto",
};

const TYPE_OPTIONS = [
  { value: "sale", label: "Vendita" },
  { value: "restock", label: "Rifornimento" },
  { value: "manual", label: "Manuale" },
  { value: "waste", label: "Scarto" },
];

export function MovementsTab() {
  const [movements, setMovements] = useState<InventoryMovementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("");

  async function load(type?: string) {
    setLoading(true);
    try {
      const data = await adminApi.inventory.listMovements(type ? { type } : undefined);
      setMovements(data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  useEffect(() => { void load(typeFilter || undefined); }, [typeFilter]);

  return (
    <AdminTablePage
      title="Movimenti inventario"
      rows={movements}
      rowKey={(m) => m.id}
      loading={loading}
      emptyMessage="Nessun movimento registrato."
      filters={[
        { key: "type", label: "Tutti i tipi", options: TYPE_OPTIONS, value: typeFilter, onChange: setTypeFilter },
      ]}
      columns={[
        {
          key: "date",
          header: "Data",
          render: (m) => new Date(m.createdAt * 1000).toLocaleString("it-IT"),
        },
        {
          key: "type",
          header: "Tipo",
          render: (m) => (
            <span style={{
              fontSize: "var(--text-xs)", fontWeight: 600, padding: "2px 8px", borderRadius: "999px",
              background: m.type === "sale" ? "rgba(239,68,68,0.1)" : m.type === "restock" ? "rgba(34,197,94,0.1)" : "var(--color-gray-100)",
              color: m.type === "sale" ? "#DC2626" : m.type === "restock" ? "#15803D" : "var(--color-gray-600)",
            }}>
              {MOVEMENT_TYPE_LABELS[m.type] ?? m.type}
            </span>
          ),
        },
        {
          key: "quantity",
          header: "Quantità",
          align: "right",
          render: (m) => (
            <span style={{ fontWeight: 600, color: m.quantity < 0 ? "#DC2626" : "#15803D" }}>
              {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
            </span>
          ),
        },
        {
          key: "reason",
          header: "Motivo / Ordine",
          render: (m) => (
            <span style={{ color: "var(--color-gray-500)" }}>
              {m.reason ?? (m.orderId ? `Ordine #${m.orderId}` : "—")}
            </span>
          ),
        },
      ]}
    />
  );
}
