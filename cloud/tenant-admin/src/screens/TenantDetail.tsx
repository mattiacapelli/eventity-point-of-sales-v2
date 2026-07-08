import { useEffect, useState } from "react";
import type { AuditLogEntry, CurrentUser, Paginated, Tenant, TenantStats, TenantUser, TenantUserRole } from "../core/types.js";
import {
  fetchTenantStats,
  rotateTenantKey,
  updateTenant,
  deleteTenant,
  listTenantUsers,
  inviteTenantUser,
  removeTenantUser,
  fetchAuditLog,
  downloadOrdersCsv,
} from "../core/api-client.js";
import { Button } from "../components/Button.js";
import { Badge } from "../components/Badge.js";
import { Input, Select } from "../components/Input.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { useToast } from "../components/Toast.js";

function formatEur(n: number): string {
  return `€${n.toFixed(2)}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("it-IT");
}

function maskApiKey(key: string): string {
  if (key.length <= 4) return "••••";
  return `${"•".repeat(Math.max(4, key.length - 4))}${key.slice(-4)}`;
}

type Tab = "overview" | "users" | "audit";

export function TenantDetail({ tenant, currentUser, onUpdated, onDeleted, onClose }: {
  tenant: Tenant;
  currentUser: CurrentUser;
  onUpdated: (t: Tenant) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copia");
  const [toggling, setToggling] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"delete" | "rotate" | "toggle" | null>(null);

  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TenantUserRole>("operator");
  const [inviting, setInviting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TenantUser | null>(null);

  const [auditPage, setAuditPage] = useState<Paginated<AuditLogEntry> | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  const myMembership = tenantUsers.find((u) => u.userId === currentUser.id);
  const myRole: TenantUserRole | "super-admin" | null = currentUser.isSuperAdmin
    ? "super-admin"
    : myMembership?.role ?? null;
  const canWrite = myRole === "super-admin" || myRole === "owner";
  const canManageUsers = canWrite;

  function loadStats() {
    setStats(null);
    setStatsError(null);
    fetchTenantStats(tenant.id)
      .then(setStats)
      .catch((err) => setStatsError(err instanceof Error ? err.message : "Impossibile caricare le statistiche"));
  }

  function loadUsers() {
    setUsersError(null);
    listTenantUsers(tenant.id)
      .then(setTenantUsers)
      .catch((err) => setUsersError(err instanceof Error ? err.message : "Impossibile caricare gli utenti"));
  }

  function loadAudit() {
    setAuditError(null);
    fetchAuditLog(tenant.id)
      .then(setAuditPage)
      .catch((err) => setAuditError(err instanceof Error ? err.message : "Impossibile caricare l'audit log"));
  }

  useEffect(() => {
    setTab("overview");
    setShowApiKey(false);
    loadStats();
    loadUsers();
  }, [tenant.id]);

  useEffect(() => {
    if (tab === "audit") loadAudit();
  }, [tab, tenant.id]);

  async function handleToggleActive() {
    setToggling(true);
    try {
      const updated = await updateTenant(tenant.id, { active: !tenant.active });
      onUpdated(updated);
      showToast(updated.active ? "Tenant attivato" : "Tenant disattivato");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Operazione non riuscita", "error");
    } finally {
      setToggling(false);
      setConfirmAction(null);
    }
  }

  async function handleRotateKey() {
    const { apiKey } = await rotateTenantKey(tenant.id);
    onUpdated({ ...tenant, apiKey });
    setShowApiKey(true);
    showToast("Chiave API rigenerata");
    setConfirmAction(null);
  }

  async function handleCopyKey() {
    try {
      await navigator.clipboard.writeText(tenant.apiKey);
      setCopyLabel("Copiata!");
      setTimeout(() => setCopyLabel("Copia"), 1500);
    } catch { /* clipboard unavailable */ }
  }

  async function handleDelete() {
    await deleteTenant(tenant.id);
    onDeleted(tenant.id);
    showToast("Tenant eliminato");
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const result = await inviteTenantUser(tenant.id, inviteEmail.trim(), inviteRole);
      setInviteEmail("");
      loadUsers();
      showToast(
        result.tempPassword
          ? `Utente creato. Password temporanea: ${result.tempPassword}`
          : `${result.email} aggiunto come ${result.role}`,
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossibile invitare l'utente", "error");
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveUser(user: TenantUser) {
    await removeTenantUser(tenant.id, user.userId);
    setTenantUsers((prev) => prev.filter((u) => u.id !== user.id));
    showToast(`${user.email} rimosso dal tenant`);
  }

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

      <div style={{ display: "flex", gap: "var(--sp-md)", borderBottom: "1.5px solid var(--color-gray-100)" }}>
        {(canWrite ? (["overview", "users", "audit"] as Tab[]) : (["overview"] as Tab[])).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 0",
              fontSize: "var(--text-sm)",
              fontWeight: 700,
              color: tab === t ? "var(--color-brand)" : "var(--color-gray-400)",
              borderBottom: tab === t ? "2px solid var(--color-brand)" : "2px solid transparent",
            }}
          >
            {t === "overview" ? "Panoramica" : t === "users" ? "Utenti" : "Audit log"}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-sm)" }}>
            <Badge tone={tenant.active ? "success" : "danger"}>{tenant.active ? "Attivo" : "Disattivato"}</Badge>
            {canWrite && (
              <Button variant="secondary" onClick={() => setConfirmAction("toggle")} disabled={toggling}>
                {tenant.active ? "Disattiva" : "Attiva"}
              </Button>
            )}
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
                {showApiKey ? tenant.apiKey : maskApiKey(tenant.apiKey)}
              </code>
              <Button variant="secondary" onClick={() => setShowApiKey((v) => !v)}>
                {showApiKey ? "Nascondi" : "Mostra"}
              </Button>
              <Button variant="secondary" onClick={() => void handleCopyKey()}>{copyLabel}</Button>
              {canWrite && (
                <Button variant="secondary" onClick={() => setConfirmAction("rotate")}>Rigenera</Button>
              )}
            </div>
          </div>

          {statsError ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-sm)", alignItems: "flex-start" }}>
              <span style={{ color: "var(--color-danger)", fontSize: "var(--text-sm)" }}>{statsError}</span>
              <Button variant="secondary" onClick={loadStats}>Riprova</Button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--sp-sm)" }}>
              <StatCard label="Categorie" value={stats ? String(stats.categoriesCount) : "—"} />
              <StatCard label="Prodotti" value={stats ? String(stats.productsCount) : "—"} />
              <StatCard label="Ordini totali" value={stats ? String(stats.ordersCount) : "—"} />
              <StatCard label="Fatturato totale" value={stats ? formatEur(stats.totalRevenue) : "—"} />
            </div>
          )}

          {stats && stats.recentOrders.length > 0 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-400)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Ultimi {stats.recentOrders.length} ordini
                </div>
                <Button variant="secondary" onClick={() => void handleExportCsv()} loading={exporting}>
                  Esporta CSV
                </Button>
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

          {currentUser.isSuperAdmin && (
            <div style={{ borderTop: "1px solid var(--color-gray-100)", paddingTop: "var(--sp-md)" }}>
              <Button variant="danger" onClick={() => setConfirmAction("delete")}>Elimina tenant</Button>
            </div>
          )}
        </>
      )}

      {tab === "users" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-md)" }}>
          {canManageUsers && (
            <div style={{ display: "flex", gap: "8px" }}>
              <Input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Email da invitare"
                type="email"
                style={{ flex: 1 }}
              />
              <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as TenantUserRole)} style={{ width: "140px" }}>
                <option value="operator">Operator</option>
                <option value="owner">Owner</option>
              </Select>
              <Button onClick={() => void handleInvite()} loading={inviting} disabled={!inviteEmail.trim()}>
                Invita
              </Button>
            </div>
          )}

          {usersError ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-sm)", alignItems: "flex-start" }}>
              <span style={{ color: "var(--color-danger)", fontSize: "var(--text-sm)" }}>{usersError}</span>
              <Button variant="secondary" onClick={loadUsers}>Riprova</Button>
            </div>
          ) : tenantUsers.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--color-gray-400)", padding: "var(--sp-lg) 0" }}>Nessun utente associato</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {tenantUsers.map((u) => (
                <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--color-gray-50)", borderRadius: "var(--radius-md)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{u.email}</span>
                    <Badge tone={u.role === "owner" ? "brand" : "neutral"}>{u.role}</Badge>
                  </div>
                  {canManageUsers && (currentUser.isSuperAdmin || u.role !== "owner") && (
                    <Button variant="ghost" onClick={() => setRemoveTarget(u)}>Rimuovi</Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "audit" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {auditError ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-sm)", alignItems: "flex-start" }}>
              <span style={{ color: "var(--color-danger)", fontSize: "var(--text-sm)" }}>{auditError}</span>
              <Button variant="secondary" onClick={loadAudit}>Riprova</Button>
            </div>
          ) : !auditPage ? (
            <div style={{ textAlign: "center", color: "var(--color-gray-400)", padding: "var(--sp-lg) 0" }}>Caricamento...</div>
          ) : auditPage.items.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--color-gray-400)", padding: "var(--sp-lg) 0" }}>Nessuna azione registrata</div>
          ) : (
            auditPage.items.map((entry) => (
              <div key={entry.id} style={{ padding: "8px 12px", background: "var(--color-gray-50)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)" }}>
                <div style={{ fontWeight: 600 }}>{entry.action}</div>
                <div style={{ color: "var(--color-gray-500)", fontSize: "var(--text-xs)" }}>{formatDate(entry.createdAt)}</div>
              </div>
            ))
          )}
        </div>
      )}

      {confirmAction === "delete" && (
        <ConfirmDialog
          title="Elimina tenant"
          description={`Confermi l'eliminazione definitiva di "${tenant.name}"? L'operazione non è reversibile.`}
          confirmLabel="Elimina"
          onConfirm={handleDelete}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {confirmAction === "rotate" && (
        <ConfirmDialog
          title="Rigenera API key"
          description="La chiave attuale smetterà di funzionare immediatamente: la cassa dovrà essere riconfigurata con la nuova chiave."
          confirmLabel="Rigenera"
          onConfirm={handleRotateKey}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {confirmAction === "toggle" && (
        <ConfirmDialog
          title={tenant.active ? "Disattiva tenant" : "Attiva tenant"}
          description={tenant.active
            ? "Il tenant disattivato non potrà più sincronizzare il menu né ricevere ordini."
            : "Il tenant tornerà operativo e potrà sincronizzare il menu e ricevere ordini."}
          confirmLabel={tenant.active ? "Disattiva" : "Attiva"}
          danger={tenant.active}
          onConfirm={handleToggleActive}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {removeTarget && (
        <ConfirmDialog
          title="Rimuovi utente"
          description={`Confermi la rimozione di ${removeTarget.email} da questo tenant?`}
          confirmLabel="Rimuovi"
          onConfirm={async () => { await handleRemoveUser(removeTarget); setRemoveTarget(null); }}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
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
