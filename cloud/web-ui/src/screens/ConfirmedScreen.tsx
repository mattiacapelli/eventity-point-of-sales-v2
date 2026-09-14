import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Footer } from "../components/Footer.js";
import { Button } from "../components/Button.js";
import type { CartLine, OrderInfo, Product } from "../core/types.js";

function formatEur(n: number): string {
  return `€${n.toFixed(2)}`;
}

export function ConfirmedScreen({ orderCode, qrPayload, info, cart, products, onNewOrder }: {
  orderCode: string;
  qrPayload: string;
  info: OrderInfo;
  cart: CartLine[];
  products: Product[];
  onNewOrder: () => void;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(qrPayload, { width: 320, margin: 1, color: { dark: "#10281C", light: "#ffffff" } })
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(null); });
    return () => { cancelled = true; };
  }, [qrPayload]);

  const count = cart.reduce((s, l) => s + l.quantity, 0);
  const total = cart.reduce((sum, l) => {
    const product = products.find((p) => p.id === l.productId);
    if (!product) return sum;
    const optionsDelta = l.selectedOptionIds
      .map((oid) => product.optionGroups.flatMap((g) => g.options).find((o) => o.id === oid))
      .filter((o): o is NonNullable<typeof o> => o !== undefined)
      .reduce((s, o) => s + o.priceDelta, 0);
    return sum + (product.price + optionsDelta) * l.quantity;
  }, 0);

  const rows = [
    { label: "Tavolo", value: info.tableId || "—" },
    { label: "Nome", value: info.customerName || "Ospite" },
    { label: "Piatti", value: String(count) },
    { label: "Da pagare in cassa", value: formatEur(total) },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div style={{
        padding: `calc(26px + var(--safe-top)) 22px 26px`,
        background: "var(--color-brand)", display: "flex", flexDirection: "column", gap: "8px", flexShrink: 0,
      }}>
        <span style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.04em", color: "var(--color-white)" }}>epos</span>
        <span style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-0.025em", color: "var(--color-white)", lineHeight: 1.15 }}>
          Ordine registrato
        </span>
        <span style={{ fontSize: "15.5px", lineHeight: 1.5, color: "var(--color-brand-light)" }}>
          Mostra questo codice in cassa per pagare e ritirare lo scontrino.
        </span>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "18px", padding: "24px 22px 20px", animation: "fade-in 0.22s ease" }}>
        <div style={{ padding: "16px", borderRadius: "20px", background: "var(--color-white)", border: "1px solid var(--color-gray-200)" }}>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={`QR ordine ${orderCode}`} style={{ width: "189px", height: "189px", display: "block", animation: "fade-in 0.3s ease" }} />
          ) : (
            <div className="skeleton" style={{ width: "189px", height: "189px", borderRadius: "var(--radius-md)" }} />
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "7px" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-gray-500)" }}>
            Codice ordine
          </span>
          <span style={{ fontSize: "32px", fontWeight: 700, letterSpacing: "0.02em", color: "var(--color-gray-900)" }}>
            {orderCode}
          </span>
        </div>

        <div style={{ width: "100%", padding: "16px 18px", borderRadius: "15px", background: "var(--color-white)", border: "1px solid var(--color-gray-200)", display: "flex", flexDirection: "column", gap: "11px" }}>
          {rows.map((r) => (
            <div key={r.label} style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
              <span style={{ flex: 1, fontSize: "14.5px", color: "var(--color-gray-700)" }}>{r.label}</span>
              <span style={{ fontSize: "16px", fontWeight: 700, textAlign: "right" }}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        position: "sticky", bottom: 0,
        padding: `12px 22px calc(20px + var(--safe-bottom))`,
        background: "var(--color-gray-100)", borderTop: "1px solid var(--color-gray-200)",
        display: "flex", flexDirection: "column", gap: "10px", flexShrink: 0,
      }}>
        <Button variant="outline" onClick={onNewOrder}>Nuovo ordine</Button>
      </div>
      <Footer />
    </div>
  );
}
