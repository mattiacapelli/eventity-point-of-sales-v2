import type { CurrentUser, Tenant } from "../core/types.js";
import { PageHeader } from "../components/PageHeader.js";
import { OverviewTab } from "./tenant-detail/OverviewTab.js";
import { TenantStatusToggle } from "./tenant-detail/TenantStatusToggle.js";
import { IntegrationTab } from "./tenant-detail/IntegrationTab.js";
import { AppearanceTab } from "./tenant-detail/AppearanceTab.js";
import { SettingsTab } from "./tenant-detail/SettingsTab.js";
import { CategoriesPanel } from "./tenant-detail/CategoriesPanel.js";
import { ProductsPanel } from "./tenant-detail/ProductsPanel.js";
import { UsersPanel } from "./tenant-detail/UsersPanel.js";
import { AuditLogPanel } from "./tenant-detail/AuditLogPanel.js";

export type TenantDetailTab = "overview" | "integration" | "appearance" | "categories" | "products" | "users" | "audit" | "settings";

export const TENANT_TAB_LABEL: Record<TenantDetailTab, string> = {
  overview: "Panoramica",
  integration: "Integrazione",
  appearance: "Aspetto",
  categories: "Categorie",
  products: "Prodotti",
  users: "Utenti",
  audit: "Audit log",
  settings: "Impostazioni",
};

const TENANT_TAB_DESCRIPTION: Record<TenantDetailTab, string> = {
  overview: "Stato dell'evento e statistiche degli ordini.",
  integration: "Link del menu self-order e chiave API per la cassa.",
  appearance: "Logo, colori e opzioni ordine mostrati ai clienti quando ordinano dal tavolo.",
  categories: "Ordina le categorie del menu e assegna un'emoji a ciascuna.",
  products: "Prodotti del catalogo, prezzi, immagini e disponibilità per data.",
  users: "Chi ha accesso a questo evento e con quale ruolo.",
  audit: "Cronologia delle azioni amministrative eseguite su questo evento.",
  settings: "Operazioni irreversibili su questo evento.",
};

/** Which tabs are visible for a given write-access level — shared with the sidebar so the nav list stays in sync. */
export function visibleTenantTabs(canWrite: boolean, isSuperAdmin: boolean): TenantDetailTab[] {
  if (!canWrite) return ["overview"];
  const tabs: TenantDetailTab[] = ["overview", "integration", "appearance", "categories", "products", "users", "audit"];
  if (isSuperAdmin) tabs.push("settings");
  return tabs;
}

export function TenantDetail({ tenant, currentUser, tab, canWrite, onUsersCountChange, onAuditCountChange, onUpdated, onDeleted }: {
  tenant: Tenant;
  currentUser: CurrentUser;
  tab: TenantDetailTab;
  canWrite: boolean;
  onUsersCountChange: (count: number) => void;
  onAuditCountChange: (count: number) => void;
  onUpdated: (t: Tenant) => void;
  onDeleted: (id: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <PageHeader
        eyebrow={TENANT_TAB_LABEL[tab]}
        title={tenant.name}
        description={TENANT_TAB_DESCRIPTION[tab]}
        showBack
        actions={tab === "overview" && (
          <TenantStatusToggle tenant={tenant} canWrite={canWrite} onUpdated={onUpdated} />
        )}
      />

      {tab === "overview" && <OverviewTab tenant={tenant} />}

      {tab === "integration" && <IntegrationTab tenant={tenant} canWrite={canWrite} onUpdated={onUpdated} />}

      {tab === "appearance" && <AppearanceTab tenant={tenant} onUpdated={onUpdated} />}

      {tab === "categories" && <CategoriesPanel tenantId={tenant.id} />}

      {tab === "products" && <ProductsPanel tenantId={tenant.id} />}

      {tab === "users" && (
        <UsersPanel tenantId={tenant.id} currentUser={currentUser} canManageUsers={canWrite} onCountChange={onUsersCountChange} />
      )}

      {tab === "audit" && <AuditLogPanel tenantId={tenant.id} onCountChange={onAuditCountChange} />}

      {tab === "settings" && currentUser.isSuperAdmin && (
        <SettingsTab tenantId={tenant.id} tenantName={tenant.name} onDeleted={onDeleted} />
      )}
    </div>
  );
}
