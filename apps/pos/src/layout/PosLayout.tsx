import React, { useState, useEffect } from "react";
import { useStore } from "../state/global-store.js";
import { useShiftStore } from "../state/shift-store.js";
import { authClient } from "../core/auth-client.js";
import { ArrowRightOnRectangleIcon, ClockIcon, WifiIcon, SignalSlashIcon } from "../components/ui/icons.js";

interface PosLayoutProps {
  children: React.ReactNode;
}

function ShiftBadge({ openedAt }: { openedAt: number }) {
  const [elapsed, setElapsed] = useState(() => {
    const ms = Date.now() - openedAt;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const ms = Date.now() - openedAt;
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      setElapsed(`${h}h ${m}m`);
    }, 30000);
    return () => clearInterval(interval);
  }, [openedAt]);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "5px",
      background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)",
      borderRadius: "var(--radius-md)", padding: "4px 10px",
    }}>
      <ClockIcon style={{ width: "13px", height: "13px", color: "rgba(255,255,255,0.7)" }} />
      <span style={{ color: "rgba(255,255,255,0.85)", fontSize: "var(--text-xs)", fontWeight: 600 }}>{elapsed}</span>
    </div>
  );
}

export function PosLayout({ children }: PosLayoutProps) {
  const { session, isOffline, wsStatus, setSession } = useStore();
  const { currentShift, setShiftModalOpen } = useShiftStore();

  const connectionState: "online" | "degraded" | "offline" =
    isOffline ? "offline" :
    wsStatus === "connected" ? "online" : "degraded";

  const handleLogout = () => {
    const token = authClient.getStoredToken();
    if (token) void authClient.logout(token);
    authClient.clearToken();
    setSession(null);
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--color-gray-50)" }}>

      <header
        style={{
          height: "52px",
          background: "var(--color-brand)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 var(--sp-lg)",
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ color: "var(--color-accent)", fontSize: "var(--text-lg)", fontWeight: 700, letterSpacing: "-0.5px" }}>
            Eventity
          </span>
          <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "var(--text-sm)" }}>POS</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-sm)" }}>
          {connectionState !== "online" && (
            <div style={{
              display: "flex", alignItems: "center", gap: "5px",
              background: connectionState === "offline" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)",
              border: `1px solid ${connectionState === "offline" ? "rgba(239,68,68,0.4)" : "rgba(245,158,11,0.4)"}`,
              borderRadius: "var(--radius-md)", padding: "4px 10px",
            }}>
              {connectionState === "offline"
                ? <SignalSlashIcon style={{ width: "13px", height: "13px", color: "rgba(255,180,180,0.9)", flexShrink: 0 }} />
                : <WifiIcon style={{ width: "13px", height: "13px", color: "rgba(255,220,130,0.9)", flexShrink: 0 }} />
              }
              <span style={{
                color: connectionState === "offline" ? "rgba(255,180,180,0.9)" : "rgba(255,220,130,0.9)",
                fontSize: "var(--text-xs)", fontWeight: 600,
              }}>
                {connectionState === "offline" ? "Offline" : "Segnale debole"}
              </span>
            </div>
          )}
          {currentShift && <ShiftBadge openedAt={currentShift.openedAt} />}
          <button
            onClick={() => setShiftModalOpen(currentShift ? "close" : "open")}
            title={currentShift ? "Chiudi turno" : "Apri turno"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 12px",
              borderRadius: "var(--radius-md)",
              border: currentShift
                ? "1px solid rgba(239,68,68,0.5)"
                : "1px solid rgba(255,255,255,0.3)",
              background: currentShift
                ? "rgba(239,68,68,0.18)"
                : "rgba(255,255,255,0.12)",
              cursor: "pointer",
              color: currentShift ? "rgba(255,180,180,0.95)" : "rgba(255,255,255,0.85)",
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              fontFamily: "var(--font)",
            }}
          >
            <ClockIcon style={{ width: "13px", height: "13px", flexShrink: 0 }} />
            {currentShift ? "Chiudi turno" : "Apri turno"}
          </button>
          {session && (
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "var(--text-sm)", fontWeight: 500 }}>
              {session.username}
            </span>
          )}
          <button
            onClick={handleLogout}
            title="Esci"
            style={{
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: "var(--radius-md)",
              color: "rgba(255,255,255,0.8)",
              padding: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "30px",
              minWidth: "30px",
            }}
          >
            <ArrowRightOnRectangleIcon style={{ width: "16px", height: "16px" }} />
          </button>
        </div>
      </header>

      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {children}
      </div>
    </div>
  );
}
