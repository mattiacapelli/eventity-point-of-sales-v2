import React from "react";
import { PosLayout } from "../../layout/PosLayout.js";
import { Cog6ToothIcon } from "../../components/ui/icons.js";

export function SettingsScreen() {
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
        <Cog6ToothIcon style={{ width: "56px", height: "56px", color: "var(--color-gray-300)" }} />
        <span style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-600)" }}>
          Impostazioni
        </span>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-400)" }}>Prossimamente</span>
      </div>
    </PosLayout>
  );
}
