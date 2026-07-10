import React, { useEffect, useRef, useState, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { bootstrap } from "./core/bootstrap.js";
import { bootstrapApi } from "./core/bootstrap-api.js";
import { useWsEvents } from "./core/useWsEvents.js";
import { useCatalogWsEvents } from "./core/useCatalogWsEvents.js";
import { useStore } from "./state/global-store.js";
import { useShiftStore } from "./state/shift-store.js";
import { useTerminalStore } from "./state/terminal-store.js";
import { adminApi } from "./core/admin-api.js";
import { LoginScreen } from "./modules-ui/auth/LoginScreen.js";
import { SetupScreen } from "./modules-ui/setup/SetupScreen.js";
import { TerminalSelectModal } from "./components/TerminalSelectModal.js";
import { ToastHost } from "./components/ui/Toast.js";
import "./styles/globals.css";

// Apply persisted theme + font scale at boot
const _savedTheme = localStorage.getItem("pos_theme");
if (_savedTheme) document.documentElement.setAttribute("data-theme", _savedTheme);
const _savedFont = localStorage.getItem("pos_font_size");
if (_savedFont) document.documentElement.setAttribute("data-font-scale", _savedFont);

const PosScreen       = lazy(() => import("./modules-ui/sales/PosScreen.js").then((m) => ({ default: m.PosScreen })));
const HistoryScreen   = lazy(() => import("./modules-ui/history/HistoryScreen.js").then((m) => ({ default: m.HistoryScreen })));
const StatsScreen     = lazy(() => import("./modules-ui/stats/StatsScreen.js").then((m) => ({ default: m.StatsScreen })));
const AdminScreen     = lazy(() => import("./modules-ui/admin/AdminScreen.js").then((m) => ({ default: m.AdminScreen })));
const AuditLogScreen  = lazy(() => import("./modules-ui/audit/AuditLogScreen.js").then((m) => ({ default: m.AuditLogScreen })));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function RequireRole({ role, children }: { role: string; children: React.ReactNode }) {
  const session = useStore((s) => s.session);
  if (session?.role !== role) return <Navigate to="/pos" replace />;
  return <>{children}</>;
}

function LoadingScreen() {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-brand)",
      }}
    >
      <span style={{ color: "var(--color-accent)", fontSize: "var(--text-xxl)", fontWeight: 700 }}>
        Eventity POS
      </span>
    </div>
  );
}

function AppInner() {
  const [booted, setBooted] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [terminalModalDismissed, setTerminalModalDismissed] = useState(false);
  const session = useStore((s) => s.session);
  const multiTerminalEnabled = useStore((s) => s.multiTerminalEnabled);
  const setMultiTerminalEnabled = useStore((s) => s.setMultiTerminalEnabled);
  const { setCurrentShift, loadForTerminal } = useShiftStore();
  const { terminalId } = useTerminalStore();
  const prevSessionRef = useRef<string | null>(null);

  useWsEvents();
  useCatalogWsEvents();

  useEffect(() => {
    bootstrap()
      .then(() => bootstrapApi.status())
      .then((status) => { if (!status.initialized || new URLSearchParams(location.search).has("setup")) setNeedsSetup(true); })
      .catch(() => { /* server unreachable — let normal flow handle it */ })
      .finally(() => setBooted(true));
  }, []);

  // Load settings + validate stored terminalId still exists on the server
  useEffect(() => {
    if (!session) return;
    setTerminalModalDismissed(false);
    const { terminalId: storedId, clearTerminal } = useTerminalStore.getState();
    adminApi.settings.get()
      .then((s) => {
        setMultiTerminalEnabled(s.multiTerminalEnabled);
        if (s.multiTerminalEnabled && storedId) {
          // Validate the stored terminal still exists
          return adminApi.terminals.list().then((list) => {
            const still = list.find((t) => t.id === storedId && t.active);
            if (!still) clearTerminal();
          });
        }
      })
      .catch(() => {});
  }, [session?.userId]);

  // Periodic heartbeat so this terminal stays "online" in the list
  useEffect(() => {
    if (!terminalId || !session) return;
    const beat = () =>
      adminApi.terminals.heartbeat(terminalId).catch((e: unknown) => {
        // Terminal no longer exists in DB (e.g. after factory reset) — clear stored ID
        if (e instanceof Error && e.message.includes("404")) {
          useTerminalStore.getState().clearTerminal();
        }
      });
    beat();
    const interval = setInterval(beat, 60_000);
    return () => clearInterval(interval);
  }, [terminalId, session?.userId]);

  // Sync shift on login/logout
  useEffect(() => {
    const currentUserId = session?.userId ?? null;
    const prevUserId = prevSessionRef.current;
    prevSessionRef.current = currentUserId;

    if (currentUserId && currentUserId !== prevUserId) {
      // Just logged in — load terminal-scoped shift from localStorage while waiting for server,
      // then overwrite with the authoritative server value.
      const tid = useTerminalStore.getState().terminalId;
      if (tid) loadForTerminal(tid);
      adminApi.shifts.current()
        .then((shift) => setCurrentShift(shift, tid))
        .catch(() => setCurrentShift(null, tid));
    } else if (!currentUserId && prevUserId) {
      // Just logged out — clear shift
      const tid = useTerminalStore.getState().terminalId;
      setCurrentShift(null, tid);
    }
  }, [session?.userId]);

  if (!booted) return <LoadingScreen />;

  if (needsSetup) {
    return <SetupScreen onDone={() => setNeedsSetup(false)} />;
  }

  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<LoginScreen />} />
      </Routes>
    );
  }

  const needsTerminalSelect = multiTerminalEnabled && !terminalId && !terminalModalDismissed;

  return (
    <>
      {needsTerminalSelect && (
        <TerminalSelectModal onSelected={() => setTerminalModalDismissed(true)} />
      )}
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/pos"       element={<PosScreen />} />
        <Route path="/history"   element={<HistoryScreen />} />
        <Route path="/stats"     element={<StatsScreen />} />
        <Route path="/admin"     element={<RequireRole role="admin"><AdminScreen /></RequireRole>} />
        <Route path="/audit"     element={<RequireRole role="admin"><AuditLogScreen /></RequireRole>} />
        <Route path="*"          element={<Navigate to="/pos" replace />} />
      </Routes>
    </Suspense>
    </>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppInner />
        <ToastHost />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
