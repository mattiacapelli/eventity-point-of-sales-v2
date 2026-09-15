import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Bars3Icon } from "@heroicons/react/24/outline";
import type { CurrentUser, Tenant } from "../core/types.js";
import { getTenant } from "../core/api-client.js";
import { useTenantCanWrite } from "../core/useTenantRole.js";
import { useActiveTenant } from "../core/tenant-context.js";
import { TenantSidebar } from "../components/TenantSidebar.js";
import { TenantDetail, visibleTenantTabs, TENANT_TAB_LABEL, type TenantDetailTab } from "./TenantDetail.js";

const VALID_TABS: TenantDetailTab[] = ["overview", "integration", "appearance", "categories", "products", "users", "audit", "settings"];

/** Resolves :id/:tab from the URL, fetches the tenant, and keeps the tab valid for the resolved write access. */
export function TenantDetailRoute({ currentUser }: { currentUser: CurrentUser }) {
  const { id, tab: tabParam } = useParams<{ id: string; tab: string }>();
  const navigate = useNavigate();
  const { setTenant: setActiveTenant } = useActiveTenant();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usersCount, setUsersCount] = useState<number | null>(null);
  const [auditCount, setAuditCount] = useState<number | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const canWrite = useTenantCanWrite(tenant, currentUser);
  const tab: TenantDetailTab = VALID_TABS.includes(tabParam as TenantDetailTab) ? (tabParam as TenantDetailTab) : "overview";

  useEffect(() => {
    if (!id) return;
    setTenant(null);
    setError(null);
    setUsersCount(null);
    setAuditCount(null);
    getTenant(id)
      .then((t) => { setTenant(t); setActiveTenant(t); })
      .catch((err) => setError(err instanceof Error ? err.message : "Impossibile caricare l'evento"));
    return () => setActiveTenant(null);
  }, [id]);

  // Once the real role resolves, fall back to a visible tab if the current one requires write access we don't have.
  useEffect(() => {
    if (!tenant) return;
    const allowed = visibleTenantTabs(canWrite, currentUser.isSuperAdmin);
    if (!allowed.includes(tab)) navigate(`/tenants/${tenant.id}/overview`, { replace: true });
  }, [tenant, canWrite, tab, currentUser.isSuperAdmin]);

  if (error) {
    return (
      <div style={{ padding: "var(--sp-xl)", textAlign: "center", color: "var(--color-danger)" }}>
        {error}
      </div>
    );
  }

  if (!tenant) {
    return (
      <div style={{ padding: "var(--sp-xl)", textAlign: "center", color: "var(--color-gray-400)" }}>
        Caricamento...
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0, minWidth: 0, overflow: "hidden", position: "relative" }}>
      <div className="tenant-sidebar-desktop">
        <TenantSidebar tenant={tenant} tab={tab} canWrite={canWrite} isSuperAdmin={currentUser.isSuperAdmin} />
      </div>

      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          style={{ position: "fixed", inset: 0, top: "64px", background: "var(--overlay)", zIndex: 99 }}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <TenantSidebar tenant={tenant} tab={tab} canWrite={canWrite} isSuperAdmin={currentUser.isSuperAdmin} onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}

      <div className="scrollable" style={{ flex: 1, minWidth: 0, overflowX: "hidden", padding: "var(--sp-lg) var(--sp-xl)" }}>
        <button
          onClick={() => setMobileNavOpen(true)}
          className="tenant-sidebar-toggle"
          aria-label="Apri menu evento"
          data-testid="tenant-sidebar-toggle"
          style={{
            display: "none", alignItems: "center", gap: "8px", marginBottom: "var(--sp-md)",
            padding: "8px 12px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-gray-200)",
            background: "var(--color-white)", color: "var(--color-gray-700)", fontSize: "13px", fontWeight: 600,
          }}
        >
          <Bars3Icon width={16} height={16} />
          {TENANT_TAB_LABEL[tab]}
        </button>

        <TenantDetail
          tenant={tenant}
          currentUser={currentUser}
          tab={tab}
          canWrite={canWrite}
          onUsersCountChange={setUsersCount}
          onAuditCountChange={setAuditCount}
          onUpdated={(t) => { setTenant(t); setActiveTenant(t); }}
          onDeleted={() => navigate("/tenants")}
        />
      </div>
    </div>
  );
}
