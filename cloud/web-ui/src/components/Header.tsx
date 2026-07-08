import type { ReactNode } from "react";
import { BackButton } from "./BackButton.js";

export function Header({ title, subtitle, onBack, children }: { title?: string | undefined; subtitle?: string | undefined; onBack?: (() => void) | undefined; children?: ReactNode }) {
  return (
    <header
      style={{
        background: "var(--color-brand)",
        color: "var(--color-white)",
        padding: `calc(var(--sp-lg) + var(--safe-top)) var(--sp-lg) var(--sp-lg)`,
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        flexShrink: 0,
        position: "relative",
      }}
    >
      {onBack && <BackButton onClick={onBack} />}
      {children ?? (
        <>
          <img src="/logo.svg" alt="epos" style={{ height: "28px", width: "auto", marginLeft: onBack ? "36px" : 0 }} />
          {title && <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginTop: "4px" }}>{title}</div>}
          {subtitle && <div style={{ fontSize: "var(--text-sm)", opacity: 0.9 }}>{subtitle}</div>}
        </>
      )}
    </header>
  );
}
