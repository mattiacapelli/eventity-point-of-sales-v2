import React from "react";
import { useStore } from "../state/global-store.js";
import { Badge } from "../components/ui/Badge.js";

interface KitchenLayoutProps {
  children: React.ReactNode;
}

export function KitchenLayout({ children }: KitchenLayoutProps) {
  const { wsStatus, orders } = useStore();

  const activeCount = orders.filter(
    (o) => o.status === "pending" || o.status === "confirmed" || o.status === "preparing",
  ).length;

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--color-gray-900)",
        color: "var(--color-white)",
      }}
    >
      {/* Kitchen top bar */}
      <header
        style={{
          height: "60px",
          background: "var(--color-gray-800)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 var(--sp-lg)",
          flexShrink: 0,
          borderBottom: "1px solid var(--color-gray-700)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-md)" }}>
          <span style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-accent)" }}>
            👨‍🍳 Cucina
          </span>
          {activeCount > 0 && (
            <span
              style={{
                background: "var(--color-danger)",
                color: "white",
                borderRadius: "var(--radius-pill)",
                padding: "2px 10px",
                fontSize: "var(--text-sm)",
                fontWeight: 700,
              }}
            >
              {activeCount} attivi
            </span>
          )}
        </div>
        <Badge variant={wsStatus === "connected" ? "ws-online" : "ws-offline"} dot>
          {wsStatus === "connected" ? "Live" : "Offline"}
        </Badge>
      </header>

      <div
        className="scrollable"
        style={{ flex: 1, padding: "var(--sp-md)" }}
      >
        {children}
      </div>
    </div>
  );
}
