import { create } from "zustand";
import type { ProductGridSlot } from "@pos/shared-types";
import { adminApi } from "../core/admin-api.js";

export type GridViewMode = "category" | "all" | "grouped_category" | "grouped_center" | "grouped_color";
export type GridSortBy = "custom" | "name" | "price" | "color" | "category";

export interface GridPrefs {
  viewMode: GridViewMode;
  showPrice: boolean;
  showDescription: boolean;
  sortBy: GridSortBy;
  baseCols: number;
}

const DEFAULT_PREFS: GridPrefs = {
  viewMode: "category",
  showPrice: true,
  showDescription: true,
  sortBy: "custom",
  baseCols: 5,
};

// Debounce timers
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
let prefsDebounce: ReturnType<typeof setTimeout> | null = null;

interface GridStore extends GridPrefs {
  layouts: Record<string, ProductGridSlot[]>;
  editMode: boolean;
  serverPrefsLoaded: boolean;
  setPrefs: (p: Partial<GridPrefs>) => void;
  setEditMode: (v: boolean) => void;
  applyServerPrefs: (serverPrefs: Partial<GridPrefs>) => void;
  loadLayout: (scope: string) => Promise<void>;
  saveLayout: (scope: string, slots: ProductGridSlot[]) => void;
  updateSlot: (scope: string, productId: string, update: Partial<Omit<ProductGridSlot, "productId">>) => void;
  removeSlot: (scope: string, productId: string) => void;
}

export const useGridStore = create<GridStore>((set, get) => ({
  ...DEFAULT_PREFS,
  layouts: {},
  editMode: false,
  serverPrefsLoaded: false,

  setPrefs: (p) => {
    set((s) => ({
      viewMode: p.viewMode ?? s.viewMode,
      showPrice: p.showPrice ?? s.showPrice,
      showDescription: p.showDescription ?? s.showDescription,
      sortBy: p.sortBy ?? s.sortBy,
      baseCols: p.baseCols ?? s.baseCols,
    }));
    // Debounce save to server
    if (prefsDebounce) clearTimeout(prefsDebounce);
    prefsDebounce = setTimeout(() => {
      const s = get();
      void adminApi.settings.update({
        gridViewMode: s.viewMode,
        gridShowPrice: s.showPrice,
        gridShowDescription: s.showDescription,
        gridSortBy: s.sortBy,
        gridBaseCols: s.baseCols,
      });
      prefsDebounce = null;
    }, 600);
  },

  setEditMode: (v) => set({ editMode: v }),

  // Called once on mount with values from the server — only applied before any user change
  applyServerPrefs: (serverPrefs) => {
    if (get().serverPrefsLoaded) return;
    set({
      viewMode: serverPrefs.viewMode ?? DEFAULT_PREFS.viewMode,
      showPrice: serverPrefs.showPrice ?? DEFAULT_PREFS.showPrice,
      showDescription: serverPrefs.showDescription ?? DEFAULT_PREFS.showDescription,
      sortBy: serverPrefs.sortBy ?? DEFAULT_PREFS.sortBy,
      baseCols: serverPrefs.baseCols ?? DEFAULT_PREFS.baseCols,
      serverPrefsLoaded: true,
    });
  },

  loadLayout: async (scope) => {
    if (get().layouts[scope] !== undefined) return;
    try {
      const slots = await adminApi.gridLayouts.get(scope);
      set((s) => ({ layouts: { ...s.layouts, [scope]: slots } }));
    } catch {
      set((s) => ({ layouts: { ...s.layouts, [scope]: [] } }));
    }
  },

  saveLayout: (scope, slots) => {
    set((s) => ({ layouts: { ...s.layouts, [scope]: slots } }));
    const existing = saveTimers.get(scope);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      void adminApi.gridLayouts.save(scope, slots);
      saveTimers.delete(scope);
    }, 800);
    saveTimers.set(scope, timer);
  },

  updateSlot: (scope, productId, update) => {
    const { layouts, saveLayout } = get();
    const current = layouts[scope] ?? [];
    const idx = current.findIndex((s) => s.productId === productId);
    let next: ProductGridSlot[];
    if (idx === -1) {
      next = [...current, { productId, slotX: 0, slotY: 0, spanW: 1, spanH: 1, ...update }];
    } else {
      next = current.map((s, i) => i === idx ? { ...s, ...update } : s);
    }
    saveLayout(scope, next);
  },

  removeSlot: (scope, productId) => {
    const { layouts, saveLayout } = get();
    const current = layouts[scope] ?? [];
    saveLayout(scope, current.filter((s) => s.productId !== productId));
  },
}));
