import { create } from "zustand";

const STORAGE_KEY = "pos_terminal_id";
const NAME_KEY = "pos_terminal_name";

interface TerminalStore {
  terminalId: string | null;
  terminalName: string | null;
  setTerminal: (id: string, name: string) => void;
  clearTerminal: () => void;
}

export const useTerminalStore = create<TerminalStore>((set) => ({
  terminalId: localStorage.getItem(STORAGE_KEY),
  terminalName: localStorage.getItem(NAME_KEY),

  setTerminal: (id, name) => {
    localStorage.setItem(STORAGE_KEY, id);
    localStorage.setItem(NAME_KEY, name);
    set({ terminalId: id, terminalName: name });
  },

  clearTerminal: () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(NAME_KEY);
    set({ terminalId: null, terminalName: null });
  },
}));
