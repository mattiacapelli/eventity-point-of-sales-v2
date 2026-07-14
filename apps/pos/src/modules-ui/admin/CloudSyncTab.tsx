import { useState } from "react";
import { adminApi } from "../../core/admin-api.js";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
}

// Same shape expected by the cloud's POST /api/tenants/:slug/menu/sync (and its
// tenant-admin manual-import counterpart) — till-side ids are preserved so the
// two catalogues can be re-imported without breaking references.
interface MenuExport {
  exportedAt: string;
  categories: { id: number; name: string; sortOrder: number }[];
  products: { id: number; categoryId: number; name: string; price: number; active: boolean; sortOrder: number }[];
  optionGroups: {
    id: number;
    productId: number;
    name: string;
    type: "single" | "multi" | "removal";
    required: boolean;
    minSel: number;
    maxSel: number;
    sortOrder: number;
    options: { id: number; name: string; priceDelta: number; prefix: "+" | "-" | ">>"; active: boolean; sortOrder: number }[];
  }[];
}

export function CloudSyncTab() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastExportedAt, setLastExportedAt] = useState<number | null>(null);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const [categories, products] = await Promise.all([
        adminApi.categories.list(),
        adminApi.products.list(),
      ]);

      const optionGroupsPerProduct = await Promise.all(
        products.map((p) => adminApi.optionGroups.list(p.id)),
      );

      const payload: MenuExport = {
        exportedAt: new Date().toISOString(),
        categories: categories.map((c) => ({ id: c.id, name: c.name, sortOrder: c.sortOrder })),
        products: products
          .filter((p) => p.categoryId !== null)
          .map((p) => ({
            id: p.id,
            categoryId: p.categoryId!,
            name: p.name,
            price: p.price,
            active: p.active,
            sortOrder: p.sortOrder,
          })),
        optionGroups: optionGroupsPerProduct.flat().map((g) => ({
          id: g.id,
          productId: g.productId,
          name: g.name,
          type: g.type,
          required: g.required,
          minSel: g.minSel,
          maxSel: g.maxSel,
          sortOrder: g.sortOrder,
          options: g.options.map((o) => ({
            id: o.id,
            name: o.name,
            priceDelta: o.priceDelta,
            prefix: o.prefix,
            active: o.active,
            sortOrder: o.sortOrder,
          })),
        })),
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `menu-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setLastExportedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante l'esportazione del menu");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--color-gray-800)" }}>Cloud</div>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)", marginTop: "2px" }}>
          Esporta categorie, prodotti e opzioni in un file JSON da importare manualmente nel pannello cloud
          (menu digitale self-order). La cassa resta indipendente: nessuna sincronizzazione automatica.
        </div>
      </div>

      {error && (
        <div style={{
          background: "rgba(239,68,68,0.08)", color: "var(--color-danger)",
          borderRadius: "10px", padding: "12px 14px",
          fontSize: "var(--text-sm)", fontWeight: 500, marginBottom: "16px",
        }}>
          {error}
        </div>
      )}

      <div style={{
        display: "flex", flexDirection: "column", gap: "12px",
        padding: "24px", background: "var(--color-gray-50)", borderRadius: "12px",
      }}>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-600)" }}>
          {lastExportedAt
            ? `Ultima esportazione: ${formatDate(lastExportedAt)}`
            : "Nessuna esportazione ancora effettuata in questa sessione."}
        </div>
        <div>
          <button
            onClick={() => void handleExport()}
            disabled={exporting}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "10px 18px", borderRadius: "10px", border: "none",
              background: exporting ? "var(--color-gray-200)" : "var(--color-brand)",
              color: exporting ? "var(--color-gray-400)" : "var(--color-white)",
              fontSize: "var(--text-sm)", fontWeight: 700, fontFamily: "var(--font)",
              cursor: exporting ? "not-allowed" : "pointer",
            }}
          >
            {exporting ? "Esportazione…" : "Esporta menu (JSON)"}
          </button>
        </div>
      </div>
    </div>
  );
}
