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

export function InfoScreen({ initial, logoUrl, requireTableId = true, requireCustomerName = false, onSubmit }: {
  initial: OrderInfo;
  logoUrl?: string | null;
  requireTableId?: boolean;
  requireCustomerName?: boolean;
  onSubmit: (info: OrderInfo) => void;
}) {
  const [tableId, setTableId] = useState(initial.tableId);
  const [customerName, setCustomerName] = useState(initial.customerName);

  const canProceed = (!requireTableId || tableId.trim().length > 0) && (!requireCustomerName || customerName.trim().length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <Header />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "var(--sp-xl) var(--sp-lg)", gap: "var(--sp-xl)" }}>
        <div
          style={{
            width: "180px",
            height: "180px",
            borderRadius: "50%",
            background: logoUrl ? "var(--color-white)" : "linear-gradient(160deg, var(--color-brand) 0%, var(--color-brand-dark) 100%)",
            boxShadow: "var(--shadow-lg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: logoUrl ? "var(--sp-md)" : "var(--sp-lg)",
            overflow: "hidden",
          }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          ) : (
            <img src="/logo.svg" alt="epos" style={{ width: "100%", height: "auto" }} />
          )}
        </div>

        <div style={{ width: "100%", maxWidth: "360px", display: "flex", flexDirection: "column", gap: "var(--sp-lg)" }}>
          <div>
            <label style={labelStyle} htmlFor="tableId">
              Tavolo{requireTableId && <span style={{ color: "var(--color-danger)" }}> *</span>}
            </label>
            <input
              id="tableId"
              className="input-field"
              style={inputStyle}
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
              placeholder="Es. 12 o A3"
              maxLength={20}
              autoFocus
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="customerName">
              Nome e Cognome{requireCustomerName && <span style={{ color: "var(--color-danger)" }}> *</span>}
            </label>
            <input
              id="customerName"
              className="input-field"
              style={inputStyle}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={requireCustomerName ? "Es. Mario Rossi" : "Facoltativo"}
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
