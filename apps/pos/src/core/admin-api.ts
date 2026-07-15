import type { Category, Product, ProductionCenter, OptionGroupWithOptions, Option, PaymentMethodRecord, Printer, ReceiptTemplate, Shift, ReceiptBlock, KitchenTemplate, KitchenBlock, ShiftReportTemplate, ShiftReportBlock, ProductGridSlot, Terminal, User, UserRole } from "@pos/shared-types";

export interface AuditEntry {
  id: number;
  type: "order_created" | "order_completed" | "order_cancelled" | "payment_completed" | "payment_refunded" | "shift_opened" | "shift_closed";
  entityId: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  ts: number;
  meta: Record<string, unknown>;
}
import { useStore } from "../state/global-store.js";

export interface ModuleInfo {
  name: string;
  enabled: boolean;
  version: string;
  config: Record<string, unknown> | null;
  dependencies: string[];
  dependencyErrors: string[];
}

export interface InventoryItemRecord {
  id: number;
  name: string;
  sku: string | null;
  unit: string;
  currentStock: number;
  minStock: number;
  productionCenterId: number | null;
  productId: number | null;
  resetOnShiftOpen: number;
  createdAt: number;
  updatedAt: number;
}

export interface InventoryMovementRecord {
  id: number;
  itemId: number;
  type: "sale" | "restock" | "manual" | "waste";
  quantity: number;
  reason: string | null;
  orderId: number | null;
  createdAt: number;
}

export interface ProductIngredientRecord {
  id: number;
  productId: number;
  inventoryItemId: number;
  quantity: number;
}

export interface RestaurantInfo {
  name: string;
  address: string;
  city: string;
  vat: string;
  phone: string;
  website: string;
  logoPath: string | null;
}

export interface BackupMeta {
  id: number;
  filename: string;
  size: number;
  sha256: string;
  createdAt: number;
}

const BASE = "/api";

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = useStore.getState().session?.token;
  const hasBody = body !== undefined;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as unknown as T;
  }
  return res.json() as Promise<T>;
}

export const adminApi = {
  categories: {
    list: () => req<Category[]>("GET", "/categories"),
    create: (data: { name: string; color?: string | null }) => req<Category>("POST", "/categories", data),
    update: (id: number, data: { name?: string; color?: string | null }) => req<Category>("PATCH", `/categories/${id}`, data),
    delete: (id: number) => req<void>("DELETE", `/categories/${id}`),
    reorder: (ids: number[]) => req<void>("PUT", "/categories/reorder", { ids }),
  },
  dailyExtras: {
    list: (date: string) => req<Array<{ productId: number; date: string }>>("GET", `/daily-extras?date=${date}`),
    add: (productId: number, date: string) => req<{ productId: number; date: string }>("POST", "/daily-extras", { productId, date }),
    remove: (productId: number, date: string) => req<void>("DELETE", `/daily-extras/${productId}/${date}`),
  },
  products: {
    list: () => req<Product[]>("GET", "/products"),
    create: (data: { name: string; price: number; categoryId?: number; productionCenterId?: number; active?: boolean; color?: string | null; description?: string; vatRate?: number; receiptPrintMode?: "inherit" | "included" | "separate"; availableDates?: string[] | null }) =>
      req<Product>("POST", "/products", data),
    update: (id: number, data: Partial<{ name: string; price: number; categoryId: number | null; productionCenterId: number | null; active: boolean; color: string | null; description: string | null; vatRate: number; receiptPrintMode: "inherit" | "included" | "separate"; availableDates: string[] | null }>) =>
      req<Product>("PATCH", `/products/${id}`, data),
    delete: (id: number) => req<void>("DELETE", `/products/${id}`),
    imageUrl: (relPath: string) => `/api/static/${relPath}`,
    uploadImage: async (id: number, file: File): Promise<{ imagePath: string }> => {
      const token = useStore.getState().session?.token;
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${BASE}/products/${id}/image`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})) as { error?: string }; throw new Error(e.error ?? `HTTP ${res.status}`); }
      return res.json() as Promise<{ imagePath: string }>;
    },
    deleteImage: (id: number) => req<void>("DELETE", `/products/${id}/image`),
  },
  productionCenters: {
    list: () => req<ProductionCenter[]>("GET", "/production-centers"),
    create: (data: { name: string; color?: string | null; icon?: string | null; receiptPrintMode?: "included" | "separate" }) => req<ProductionCenter>("POST", "/production-centers", data),
    update: (id: number, data: { name?: string; color?: string | null; icon?: string | null; receiptPrintMode?: "included" | "separate" }) => req<ProductionCenter>("PATCH", `/production-centers/${id}`, data),
    delete: (id: number) => req<void>("DELETE", `/production-centers/${id}`),
    reorder: (ids: number[]) => req<void>("PUT", "/production-centers/reorder", { ids }),
    getCategories: (id: number) => req<Category[]>("GET", `/production-centers/${id}/categories`),
    assignCategory: (id: number, categoryId: number) =>
      req<void>("POST", `/production-centers/${id}/categories`, { categoryId }),
    removeCategory: (id: number, categoryId: number) =>
      req<void>("DELETE", `/production-centers/${id}/categories/${categoryId}`),
    getPrinters: (id: number) => req<Array<Pick<Printer, "id" | "name" | "host" | "port" | "kitchenEnabled" | "active">>>("GET", `/production-centers/${id}/printers`),
    assignPrinter: (id: number, printerId: number) => req<void>("POST", `/production-centers/${id}/printers/${printerId}`),
    removePrinter: (id: number, printerId: number) => req<void>("DELETE", `/production-centers/${id}/printers/${printerId}`),
  },
  optionGroups: {
    list: (productId: number) =>
      req<OptionGroupWithOptions[]>("GET", `/option-groups?productId=${productId}`),
    create: (data: { productId: number; name: string; type: "single" | "multi" | "removal"; required?: boolean; minSel?: number; maxSel?: number; sortOrder?: number }) =>
      req<OptionGroupWithOptions>("POST", "/option-groups", data),
    update: (id: number, data: Partial<{ name: string; type: "single" | "multi" | "removal"; required: boolean; minSel: number; maxSel: number; sortOrder: number }>) =>
      req<OptionGroupWithOptions>("PATCH", `/option-groups/${id}`, data),
    delete: (id: number) => req<void>("DELETE", `/option-groups/${id}`),
    createOption: (groupId: number, data: { name: string; priceDelta?: number; prefix?: "+" | "-" | ">>"; sortOrder?: number }) =>
      req<Option>("POST", `/option-groups/${groupId}/options`, data),
    updateOption: (optionId: number, data: Partial<{ name: string; priceDelta: number; prefix: "+" | "-" | ">>"; active: boolean; sortOrder: number }>) =>
      req<Option>("PATCH", `/options/${optionId}`, data),
    deleteOption: (optionId: number) => req<void>("DELETE", `/options/${optionId}`),
  },
  paymentMethods: {
    list: () => req<PaymentMethodRecord[]>("GET", "/payment-methods"),
    create: (data: { name: string; type: string; active?: boolean; sortOrder?: number; icon?: string | null; excludeFromTotal?: boolean }) =>
      req<PaymentMethodRecord>("POST", "/payment-methods", data),
    update: (id: string, data: Partial<{ name: string; type: string; active: boolean; sortOrder: number; icon: string | null; excludeFromTotal: boolean }>) =>
      req<PaymentMethodRecord>("PATCH", `/payment-methods/${id}`, data),
    delete: (id: string) => req<void>("DELETE", `/payment-methods/${id}`),
  },
  printers: {
    list: () => req<Printer[]>("GET", "/printers"),
    create: (data: { name: string; type?: string; connectionType?: string; host?: string; port?: number; active?: boolean; receiptEnabled?: boolean; kitchenEnabled?: boolean; printMode?: "text" | "image" }) =>
      req<Printer>("POST", "/printers", data),
    update: (id: number, data: Partial<{ name: string; type: string; connectionType: string; host: string | null; port: number | null; active: boolean; receiptEnabled: boolean; kitchenEnabled: boolean; printMode: "text" | "image" }>) =>
      req<Printer>("PATCH", `/printers/${id}`, data),
    delete: (id: number) => req<void>("DELETE", `/printers/${id}`),
    testPrint: (id: number) => req<{ success: boolean; message: string }>("POST", `/printers/${id}/test-print`, {}),
    discoverSubnet: () => req<{ subnet: string | null }>("GET", "/printers/discover/subnet"),
    discover: (subnet?: string) => req<{ subnet: string; found: Array<{ host: string; port: number }> }>("POST", "/printers/discover", { subnet }),
    getProductionCenters: (id: number) => req<ProductionCenter[]>("GET", `/printers/${id}/production-centers`),
  },
  receiptTemplates: {
    list: () => req<ReceiptTemplate[]>("GET", "/receipt-templates"),
    getActive: () => req<ReceiptTemplate>("GET", "/receipt-templates/active"),
    create: (data: { name: string; headerText?: string; footerText?: string; showLogo?: boolean; showOrderNumber?: boolean; showTimestamp?: boolean; showPaymentMethod?: boolean; showItemCategory?: boolean; active?: boolean; printMode?: "text" | "image"; canvasWidth?: number; blocks?: ReceiptBlock[]; printMethod?: string; role?: string }) =>
      req<ReceiptTemplate>("POST", "/receipt-templates", data),
    update: (id: string, data: Partial<{ name: string; headerText: string | null; footerText: string | null; showLogo: boolean; showOrderNumber: boolean; showTimestamp: boolean; showPaymentMethod: boolean; showItemCategory: boolean; active: boolean; printMode: "text" | "image"; canvasWidth: number; blocks: ReceiptBlock[] | null; printMethod: string; role: string }>) =>
      req<ReceiptTemplate>("PATCH", `/receipt-templates/${id}`, data),
    previewUrl: () => `${BASE}/receipt-templates/preview`,
    listFonts: () => req<string[]>("GET", "/admin/fonts"),
    uploadFont: async (file: File): Promise<{ name: string }> => {
      const token = useStore.getState().session?.token;
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${BASE}/admin/fonts`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})) as { error?: string }; throw new Error(e.error ?? `HTTP ${res.status}`); }
      return res.json() as Promise<{ name: string }>;
    },
    deleteFont: (name: string) => req<void>("DELETE", `/admin/fonts/${name}`),
  },
  shifts: {
    current: () => req<Shift>("GET", "/shifts/current"),
    history: () => req<Shift[]>("GET", "/shifts/history"),
    open: (data: { userId: string; openingCash?: number; notes?: string }) =>
      req<Shift>("POST", "/shifts/open", data),
    close: (id: number, data: { closingCash?: number; notes?: string; force?: boolean }) =>
      req<Shift>("POST", `/shifts/${id}/close`, data),
    updateTotals: (id: number, data: { totalSales?: number; totalOrders?: number }) =>
      req<Shift>("PATCH", `/shifts/${id}`, data),
  },
  backups: {
    list: () => req<BackupMeta[]>("GET", "/admin/backups/list"),
    create: () => req<BackupMeta>("POST", "/admin/backups/create"),
    delete: (id: number) => req<void>("DELETE", `/admin/backups/${id}`),
    downloadUrl: (id: number) => `/api/admin/backups/download/${id}`,
  },
  settings: {
    get: () => req<{
      expressMode: boolean;
      receiptNumberMode: "default" | "global" | "shift" | "center";
      receiptNumberPrefix: string;
      receiptNumberPadding: number;
      gridViewMode: "category" | "center" | "all" | "grouped_category" | "grouped_center" | "grouped_color";
      gridShowPrice: boolean;
      gridShowDescription: boolean;
      gridSortBy: "custom" | "name" | "price" | "color" | "category";
      gridBaseCols: number;
      gridShowCategory: boolean;
      gridShowImage: boolean;
      gridCardTextSize: number;
      gridCardRowHeight: number;
      gridSidebarTextSize: number;
      gridSidebarSortBy: "custom" | "name";
      multiTerminalEnabled: boolean;
      cartNotesEnabled: boolean;
      cartPaxEnabled: boolean;
      cartDiscountEnabled: boolean;
      cartTextSize: number;
      tablesEnabled: boolean;
      shiftAutoPrintReport: boolean;
      productDateFilterEnabled: boolean;
    }>("GET", "/admin/settings"),
    update: (data: Partial<{
      expressMode: boolean;
      receiptNumberMode: "default" | "global" | "shift" | "center";
      receiptNumberPrefix: string;
      receiptNumberPadding: number;
      gridViewMode: "category" | "center" | "all" | "grouped_category" | "grouped_center" | "grouped_color";
      gridShowPrice: boolean;
      gridShowDescription: boolean;
      gridSortBy: "custom" | "name" | "price" | "color" | "category";
      gridBaseCols: number;
      gridShowCategory: boolean;
      gridShowImage: boolean;
      gridCardTextSize: number;
      gridCardRowHeight: number;
      gridSidebarTextSize: number;
      gridSidebarSortBy: "custom" | "name";
      multiTerminalEnabled: boolean;
      cartNotesEnabled: boolean;
      cartPaxEnabled: boolean;
      cartDiscountEnabled: boolean;
      cartTextSize: number;
      tablesEnabled: boolean;
      shiftAutoPrintReport: boolean;
      productDateFilterEnabled: boolean;
    }>) => req<{
      expressMode: boolean;
      receiptNumberMode: "default" | "global" | "shift" | "center";
      receiptNumberPrefix: string;
      receiptNumberPadding: number;
      gridViewMode: "category" | "center" | "all" | "grouped_category" | "grouped_center" | "grouped_color";
      gridShowPrice: boolean;
      gridShowDescription: boolean;
      gridSortBy: "custom" | "name" | "price" | "color" | "category";
      gridBaseCols: number;
      gridShowCategory: boolean;
      gridShowImage: boolean;
      gridCardTextSize: number;
      gridCardRowHeight: number;
      gridSidebarTextSize: number;
      gridSidebarSortBy: "custom" | "name";
      multiTerminalEnabled: boolean;
      cartNotesEnabled: boolean;
      cartPaxEnabled: boolean;
      cartDiscountEnabled: boolean;
      cartTextSize: number;
      tablesEnabled: boolean;
      shiftAutoPrintReport: boolean;
      productDateFilterEnabled: boolean;
    }>("PATCH", "/admin/settings", data),
    resetReceiptCounter: (scope?: string, startFrom?: number) =>
      req<{ scope: string; lastValue: number }>("POST", "/admin/settings/reset-receipt-counter", { scope: scope ?? "global", startFrom: startFrom ?? 0 }),
    getRaw: (keys: string[]) => req<Record<string, string>>("GET", `/admin/settings/raw?keys=${keys.join(",")}`),
    setRaw: (key: string, value: string) => req<void>("PUT", `/admin/settings/raw/${encodeURIComponent(key)}`, { value }),
  },
  restaurant: {
    get: () => req<RestaurantInfo>("GET", "/admin/restaurant"),
    update: (data: Partial<Omit<RestaurantInfo, "logoPath">>) => req<RestaurantInfo>("PATCH", "/admin/restaurant", data),
    uploadLogo: async (file: File): Promise<{ logoPath: string }> => {
      const token = useStore.getState().session?.token;
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${BASE}/admin/restaurant/logo`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})) as { error?: string }; throw new Error(e.error ?? `HTTP ${res.status}`); }
      return res.json() as Promise<{ logoPath: string }>;
    },
    deleteLogo: () => req<void>("DELETE", "/admin/restaurant/logo"),
  },
  modules: {
    list: () => req<ModuleInfo[]>("GET", "/admin/modules"),
    toggle: (name: string) => req<{ name: string; enabled: boolean }>("PATCH", `/admin/modules/${name}/toggle`, {}),
    updateConfig: (name: string, config: Record<string, unknown>) =>
      req<{ name: string; config: Record<string, unknown> }>("PATCH", `/admin/modules/${name}/config`, { config }),
    reload: (name: string) => req<{ name: string; state: string }>("POST", `/admin/modules/${name}/reload`),
  },
  kitchenTemplates: {
    list: () => req<KitchenTemplate[]>("GET", "/kitchen-templates"),
    create: (data: { name: string; productionCenterId?: number | null; printMode?: "text" | "image"; canvasWidth?: number; blocks?: KitchenBlock[] }) =>
      req<KitchenTemplate>("POST", "/kitchen-templates", data),
    update: (id: string, data: Partial<{ name: string; productionCenterId: number | null; active: boolean; printMode: "text" | "image"; canvasWidth: number; blocks: KitchenBlock[] }>) =>
      req<KitchenTemplate>("PATCH", `/kitchen-templates/${id}`, data),
    delete: (id: string) => req<void>("DELETE", `/kitchen-templates/${id}`),
    previewUrl: (id: string) => `${BASE}/kitchen-templates/${id}/preview`,
    livePreviewUrl: () => `${BASE}/kitchen-templates/preview`,
    uploadLogo: async (id: string, file: File): Promise<KitchenTemplate> => {
      const token = useStore.getState().session?.token;
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${BASE}/kitchen-templates/${id}/logo`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})) as { error?: string }; throw new Error(e.error ?? `HTTP ${res.status}`); }
      return res.json() as Promise<KitchenTemplate>;
    },
    deleteLogo: (id: string) => req<void>("DELETE", `/kitchen-templates/${id}/logo`),
  },
  shiftReportTemplates: {
    list: () => req<ShiftReportTemplate[]>("GET", "/shift-report-templates"),
    getActive: () => req<ShiftReportTemplate>("GET", "/shift-report-templates/active"),
    create: (data: { name: string; printMode?: "text" | "image"; canvasWidth?: number; blocks?: ShiftReportBlock[] }) =>
      req<ShiftReportTemplate>("POST", "/shift-report-templates", data),
    update: (id: string, data: Partial<{ name: string; active: boolean; printMode: "text" | "image"; canvasWidth: number; blocks: ShiftReportBlock[] | null }>) =>
      req<ShiftReportTemplate>("PATCH", `/shift-report-templates/${id}`, data),
    delete: (id: string) => req<void>("DELETE", `/shift-report-templates/${id}`),
    previewUrl: () => `${BASE}/shift-report-templates/preview`,
    uploadLogo: async (id: string, file: File): Promise<ShiftReportTemplate> => {
      const token = useStore.getState().session?.token;
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${BASE}/shift-report-templates/${id}/logo`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})) as { error?: string }; throw new Error(e.error ?? `HTTP ${res.status}`); }
      return res.json() as Promise<ShiftReportTemplate>;
    },
    deleteLogo: (id: string) => req<void>("DELETE", `/shift-report-templates/${id}/logo`),
  },
  inventory: {
    listItems: () => req<InventoryItemRecord[]>("GET", "/inventory/items"),
    createItem: (data: { name: string; sku?: string; unit?: string; currentStock?: number; minStock?: number; productionCenterId?: number; productId?: number | null; resetOnShiftOpen?: boolean }) =>
      req<InventoryItemRecord>("POST", "/inventory/items", data),
    updateItem: (id: number, data: Partial<{ name: string; sku: string | null; unit: string; minStock: number; productionCenterId: number | null; productId: number | null; resetOnShiftOpen: boolean }>) =>
      req<InventoryItemRecord>("PATCH", `/inventory/items/${id}`, data),
    getItemsByProduct: (productId: number) => req<InventoryItemRecord[]>("GET", `/inventory/items/by-product/${productId}`),
    deleteItem: (id: number) => req<void>("DELETE", `/inventory/items/${id}`),
    adjustStock: (id: number, quantity: number, reason?: string) =>
      req<InventoryItemRecord>("POST", `/inventory/items/${id}/adjust`, { quantity, ...(reason !== undefined ? { reason } : {}) }),
    getMovements: (id: number) => req<InventoryMovementRecord[]>("GET", `/inventory/items/${id}/movements`),
    listMovements: (params?: { type?: string; from?: number; to?: number }) => {
      const q = params ? new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      ).toString() : "";
      return req<InventoryMovementRecord[]>("GET", `/inventory/movements${q ? `?${q}` : ""}`);
    },
    getAlerts: () => req<InventoryItemRecord[]>("GET", "/inventory/alerts"),
    getIngredients: (productId: number) => req<ProductIngredientRecord[]>("GET", `/inventory/ingredients/${productId}`),
    createIngredient: (data: { productId: number; inventoryItemId: number; quantity?: number }) =>
      req<ProductIngredientRecord>("POST", "/inventory/ingredients", data),
    deleteIngredient: (id: number) => req<void>("DELETE", `/inventory/ingredients/${id}`),
  },
  gridLayouts: {
    get: (scope: string) => req<ProductGridSlot[]>("GET", `/admin/grid-layouts/${encodeURIComponent(scope)}`),
    save: (scope: string, slots: ProductGridSlot[]) =>
      req<void>("POST", `/admin/grid-layouts/${encodeURIComponent(scope)}`, slots),
  },
  auditLog: {
    list: (params?: { from?: number; to?: number; type?: string; limit?: number; offset?: number }) => {
      const q = params ? new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      ).toString() : "";
      return req<{ entries: AuditEntry[]; total: number; offset: number; limit: number }>("GET", `/admin/audit-log${q ? `?${q}` : ""}`);
    },
  },
  terminals: {
    list: () => req<Terminal[]>("GET", "/admin/terminals"),
    create: (data: { name: string }) => req<Terminal>("POST", "/admin/terminals", data),
    update: (id: number, data: { name?: string; active?: boolean; defaultViewMode?: string | null }) => req<Terminal>("PATCH", `/admin/terminals/${id}`, data),
    delete: (id: number) => req<void>("DELETE", `/admin/terminals/${id}`),
    getPrinters: (id: number) => req<Printer[]>("GET", `/admin/terminals/${id}/printers`),
    assignPrinter: (id: number, printerId: number) => req<void>("POST", `/admin/terminals/${id}/printers/${printerId}`),
    removePrinter: (id: number, printerId: number) => req<void>("DELETE", `/admin/terminals/${id}/printers/${printerId}`),
    heartbeat: (id: number) => req<Terminal>("POST", `/admin/terminals/${id}/heartbeat`),
    getCategories: (id: number) => req<Category[]>("GET", `/admin/terminals/${id}/categories`),
    assignCategory: (id: number, categoryId: number) => req<void>("POST", `/admin/terminals/${id}/categories/${categoryId}`),
    removeCategory: (id: number, categoryId: number) => req<void>("DELETE", `/admin/terminals/${id}/categories/${categoryId}`),
    reorderCategories: (id: number, categoryIds: number[]) => req<void>("PATCH", `/admin/terminals/${id}/categories/reorder`, { categoryIds }),
  },
  users: {
    list: () => req<User[]>("GET", "/admin/users"),
    create: (data: { name: string; username: string; role: UserRole; pin: string }) => req<{ userId: string }>("POST", "/admin/users", data),
    update: (id: number, data: Partial<{ name: string; username: string; role: UserRole; active: boolean }>) => req<{ ok: boolean }>("PATCH", `/admin/users/${id}`, data),
    resetPin: (id: number, newPin: string) => req<{ ok: boolean }>("POST", `/admin/users/${id}/reset-pin`, { newPin }),
  },
  factoryReset: (password: string) => req<{ ok: boolean }>("POST", "/admin/factory-reset", { password }),
};
