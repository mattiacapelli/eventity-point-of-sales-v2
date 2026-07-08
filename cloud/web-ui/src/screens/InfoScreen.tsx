import { useState } from "react";
import { Header } from "../components/Header.js";
import { Footer } from "../components/Footer.js";
import { Button } from "../components/Button.js";
import type { OrderInfo } from "../core/types.js";

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: "48px",
  padding: "0 14px",
  borderRadius: "var(--radius-md)",
  border: "1.5px solid var(--color-gray-200)",
  background: "var(--color-gray-50)",
  fontSize: "var(--text-md)",
  color: "var(--color-gray-900)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  fontWeight: 600,
  color: "var(--color-gray-700)",
  marginBottom: "6px",
  display: "block",
};

export function InfoScreen({ initial, onSubmit }: { initial: OrderInfo; onSubmit: (info: OrderInfo) => void }) {
  const [tableId, setTableId] = useState(initial.tableId);
  const [customerName, setCustomerName] = useState(initial.customerName);

  const canProceed = tableId.trim().length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <Header />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "var(--sp-xl) var(--sp-lg)", gap: "var(--sp-xl)" }}>
        <div
          style={{
            width: "180px",
            height: "180px",
            borderRadius: "50%",
            background: "var(--color-brand)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--sp-lg)",
          }}
        >
          <img src="/logo.svg" alt="epos" style={{ width: "100%", height: "auto" }} />
        </div>

        <div style={{ width: "100%", maxWidth: "360px", display: "flex", flexDirection: "column", gap: "var(--sp-lg)" }}>
          <div>
            <label style={labelStyle} htmlFor="tableId">Tavolo</label>
            <input
              id="tableId"
              style={inputStyle}
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
              placeholder="Es. 12"
              inputMode="numeric"
              maxLength={20}
              autoFocus
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="customerName">Nome e Cognome</label>
            <input
              id="customerName"
              style={inputStyle}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Facoltativo"
              maxLength={100}
            />
          </div>
        </div>
      </div>
      <div style={{ padding: "0 var(--sp-lg) var(--sp-lg)" }}>
        <Button
          disabled={!canProceed}
          onClick={() => onSubmit({ tableId: tableId.trim(), customerName: customerName.trim() })}
        >
          Prosegui
        </Button>
      </div>
      <Footer />
    </div>
  );
}
