import { useEffect, useState } from "react";
import type { Tenant } from "../core/types.js";
import { listTenants, createTenant, clearToken } from "../core/api-client.js";
import { TenantDetail } from "./TenantDetail.js";

export function TenantsScreen({ onLogout }: { onLogout: () => void }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    listTenants().then(setTenants).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await createTenant(newName.trim());
      setTenants((prev) => [...prev, created]);
      setNewName("");
      setSelectedId(created.id);
    } finally {
      setCreating(false);
    }
  }

  function handleUpdated(updated: Tenant) {
    setTenants((prev) => prev.map((t) => t.id === updated.id ? updated : t));
  }

  function handleDeleted(id: string) {
    setTenants((prev) => prev.filter((t) => t.id !== id));
    setSelectedId(null);
  }

  function handleLogout() {
    clearToken();
    onLogout();
  }

  const selected = tenants.find((t) => t.id === selectedId) ?? null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <header
        style={{
          background: "var(--color-brand)",
          color: "var(--color-white)",
          padding: "var(--sp-lg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <img src="/logo.svg" alt="epos" style={{ height: "26px" }} />
        <button onClick={handleLogout} style={{ color: "var(--color-white)", fontSize: "var(--text-sm)", fontWeight: 600, opacity: 0.85 }}>
          Esci
        </button>
      </header>

      <div style={{ flex: 1, maxWidth: "960px", width: "100%", margin: "0 auto", padding: "var(--sp-lg)", display: "grid", gridTemplateColumns: selected ? "1fr 1fr" : "1fr", gap: "var(--sp-lg)", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-md)" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
              placeholder="Nome nuovo locale..."
              style={{ flex: 1, height: "42px", padding: "0 14px", borderRadius: "var(--radius-md)", border: "1.5px solid var(--color-gray-200)", fontSize: "var(--text-sm)" }}
            />
            <button
              onClick={() => void handleCreate()}
              disabled={creating || !newName.trim()}
              style={{ padding: "0 18px", borderRadius: "var(--radius-md)", background: "var(--color-brand)", color: "var(--color-white)", fontWeight: 700, fontSize: "var(--text-sm)", opacity: creating ? 0.6 : 1 }}
            >
              {creating ? "..." : "Crea"}
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", color: "var(--color-gray-400)", padding: "var(--sp-xl) 0" }}>Caricamento...</div>
          ) : tenants.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--color-gray-400)", padding: "var(--sp-xl) 0" }}>Nessun tenant creato</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {tenants.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "var(--sp-md)",
                    borderRadius: "var(--radius-lg)",
                    background: "var(--color-white)",
                    border: `1.5px solid ${selectedId === t.id ? "var(--color-brand)" : "var(--color-gray-100)"}`,
                    boxShadow: "var(--shadow-sm)",
                    textAlign: "left",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--color-gray-900)" }}>{t.name}</div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-500)" }}>/{t.slug}</div>
                  </div>
                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: "var(--radius-pill)",
                      fontSize: "var(--text-xs)",
                      fontWeight: 700,
                      background: t.active ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.1)",
                      color: t.active ? "#16a34a" : "var(--color-danger)",
                    }}
                  >
                    {t.active ? "Attivo" : "Disattivato"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <TenantDetail
            tenant={selected}
            onUpdated={handleUpdated}
            onDeleted={handleDeleted}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  );
}
