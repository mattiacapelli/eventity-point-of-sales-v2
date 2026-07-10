import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
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
  ChevronDownIcon,
} from "../../components/ui/icons.js";
import { BackupTab } from "./BackupTab.js";
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
import { NavMenuFab } from "../../components/NavMenu.js";

// ─── Tab types ───────────────────────────────────────────────────────────────

type Tab = "restaurant" | "products" | "categories" | "production-centers" | "payment-methods" | "printers" | "receipt-template" | "kitchen-template" | "shift-report-template" | "shifts" | "backup" | "advanced" | "interface" | "inventory" | "movements" | "terminals" | "users" | "license";

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

function GroupMenu({ group, activeTab, isTabVisible, onSelect }: {
  group: Group;
  activeTab: Tab;
  isTabVisible: (key: Tab) => boolean;
  onSelect: (key: Tab) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const visibleTabs = group.tabs.filter((t) => isTabVisible(t.key));
  const isActiveGroup = visibleTabs.some((t) => t.key === activeTab);
  const singleTab = visibleTabs.length === 1 ? visibleTabs[0] : null;

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleScrollOrResize() {
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open]);

  function handleToggle() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 6, left: rect.left });
    }
    setOpen((v) => !v);
  }

  if (visibleTabs.length === 0) return null;

  if (singleTab) {
    const active = activeTab === singleTab.key;
    return (
      <button
        onClick={() => onSelect(singleTab.key)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "7px",
          padding: "8px 16px",
          borderRadius: "999px",
          flexShrink: 0,
          border: active ? "none" : "1.5px solid var(--color-gray-200)",
          background: active ? "var(--color-brand)" : "var(--color-white)",
          cursor: "pointer",
          fontSize: "var(--text-sm)",
          fontWeight: 600,
          color: active ? "var(--color-white)" : "var(--color-gray-500)",
          fontFamily: "var(--font)",
        }}
      >
        <group.Icon style={{ width: "15px", height: "15px" }} />
        {group.label}
      </button>
    );
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "7px",
          padding: "8px 14px",
          borderRadius: "999px",
          flexShrink: 0,
          border: isActiveGroup ? "none" : "1.5px solid var(--color-gray-200)",
          background: isActiveGroup ? "var(--color-brand)" : "var(--color-white)",
          cursor: "pointer",
          fontSize: "var(--text-sm)",
          fontWeight: 600,
          color: isActiveGroup ? "var(--color-white)" : "var(--color-gray-500)",
          fontFamily: "var(--font)",
        }}
      >
        <group.Icon style={{ width: "15px", height: "15px" }} />
        {group.label}
        <ChevronDownIcon style={{ width: "13px", height: "13px", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>

      {open && menuPos && createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: `${menuPos.top}px`,
            left: `${menuPos.left}px`,
            minWidth: "220px",
            background: "var(--color-white)",
            border: "1px solid var(--color-gray-200)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-lg)",
            padding: "6px",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          {visibleTabs.map(({ key, label, Icon }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => { onSelect(key); setOpen(false); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "9px 12px",
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  background: active ? "var(--color-gray-100)" : "transparent",
                  cursor: "pointer",
                  fontSize: "var(--text-sm)",
                  fontWeight: active ? 700 : 500,
                  color: active ? "var(--color-brand)" : "var(--color-gray-700)",
                  fontFamily: "var(--font)",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <Icon style={{ width: "16px", height: "16px", flexShrink: 0 }} />
                {label}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
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
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "var(--color-gray-50)", overflow: "hidden" }}>

      {/* ── Top header ── */}
      <div style={{
        background: "var(--color-white)",
        borderBottom: "1px solid var(--color-gray-200)",
        flexShrink: 0,
      }}>
        {/* Title row */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "0 32px",
          height: "60px",
        }}>
          <button
            onClick={() => navigate("/pos")}
            title="Torna al POS"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "34px",
              height: "34px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-gray-200)",
              background: "var(--color-white)",
              cursor: "pointer",
              color: "var(--color-gray-500)",
              flexShrink: 0,
            }}
          >
            <ArrowLeftIcon style={{ width: "16px", height: "16px" }} />
          </button>
          <div style={{ width: "1px", height: "20px", background: "var(--color-gray-200)" }} />
          <WrenchScrewdriverIcon style={{ width: "18px", height: "18px", color: "var(--color-brand)", flexShrink: 0 }} />
          <span style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--color-gray-800)" }}>
            Amministrazione
          </span>
          <span style={{ color: "var(--color-gray-300)", fontSize: "var(--text-sm)" }}>/</span>
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-500)" }}>
            {activeTab_.label}
          </span>
          {lowStockCount > 0 && (
            <button
              onClick={() => setActiveTab("inventory")}
              title={`${lowStockCount} prodott${lowStockCount === 1 ? "o" : "i"} sotto scorta`}
              style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px", padding: "5px 12px", borderRadius: "999px", background: "#fef2f2", border: "1px solid #fca5a5", cursor: "pointer", color: "#dc2626", fontSize: "var(--text-xs)", fontWeight: 700 }}
            >
              ⚠ {lowStockCount} sotto scorta
            </button>
          )}
        </div>

        {/* Group nav */}
        <div style={{
          display: "flex",
          gap: "6px",
          padding: "0 32px 14px",
          overflowX: "auto",
          scrollbarWidth: "none",
        }}>
          {GROUPS.map((group) => (
            <GroupMenu
              key={group.key}
              group={group}
              activeTab={resolvedActiveTab}
              isTabVisible={isTabVisible}
              onSelect={setActiveTab}
            />
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="scrollable" style={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px" }}>
            <span style={{ color: "var(--color-gray-400)", fontSize: "var(--text-sm)" }}>Caricamento...</span>
          </div>
        ) : (
          <div style={{ maxWidth: "960px", margin: "0 auto", padding: "32px 24px" }}>
            {resolvedActiveTab === "restaurant" && <RestaurantTab />}
            {resolvedActiveTab === "products" && <ProductsTab />}
            {resolvedActiveTab === "categories" && <CategoriesTab />}
            {resolvedActiveTab === "production-centers" && <ProductionCentersTab />}
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
          </div>
        )}
      </div>

      <NavMenuFab />
    </div>
  );
}
