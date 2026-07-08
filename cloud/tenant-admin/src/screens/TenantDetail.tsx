import { useEffect, useState } from "react";
import type { Tenant, TenantStats } from "../core/types.js";
import { fetchTenantStats, rotateTenantKey, updateTenant, deleteTenant } from "../core/api-client.js";

function formatEur(n: number): string {
  return `€${n.toFixed(2)}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("it-IT");
}

export function TenantDetail({ tenant, onUpdated, onDeleted, onClose }: {
  tenant: Tenant;
  onUpdated: (t: Tenant) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}) {
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [copyLabel, setCopyLabel] = useState("Copia chiave");
  const [rotating, setRotating] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setStats(null);
    fetchTenantStats(tenant.id).then(setStats).catch(() => {});
  }, [tenant.id]);

  async function handleToggleActive() {
    setToggling(true);
    try {
      const updated = await updateTenant(tenant.id, { active: !tenant.active });
      onUpdated(updated);
    } finally {
      setToggling(false);
    }
  }

  async function handleRotateKey() {
    setRotating(true);
    try {
      const { apiKey } = await rotateTenantKey(tenant.id);
      onUpdated({ ...tenant, apiKey });
    } finally {
      setRotating(false);
    }
  }

  async function handleCopyKey() {
    try {
      await navigator.clipboard.writeText(tenant.apiKey);
      setCopyLabel("Copiata!");
      setTimeout(() => setCopyLabel("Copia chiave"), 1500);
    } catch { /* clipboard unavailable */ }
  }

  async function handleDelete() {
    await deleteTenant(tenant.id);
    onDeleted(tenant.id);
  }

  const orderUrl = `${window.location.origin.replace(/:\d+$/, ":5174")}/?t=${tenant.slug}`;

  return (
    <div
      style={{
        background: "var(--color-white)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "var(--shadow-md)",
        padding: "var(--sp-lg)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-lg)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>{tenant.name}</div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)" }}>/{tenant.slug}</div>
        </div>
        <button onClick={onClose} style={{ color: "var(--color-gray-400)", fontSize: "var(--text-lg)", fontWeight: 700 }}>✕</button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-sm)" }}>
        <span
          style={{
            padding: "4px 12px",
            borderRadius: "var(--radius-pill)",
            fontSize: "var(--text-xs)",
            fontWeight: 700,
            background: tenant.active ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.1)",
            color: tenant.active ? "#16a34a" : "var(--color-danger)",
          }}
        >
          {tenant.active ? "Attivo" : "Disattivato"}
        </span>
        <button
          onClick={() => void handleToggleActive()}
          disabled={toggling}
          style={{
            padding: "6px 14px",
            borderRadius: "var(--radius-md)",
            border: "1.5px solid var(--color-gray-200)",
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            color: "var(--color-gray-700)",
          }}
        >
          {tenant.active ? "Disattiva" : "Attiva"}
        </button>
      </div>

      <div>
        <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-400)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
          Link ordinazione (da stampare sul QR del tavolo)
        </div>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--color-brand)", wordBreak: "break-all" }}>{orderUrl}</div>
      </div>

      <div>
        <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-400)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
          API Key (per il sync menu dalla cassa)
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <code style={{ flex: 1, padding: "8px 12px", background: "var(--color-gray-50)", borderRadius: "var(--radius-md)", fontSize: "var(--text-xs)", wordBreak: "break-all" }}>
            {tenant.apiKey}
          </code>
          <button onClick={() => void handleCopyKey()} style={{ padding: "8px 12px", borderRadius: "var(--radius-md)", border: "1.5px solid var(--color-gray-200)", fontSize: "var(--text-xs)", fontWeight: 600, whiteSpace: "nowrap" }}>
            {copyLabel}
          </button>
          <button onClick={() => void handleRotateKey()} disabled={rotating} style={{ padding: "8px 12px", borderRadius: "var(--radius-md)", border: "1.5px solid var(--color-gray-200)", fontSize: "var(--text-xs)", fontWeight: 600, whiteSpace: "nowrap" }}>
            {rotating ? "..." : "Rigenera"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--sp-sm)" }}>
        <StatCard label="Categorie" value={stats ? String(stats.categoriesCount) : "—"} />
        <StatCard label="Prodotti" value={stats ? String(stats.productsCount) : "—"} />
        <StatCard label="Ordini totali" value={stats ? String(stats.ordersCount) : "—"} />
        <StatCard label="Fatturato totale" value={stats ? formatEur(stats.totalRevenue) : "—"} />
      </div>

      {stats && stats.recentOrders.length > 0 && (
        <div>
          <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-400)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
            Ultimi {stats.recentOrders.length} ordini
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {stats.recentOrders.map((o) => (
              <div key={o.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--color-gray-50)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)" }}>
                <span>
                  <strong>{o.orderCode}</strong> · Tavolo {o.tableId}{o.customerName ? ` · ${o.customerName}` : ""}
                </span>
                <span style={{ color: "var(--color-gray-500)" }}>
                  {formatEur(o.totalAmount)} · {formatDate(o.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ borderTop: "1px solid var(--color-gray-100)", paddingTop: "var(--sp-md)" }}>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} style={{ color: "var(--color-danger)", fontSize: "var(--text-sm)", fontWeight: 600 }}>
            Elimina tenant
          </button>
        ) : (
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-600)" }}>Confermi l'eliminazione?</span>
            <button onClick={() => void handleDelete()} style={{ padding: "6px 14px", borderRadius: "var(--radius-md)", background: "var(--color-danger)", color: "var(--color-white)", fontSize: "var(--text-sm)", fontWeight: 600 }}>
              Elimina
            </button>
            <button onClick={() => setConfirmDelete(false)} style={{ padding: "6px 14px", borderRadius: "var(--radius-md)", border: "1.5px solid var(--color-gray-200)", fontSize: "var(--text-sm)", fontWeight: 600 }}>
              Annulla
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--color-gray-50)", borderRadius: "var(--radius-md)", padding: "var(--sp-md)", textAlign: "center" }}>
      <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-brand)" }}>{value}</div>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-500)", marginTop: "2px" }}>{label}</div>
    </div>
  );
}
