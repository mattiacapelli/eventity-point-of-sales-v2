import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../state/global-store.js";
import { useShiftStore } from "../state/shift-store.js";
import { useTerminalStore } from "../state/terminal-store.js";
import { authClient } from "../core/auth-client.js";
import { apiClient } from "../core/api-client.js";
import { ClockIcon, WifiIcon, SignalSlashIcon } from "../components/ui/icons.js";
import { NavMenuFab } from "../components/NavMenu.js";
import { TerminalSelectModal } from "../components/TerminalSelectModal.js";

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

// ─── Profile popover ──────────────────────────────────────────────────────────

function ProfilePopover({ anchorRef, onClose, onLogout }: {
  anchorRef: React.RefObject<HTMLButtonElement>;
  onClose: () => void;
  onLogout: () => void;
}) {
  const session = useStore((s) => s.session);
  const popRef = useRef<HTMLDivElement>(null);

  // PIN change state
  const [pinMode, setPinMode] = useState(false);
  const [curPin, setCurPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confPin, setConfPin] = useState("");
  const [pinErr, setPinErr] = useState<string | null>(null);
  const [pinOk, setPinOk] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);

  // Position popover below the anchor button
  const [pos, setPos] = useState({ top: 0, right: 0 });
  useEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    }
  }, [anchorRef]);

  // Close on outside click / Escape
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [onClose, anchorRef]);

  async function handleChangePin(e: React.FormEvent) {
    e.preventDefault();
    setPinErr(null);
    if (newPin.length < 4) { setPinErr("Minimo 4 cifre"); return; }
    if (newPin !== confPin) { setPinErr("I PIN non coincidono"); return; }
    setPinLoading(true);
    try {
      await apiClient.auth.changePin(curPin, newPin);
      setPinOk(true);
      setTimeout(() => { setPinMode(false); setPinOk(false); setCurPin(""); setNewPin(""); setConfPin(""); }, 1400);
    } catch (err) {
      setPinErr(err instanceof Error ? err.message : "Errore");
    } finally {
      setPinLoading(false);
    }
  }

  return createPortal(
    <div ref={popRef} style={{
      position: "fixed", top: pos.top, right: pos.right, zIndex: 500,
      width: "280px",
      background: "var(--color-white)",
      borderRadius: "var(--radius-xl)",
      boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
      border: "1px solid var(--color-gray-100)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--color-gray-100)", background: "var(--color-gray-50)" }}>
        <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--color-gray-900)" }}>{session?.name}</div>
        <div style={{ fontSize: "11px", color: "var(--color-gray-400)", marginTop: "2px", textTransform: "capitalize" }}>{session?.role}</div>
      </div>

      <div style={{ padding: "8px 16px" }}>
        {!pinMode ? (<>
          {/* Change PIN */}
          <button onClick={() => setPinMode(true)} style={{
            width: "100%", padding: "9px", marginTop: "4px",
            borderRadius: "var(--radius-md)", border: "1.5px solid var(--color-gray-200)",
            background: "var(--color-white)", color: "var(--color-gray-700)",
            fontFamily: "var(--font)", fontSize: "13px", fontWeight: 600, cursor: "pointer", textAlign: "left",
          }}>🔑 Cambia PIN</button>

          {/* Logout */}
          <button onClick={onLogout} style={{
            width: "100%", padding: "9px", marginTop: "6px", marginBottom: "4px",
            borderRadius: "var(--radius-md)", border: "none",
            background: "rgba(239,68,68,0.07)", color: "var(--color-danger)",
            fontFamily: "var(--font)", fontSize: "13px", fontWeight: 700, cursor: "pointer", textAlign: "left",
          }}>← Esci</button>
        </>) : (
          // PIN change form
          <div style={{ paddingTop: "4px", paddingBottom: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <button onClick={() => { setPinMode(false); setPinErr(null); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", color: "var(--color-gray-500)", padding: 0 }}>←</button>
              <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--color-gray-900)" }}>Cambia PIN</span>
            </div>
            {pinOk ? (
              <div style={{ textAlign: "center", padding: "16px 0", color: "var(--color-brand)", fontWeight: 700 }}>✓ PIN aggiornato</div>
            ) : (
              <form onSubmit={(e) => void handleChangePin(e)} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  { label: "PIN attuale", val: curPin, set: setCurPin },
                  { label: "Nuovo PIN", val: newPin, set: setNewPin },
                  { label: "Conferma PIN", val: confPin, set: setConfPin },
                ].map(({ label: l, val, set }) => (
                  <input key={l} type="password" inputMode="numeric" placeholder={l} maxLength={12}
                    value={val} onChange={(e) => set(e.target.value)}
                    style={{
                      padding: "8px 12px", borderRadius: "var(--radius-md)",
                      border: "1.5px solid var(--color-gray-200)",
                      fontFamily: "var(--font)", fontSize: "13px", outline: "none",
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-brand)"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-gray-200)"; }}
                  />
                ))}
                {pinErr && <div style={{ fontSize: "12px", color: "var(--color-danger)" }}>{pinErr}</div>}
                <button type="submit" disabled={pinLoading} style={{
                  padding: "9px", borderRadius: "var(--radius-md)", border: "none",
                  background: "var(--color-brand)", color: "white",
                  fontFamily: "var(--font)", fontSize: "13px", fontWeight: 700, cursor: "pointer", marginTop: "4px",
                }}>{pinLoading ? "..." : "Aggiorna PIN"}</button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function PosLayout({ children }: PosLayoutProps) {
  const { session, isOffline, wsStatus, setSession, multiTerminalEnabled } = useStore();
  const { currentShift, setShiftModalOpen } = useShiftStore();
  const { terminalName } = useTerminalStore();
  const [terminalModalOpen, setTerminalModalOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileBtnRef = useRef<HTMLButtonElement>(null);
  const isAdmin = session?.role === "admin";

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
        {/* Left: logo */}
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <img src="/logo.svg" alt="Eventity" style={{ height: "24px", display: "block" }} />
        </div>

        {/* Center: optional chips — allowed to shrink/disappear */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-sm)", overflow: "hidden", flex: 1, justifyContent: "flex-end", marginRight: "var(--sp-sm)" }}>
          {connectionState !== "online" && (
            <div style={{
              display: "flex", alignItems: "center", gap: "5px", flexShrink: 0,
              background: connectionState === "offline" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)",
              border: `1px solid ${connectionState === "offline" ? "rgba(239,68,68,0.4)" : "rgba(245,158,11,0.4)"}`,
              borderRadius: "var(--radius-md)", padding: "4px 10px",
            }}>
              {connectionState === "offline"
                ? <SignalSlashIcon style={{ width: "13px", height: "13px", color: "rgba(255,180,180,0.9)", flexShrink: 0 }} />
                : <WifiIcon style={{ width: "13px", height: "13px", color: "rgba(255,220,130,0.9)", flexShrink: 0 }} />
              }
              <span style={{ color: connectionState === "offline" ? "rgba(255,180,180,0.9)" : "rgba(255,220,130,0.9)", fontSize: "var(--text-xs)", fontWeight: 600 }}>
                {connectionState === "offline" ? "Offline" : "Segnale debole"}
              </span>
            </div>
          )}
          {multiTerminalEnabled && terminalName && (
            <div
              onClick={isAdmin ? () => setTerminalModalOpen(true) : undefined}
              title={isAdmin ? "Cambia terminale" : undefined}
              style={{
                display: "flex", alignItems: "center", gap: "5px", flexShrink: 0,
                background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: "var(--radius-md)", padding: "4px 10px",
                cursor: isAdmin ? "pointer" : "default",
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.85)", fontSize: "var(--text-xs)", fontWeight: 600 }}>{terminalName}</span>
              {isAdmin && <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "10px" }}>✎</span>}
            </div>
          )}
          {currentShift && <ShiftBadge openedAt={currentShift.openedAt} />}
          <button
            onClick={() => setShiftModalOpen(currentShift ? "close" : "open")}
            style={{
              display: "flex", alignItems: "center", gap: "6px", flexShrink: 0,
              borderRadius: "var(--radius-md)",
              border: currentShift ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(255,255,255,0.3)",
              background: currentShift ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.12)",
              cursor: "pointer",
              color: "rgba(255,255,255,0.85)",
              padding: "5px 10px",
              fontFamily: "var(--font)", fontSize: "13px", fontWeight: 600,
            }}
          >
            <ClockIcon style={{ width: "14px", height: "14px", flexShrink: 0 }} />
            {currentShift ? "Chiudi turno" : "Apri turno"}
          </button>
        </div>

        {/* Right: username — always visible */}
        {session && (
          <div style={{ flexShrink: 0 }}>
            <button
              ref={profileBtnRef}
              onClick={() => setProfileOpen((v) => !v)}
              title="Profilo"
              style={{
                display: "flex", alignItems: "center", gap: "5px",
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: "6px",
                color: "#fff", cursor: "pointer",
                fontFamily: "var(--font)", fontSize: "13px", fontWeight: 600,
                whiteSpace: "nowrap", padding: "5px 10px",
              }}
            >
              {session.name}
              <span style={{ fontSize: "9px", opacity: 0.6, color: "#fff" }}>▾</span>
            </button>
            {profileOpen && (
              <ProfilePopover
                anchorRef={profileBtnRef}
                onClose={() => setProfileOpen(false)}
                onLogout={() => { setProfileOpen(false); handleLogout(); }}
              />
            )}
          </div>
        )}
      </header>

      <div style={{ flex: 1, overflow: "hidden", position: "relative", minHeight: 0, height: 0 }}>
        {children}
      </div>

      <NavMenuFab />

      {terminalModalOpen && (
        <TerminalSelectModal onSelected={() => setTerminalModalOpen(false)} />
      )}
    </div>
  );
}
