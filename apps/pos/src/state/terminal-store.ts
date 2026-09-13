import { create } from "zustand";

const STORAGE_KEY = "pos_terminal_id";
const NAME_KEY = "pos_terminal_name";

interface TerminalStore {
  terminalId: number | null;
  terminalName: string | null;
  setTerminal: (id: number, name: string) => void;
  clearTerminal: () => void;
}

export const useTerminalStore = create<TerminalStore>((set) => ({
  terminalId: (() => { const v = localStorage.getItem(STORAGE_KEY); return v !== null ? parseInt(v, 10) : null; })(),
  terminalName: localStorage.getItem(NAME_KEY),

  setTerminal: (id, name) => {
    localStorage.setItem(STORAGE_KEY, String(id));
    localStorage.setItem(NAME_KEY, name);
    set({ terminalId: id, terminalName: name });
  },

  clearTerminal: () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(NAME_KEY);
    set({ terminalId: null, terminalName: null });
  },
}));
