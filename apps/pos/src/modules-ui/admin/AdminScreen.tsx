import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PosLayout } from "../../layout/PosLayout.js";
import { adminApi } from "../../core/admin-api.js";
import { useAdminStore } from "../../state/admin-store.js";
import {
  CubeIcon,
  TagIcon,
  BuildingStorefrontIcon,
  ArrowLeftIcon,
  WrenchScrewdriverIcon,
  BanknotesIcon,
  PrinterIcon,
  DocumentTextIcon,
  ClockIcon,
  ArrowDownTrayIcon,
  CircleStackIcon,
  ListBulletIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  CloudArrowUpIcon,
} from "../../components/ui/icons.js";
import { BackupTab } from "./BackupTab.js";
import { CloudSyncTab } from "./CloudSyncTab.js";
import { RestaurantTab } from "./RestaurantTab.js";
import { ProductsTab } from "./ProductsTab.js";
import { CategoriesTab } from "./CategoriesTab.js";
import { ProductionCentersTab } from "./ProductionCentersTab.js";
import { PaymentMethodsTab } from "./PaymentMethodsTab.js";
import { PrintersTab } from "./PrintersTab.js";
import { ReceiptTemplateTab } from "./ReceiptTemplateTab.js";
import { KitchenTemplateTab } from "./KitchenTemplateTab.js";
import { ShiftReportTemplateTab } from "./ShiftReportTemplateTab.js";
import { AdvancedTab } from "./AdvancedTab.js";
import { ShiftsTab } from "./ShiftsTab.js";
import { InventoryTab } from "./InventoryTab.js";
import { MovementsTab } from "./MovementsTab.js";
import { TerminalsTab } from "./TerminalsTab.js";
import { UsersTab } from "./UsersTab.js";
import { LicenseTab } from "./LicenseTab.js";
import { InterfaceTab } from "./InterfaceTab.js";

// ─── Tab types ───────────────────────────────────────────────────────────────

type Tab = "restaurant" | "products" | "categories" | "production-centers" | "cloud-sync" | "payment-methods" | "printers" | "receipt-template" | "kitchen-template" | "shift-report-template" | "shifts" | "backup" | "advanced" | "interface" | "inventory" | "movements" | "terminals" | "users" | "license";

type TabDef = { key: Tab; label: string; Icon: React.ComponentType<React.SVGProps<SVGSVGElement>> };

// Single-entry groups (e.g. "Ristorante") render as a plain button, no dropdown.
type Group = { key: string; label: string; Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; tabs: TabDef[] };

const GROUPS: Group[] = [
  {
    key: "restaurant", label: "Ristorante", Icon: BuildingStorefrontIcon,
    tabs: [
      { key: "restaurant", label: "Ristorante", Icon: BuildingStorefrontIcon },
    ],
  },
  {
    key: "catalog", label: "Catalogo", Icon: CubeIcon,
    tabs: [
      { key: "categories", label: "Categorie", Icon: TagIcon },
      { key: "products", label: "Prodotti", Icon: CubeIcon },
      { key: "production-centers", label: "Centri di produzione", Icon: BuildingStorefrontIcon },
      { key: "cloud-sync", label: "Cloud", Icon: CloudArrowUpIcon },
    ],
  },
  {
    key: "sales", label: "Vendita", Icon: BanknotesIcon,
    tabs: [
      { key: "payment-methods", label: "Metodi pagamento", Icon: BanknotesIcon },
      { key: "printers", label: "Stampanti", Icon: PrinterIcon },
      { key: "receipt-template", label: "Scontrino", Icon: DocumentTextIcon },
      { key: "kitchen-template", label: "Comanda", Icon: PrinterIcon },
      { key: "shift-report-template", label: "Report Turno", Icon: DocumentTextIcon },
    ],
  },
  {
    key: "operations", label: "Operatività", Icon: ClockIcon,
    tabs: [
      { key: "shifts", label: "Turni", Icon: ClockIcon },
      { key: "terminals", label: "Terminali", Icon: WrenchScrewdriverIcon },
      { key: "users", label: "Utenti", Icon: UserGroupIcon },
    ],
  },
  {
    key: "inventory-group", label: "Magazzino", Icon: CircleStackIcon,
    tabs: [
      { key: "inventory", label: "Inventario", Icon: CircleStackIcon },
      { key: "movements", label: "Movimenti", Icon: ListBulletIcon },
    ],
  },
  {
    key: "system", label: "Sistema", Icon: WrenchScrewdriverIcon,
    tabs: [
      { key: "interface", label: "Interfaccia", Icon: WrenchScrewdriverIcon },
      { key: "backup", label: "Backup", Icon: ArrowDownTrayIcon },
      { key: "advanced", label: "Avanzate", Icon: WrenchScrewdriverIcon },
      { key: "license", label: "Licenza", Icon: ShieldCheckIcon },
    ],
  },
];

const ALL_TABS: TabDef[] = GROUPS.flatMap((g) => g.tabs);

// ─── AdminScreen ──────────────────────────────────────────────────────────────

// Which tabs require a module to be enabled (module name → tab keys)
const MODULE_TAB_MAP: Record<string, Tab[]> = {
  inventory: ["inventory", "movements"],
};

function SidebarGroup({ group, activeTab, isTabVisible, onSelect }: {
  group: Group;
  activeTab: Tab;
  isTabVisible: (key: Tab) => boolean;
  onSelect: (key: Tab) => void;
}) {
  const visibleTabs = group.tabs.filter((t) => isTabVisible(t.key));
  if (visibleTabs.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-gray-400)", padding: "4px 10px 6px" }}>
        {group.label}
      </span>
      {visibleTabs.map(({ key, label }) => {
        const active = activeTab === key;
        return (
          <button
            key={key}
            onClick={() => onSelect(key)}
            style={{
              display: "flex", alignItems: "center", width: "100%",
              minHeight: "44px", padding: "0 12px", borderRadius: "10px", border: "none",
              fontSize: "14.5px", fontWeight: 600, textAlign: "left", fontFamily: "var(--font)",
              background: active ? "#E8F0EA" : "transparent",
              color: active ? "var(--color-brand)" : "var(--color-gray-700)",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function AdminScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("restaurant");
  const { setCategories, setProducts, setProductionCenters, setLoading, loading } = useAdminStore();
  const navigate = useNavigate();
  const [lowStockCount, setLowStockCount] = useState(0);
  const [enabledModules, setEnabledModules] = useState<Set<string>>(new Set());
  const [multiTerminalEnabled, setMultiTerminalEnabled] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      adminApi.categories.list(),
      adminApi.products.list(),
      adminApi.productionCenters.list(),
    ])
      .then(([cats, prods, pcs]) => {
        setCategories(cats);
        setProducts(prods);
        setProductionCenters(pcs);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    adminApi.modules.list()
      .then((mods) => setEnabledModules(new Set(mods.filter((m) => m.enabled).map((m) => m.name))))
      .catch(() => setEnabledModules(new Set()));

    adminApi.inventory.getAlerts().then((alerts) => setLowStockCount(alerts.length)).catch(() => {});
    adminApi.settings.get().then((s) => setMultiTerminalEnabled(s.multiTerminalEnabled)).catch(() => {});
  }, []);

  function refreshEnabledModules() {
    adminApi.modules.list()
      .then((mods) => setEnabledModules(new Set(mods.filter((m) => m.enabled).map((m) => m.name))))
      .catch(() => {});
  }

  function isTabVisible(key: Tab): boolean {
    if (key === "terminals" && !multiTerminalEnabled) return false;
    for (const [moduleName, tabs] of Object.entries(MODULE_TAB_MAP)) {
      if (tabs.includes(key) && !enabledModules.has(moduleName)) return false;
    }
    return true;
  }

  const visibleTabs = ALL_TABS.filter((t) => isTabVisible(t.key));

  // If current tab became hidden (module disabled), fall back to first visible tab
  const resolvedActiveTab = isTabVisible(activeTab) ? activeTab : (visibleTabs[0]?.key ?? "restaurant");
  const activeTab_ = visibleTabs.find((t) => t.key === resolvedActiveTab) ?? visibleTabs[0]!

  return (
    <PosLayout>
      <div style={{ display: "flex", alignItems: "stretch", height: "100%" }}>
        <aside style={{
          width: "232px", flex: "none", background: "var(--color-white)",
          borderRight: "1px solid var(--color-gray-200)", padding: "18px 12px",
          display: "flex", flexDirection: "column", gap: "18px", overflowY: "auto",
        }}>
          {GROUPS.map((group) => (
            <SidebarGroup
              key={group.key}
              group={group}
              activeTab={resolvedActiveTab}
              isTabVisible={isTabVisible}
              onSelect={setActiveTab}
            />
          ))}
        </aside>

        <main className="scrollable" style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "24px 28px 40px" }}>
          <div style={{ maxWidth: "940px", display: "flex", flexDirection: "column", gap: "18px" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 700, letterSpacing: "-0.025em", color: "var(--color-gray-900)" }}>
                  {activeTab_.label}
                </h1>
                <p style={{ margin: 0, fontSize: "14.5px", color: "var(--color-gray-700)" }}>Amministrazione</p>
              </div>
              <div style={{ flex: 1 }} />
              {lowStockCount > 0 && (
                <button
                  onClick={() => setActiveTab("inventory")}
                  title={`${lowStockCount} prodott${lowStockCount === 1 ? "o" : "i"} sotto scorta`}
                  style={{
                    display: "flex", alignItems: "center", gap: "6px", height: "38px", padding: "0 14px",
                    borderRadius: "999px", background: "rgba(154,44,34,0.08)", border: "1px solid rgba(154,44,34,0.25)",
                    cursor: "pointer", color: "var(--color-danger)", fontSize: "13px", fontWeight: 700, fontFamily: "var(--font)",
                  }}
                >
                  ⚠ {lowStockCount} sotto scorta
                </button>
              )}
              <button
                onClick={() => navigate("/pos")}
                title="Torna al POS"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: "38px", height: "38px", borderRadius: "10px",
                  border: "1px solid var(--color-gray-200)", background: "var(--color-white)",
                  cursor: "pointer", color: "var(--color-gray-600)", flexShrink: 0,
                }}
              >
                <ArrowLeftIcon style={{ width: "16px", height: "16px" }} />
              </button>
            </div>

            {loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px" }}>
                <span style={{ color: "var(--color-gray-400)", fontSize: "var(--text-sm)" }}>Caricamento...</span>
              </div>
            ) : (
              <>
                {resolvedActiveTab === "restaurant" && <RestaurantTab />}
                {resolvedActiveTab === "products" && <ProductsTab />}
                {resolvedActiveTab === "categories" && <CategoriesTab />}
                {resolvedActiveTab === "production-centers" && <ProductionCentersTab />}
                {resolvedActiveTab === "cloud-sync" && <CloudSyncTab />}
                {resolvedActiveTab === "payment-methods" && <PaymentMethodsTab />}
                {resolvedActiveTab === "printers" && <PrintersTab />}
                {resolvedActiveTab === "receipt-template" && <ReceiptTemplateTab />}
                {resolvedActiveTab === "kitchen-template" && <KitchenTemplateTab />}
                {resolvedActiveTab === "shift-report-template" && <ShiftReportTemplateTab />}
                {resolvedActiveTab === "shifts" && <ShiftsTab />}
                {resolvedActiveTab === "interface" && <InterfaceTab />}
                {resolvedActiveTab === "backup" && <BackupTab />}
                {resolvedActiveTab === "advanced" && <AdvancedTab onModuleToggle={refreshEnabledModules} />}
                {resolvedActiveTab === "inventory" && <InventoryTab />}
                {resolvedActiveTab === "movements" && <MovementsTab />}
                {resolvedActiveTab === "terminals" && <TerminalsTab onMultiTerminalChange={setMultiTerminalEnabled} />}
                {resolvedActiveTab === "users" && <UsersTab />}
                {resolvedActiveTab === "license" && <LicenseTab />}
              </>
            )}
          </div>
        </main>
      </div>
    </PosLayout>
  );
}
