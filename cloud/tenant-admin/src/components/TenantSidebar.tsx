import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import type { Tenant } from "../core/types.js";
import { visibleTenantTabs, TENANT_TAB_LABEL, type TenantDetailTab } from "../screens/TenantDetail.js";

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={active ? undefined : "tenant-sidebar-tab"}
      style={{
        display: "flex", alignItems: "center", width: "100%",
        minHeight: "42px", padding: "0 12px", borderRadius: "var(--radius-md)",
        fontSize: "var(--text-sm)", fontWeight: 600, textAlign: "left", fontFamily: "var(--font)",
        background: active ? "var(--color-white)" : "transparent",
        color: active ? "var(--color-brand)" : "var(--color-gray-700)",
        boxShadow: active ? "var(--shadow-sm)" : "none",
        border: active ? "1px solid var(--color-gray-200)" : "1px solid transparent",
      }}
    >
      {children}
    </button>
  );
}

const CONTENT_TABS: TenantDetailTab[] = ["categories", "products"];
const ACCESS_TABS: TenantDetailTab[] = ["users", "audit"];

export function TenantSidebar({ tenant, tab, canWrite, isSuperAdmin, onNavigate }: {
  tenant: Tenant;
  tab: TenantDetailTab;
  canWrite: boolean;
  isSuperAdmin: boolean;
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();

  function go(next: TenantDetailTab) {
    navigate(`/tenants/${tenant.id}/${next}`);
    onNavigate?.();
  }

  const allowed = new Set(visibleTenantTabs(canWrite, isSuperAdmin));
  const contentTabs = CONTENT_TABS.filter((t) => allowed.has(t));
  const accessTabs = ACCESS_TABS.filter((t) => allowed.has(t));

  return (
    <aside
      className="tenant-sidebar scrollable"
      style={{
        width: "232px", flexShrink: 0, height: "100%",
        background: "var(--color-white)", borderRight: "1px solid var(--color-gray-200)",
        padding: "16px 12px", display: "flex", flexDirection: "column", gap: "16px",
      }}
    >
      <button
        onClick={() => { navigate("/tenants"); onNavigate?.(); }}
        style={{
          display: "flex", alignItems: "center", gap: "7px",
          padding: "6px 4px", fontSize: "var(--text-xs)", fontWeight: 600,
          color: "var(--color-gray-500)", textAlign: "left", fontFamily: "var(--font)",
          alignSelf: "flex-start",
        }}
      >
        <ArrowLeftIcon width={13} height={13} />
        Tutti i locali
      </button>

      <div
        style={{
          padding: "14px", borderRadius: "var(--radius-lg)",
          background: "var(--color-gray-50)", border: "1px solid var(--color-gray-200)",
        }}
      >
        <div style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--color-gray-900)", wordBreak: "break-word", lineHeight: 1.25 }}>
          {tenant.name}
        </div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", marginTop: "3px" }}>/{tenant.slug}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
        <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-gray-400)", padding: "0 10px 6px" }}>
          Generale
        </span>
        <TabButton active={tab === "overview"} onClick={() => go("overview")}>{TENANT_TAB_LABEL.overview}</TabButton>
        {allowed.has("integration") && (
          <TabButton active={tab === "integration"} onClick={() => go("integration")}>{TENANT_TAB_LABEL.integration}</TabButton>
        )}
        {allowed.has("appearance") && (
          <TabButton active={tab === "appearance"} onClick={() => go("appearance")}>{TENANT_TAB_LABEL.appearance}</TabButton>
        )}
      </div>

      {contentTabs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
          <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-gray-400)", padding: "0 10px 6px" }}>
            Contenuti
          </span>
          {contentTabs.map((key) => (
            <TabButton key={key} active={tab === key} onClick={() => go(key)}>
              {TENANT_TAB_LABEL[key]}
            </TabButton>
          ))}
        </div>
      )}

      {accessTabs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
          <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-gray-400)", padding: "0 10px 6px" }}>
            Accesso
          </span>
          {accessTabs.map((key) => (
            <TabButton key={key} active={tab === key} onClick={() => go(key)}>
              {TENANT_TAB_LABEL[key]}
            </TabButton>
          ))}
        </div>
      )}

      {allowed.has("settings") && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1px", marginTop: "auto", paddingTop: "16px", borderTop: "1px solid var(--color-gray-100)" }}>
          <TabButton active={tab === "settings"} onClick={() => go("settings")}>{TENANT_TAB_LABEL.settings}</TabButton>
        </div>
      )}
    </aside>
  );
}
