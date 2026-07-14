import { useEffect, useState } from "react";
import { BuildingStorefrontIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import type { CurrentUser, Tenant } from "../core/types.js";
import { listTenants, createTenant, clearToken } from "../core/api-client.js";
import { TenantDetail } from "./TenantDetail.js";
import { Input } from "../components/Input.js";
import { Button } from "../components/Button.js";
import { Badge } from "../components/Badge.js";
import { useToast } from "../components/Toast.js";

const PAGE_SIZE = 20;

export function TenantsScreen({ currentUser, onLogout }: { currentUser: CurrentUser; onLogout: () => void }) {
  const { showToast } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    listTenants({ search, page, pageSize: PAGE_SIZE })
      .then((res) => {
        setTenants(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Impossibile caricare i tenant"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [page, search]);

  useEffect(() => {
    const handle = setTimeout(() => setPage(1), 300);
    return () => clearTimeout(handle);
  }, [search]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await createTenant(newName.trim());
      setNewName("");
      setSelectedId(created.id);
      showToast(`Tenant "${created.name}" creato`);
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossibile creare il tenant", "error");
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
    setTotal((t) => Math.max(0, t - 1));
  }

  function handleLogout() {
    clearToken();
    onLogout();
  }

  const selected = tenants.find((t) => t.id === selectedId) ?? null;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <header
        style={{
          background: "linear-gradient(160deg, var(--color-brand) 0%, var(--color-brand-dark) 100%)",
          color: "var(--color-white)",
          padding: "var(--sp-lg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <img src="/logo.svg" alt="epos" style={{ height: "26px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-md)" }}>
          <span style={{ fontSize: "var(--text-sm)", opacity: 0.85 }}>
            {currentUser.email}{currentUser.isSuperAdmin ? " · super-admin" : ""}
          </span>
          <button onClick={handleLogout} style={{ color: "var(--color-white)", fontSize: "var(--text-sm)", fontWeight: 600, opacity: 0.85 }}>
            Esci
          </button>
        </div>
      </header>

      <div style={{ flex: 1, maxWidth: "1280px", width: "100%", margin: "0 auto", padding: "var(--sp-lg)", display: "grid", gridTemplateColumns: selected ? "1fr 1.2fr" : "1fr", gap: "var(--sp-lg)", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-md)" }}>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca tenant..."
          />

          {currentUser.isSuperAdmin && (
            <div style={{ display: "flex", gap: "8px" }}>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
                placeholder="Nome nuovo locale..."
                style={{ flex: 1 }}
              />
              <Button onClick={() => void handleCreate()} loading={creating} disabled={!newName.trim()}>
                Crea
              </Button>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: "center", color: "var(--color-gray-400)", padding: "var(--sp-xl) 0" }}>Caricamento...</div>
          ) : error ? (
            <div style={{ textAlign: "center", padding: "var(--sp-xl) 0", display: "flex", flexDirection: "column", gap: "var(--sp-sm)", alignItems: "center" }}>
              <span style={{ color: "var(--color-danger)", fontSize: "var(--text-sm)" }}>{error}</span>
              <Button variant="secondary" onClick={load}>Riprova</Button>
            </div>
          ) : tenants.length === 0 ? (
            <div style={{ textAlign: "center", padding: "var(--sp-xl) 0", display: "flex", flexDirection: "column", gap: "var(--sp-sm)", alignItems: "center", color: "var(--color-gray-400)" }}>
              {search ? <MagnifyingGlassIcon width={32} height={32} color="var(--color-gray-300)" /> : <BuildingStorefrontIcon width={32} height={32} color="var(--color-gray-300)" />}
              <span>{search ? "Nessun tenant corrisponde alla ricerca" : "Nessun tenant creato"}</span>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {tenants.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className="hoverable"
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
                    <Badge tone={t.active ? "success" : "danger"}>{t.active ? "Attivo" : "Disattivato"}</Badge>
                  </button>
                ))}
              </div>

              {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "var(--sp-sm)" }}>
                  <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>←</Button>
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)" }}>
                    Pagina {page} di {totalPages}
                  </span>
                  <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>→</Button>
                </div>
              )}
            </>
          )}
        </div>

        {selected && (
          <TenantDetail
            tenant={selected}
            currentUser={currentUser}
            onUpdated={handleUpdated}
            onDeleted={handleDeleted}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  );
}
