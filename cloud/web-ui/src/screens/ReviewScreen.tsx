import { useState } from "react";
import type { CartLine, OrderInfo, Product } from "../core/types.js";
import { Header } from "../components/Header.js";
import { Footer } from "../components/Footer.js";
import { Button } from "../components/Button.js";

function formatEur(n: number): string {
  return `€${n.toFixed(2)}`;
}

export function ReviewScreen({
  products, info, cart, onBack, onConfirm,
}: {
  products: Product[];
  info: OrderInfo;
  cart: CartLine[];
  onBack: () => void;
  onConfirm: () => Promise<void>;
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
      <Header
        title="Riepilogo ordine"
        subtitle={info.tableId ? `Tavolo ${info.tableId}${info.customerName ? ` · ${info.customerName}` : ""}` : undefined}
        onBack={onBack}
      />

      <div className="scrollable" style={{ flex: 1, minHeight: 0, padding: "var(--sp-lg)" }}>
        {lines.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--color-gray-400)", padding: "var(--sp-xxl) 0" }}>
            Il carrello è vuoto
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-sm)" }}>
            {lines.map(({ line, product, selectedOptions, unitPrice }, idx) => (
              <div
                key={`${product.id}-${idx}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "var(--sp-md)",
                  background: "var(--color-white)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-gray-100)",
                }}
              >
                <div>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 700 }}>{product.name}</div>
                  {selectedOptions.length > 0 && (
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-500)", marginTop: "2px" }}>
                      {selectedOptions.map((o) => o.prefix === "-" ? `senza ${o.name}` : o.name).join(", ")}
                    </div>
                  )}
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-500)" }}>
                    {line.quantity} × {formatEur(unitPrice)}
                  </div>
                </div>
                <div style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--color-brand)" }}>
                  {formatEur(unitPrice * line.quantity)}
                </div>
              </div>
            ))}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "var(--sp-md) var(--sp-md) 0",
                marginTop: "var(--sp-sm)",
                borderTop: "1px solid var(--color-gray-200)",
              }}
            >
              <span style={{ fontSize: "var(--text-md)", fontWeight: 700 }}>Totale</span>
              <span style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-brand)" }}>{formatEur(total)}</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "0 var(--sp-lg) var(--sp-lg)", display: "flex", flexDirection: "column", gap: "var(--sp-sm)" }}>
        {error && (
          <div style={{ padding: "10px 14px", borderRadius: "var(--radius-md)", background: "rgba(239,68,68,0.1)", color: "var(--color-danger)", fontSize: "var(--text-sm)", fontWeight: 600 }}>
            {error}
          </div>
        )}
        <Button disabled={lines.length === 0 || submitting} onClick={() => void handleConfirm()}>
          {submitting ? "Invio in corso..." : "Conferma e paga in cassa"}
        </Button>
        <Button variant="outline" onClick={onBack} disabled={submitting}>Modifica ordine</Button>
      </div>
      <Footer />
    </div>
  );
}
