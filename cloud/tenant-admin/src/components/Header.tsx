import { useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { UserGroupIcon } from "@heroicons/react/24/outline";
import type { CurrentUser } from "../core/types.js";
import { Popover } from "./Popover.js";

const NAV_ITEMS: { path: string; label: string; superAdminOnly?: boolean }[] = [
  { path: "/tenants", label: "Locali" },
  { path: "/users", label: "Utenti", superAdminOnly: true },
];

function ProfilePopover({ currentUser, anchorRef, onClose, onLogout }: {
  currentUser: CurrentUser;
  anchorRef: React.RefObject<HTMLButtonElement>;
  onClose: () => void;
  onLogout: () => void;
}) {
  const navigate = useNavigate();

  return (
    <Popover anchorRef={anchorRef} onClose={onClose} width={220}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--color-gray-100)", background: "var(--color-gray-50)" }}>
        <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--color-gray-900)", wordBreak: "break-all" }}>{currentUser.email}</div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", marginTop: "2px" }}>
          {currentUser.isSuperAdmin ? "Super-admin" : "Utente"}
        </div>
      </div>
      <div style={{ padding: "8px 16px", display: "flex", flexDirection: "column", gap: "6px" }}>
        <button
          onClick={() => { onClose(); navigate("/profile"); }}
          className="btn-outline"
          style={{
            width: "100%", padding: "9px", marginTop: "4px",
            borderRadius: "var(--radius-md)", border: "1.5px solid var(--color-gray-200)",
            background: "var(--color-white)", color: "var(--color-gray-700)",
            fontFamily: "var(--font)", fontSize: "var(--text-sm)", fontWeight: 600, textAlign: "left",
          }}
        >
          Il mio profilo
        </button>
        <button
          onClick={onLogout}
          style={{
            width: "100%", padding: "9px", marginBottom: "4px",
            borderRadius: "var(--radius-md)", border: "none",
            background: "var(--color-danger-wash)", color: "var(--color-danger)",
            fontFamily: "var(--font)", fontSize: "var(--text-sm)", fontWeight: 700, textAlign: "left",
          }}
        >
          ← Esci
        </button>
      </div>
    </Popover>
  );
}

export function Header({ currentUser, onLogout }: { currentUser: CurrentUser; onLogout: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileBtnRef = useRef<HTMLButtonElement>(null);

  const visibleItems = NAV_ITEMS.filter((item) => !item.superAdminOnly || currentUser.isSuperAdmin);

  return (
    <header
      style={{
        display: "flex", alignItems: "center", gap: "12px",
        padding: "0 12px", height: "64px", minWidth: 0,
        background: "var(--color-white)", borderBottom: "1px solid var(--color-gray-200)",
        flexShrink: 0, zIndex: 10,
      }}
    >
      <div style={{ flex: "none", display: "flex", alignItems: "baseline", gap: "10px" }}>
        <span style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "-0.04em", color: "var(--color-brand)" }}>epos</span>
      </div>

      <nav style={{
        flex: "1 1 auto", minWidth: 0, display: "flex", alignItems: "center", gap: "4px",
        overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none",
      }}>
        {visibleItems.map((item) => {
          const active = location.pathname.startsWith(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                height: "42px", padding: "0 15px", borderRadius: "var(--radius-md)",
                fontSize: "var(--text-md)", fontWeight: 600, letterSpacing: "-0.005em",
                flex: "none", whiteSpace: "nowrap", fontFamily: "var(--font)",
                background: active ? "var(--color-brand-tint)" : "transparent",
                color: active ? "var(--color-brand)" : "var(--color-gray-700)",
              }}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
        {currentUser.isSuperAdmin && (
          <div className="header-superadmin-badge" style={{
            display: "flex", alignItems: "center", gap: "5px", flexShrink: 0,
            background: "var(--color-gray-100)", border: "1px solid var(--color-gray-200)",
            borderRadius: "var(--radius-md)", padding: "4px 10px", whiteSpace: "nowrap",
          }}>
            <UserGroupIcon style={{ width: "13px", height: "13px", color: "var(--color-gray-600)", flexShrink: 0 }} />
            <span style={{ color: "var(--color-gray-700)", fontSize: "var(--text-xs)", fontWeight: 600 }}>Super-admin</span>
          </div>
        )}

        <div style={{ flexShrink: 0, position: "relative" }}>
          <button
            ref={profileBtnRef}
            onClick={() => setProfileOpen((v) => !v)}
            title="Profilo"
            className="header-profile-btn"
            style={{
              display: "flex", alignItems: "center", gap: "9px",
              height: "42px", padding: "0 10px 0 8px", borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-gray-200)", background: "var(--color-white)",
              color: "var(--color-gray-900)",
              fontFamily: "var(--font)", fontSize: "var(--text-sm)", fontWeight: 600, whiteSpace: "nowrap",
            }}
          >
            <span style={{
              width: "26px", height: "26px", borderRadius: "50%",
              background: "var(--color-brand-tint)", color: "var(--color-brand)",
              fontSize: "var(--text-xs)", fontWeight: 700, display: "grid", placeItems: "center", flexShrink: 0,
            }}>
              {currentUser.email.charAt(0).toUpperCase()}
            </span>
            <span className="header-profile-name">{currentUser.email.split("@")[0]}</span>
          </button>
          {profileOpen && (
            <ProfilePopover
              currentUser={currentUser}
              anchorRef={profileBtnRef}
              onClose={() => setProfileOpen(false)}
              onLogout={() => { setProfileOpen(false); onLogout(); }}
            />
          )}
        </div>
      </div>
    </header>
  );
}
