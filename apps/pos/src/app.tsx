import React, { useEffect, useState, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { bootstrap } from "./core/bootstrap.js";
import { bootstrapApi } from "./core/bootstrap-api.js";
import { useWsEvents } from "./core/useWsEvents.js";
import { useStore } from "./state/global-store.js";
import { LoginScreen } from "./modules-ui/auth/LoginScreen.js";
import { SetupScreen } from "./modules-ui/setup/SetupScreen.js";
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
  const session = useStore((s) => s.session);

  useWsEvents();

  useEffect(() => {
    bootstrap()
      .then(() => bootstrapApi.status())
      .then((status) => { if (!status.initialized) setNeedsSetup(true); })
      .catch(() => { /* server unreachable — let normal flow handle it */ })
      .finally(() => setBooted(true));
  }, []);

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

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/pos"       element={<PosScreen />} />
        <Route path="/history"   element={<HistoryScreen />} />
        <Route path="/stats"     element={<StatsScreen />} />
        <Route path="/settings"  element={<SettingsScreen />} />
        <Route path="/admin"     element={<AdminScreen />} />
        <Route path="*"          element={<Navigate to="/pos" replace />} />
      </Routes>
    </Suspense>
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
