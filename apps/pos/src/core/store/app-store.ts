import { create } from "zustand";

type SyncStatus = "idle" | "syncing" | "error";

interface AppState {
  readonly isOnline: boolean;
  readonly syncStatus: SyncStatus;
  setOnline: (online: boolean) => void;
  setSyncStatus: (status: SyncStatus) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isOnline: navigator.onLine,
  syncStatus: "idle",
  setOnline: (online) => set({ isOnline: online }),
  setSyncStatus: (syncStatus) => set({ syncStatus }),
}));
