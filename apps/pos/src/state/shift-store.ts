import { create } from "zustand";
import type { Shift } from "@pos/shared-types";

interface ShiftState {
  currentShift: Shift | null;
  shiftModalOpen: "open" | "close" | null;
  setCurrentShift: (shift: Shift | null) => void;
  setShiftModalOpen: (v: "open" | "close" | null) => void;
  updateShiftTotals: (totalSales: number, totalOrders: number) => void;
}

export const useShiftStore = create<ShiftState>((set) => ({
  currentShift: null,
  shiftModalOpen: null,
  setCurrentShift: (currentShift) => set({ currentShift }),
  setShiftModalOpen: (shiftModalOpen) => set({ shiftModalOpen }),
  updateShiftTotals: (totalSales, totalOrders) =>
    set((s) => s.currentShift ? { currentShift: { ...s.currentShift, totalSales, totalOrders } } : {}),
}));
