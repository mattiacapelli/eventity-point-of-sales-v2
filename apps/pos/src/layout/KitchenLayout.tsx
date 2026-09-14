import React from "react";
import { PosLayout } from "./PosLayout.js";

interface KitchenLayoutProps {
  children: React.ReactNode;
}

export function KitchenLayout({ children }: KitchenLayoutProps) {
  return (
    <PosLayout>
      <div className="scrollable" style={{ height: "100%", overflowY: "auto", padding: "22px 20px 32px" }}>
        {children}
      </div>
    </PosLayout>
  );
}
