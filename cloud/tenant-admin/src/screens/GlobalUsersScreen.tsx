import { useEffect, useState } from "react";
import { UserGroupIcon, MagnifyingGlassIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { listGlobalUsers, type GlobalUser } from "../core/api-client.js";
import { Input } from "../components/Input.js";
import { Badge } from "../components/Badge.js";
import { Button } from "../components/Button.js";
import { Table, TableHead, Th, Tr, Td } from "../components/Table.js";
import { PageHeader } from "../components/PageHeader.js";
import { ErrorRetry } from "../components/ErrorRetry.js";
import { EmptyState } from "../components/EmptyState.js";

const PAGE_SIZE = 20;

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("it-IT");
}

export function GlobalUsersScreen() {
  const [users, setUsers] = useState<GlobalUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    listGlobalUsers({ search, page, pageSize: PAGE_SIZE })
      .then((res) => {
        setUsers(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Impossibile caricare gli utenti"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [page, search]);

  useEffect(() => {
    const handle = setTimeout(() => setPage(1), 300);
    return () => clearTimeout(handle);
  }, [search]);

  const superAdminCount = users.filter((u) => u.isSuperAdmin).length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <PageHeader
        title="Utenti"
        description="Tutti gli utenti registrati sulla piattaforma e i tenant a cui sono assegnati."
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-lg)" }}>
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sp-md)", flexWrap: "wrap",
            padding: "var(--sp-md) var(--sp-lg)", background: "var(--color-white)",
            border: "1px solid var(--color-gray-200)", borderRadius: "var(--radius-lg)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-xl)", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
              <span style={{ fontSize: "var(--text-xxl)", fontWeight: 700, color: "var(--color-gray-900)", fontVariantNumeric: "tabular-nums" }}>{total}</span>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)" }}>
                {total === 1 ? "utente totale" : "utenti totali"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <ShieldCheckIcon width={16} height={16} color="var(--color-brand)" />
              <span style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)" }}>
                {superAdminCount} super-admin in questa pagina
              </span>
            </div>
          </div>
          <div style={{ maxWidth: "320px", flex: "1 1 240px" }}>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca per email..."
            />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: "var(--color-gray-400)", padding: "var(--sp-xl) 0" }}>Caricamento...</div>
        ) : error ? (
          <ErrorRetry message={error} onRetry={load} />
        ) : users.length === 0 ? (
          <div style={{ textAlign: "center", padding: "var(--sp-xl) 0", display: "flex", flexDirection: "column", gap: "var(--sp-sm)", alignItems: "center" }}>
            {search ? <MagnifyingGlassIcon width={32} height={32} color="var(--color-gray-300)" /> : <UserGroupIcon width={32} height={32} color="var(--color-gray-300)" />}
            <EmptyState>{search ? "Nessun utente corrisponde alla ricerca" : "Nessun utente nel sistema"}</EmptyState>
          </div>
        ) : (
          <>
            <Table>
              <TableHead>
                <Th>Email</Th>
                <Th width="160px">Stato</Th>
                <Th>Tenant assegnati</Th>
                <Th width="110px" align="right">Dal</Th>
              </TableHead>
              <tbody>
                {users.map((u) => (
                  <Tr key={u.id}>
                    <Td>
                      <span style={{ fontWeight: 600, wordBreak: "break-all" }}>{u.email}</span>
                    </Td>
                    <Td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-start" }}>
                        {u.isSuperAdmin && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <ShieldCheckIcon width={14} height={14} color="var(--color-brand)" />
                            <Badge tone="brand">Super-admin</Badge>
                          </span>
                        )}
                        {!u.active && <Badge tone="danger">Disattivato</Badge>}
                        {u.active && !u.isSuperAdmin && <span style={{ color: "var(--color-gray-400)", fontSize: "var(--text-xs)" }}>—</span>}
                      </div>
                    </Td>
                    <Td>
                      {u.tenants.length === 0 ? (
                        <span style={{ color: "var(--color-gray-400)" }}>Nessun tenant assegnato</span>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {u.tenants.map((t) => (
                            <span
                              key={t.tenantId}
                              style={{
                                display: "inline-flex", alignItems: "center", gap: "5px",
                                padding: "3px 9px", borderRadius: "var(--radius-pill)",
                                background: "var(--color-gray-50)", border: "1px solid var(--color-gray-200)",
                                fontSize: "var(--text-xs)", color: "var(--color-gray-700)",
                              }}
                            >
                              {t.tenantName}
                              <span style={{ color: t.role === "owner" ? "var(--color-brand)" : "var(--color-gray-400)", fontWeight: 700 }}>
                                {t.role}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </Td>
                    <Td align="right">
                      <span style={{ color: "var(--color-gray-500)", whiteSpace: "nowrap" }}>{formatDate(u.createdAt)}</span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>

            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "var(--sp-sm)" }}>
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Precedente</Button>
                <span style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)" }}>
                  Pagina {page} di {totalPages}
                </span>
                <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Successiva →</Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
