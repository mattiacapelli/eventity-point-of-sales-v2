import React from "react";
import { PosLayout } from "../../layout/PosLayout.js";
import { ChartBarIcon } from "../../components/ui/icons.js";

export function StatsScreen() {
  return (
    <PosLayout>
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--sp-md)",
        }}
      >
        <ChartBarIcon style={{ width: "56px", height: "56px", color: "var(--color-gray-300)" }} />
        <span style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-600)" }}>
          Statistiche
        </span>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-400)" }}>Prossimamente</span>
      </div>
    </PosLayout>
  );
}
