import { BuildingStorefrontIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import type { ComponentType, SVGProps } from "react";
import type { CurrentUser } from "../core/types.js";

export type Section = "tenants" | "profile";

const NAV_ITEMS: { key: Section; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { key: "tenants", label: "Locali", Icon: BuildingStorefrontIcon },
  { key: "profile", label: "Il mio profilo", Icon: UserCircleIcon },
];

export function Sidebar({ currentUser, active, onSelect }: {
  currentUser: CurrentUser;
  active: Section;
  onSelect: (section: Section) => void;
}) {
  return (
    <div
      style={{
        width: "220px",
        flexShrink: 0,
        background: "linear-gradient(160deg, var(--color-brand) 0%, var(--color-brand-dark) 100%)",
        color: "var(--color-white)",
        display: "flex",
        flexDirection: "column",
        padding: "var(--sp-lg) var(--sp-md)",
        gap: "var(--sp-xl)",
        minHeight: "100vh",
      }}
    >
      <img src="/logo.svg" alt="epos" style={{ height: "26px" }} />

      <nav style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
        {NAV_ITEMS.map(({ key, label, Icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                background: isActive ? "var(--color-white)" : "transparent",
                color: isActive ? "var(--color-brand)" : "rgba(255,255,255,0.85)",
                fontSize: "var(--text-sm)",
                fontWeight: 700,
                textAlign: "left",
              }}
            >
              <Icon width={18} height={18} />
              {label}
            </button>
          );
        })}
      </nav>

      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.15)",
          paddingTop: "var(--sp-md)",
          fontSize: "var(--text-xs)",
          color: "rgba(255,255,255,0.7)",
          wordBreak: "break-all",
        }}
      >
        {currentUser.email}
        {currentUser.isSuperAdmin && (
          <div style={{ marginTop: "2px", fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>Super-admin</div>
        )}
      </div>
    </div>
  );
}
