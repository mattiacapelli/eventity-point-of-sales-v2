import { useState } from "react";
import { ShoppingBagIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import type { CartLine, OrderInfo, Product } from "../core/types.js";
import { Footer } from "../components/Footer.js";
import { Button } from "../components/Button.js";

function formatEur(n: number): string {
  return `€${n.toFixed(2)}`;
}

export function ReviewScreen({
  products, info, cart, onBack, onConfirm, onQuantityChange,
}: {
  products: Product[];
  info: OrderInfo;
  cart: CartLine[];
  onBack: () => void;
  onConfirm: () => Promise<void>;
  onQuantityChange: (productId: number, quantity: number) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lines = cart
    .map((l) => {
      const product = products.find((p) => p.id === l.productId);
      if (!product) return null;
      const selectedOptions = l.selectedOptionIds
        .map((oid) => product.optionGroups.flatMap((g) => g.options).find((o) => o.id === oid))
        .filter((o): o is NonNullable<typeof o> => o !== undefined);
      const unitPrice = product.price + selectedOptions.reduce((s, o) => s + o.priceDelta, 0);
      return { line: l, product, selectedOptions, unitPrice };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const total = lines.reduce((sum, { line, unitPrice }) => sum + unitPrice * line.quantity, 0);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante l'invio dell'ordine");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={{
        padding: `calc(14px + var(--safe-top)) 18px 22px`,
        background: "var(--color-brand)", display: "flex", flexDirection: "column", gap: "14px", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={onBack}
            aria-label="Indietro"
            className="icon-btn"
            style={{
              flexShrink: 0, width: "44px", height: "44px", borderRadius: "12px",
              background: "rgba(255,255,255,0.14)", color: "var(--color-white)",
              fontSize: "19px", fontWeight: 600,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ←
          </button>
          <span style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.04em", color: "var(--color-white)" }}>epos</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontSize: "26px", fontWeight: 700, letterSpacing: "-0.025em", color: "var(--color-white)", lineHeight: 1.15 }}>
            Riepilogo ordine
          </span>
          <span style={{ fontSize: "15px", color: "var(--color-brand-light)" }}>
            Tavolo {info.tableId || "—"} · {info.customerName || "Ospite"}
          </span>
        </div>
      </div>

      <div className="scrollable" style={{ flex: 1, minHeight: 0, padding: "16px 14px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {lines.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--sp-md)", color: "var(--color-gray-400)", padding: "var(--sp-xxl) 0" }}>
            <ShoppingBagIcon width={40} height={40} color="var(--color-gray-300)" />
            <span>Il carrello è vuoto</span>
            <Button variant="outline" style={{ width: "auto", padding: "10px 20px" }} onClick={onBack}>
              Torna al menu
            </Button>
          </div>
        ) : (
          <>
            {lines.map(({ line, product, selectedOptions, unitPrice }, idx) => {
              const canStep = line.selectedOptionIds.length === 0;
              return (
                <div
                  key={`${product.id}-${idx}`}
                  style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    padding: "12px 14px", borderRadius: "15px",
                    background: "var(--color-white)", border: "1px solid var(--color-gray-200)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "3px" }}>
                    <span style={{ fontSize: "16.5px", fontWeight: 600, lineHeight: 1.3, color: "var(--color-gray-900)" }}>
                      {product.name}
                    </span>
                    {selectedOptions.length > 0 && (
                      <span style={{ fontSize: "13px", color: "var(--color-gray-600)" }}>
                        {selectedOptions.map((o) => o.prefix === "-" ? `senza ${o.name}` : o.name).join(", ")}
                      </span>
                    )}
                    <span style={{ fontSize: "13.5px", color: "var(--color-gray-600)" }}>
                      {formatEur(unitPrice)} cad.
                    </span>
                  </div>
                  {canStep ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "2px", padding: "3px", borderRadius: "13px", background: "var(--color-gray-100)", flexShrink: 0 }}>
                      <button
                        onClick={() => onQuantityChange(product.id, line.quantity - 1)}
                        aria-label="Diminuisci"
                        style={{ width: "42px", height: "42px", borderRadius: "10px", background: "var(--color-white)", color: "var(--color-brand)", fontSize: "21px", fontWeight: 600 }}
                      >
                        −
                      </button>
                      <span style={{ minWidth: "28px", textAlign: "center", fontSize: "16.5px", fontWeight: 700 }}>{line.quantity}</span>
                      <button
                        onClick={() => onQuantityChange(product.id, line.quantity + 1)}
                        aria-label="Aumenta"
                        style={{ width: "42px", height: "42px", borderRadius: "10px", background: "var(--color-brand)", color: "var(--color-white)", fontSize: "21px", fontWeight: 600 }}
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <span style={{ flexShrink: 0, fontSize: "15px", fontWeight: 700, color: "var(--color-gray-700)" }}>×{line.quantity}</span>
                  )}
                  <span style={{ flexShrink: 0, minWidth: "66px", textAlign: "right", fontSize: "17px", fontWeight: 700, color: "var(--color-gray-900)" }}>
                    {formatEur(unitPrice * line.quantity)}
                  </span>
                </div>
              );
            })}

            <div style={{
              marginTop: "6px", padding: "18px 18px", borderRadius: "16px", background: "var(--color-brand)",
              display: "flex", alignItems: "baseline", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: "14px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-brand-light)" }}>
                Totale
              </span>
              <span
                key={total}
                style={{ fontSize: "34px", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--color-white)", lineHeight: 1, animation: "fade-in 0.2s ease" }}
              >
                {formatEur(total)}
              </span>
            </div>
            <span style={{ fontSize: "13.5px", lineHeight: 1.5, color: "var(--color-gray-600)", padding: "2px 4px" }}>
              Paghi in cassa mostrando il codice. L'ordine entra in preparazione dopo il pagamento.
            </span>
          </>
        )}
      </div>

      <div style={{
        position: "sticky", bottom: 0,
        padding: `12px 14px calc(18px + var(--safe-bottom))`,
        background: "var(--color-gray-100)", borderTop: "1px solid var(--color-gray-200)",
        display: "flex", flexDirection: "column", gap: "9px", flexShrink: 0,
      }}>
        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderRadius: "var(--radius-md)", background: "rgba(154,44,34,0.08)", color: "var(--color-danger)", fontSize: "var(--text-sm)", fontWeight: 600 }}>
            <ExclamationTriangleIcon width={18} height={18} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}
        <Button disabled={lines.length === 0 || submitting} onClick={() => void handleConfirm()}>
          {submitting ? "Invio in corso..." : "Conferma ordine"}
        </Button>
        <Button variant="outline" onClick={onBack} disabled={submitting}>Aggiungi altri piatti</Button>
      </div>
      <Footer />
    </div>
  );
}
