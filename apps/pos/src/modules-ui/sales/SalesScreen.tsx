import React from "react";
import { PosLayout } from "../../layout/PosLayout.js";
import { ProductGrid } from "./ProductGrid.js";
import { CartPanel } from "./CartPanel.js";

export function SalesScreen() {
  return (
    <PosLayout>
      <div
        style={{
          height: "100%",
          display: "grid",
          gridTemplateColumns: "1fr 320px",
        }}
      >
        <ProductGrid />
        <CartPanel />
      </div>
    </PosLayout>
  );
}
