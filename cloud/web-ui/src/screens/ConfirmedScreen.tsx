import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Header } from "../components/Header.js";
import { Footer } from "../components/Footer.js";
import { Button } from "../components/Button.js";

export function ConfirmedScreen({ orderCode, qrPayload, onNewOrder }: { orderCode: string; qrPayload: string; onNewOrder: () => void }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(qrPayload, { width: 320, margin: 1, color: { dark: "#111827", light: "#ffffff" } })
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(null); });
    return () => { cancelled = true; };
  }, [qrPayload]);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <Header>
        <img src="/logo.svg" alt="epos" style={{ height: "24px", width: "auto", marginBottom: "8px" }} />
        <div style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>Ordine confermato</div>
        <div style={{ fontSize: "var(--text-sm)", opacity: 0.9 }}>
          Mostra questo codice in cassa per pagare e ritirare lo scontrino
        </div>
      </Header>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "var(--sp-lg)", padding: "var(--sp-xl) var(--sp-lg)" }}>
        <div
          style={{
            width: "260px",
            height: "260px",
            borderRadius: "var(--radius-lg)",
            border: "1.5px solid var(--color-gray-200)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            background: "var(--color-white)",
          }}
        >
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={`QR ordine ${orderCode}`} style={{ width: "100%", height: "100%" }} />
          ) : (
            <span style={{ color: "var(--color-gray-400)", fontSize: "var(--text-sm)" }}>Generazione QR...</span>
          )}
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-500)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Codice Ordine
          </div>
          <div
            style={{
              marginTop: "8px",
              padding: "12px 24px",
              borderRadius: "var(--radius-lg)",
              border: "2px solid var(--color-brand)",
              color: "var(--color-brand)",
              fontSize: "var(--text-xl)",
              fontWeight: 700,
              letterSpacing: "0.05em",
            }}
          >
            {orderCode}
          </div>
        </div>
      </div>

      <div style={{ padding: "var(--sp-lg)" }}>
        <Button variant="outline" onClick={onNewOrder}>Nuovo ordine</Button>
      </div>
      <Footer />
    </div>
  );
}
