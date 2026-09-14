import { useEffect, useState } from "react";
import { TagIcon, CubeIcon, ClipboardDocumentListIcon, BanknotesIcon } from "@heroicons/react/24/outline";
import type { Tenant, TenantStats } from "../../core/types.js";
import { fetchTenantStats, downloadOrdersCsv } from "../../core/api-client.js";
import { Button } from "../../components/Button.js";
import { SectionLabel } from "../../components/SectionLabel.js";
import { ErrorRetry } from "../../components/ErrorRetry.js";
import { EmptyState } from "../../components/EmptyState.js";
import { StatCard, StatusRow } from "../../components/StatCard.js";
import { useToast } from "../../components/Toast.js";

function formatEur(n: number): string {
  return `€${n.toFixed(2)}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("it-IT");
}

export function StatsPanel({ tenant }: { tenant: Tenant }) {
  const { showToast } = useToast();
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  function loadStats() {
    setStats(null);
    setStatsError(null);
    fetchTenantStats(tenant.id)
      .then(setStats)
      .catch((err) => setStatsError(err instanceof Error ? err.message : "Impossibile caricare le statistiche"));
  }

  useEffect(loadStats, [tenant.id]);

  async function handleExportCsv() {
    setExporting(true);
    try {
      const blob = await downloadOrdersCsv(tenant.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders-${tenant.slug}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossibile esportare gli ordini", "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      {statsError ? (
        <ErrorRetry message={statsError} onRetry={loadStats} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--sp-sm)" }}>
          <StatCard label="Valore ordini richiesti" value={stats ? formatEur(stats.totalRevenue) : "—"} Icon={BanknotesIcon} accent />
          <StatCard label="Ordini totali" value={stats ? String(stats.ordersCount) : "—"} Icon={ClipboardDocumentListIcon} />
          <StatCard label="Prodotti" value={stats ? String(stats.productsCount) : "—"} Icon={CubeIcon} />
          <StatCard label="Categorie" value={stats ? String(stats.categoriesCount) : "—"} Icon={TagIcon} />
        </div>
      )}

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--sp-md)", alignItems: "start" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <SectionLabel>Ultimi {stats.recentOrders.length} ordini</SectionLabel>
              <Button variant="secondary" onClick={() => void handleExportCsv()} loading={exporting}>
                Esporta CSV
              </Button>
            </div>
            {stats.recentOrders.length === 0 ? (
              <EmptyState>Nessun ordine ancora</EmptyState>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {stats.recentOrders.map((o) => (
                  <div key={o.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--color-gray-50)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)" }}>
                    <span>
                      <strong>{o.orderCode}</strong> · Tavolo {o.tableId}{o.customerName ? ` · ${o.customerName}` : ""}
                    </span>
                    <span style={{ color: "var(--color-gray-500)", fontVariantNumeric: "tabular-nums" }}>
                      {formatEur(o.totalAmount)} · {formatDate(o.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: "var(--color-gray-50)", border: "1px solid var(--color-gray-100)", borderRadius: "var(--radius-lg)", padding: "var(--sp-md)" }}>
            <div style={{ marginBottom: "10px" }}>
              <SectionLabel>Stato del locale</SectionLabel>
            </div>
            <StatusRow ok={stats.categoriesCount > 0} label={stats.categoriesCount > 0 ? "Categorie configurate" : "Nessuna categoria configurata"} />
            <StatusRow ok={stats.productsCount > 0} label={stats.productsCount > 0 ? "Menu configurato" : "Nessun prodotto nel menu"} />
            <StatusRow ok={tenant.active} label={tenant.active ? "Tenant attivo" : "Tenant disattivato"} />
          </div>
        </div>
      )}
    </>
  );
}
