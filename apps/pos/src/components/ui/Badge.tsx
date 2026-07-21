import React from "react";
import type { OrderStatus } from "@pos/shared-types";

type BadgeVariant = OrderStatus | "ws-online" | "ws-offline" | "offline";

const variantMap: Record<BadgeVariant, { bg: string; color: string; label?: string }> = {
  pending:    { bg: "rgba(245,158,11,0.15)",  color: "var(--status-pending)",   label: "In attesa" },
  confirmed:  { bg: "rgba(59,130,246,0.15)",  color: "var(--status-confirmed)", label: "Confermato" },
  preparing:  { bg: "rgba(139,92,246,0.15)",  color: "var(--status-preparing)", label: "In preparazione" },
  ready:      { bg: "rgba(34,197,94,0.15)",   color: "var(--status-ready)",     label: "Pronto" },
  completed:  { bg: "rgba(107,114,128,0.15)", color: "var(--status-completed)", label: "Completato" },
  cancelled:  { bg: "rgba(239,68,68,0.15)",   color: "var(--status-cancelled)", label: "Annullato" },
  refunded:   { bg: "rgba(139,92,246,0.15)",  color: "#5b21b6",                 label: "Rimborsato" },
  "ws-online":  { bg: "rgba(34,197,94,0.15)",  color: "var(--color-success)" },
  "ws-offline": { bg: "rgba(239,68,68,0.15)",  color: "var(--color-danger)" },
  offline:    { bg: "rgba(245,158,11,0.15)",  color: "var(--color-warning)" },
};

interface BadgeProps {
  variant: BadgeVariant;
  children?: React.ReactNode;
  size?: "sm" | "md";
  dot?: boolean;
}

export function Badge({ variant, children, size = "md", dot = false }: BadgeProps) {
  const { bg, color, label } = variantMap[variant];
  const text = children ?? label ?? variant;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: size === "sm" ? "2px 8px" : "4px 12px",
        borderRadius: "var(--radius-pill)",
        background: bg,
        color,
        fontSize: size === "sm" ? "var(--text-xs)" : "var(--text-sm)",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {dot && (
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: color,
            flexShrink: 0,
          }}
        />
      )}
      {text}
    </span>
  );
}
