import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useStore } from "../state/global-store.js";
import {
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  WrenchScrewdriverIcon,
} from "./ui/icons.js";

const NAV_ITEMS = [
  { path: "/pos",      label: "Home",            Icon: HomeIcon },
  { path: "/history",  label: "Storico",         Icon: ClipboardDocumentListIcon },
  { path: "/stats",    label: "Statistiche",     Icon: ChartBarIcon },
  { path: "/admin",    label: "Amministrazione", Icon: WrenchScrewdriverIcon, roles: ["admin"] },
  { path: "/audit",    label: "Audit log",       Icon: ShieldCheckIcon,       roles: ["admin"] },
] as const;

function NavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const role = useStore((s) => s.session?.role);
  const drawerRef = useRef<HTMLDivElement>(null);
  const visibleItems = NAV_ITEMS.filter((item) => !("roles" in item) || (item.roles as readonly string[]).includes(role ?? ""));

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    function handle(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 199,
          background: "rgba(0,0,0,0.35)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 180ms ease",
        }}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu navigazione"
        style={{
          position: "fixed",
          bottom: "76px",
          left: "12px",
          zIndex: 200,
          width: "220px",
          background: "var(--color-surface, var(--color-white, #fff))",
          borderRadius: "var(--radius-xl, 16px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
          padding: "8px",
          transform: open ? "translateY(0) scale(1)" : "translateY(12px) scale(0.95)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "transform 180ms ease, opacity 180ms ease",
          transformOrigin: "bottom left",
        }}
      >
        {visibleItems.map(({ path, label, Icon }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => { navigate(path); onClose(); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                width: "100%",
                padding: "11px 14px",
                borderRadius: "var(--radius-lg, 10px)",
                border: "none",
                background: active ? "var(--color-brand, #306b34)" : "transparent",
                color: active ? "#fff" : "var(--color-text, #111)",
                fontFamily: "var(--font)",
                fontSize: "var(--text-md, 15px)",
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                textAlign: "left",
                transition: "background 120ms",
              }}
            >
              <Icon style={{ width: "18px", height: "18px", flexShrink: 0, opacity: active ? 1 : 0.65 }} />
              {label}
            </button>
          );
        })}
      </div>
    </>
  );
}

/** Persistent floating menu button — always bottom-left. */
export function NavMenuFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <NavDrawer open={open} onClose={() => setOpen(false)} />
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Chiudi menu" : "Apri menu"}
        aria-expanded={open}
        style={{
          position: "fixed",
          bottom: "20px",
          left: "12px",
          zIndex: 201,
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          border: "none",
          background: "var(--color-brand, #306b34)",
          color: "#fff",
          boxShadow: "0 4px 16px rgba(0,0,0,0.28)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform 160ms ease, box-shadow 160ms ease",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.08)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
      >
        {open
          ? <XMarkIcon style={{ width: "22px", height: "22px" }} />
          : <Bars3Icon style={{ width: "22px", height: "22px" }} />
        }
      </button>
    </>
  );
}
