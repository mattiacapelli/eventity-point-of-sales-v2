import { useEffect, useRef, useState } from "react";
import type { ComponentType, SVGProps } from "react";
import {
  TagIcon,
  CubeIcon,
  ClipboardDocumentListIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PencilSquareIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";
import type { AuditLogEntry, CategoryRecord, CurrentUser, Paginated, ProductRecord, Tenant, TenantStats, TenantUser, TenantUserRole } from "../core/types.js";
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
  importMenu,
  listCategories,
  reorderCategories,
  listProducts,
  renameProduct,
  uploadTenantLogo,
  deleteTenantLogo,
  updateTenantBranding,
  updateTenantSettings,
  updateCategoryEmoji,
  updateProductAvailability,
  uploadProductImage,
  deleteProductImage,
  API_BASE,
} from "../core/api-client.js";
import { Button } from "../components/Button.js";
import { Badge } from "../components/Badge.js";
import { Input, Select } from "../components/Input.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { useToast } from "../components/Toast.js";
import { AvailableDatesEditor } from "../components/AvailableDatesEditor.js";

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

type Tab = "overview" | "catalog" | "users" | "audit";

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

  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);
  const [colorBrand, setColorBrand] = useState(tenant.colorBrand ?? "#306B34");
  const [colorAccent, setColorAccent] = useState(tenant.colorAccent ?? "#C2E812");
  const [savingBranding, setSavingBranding] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [savingSettings, setSavingSettings] = useState(false);

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
    setColorBrand(tenant.colorBrand ?? "#306B34");
    setColorAccent(tenant.colorAccent ?? "#C2E812");
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

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPendingImportFile(file);
    if (file) setConfirmImport(true);
    e.target.value = "";
  }

  async function handleConfirmImport() {
    if (!pendingImportFile) return;
    let payload: unknown;
    try {
      payload = JSON.parse(await pendingImportFile.text());
    } catch {
      throw new Error("Il file selezionato non è un JSON valido");
    }
    const result = await importMenu(tenant.id, payload);
    setConfirmImport(false);
    setPendingImportFile(null);
    loadStats();
    showToast(`Menu importato: ${result.categories} categorie, ${result.products} prodotti, ${result.optionGroups} gruppi opzione`);
  }

  async function handleLogoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return;
    setUploadingLogo(true);
    try {
      const { logoPath } = await uploadTenantLogo(tenant.id, file);
      onUpdated({ ...tenant, logoPath });
      showToast("Logo caricato");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossibile caricare il logo", "error");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleRemoveLogo() {
    setRemovingLogo(true);
    try {
      await deleteTenantLogo(tenant.id);
      onUpdated({ ...tenant, logoPath: null });
      showToast("Logo rimosso");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossibile rimuovere il logo", "error");
    } finally {
      setRemovingLogo(false);
    }
  }

  async function handleSaveBranding() {
    setSavingBranding(true);
    try {
      const updated = await updateTenantBranding(tenant.id, { colorBrand, colorAccent });
      onUpdated({ ...tenant, colorBrand: updated.colorBrand, colorAccent: updated.colorAccent });
      showToast("Colori aggiornati");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossibile aggiornare i colori", "error");
    } finally {
      setSavingBranding(false);
    }
  }

  async function handleToggleSetting(key: "requireTableId" | "requireCustomerName") {
    setSavingSettings(true);
    try {
      const updated = await updateTenantSettings(tenant.id, { [key]: !tenant[key] });
      onUpdated({ ...tenant, ...updated });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossibile aggiornare le impostazioni", "error");
    } finally {
      setSavingSettings(false);
    }
  }

  const orderUrl = `${window.location.origin.replace(/:\d+$/, ":5174")}/?t=${tenant.slug}`;
  const logoUrl = tenant.logoPath ? `${API_BASE}/api/static/${tenant.logoPath}` : null;

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
        {(canWrite ? (["overview", "catalog", "users", "audit"] as Tab[]) : (["overview"] as Tab[])).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 0",
              fontSize: "var(--text-sm)",
              fontWeight: 700,
              color: tab === t ? "var(--color-brand)" : "var(--color-gray-400)",
              borderBottom: tab === t ? "2px solid var(--color-brand)" : "2px solid transparent",
            }}
          >
            {t === "overview" ? "Panoramica" : t === "catalog" ? "Catalogo" : t === "users" ? "Utenti" : "Audit log"}
            {t === "users" && tenantUsers.length > 0 && (
              <Badge tone={tab === t ? "brand" : "neutral"}>{tenantUsers.length}</Badge>
            )}
            {t === "audit" && auditPage && auditPage.total > 0 && (
              <Badge tone={tab === t ? "brand" : "neutral"}>{auditPage.total}</Badge>
            )}
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

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--sp-md)",
              padding: "var(--sp-md)",
              background: "var(--color-gray-50)",
              border: "1px solid var(--color-gray-100)",
              borderRadius: "var(--radius-lg)",
            }}
          >
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
                <code style={{ flex: 1, padding: "8px 12px", background: "var(--color-white)", border: "1px solid var(--color-gray-200)", borderRadius: "var(--radius-md)", fontSize: "var(--text-xs)", wordBreak: "break-all" }}>
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
          </div>

          {canWrite && (
            <div>
              <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-400)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                Aspetto (menu self-order)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-md)", padding: "var(--sp-md)", background: "var(--color-gray-50)", border: "1px solid var(--color-gray-100)", borderRadius: "var(--radius-lg)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-md)" }}>
                  <div
                    style={{
                      width: "56px", height: "56px", borderRadius: "50%",
                      background: logoUrl ? "var(--color-white)" : "var(--color-gray-100)",
                      border: "1px solid var(--color-gray-200)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      overflow: "hidden", flexShrink: 0,
                    }}
                  >
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    ) : (
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>Logo</span>
                    )}
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => void handleLogoSelected(e)}
                    style={{ display: "none" }}
                  />
                  <Button variant="secondary" onClick={() => logoInputRef.current?.click()} loading={uploadingLogo}>
                    {logoUrl ? "Cambia logo" : "Carica logo"}
                  </Button>
                  {logoUrl && (
                    <Button variant="ghost" onClick={() => void handleRemoveLogo()} loading={removingLogo}>
                      Rimuovi
                    </Button>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-lg)" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "var(--text-sm)", fontWeight: 600 }}>
                    Colore principale
                    <input type="color" value={colorBrand} onChange={(e) => setColorBrand(e.target.value)} style={{ width: "36px", height: "28px", padding: 0, border: "1px solid var(--color-gray-200)", borderRadius: "var(--radius-sm)" }} />
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "var(--text-sm)", fontWeight: 600 }}>
                    Colore accento
                    <input type="color" value={colorAccent} onChange={(e) => setColorAccent(e.target.value)} style={{ width: "36px", height: "28px", padding: 0, border: "1px solid var(--color-gray-200)", borderRadius: "var(--radius-sm)" }} />
                  </label>
                  <Button variant="secondary" onClick={() => void handleSaveBranding()} loading={savingBranding}>
                    Salva colori
                  </Button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingTop: "var(--sp-sm)", borderTop: "1px solid var(--color-gray-100)" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "var(--text-sm)", fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={tenant.requireTableId}
                      disabled={savingSettings}
                      onChange={() => void handleToggleSetting("requireTableId")}
                    />
                    Tavolo obbligatorio
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "var(--text-sm)", fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={tenant.requireCustomerName}
                      disabled={savingSettings}
                      onChange={() => void handleToggleSetting("requireCustomerName")}
                    />
                    Nome cliente obbligatorio
                  </label>
                </div>
              </div>
            </div>
          )}

          {canWrite && (
            <div>
              <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-400)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                Importa menu da file
              </div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)", marginBottom: "8px" }}>
                Carica il file JSON esportato dalla cassa (tab Catalogo → Cloud). Sostituisce l'intero catalogo attuale.
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleFileSelected}
                style={{ display: "none" }}
              />
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                Scegli file e importa
              </Button>
            </div>
          )}

          {statsError ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-sm)", alignItems: "flex-start" }}>
              <span style={{ color: "var(--color-danger)", fontSize: "var(--text-sm)" }}>{statsError}</span>
              <Button variant="secondary" onClick={loadStats}>Riprova</Button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--sp-sm)" }}>
              <StatCard label="Valore ordini richiesti" value={stats ? formatEur(stats.totalRevenue) : "—"} Icon={BanknotesIcon} accent />
              <StatCard label="Ordini totali" value={stats ? String(stats.ordersCount) : "—"} Icon={ClipboardDocumentListIcon} />
              <StatCard label="Prodotti" value={stats ? String(stats.productsCount) : "—"} Icon={CubeIcon} />
              <StatCard label="Categorie" value={stats ? String(stats.categoriesCount) : "—"} Icon={TagIcon} />
            </div>
          )}

          {stats && (
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--sp-md)", alignItems: "start" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-400)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Ultimi {stats.recentOrders.length} ordini
                  </div>
                  <Button variant="secondary" onClick={() => void handleExportCsv()} loading={exporting}>
                    Esporta CSV
                  </Button>
                </div>
                {stats.recentOrders.length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--color-gray-400)", padding: "var(--sp-lg) 0", fontSize: "var(--text-sm)" }}>Nessun ordine ancora</div>
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
                <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-400)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" }}>
                  Stato del locale
                </div>
                <StatusRow ok={stats.categoriesCount > 0} label={stats.categoriesCount > 0 ? "Categorie configurate" : "Nessuna categoria configurata"} />
                <StatusRow ok={stats.productsCount > 0} label={stats.productsCount > 0 ? "Menu configurato" : "Nessun prodotto nel menu"} />
                <StatusRow ok={tenant.active} label={tenant.active ? "Tenant attivo" : "Tenant disattivato"} />
              </div>
            </div>
          )}

          {currentUser.isSuperAdmin && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--sp-md)",
                marginTop: "var(--sp-sm)",
                padding: "var(--sp-md)",
                border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: "var(--radius-lg)",
                background: "rgba(239,68,68,0.04)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <ExclamationTriangleIcon width={20} height={20} color="var(--color-danger)" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-gray-800)" }}>Zona pericolosa</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-500)" }}>L'eliminazione del tenant non è reversibile.</div>
                </div>
              </div>
              <Button variant="danger" onClick={() => setConfirmAction("delete")}>Elimina tenant</Button>
            </div>
          )}
        </>
      )}

      {tab === "catalog" && <CatalogTab tenantId={tenant.id} />}

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
      {confirmImport && pendingImportFile && (
        <ConfirmDialog
          title="Importa menu"
          description={`Questa operazione sostituirà l'intero catalogo attuale del tenant con il contenuto di "${pendingImportFile.name}". L'operazione non è reversibile. Continuare?`}
          confirmLabel="Importa"
          onConfirm={handleConfirmImport}
          onCancel={() => { setConfirmImport(false); setPendingImportFile(null); }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, Icon, accent }: { label: string; value: string; Icon: ComponentType<SVGProps<SVGSVGElement>>; accent?: boolean }) {
  if (accent) {
    return (
      <div
        style={{
          background: "linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-dark) 100%)",
          borderRadius: "var(--radius-md)", padding: "var(--sp-md)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", textAlign: "center",
        }}
      >
        <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon width={16} height={16} color="var(--color-white)" />
        </div>
        <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-white)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
        <div style={{ fontSize: "var(--text-xs)", color: "rgba(255,255,255,0.85)" }}>{label}</div>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--color-gray-50)", borderRadius: "var(--radius-md)", padding: "var(--sp-md)", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", textAlign: "center" }}>
      <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "rgba(48,107,52,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon width={16} height={16} color="var(--color-brand)" />
      </div>
      <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-brand)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-500)" }}>{label}</div>
    </div>
  );
}

function StatusRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", fontSize: "var(--text-sm)", color: "var(--color-gray-700)" }}>
      <span style={{ width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0, background: ok ? "#16a34a" : "var(--color-danger)" }} />
      {label}
    </div>
  );
}

function CatalogTab({ tenantId }: { tenantId: string }) {
  const { showToast } = useToast();
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingProductId, setSavingProductId] = useState<number | null>(null);
  const [editingAvailabilityId, setEditingAvailabilityId] = useState<number | null>(null);
  const [uploadingImageId, setUploadingImageId] = useState<number | null>(null);
  const productImageInputRef = useRef<HTMLInputElement>(null);
  const [imageTargetProductId, setImageTargetProductId] = useState<number | null>(null);

  function loadCategories() {
    setCategoriesError(null);
    listCategories(tenantId)
      .then((rows) => setCategories(rows.slice().sort((a, b) => a.sortOrder - b.sortOrder)))
      .catch((err) => setCategoriesError(err instanceof Error ? err.message : "Impossibile caricare le categorie"));
  }

  function loadProducts() {
    setProductsError(null);
    listProducts(tenantId)
      .then(setProducts)
      .catch((err) => setProductsError(err instanceof Error ? err.message : "Impossibile caricare i prodotti"));
  }

  useEffect(() => {
    loadCategories();
    loadProducts();
  }, [tenantId]);

  const [editingEmojiId, setEditingEmojiId] = useState<number | null>(null);
  const [editingEmojiValue, setEditingEmojiValue] = useState("");

  function startEditingEmoji(category: CategoryRecord) {
    setEditingEmojiId(category.id);
    setEditingEmojiValue(category.emoji ?? "");
  }

  async function saveEmoji(category: CategoryRecord) {
    const trimmed = editingEmojiValue.trim();
    const nextEmoji = trimmed || null;
    setEditingEmojiId(null);
    if (nextEmoji === category.emoji) return;
    try {
      const updated = await updateCategoryEmoji(tenantId, category.id, nextEmoji);
      setCategories((prev) => prev.map((c) => (c.id === category.id ? updated : c)));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossibile aggiornare l'emoji", "error");
    }
  }

  async function moveCategory(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const reordered = categories.slice();
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex]!, reordered[index]!];
    const previous = categories;
    setCategories(reordered);
    setReordering(true);
    try {
      await reorderCategories(tenantId, reordered.map((c) => c.id));
    } catch (err) {
      setCategories(previous);
      showToast(err instanceof Error ? err.message : "Impossibile riordinare le categorie", "error");
    } finally {
      setReordering(false);
    }
  }

  function startEditing(product: ProductRecord) {
    setEditingProductId(product.id);
    setEditingName(product.name);
  }

  async function saveProductName(product: ProductRecord) {
    const trimmed = editingName.trim();
    if (!trimmed || trimmed === product.name) {
      setEditingProductId(null);
      return;
    }
    setSavingProductId(product.id);
    try {
      const updated = await renameProduct(tenantId, product.id, trimmed);
      setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)));
      showToast("Prodotto rinominato");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossibile rinominare il prodotto", "error");
    } finally {
      setSavingProductId(null);
      setEditingProductId(null);
    }
  }

  async function handleAvailabilityChange(product: ProductRecord, dates: string[]) {
    const nextDates = dates.length > 0 ? dates : null;
    try {
      const updated = await updateProductAvailability(tenantId, product.id, nextDates);
      setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossibile aggiornare la disponibilità", "error");
    }
  }

  function openImagePicker(productId: number) {
    setImageTargetProductId(productId);
    productImageInputRef.current?.click();
  }

  async function handleImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    const productId = imageTargetProductId;
    if (!file || productId === null) return;
    setUploadingImageId(productId);
    try {
      const updated = await uploadProductImage(tenantId, productId, file);
      setProducts((prev) => prev.map((p) => (p.id === productId ? updated : p)));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossibile caricare l'immagine", "error");
    } finally {
      setUploadingImageId(null);
      setImageTargetProductId(null);
    }
  }

  async function handleRemoveImage(product: ProductRecord) {
    setUploadingImageId(product.id);
    try {
      await deleteProductImage(tenantId, product.id);
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, imagePath: null } : p)));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossibile rimuovere l'immagine", "error");
    } finally {
      setUploadingImageId(null);
    }
  }

  const categoryNameById = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-lg)" }}>
      <div>
        <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-gray-800)", marginBottom: "8px" }}>
          Ordine categorie
        </div>
        {categoriesError ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-sm)", alignItems: "flex-start" }}>
            <span style={{ color: "var(--color-danger)", fontSize: "var(--text-sm)" }}>{categoriesError}</span>
            <Button variant="secondary" onClick={loadCategories}>Riprova</Button>
          </div>
        ) : categories.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--color-gray-400)", padding: "var(--sp-lg) 0" }}>Nessuna categoria</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {categories.map((c, index) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "var(--color-gray-50)", borderRadius: "var(--radius-md)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {editingEmojiId === c.id ? (
                    <input
                      value={editingEmojiValue}
                      onChange={(e) => setEditingEmojiValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void saveEmoji(c);
                        if (e.key === "Escape") setEditingEmojiId(null);
                      }}
                      onBlur={() => void saveEmoji(c)}
                      placeholder="🍕"
                      maxLength={8}
                      autoFocus
                      style={{ width: "40px", textAlign: "center", padding: "4px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-gray-200)", fontSize: "var(--text-md)" }}
                    />
                  ) : (
                    <button
                      onClick={() => startEditingEmoji(c)}
                      aria-label="Imposta emoji"
                      style={{ width: "28px", height: "28px", borderRadius: "var(--radius-sm)", border: "1px dashed var(--color-gray-300)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "var(--text-md)" }}
                    >
                      {c.emoji ?? "＋"}
                    </button>
                  )}
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{c.name}</span>
                </div>
                <div style={{ display: "flex", gap: "4px" }}>
                  <button
                    onClick={() => void moveCategory(index, -1)}
                    disabled={index === 0 || reordering}
                    aria-label="Sposta su"
                    style={{ width: "28px", height: "28px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-gray-200)", background: "var(--color-white)", display: "flex", alignItems: "center", justifyContent: "center", opacity: index === 0 ? 0.4 : 1 }}
                  >
                    <ArrowUpIcon width={14} height={14} />
                  </button>
                  <button
                    onClick={() => void moveCategory(index, 1)}
                    disabled={index === categories.length - 1 || reordering}
                    aria-label="Sposta giù"
                    style={{ width: "28px", height: "28px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-gray-200)", background: "var(--color-white)", display: "flex", alignItems: "center", justifyContent: "center", opacity: index === categories.length - 1 ? 0.4 : 1 }}
                  >
                    <ArrowDownIcon width={14} height={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-gray-800)", marginBottom: "8px" }}>
          Prodotti
        </div>
        {productsError ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-sm)", alignItems: "flex-start" }}>
            <span style={{ color: "var(--color-danger)", fontSize: "var(--text-sm)" }}>{productsError}</span>
            <Button variant="secondary" onClick={loadProducts}>Riprova</Button>
          </div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--color-gray-400)", padding: "var(--sp-lg) 0" }}>Nessun prodotto</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <input
              ref={productImageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => void handleImageSelected(e)}
              style={{ display: "none" }}
            />
            {products.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "var(--color-gray-50)", borderRadius: "var(--radius-md)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <button
                      onClick={() => openImagePicker(p.id)}
                      disabled={uploadingImageId === p.id}
                      style={{
                        width: "40px", height: "40px", borderRadius: "var(--radius-md)",
                        overflow: "hidden", border: "1px solid var(--color-gray-200)",
                        background: "var(--color-white)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        opacity: uploadingImageId === p.id ? 0.5 : 1,
                      }}
                      aria-label="Carica immagine"
                    >
                      {p.imagePath ? (
                        <img src={`${API_BASE}/api/static/${p.imagePath}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>＋</span>
                      )}
                    </button>
                    {p.imagePath && (
                      <button
                        onClick={() => void handleRemoveImage(p)}
                        disabled={uploadingImageId === p.id}
                        aria-label="Rimuovi immagine"
                        style={{
                          position: "absolute", top: "-6px", right: "-6px",
                          width: "18px", height: "18px", borderRadius: "50%",
                          background: "var(--color-danger)", color: "var(--color-white)",
                          fontSize: "10px", fontWeight: 700, lineHeight: "18px", textAlign: "center",
                          border: "2px solid var(--color-gray-50)",
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1, minWidth: 0 }}>
                  {editingProductId === p.id ? (
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void saveProductName(p);
                        if (e.key === "Escape") setEditingProductId(null);
                      }}
                      onBlur={() => void saveProductName(p)}
                      autoFocus
                      disabled={savingProductId === p.id}
                    />
                  ) : (
                    <button
                      onClick={() => startEditing(p)}
                      style={{ display: "flex", alignItems: "center", gap: "6px", textAlign: "left" }}
                    >
                      <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{p.name}</span>
                      <PencilSquareIcon width={14} height={14} color="var(--color-gray-400)" />
                    </button>
                  )}
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>
                    {categoryNameById[p.categoryId] ?? "—"} · <code>#{p.id}</code>
                  </span>
                  </div>
                </div>

                <div style={{ position: "relative", flexShrink: 0 }}>
                  <button
                    onClick={() => setEditingAvailabilityId(editingAvailabilityId === p.id ? null : p.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: "6px",
                      padding: "6px 10px", borderRadius: "var(--radius-md)",
                      border: `1px solid ${p.availableDates ? "var(--color-brand)" : "var(--color-gray-200)"}`,
                      background: "var(--color-white)",
                      color: p.availableDates ? "var(--color-brand)" : "var(--color-gray-500)",
                      fontSize: "var(--text-xs)", fontWeight: 600,
                    }}
                  >
                    <CalendarDaysIcon width={14} height={14} />
                    {p.availableDates ? `${p.availableDates.length} giorni` : "Sempre visibile"}
                  </button>
                  {editingAvailabilityId === p.id && (
                    <AvailableDatesEditor
                      dates={p.availableDates ?? []}
                      onChange={(dates) => void handleAvailabilityChange(p, dates)}
                      onClose={() => setEditingAvailabilityId(null)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
