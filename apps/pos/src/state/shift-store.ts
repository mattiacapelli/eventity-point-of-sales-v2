import { create } from "zustand";
import type { Shift } from "@pos/shared-types";

const SHIFT_STORAGE_KEY = "pos_current_shift_v1";

function loadPersistedShift(): Shift | null {
  try {
    const raw = localStorage.getItem(SHIFT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Shift;
  } catch {
    return null;
  }
}

function persistShift(shift: Shift | null): void {
  try {
    if (shift === null) localStorage.removeItem(SHIFT_STORAGE_KEY);
    else localStorage.setItem(SHIFT_STORAGE_KEY, JSON.stringify(shift));
  } catch { /* ignore quota errors */ }
}

interface ShiftState {
  currentShift: Shift | null;
  shiftModalOpen: "open" | "close" | null;
  setCurrentShift: (shift: Shift | null) => void;
  setShiftModalOpen: (v: "open" | "close" | null) => void;
  updateShiftTotals: (totalSales: number, totalOrders: number) => void;
}

export const useShiftStore = create<ShiftState>((set) => ({
  currentShift: loadPersistedShift(),
  shiftModalOpen: null,
  setCurrentShift: (currentShift) => { persistShift(currentShift); set({ currentShift }); },
  setShiftModalOpen: (shiftModalOpen) => set({ shiftModalOpen }),
  updateShiftTotals: (totalSales, totalOrders) =>
    set((s) => {
      if (!s.currentShift) return {};
      const updated = { ...s.currentShift, totalSales, totalOrders };
      persistShift(updated);
      return { currentShift: updated };
    }),
}));
