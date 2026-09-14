import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { useStore } from "../state/global-store.js";
import { useShiftStore } from "../state/shift-store.js";
import { useTerminalStore } from "../state/terminal-store.js";
import { authClient } from "../core/auth-client.js";
import { apiClient } from "../core/api-client.js";
import { ClockIcon, WifiIcon, SignalSlashIcon } from "../components/ui/icons.js";
import { TerminalSelectModal } from "../components/TerminalSelectModal.js";

interface PosLayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { path: "/pos",       label: "Cassa" },
  { path: "/kitchen",   label: "Comande" },
  { path: "/history",   label: "Storico" },
  { path: "/stats",     label: "Statistiche" },
  { path: "/admin",     label: "Admin",  roles: ["admin"] },
] as const;

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
      background: "var(--color-gray-100)", border: "1px solid var(--color-gray-200)",
      borderRadius: "var(--radius-md)", padding: "4px 10px",
    }}>
      <ClockIcon style={{ width: "13px", height: "13px", color: "var(--color-gray-600)" }} />
      <span style={{ color: "var(--color-gray-700)", fontSize: "var(--text-xs)", fontWeight: 600 }}>{elapsed}</span>
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
  const navigate = useNavigate();
  const location = useLocation();
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

  const visibleNavItems = NAV_ITEMS.filter((item) => !("roles" in item) || (item.roles as readonly string[]).includes(session?.role ?? ""));

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--color-gray-100)" }}>

      <header
        style={{
          display: "flex", alignItems: "center", gap: "26px",
          padding: "0 18px", height: "64px",
          background: "var(--color-white)", borderBottom: "1px solid var(--color-gray-200)",
          flexShrink: 0, zIndex: 10,
        }}
      >
        {/* Left: logo */}
        <div style={{ flex: "none", display: "flex", alignItems: "baseline", gap: "10px" }}>
          <span style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "-0.04em", color: "var(--color-brand)" }}>epos</span>
        </div>

        {/* Nav */}
        <nav style={{
          flex: "1 1 auto", minWidth: 0, display: "flex", alignItems: "center", gap: "4px",
          overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none",
        }}>
          {visibleNavItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  height: "42px", padding: "0 15px", borderRadius: "11px",
                  fontSize: "15px", fontWeight: 600, letterSpacing: "-0.005em",
                  flex: "none", whiteSpace: "nowrap", fontFamily: "var(--font)",
                  background: active ? "#E8F0EA" : "transparent",
                  color: active ? "var(--color-brand)" : "var(--color-gray-700)",
                  cursor: "pointer",
                }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right: status chips + profile */}
        <div style={{ flex: "none", display: "flex", alignItems: "center", gap: "8px" }}>
          {connectionState !== "online" && (
            <div style={{
              display: "flex", alignItems: "center", gap: "5px", flexShrink: 0,
              background: connectionState === "offline" ? "rgba(154,44,34,0.1)" : "rgba(201,138,22,0.12)",
              border: `1px solid ${connectionState === "offline" ? "rgba(154,44,34,0.25)" : "rgba(201,138,22,0.3)"}`,
              borderRadius: "var(--radius-md)", padding: "4px 10px",
            }}>
              {connectionState === "offline"
                ? <SignalSlashIcon style={{ width: "13px", height: "13px", color: "var(--color-danger)", flexShrink: 0 }} />
                : <WifiIcon style={{ width: "13px", height: "13px", color: "var(--color-warning)", flexShrink: 0 }} />
              }
              <span style={{ color: connectionState === "offline" ? "var(--color-danger)" : "var(--color-warning)", fontSize: "var(--text-xs)", fontWeight: 600 }}>
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
                background: "var(--color-gray-100)", border: "1px solid var(--color-gray-200)",
                borderRadius: "var(--radius-md)", padding: "4px 10px",
                cursor: isAdmin ? "pointer" : "default",
              }}
            >
              <span style={{ color: "var(--color-gray-700)", fontSize: "var(--text-xs)", fontWeight: 600 }}>{terminalName}</span>
              {isAdmin && <span style={{ color: "var(--color-gray-400)", fontSize: "10px" }}>✎</span>}
            </div>
          )}
          {currentShift && <ShiftBadge openedAt={currentShift.openedAt} />}
          <button
            onClick={() => setShiftModalOpen(currentShift ? "close" : "open")}
            style={{
              display: "flex", alignItems: "center", gap: "6px", flexShrink: 0,
              height: "42px", padding: "0 14px", borderRadius: "11px",
              fontSize: "14px", fontWeight: 600, whiteSpace: "nowrap", fontFamily: "var(--font)",
              border: currentShift ? "1px solid var(--color-gray-200)" : "none",
              background: currentShift ? "var(--color-white)" : "var(--color-brand)",
              color: currentShift ? "var(--color-gray-700)" : "var(--color-white)",
              cursor: "pointer",
            }}
          >
            <ClockIcon style={{ width: "14px", height: "14px", flexShrink: 0 }} />
            {currentShift ? "Chiudi cassa" : "Apri cassa"}
          </button>

          {session && (
            <div style={{ flexShrink: 0, position: "relative" }}>
              <button
                ref={profileBtnRef}
                onClick={() => setProfileOpen((v) => !v)}
                title="Profilo"
                style={{
                  display: "flex", alignItems: "center", gap: "9px",
                  height: "42px", padding: "0 10px 0 8px", borderRadius: "11px",
                  border: "1px solid var(--color-gray-200)", background: "var(--color-white)",
                  color: "var(--color-gray-900)", cursor: "pointer",
                  fontFamily: "var(--font)", fontSize: "14px", fontWeight: 600, whiteSpace: "nowrap",
                }}
              >
                <span style={{
                  width: "26px", height: "26px", borderRadius: "50%",
                  background: "#E8F0EA", color: "var(--color-brand)",
                  fontSize: "13px", fontWeight: 700, display: "grid", placeItems: "center", flexShrink: 0,
                }}>
                  {session.name.charAt(0)}
                </span>
                {session.name}
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
        </div>
      </header>

      <div style={{ flex: 1, overflow: "hidden", position: "relative", minHeight: 0, height: 0 }}>
        {children}
      </div>

      {terminalModalOpen && (
        <TerminalSelectModal onSelected={() => setTerminalModalOpen(false)} />
      )}
    </div>
  );
}
