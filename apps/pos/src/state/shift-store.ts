import { create } from "zustand";
import type { Shift } from "@pos/shared-types";

// Key is scoped to the terminal so multiple terminals on the same browser origin
// (same device, different tabs) do not overwrite each other's shift data.
function shiftStorageKey(terminalId: string): string {
  return `pos_current_shift_v1_${terminalId}`;
}

function loadPersistedShift(terminalId: string): Shift | null {
  try {
    const raw = localStorage.getItem(shiftStorageKey(terminalId));
    if (!raw) return null;
    return JSON.parse(raw) as Shift;
  } catch {
    return null;
  }
}

function persistShift(shift: Shift | null, terminalId: string | null): void {
  if (!terminalId) return;
  try {
    if (shift === null) localStorage.removeItem(shiftStorageKey(terminalId));
    else localStorage.setItem(shiftStorageKey(terminalId), JSON.stringify(shift));
  } catch { /* ignore quota errors */ }
}

interface ShiftState {
  currentShift: Shift | null;
  shiftModalOpen: "open" | "close" | null;
  setCurrentShift: (shift: Shift | null, terminalId?: string | null) => void;
  setShiftModalOpen: (v: "open" | "close" | null) => void;
  updateShiftTotals: (totalSales: number, totalOrders: number, terminalId?: string | null) => void;
  loadForTerminal: (terminalId: string) => void;
}

export const useShiftStore = create<ShiftState>((set) => ({
  // No shift at boot — app.tsx calls loadForTerminal() once terminalId is known.
  currentShift: null,
  shiftModalOpen: null,
  setCurrentShift: (currentShift, terminalId) => {
    persistShift(currentShift, terminalId ?? null);
    set({ currentShift });
  },
  setShiftModalOpen: (shiftModalOpen) => set({ shiftModalOpen }),
  updateShiftTotals: (totalSales, totalOrders, terminalId) =>
    set((s) => {
      if (!s.currentShift) return {};
      const updated = { ...s.currentShift, totalSales, totalOrders };
      persistShift(updated, terminalId ?? null);
      return { currentShift: updated };
    }),
  loadForTerminal: (terminalId) => {
    set({ currentShift: loadPersistedShift(terminalId) });
  },
}));
