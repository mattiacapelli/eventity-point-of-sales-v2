import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BuildingStorefrontIcon, MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/24/outline";
import type { CurrentUser, Tenant } from "../core/types.js";
import { listTenants, createTenant } from "../core/api-client.js";
import { Input } from "../components/Input.js";
import { Button } from "../components/Button.js";
import { Badge } from "../components/Badge.js";
import { Table, TableHead, Th, Td } from "../components/Table.js";
import { PageHeader } from "../components/PageHeader.js";
import { Modal } from "../components/Modal.js";
import { ErrorRetry } from "../components/ErrorRetry.js";
import { EmptyState } from "../components/EmptyState.js";
import { useToast } from "../components/Toast.js";

const PAGE_SIZE = 20;

export function TenantsScreen({ currentUser }: { currentUser: CurrentUser }) {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
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
      .catch((err) => setError(err instanceof Error ? err.message : "Impossibile caricare gli eventi"))
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
      setCreateOpen(false);
      showToast(`Evento "${created.name}" creato`);
      load();
      navigate(`/tenants/${created.id}/overview`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossibile creare l'evento", "error");
    } finally {
      setCreating(false);
    }
  }

  const activeCount = tenants.filter((t) => t.active).length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <PageHeader
        title="Eventi"
        description="Gestisci gli eventi collegati alla piattaforma, il loro stato e l'accesso al menu self-order."
        actions={currentUser.isSuperAdmin && (
          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon width={16} height={16} />
            Nuovo evento
          </Button>
        )}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-lg)" }}>
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sp-md)", flexWrap: "wrap",
            padding: "var(--sp-md) var(--sp-lg)", background: "var(--color-white)",
            border: "1px solid var(--color-gray-200)", borderRadius: "var(--radius-lg)",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
            <span style={{ fontSize: "var(--text-xxl)", fontWeight: 700, color: "var(--color-gray-900)", fontVariantNumeric: "tabular-nums" }}>{total}</span>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)" }}>
              {total === 1 ? "evento totale" : "eventi totali"}
            </span>
          </div>
          <div style={{ maxWidth: "320px", flex: "1 1 240px" }}>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca per nome..."
            />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: "var(--color-gray-400)", padding: "var(--sp-xl) 0" }}>Caricamento...</div>
        ) : error ? (
          <ErrorRetry message={error} onRetry={load} />
        ) : tenants.length === 0 ? (
          <div style={{ textAlign: "center", padding: "var(--sp-xl) 0", display: "flex", flexDirection: "column", gap: "var(--sp-sm)", alignItems: "center" }}>
            {search ? <MagnifyingGlassIcon width={32} height={32} color="var(--color-gray-300)" /> : <BuildingStorefrontIcon width={32} height={32} color="var(--color-gray-300)" />}
            <EmptyState>{search ? "Nessun evento corrisponde alla ricerca" : "Nessun evento creato"}</EmptyState>
          </div>
        ) : (
          <>
            <Table>
              <TableHead>
                <Th>Nome</Th>
                <Th>Slug</Th>
                <Th width="140px">Stato</Th>
                <Th width="160px">Creato il</Th>
              </TableHead>
              <tbody>
                {tenants.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/tenants/${t.id}/overview`)}
                    className="hoverable"
                    style={{ borderBottom: "1px solid var(--color-gray-100)", cursor: "pointer" }}
                  >
                    <Td>
                      <span style={{ fontWeight: 700, color: "var(--color-gray-900)" }}>{t.name}</span>
                    </Td>
                    <Td>
                      <span style={{ color: "var(--color-gray-500)" }}>/{t.slug}</span>
                    </Td>
                    <Td>
                      <Badge tone={t.active ? "success" : "danger"}>{t.active ? "Attivo" : "Disattivato"}</Badge>
                    </Td>
                    <Td>
                      <span style={{ color: "var(--color-gray-500)" }}>{new Date(t.createdAt).toLocaleDateString("it-IT")}</span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "var(--text-sm)", color: "var(--color-gray-500)" }}>
              <span>{activeCount} attivi in questa pagina · {total} in totale</span>
              {totalPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-sm)" }}>
                  <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Precedente</Button>
                  <span>Pagina {page} di {totalPages}</span>
                  <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Successiva →</Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {createOpen && (
        <Modal onClose={() => setCreateOpen(false)}>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--color-gray-900)" }}>Nuovo evento</div>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
            placeholder="Nome dell'evento..."
            autoFocus
          />
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={creating}>Annulla</Button>
            <Button onClick={() => void handleCreate()} loading={creating} disabled={!newName.trim()}>Crea</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
