import { useState } from "react";
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
      <div style={{
        padding: "calc(var(--sp-lg) + var(--safe-top)) var(--sp-lg) var(--sp-xl)",
        background: "var(--color-brand)", display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0,
      }}>
        <span style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "-0.04em", color: "var(--color-white)" }}>epos</span>
        <span style={{ fontSize: "13px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-brand-light)" }}>Ordina dal tavolo</span>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "22px", padding: "26px var(--sp-lg) var(--sp-md)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", textAlign: "center" }}>
          <div
            style={{
              width: "132px", height: "132px", borderRadius: "30px", flexShrink: 0,
              background: logoUrl ? "var(--color-white)" : "repeating-linear-gradient(135deg, var(--color-gray-100) 0 8px, var(--color-white) 8px 16px)",
              border: "1px solid var(--color-gray-200)",
              display: "grid", placeItems: "center", overflow: "hidden",
              padding: logoUrl ? "var(--sp-md)" : 0,
            }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              <img src="/logo.svg" alt="epos" style={{ width: "72px", height: "auto" }} />
            )}
          </div>
        </div>

        <div style={{
          padding: "16px 18px", borderRadius: "14px", background: "#E8F0EA",
          display: "flex", flexDirection: "column", gap: "4px",
        }}>
          <span style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--color-brand)" }}>Come funziona</span>
          <span style={{ fontSize: "14px", lineHeight: 1.5, color: "#2F5C43" }}>
            Scegli i piatti, conferma l'ordine e mostra il codice in cassa per pagare e ritirare.
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle} htmlFor="tableId">
              Tavolo o postazione{requireTableId && <span style={{ color: "var(--color-danger)" }}> *</span>}
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
              Nome per la chiamata{requireCustomerName && <span style={{ color: "var(--color-danger)" }}> *</span>}
            </label>
            <input
              id="customerName"
              className="input-field"
              style={inputStyle}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={requireCustomerName ? "Es. Mario Rossi" : "Es. Mario"}
              maxLength={100}
            />
            {!requireCustomerName && (
              <span style={{ fontSize: "13px", color: "var(--color-gray-500)", marginTop: "6px", display: "block" }}>
                Serve solo per chiamarti al ritiro.
              </span>
            )}
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
