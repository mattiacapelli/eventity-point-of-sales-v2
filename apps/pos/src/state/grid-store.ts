import { create } from "zustand";
import type { ProductGridSlot } from "@pos/shared-types";
import { adminApi } from "../core/admin-api.js";

export type GridViewMode = "category" | "center" | "all" | "grouped_category" | "grouped_center" | "grouped_color";
export type GridSortBy = "custom" | "name" | "price" | "color" | "category";
export type GridSidebarSortBy = "custom" | "name";

export interface GridPrefs {
  viewMode: GridViewMode;
  showPrice: boolean;
  showDescription: boolean;
  showCategory: boolean;
  showImage: boolean;
  cardTextSize: number;
  cardRowHeight: number;
  sortBy: GridSortBy;
  baseCols: number;
  sidebarTextSize: number;
  sidebarSortBy: GridSidebarSortBy;
}

const DEFAULT_PREFS: GridPrefs = {
  viewMode: "category",
  showPrice: true,
  showDescription: true,
  showCategory: false,
  showImage: true,
  cardTextSize: 14,
  cardRowHeight: 120,
  sortBy: "custom",
  baseCols: 5,
  sidebarTextSize: 10,
  sidebarSortBy: "custom",
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
  applyTerminalViewMode: (viewMode: GridViewMode) => void;
  loadLayout: (scope: string) => Promise<void>;
  saveLayout: (scope: string, slots: ProductGridSlot[]) => void;
  updateSlot: (scope: string, productId: number, update: Partial<Omit<ProductGridSlot, "productId">>) => void;
  removeSlot: (scope: string, productId: number) => void;
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
      showCategory: p.showCategory ?? s.showCategory,
      showImage: p.showImage ?? s.showImage,
      cardTextSize: p.cardTextSize ?? s.cardTextSize,
      cardRowHeight: p.cardRowHeight ?? s.cardRowHeight,
      sortBy: p.sortBy ?? s.sortBy,
      baseCols: p.baseCols ?? s.baseCols,
      sidebarTextSize: p.sidebarTextSize ?? s.sidebarTextSize,
      sidebarSortBy: p.sidebarSortBy ?? s.sidebarSortBy,
    }));
    // Debounce save to server
    if (prefsDebounce) clearTimeout(prefsDebounce);
    prefsDebounce = setTimeout(() => {
      const s = get();
      void adminApi.settings.update({
        gridViewMode: s.viewMode,
        gridShowPrice: s.showPrice,
        gridShowDescription: s.showDescription,
        gridShowCategory: s.showCategory,
        gridShowImage: s.showImage,
        gridCardTextSize: s.cardTextSize,
        gridCardRowHeight: s.cardRowHeight,
        gridSortBy: s.sortBy,
        gridBaseCols: s.baseCols,
        gridSidebarTextSize: s.sidebarTextSize,
        gridSidebarSortBy: s.sidebarSortBy,
      });
      prefsDebounce = null;
    }, 600);
  },

  setEditMode: (v) => {
    set({ editMode: v });
    if (!v) {
      // Flush any pending debounced saves immediately on edit mode exit
      for (const [scope, timer] of saveTimers) {
        clearTimeout(timer);
        saveTimers.delete(scope);
        const slots = get().layouts[scope];
        if (slots !== undefined) {
          void adminApi.gridLayouts.save(scope, slots);
        }
      }
    }
  },

  // Called once on mount with values from the server — only applied before any user change
  applyServerPrefs: (serverPrefs) => {
    if (get().serverPrefsLoaded) return;
    set({
      viewMode: serverPrefs.viewMode ?? DEFAULT_PREFS.viewMode,
      showPrice: serverPrefs.showPrice ?? DEFAULT_PREFS.showPrice,
      showDescription: serverPrefs.showDescription ?? DEFAULT_PREFS.showDescription,
      showCategory: serverPrefs.showCategory ?? DEFAULT_PREFS.showCategory,
      showImage: serverPrefs.showImage ?? DEFAULT_PREFS.showImage,
      cardTextSize: serverPrefs.cardTextSize ?? DEFAULT_PREFS.cardTextSize,
      cardRowHeight: serverPrefs.cardRowHeight ?? DEFAULT_PREFS.cardRowHeight,
      sortBy: serverPrefs.sortBy ?? DEFAULT_PREFS.sortBy,
      baseCols: serverPrefs.baseCols ?? DEFAULT_PREFS.baseCols,
      sidebarTextSize: serverPrefs.sidebarTextSize ?? DEFAULT_PREFS.sidebarTextSize,
      sidebarSortBy: serverPrefs.sidebarSortBy ?? DEFAULT_PREFS.sidebarSortBy,
      serverPrefsLoaded: true,
    });
  },

  // Applies terminal-specific viewMode override — always wins over global settings
  applyTerminalViewMode: (viewMode) => {
    set({ viewMode });
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
