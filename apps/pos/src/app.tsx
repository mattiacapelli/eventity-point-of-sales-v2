import React, { useEffect, useRef, useState, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { bootstrap } from "./core/bootstrap.js";
import { bootstrapApi } from "./core/bootstrap-api.js";
import { useWsEvents } from "./core/useWsEvents.js";
import { useStore } from "./state/global-store.js";
import { useShiftStore } from "./state/shift-store.js";
import { useTerminalStore } from "./state/terminal-store.js";
import { adminApi } from "./core/admin-api.js";
import { LoginScreen } from "./modules-ui/auth/LoginScreen.js";
import { SetupScreen } from "./modules-ui/setup/SetupScreen.js";
import { TerminalSelectModal } from "./components/TerminalSelectModal.js";
import "./styles/globals.css";

// Apply persisted theme + font scale at boot
const _savedTheme = localStorage.getItem("pos_theme");
if (_savedTheme) document.documentElement.setAttribute("data-theme", _savedTheme);
const _savedFont = localStorage.getItem("pos_font_size");
if (_savedFont) document.documentElement.setAttribute("data-font-scale", _savedFont);

const PosScreen       = lazy(() => import("./modules-ui/sales/PosScreen.js").then((m) => ({ default: m.PosScreen })));
const HistoryScreen   = lazy(() => import("./modules-ui/history/HistoryScreen.js").then((m) => ({ default: m.HistoryScreen })));
const StatsScreen     = lazy(() => import("./modules-ui/stats/StatsScreen.js").then((m) => ({ default: m.StatsScreen })));
const SettingsScreen  = lazy(() => import("./modules-ui/settings/SettingsScreen.js").then((m) => ({ default: m.SettingsScreen })));
const AdminScreen     = lazy(() => import("./modules-ui/admin/AdminScreen.js").then((m) => ({ default: m.AdminScreen })));
const AuditLogScreen  = lazy(() => import("./modules-ui/audit/AuditLogScreen.js").then((m) => ({ default: m.AuditLogScreen })));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

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
  const [multiTerminalEnabled, setMultiTerminalEnabled] = useState(false);
  const [terminalModalDismissed, setTerminalModalDismissed] = useState(false);
  const session = useStore((s) => s.session);
  const { setCurrentShift } = useShiftStore();
  const { terminalId } = useTerminalStore();
  const prevSessionRef = useRef<string | null>(null);

  useWsEvents();

  useEffect(() => {
    bootstrap()
      .then(() => bootstrapApi.status())
      .then((status) => { if (!status.initialized) setNeedsSetup(true); })
      .catch(() => { /* server unreachable — let normal flow handle it */ })
      .finally(() => setBooted(true));
  }, []);

  // Load settings to check multiTerminalEnabled; reset dismiss on login
  useEffect(() => {
    if (session) {
      setTerminalModalDismissed(false);
      adminApi.settings.get()
        .then((s) => setMultiTerminalEnabled(s.multiTerminalEnabled))
        .catch(() => {});
    }
  }, [session?.userId]);

  // Periodic heartbeat so this terminal stays "online" in the list
  useEffect(() => {
    if (!terminalId || !session) return;
    adminApi.terminals.heartbeat(terminalId).catch(() => {});
    const interval = setInterval(() => {
      adminApi.terminals.heartbeat(terminalId).catch(() => {});
    }, 60_000);
    return () => clearInterval(interval);
  }, [terminalId, session?.userId]);

  // Sync shift on login/logout
  useEffect(() => {
    const currentUserId = session?.userId ?? null;
    const prevUserId = prevSessionRef.current;
    prevSessionRef.current = currentUserId;

    if (currentUserId && currentUserId !== prevUserId) {
      // Just logged in — fetch current shift from server (overrides localStorage cache)
      adminApi.shifts.current()
        .then((shift) => setCurrentShift(shift))
        .catch(() => setCurrentShift(null));
    } else if (!currentUserId && prevUserId) {
      // Just logged out — clear shift
      setCurrentShift(null);
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
        <Route path="/settings"  element={<SettingsScreen />} />
        <Route path="/admin"     element={<AdminScreen />} />
        <Route path="/audit"     element={<AuditLogScreen />} />
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
      </BrowserRouter>
    </QueryClientProvider>
  );
}
