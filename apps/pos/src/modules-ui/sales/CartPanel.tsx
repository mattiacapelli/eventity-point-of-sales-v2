import React, { useState } from "react";
import { useStore } from "../../state/global-store.js";
import { useShiftStore } from "../../state/shift-store.js";
import { apiClient } from "../../core/api-client.js";
import { Button } from "../../components/ui/Button.js";
import { ShoppingCartIcon } from "../../components/ui/icons.js";

export function CartPanel() {
  const { cart, updateCartQty, removeFromCart, clearCart, cartTotal, setCheckoutOrder } = useStore();
  const { currentShift } = useShiftStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = cartTotal();

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const order = await apiClient.orders.create({
        ...(currentShift ? { shiftId: currentShift.id } : {}),
        items: cart.map((c) => ({
          productId: c.productId,
          name: c.name,
          quantity: c.quantity,
          ...(c.selectedOptions.length > 0
            ? {
                selectedOptionIds: c.selectedOptions.map((o) => o.optionId),
                notes: JSON.stringify(c.selectedOptions.map((o) => (o.isRemoval ? `senza ${o.name}` : o.name))),
              }
            : c.notes !== undefined ? { notes: c.notes } : {}),
        })),
      });
      setCheckoutOrder(order);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore creazione ordine");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--color-white)",
        borderLeft: "1px solid var(--color-gray-200)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "var(--sp-md)",
          borderBottom: "1px solid var(--color-gray-100)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>
          Carrello {cart.length > 0 && `(${cart.length})`}
        </span>
        {cart.length > 0 && (
          <button
            onClick={clearCart}
            disabled={loading}
            style={{
              color: loading ? "var(--color-gray-400)" : "var(--color-danger)",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              background: "none",
              border: "none",
              fontFamily: "var(--font)",
            }}
          >
            Svuota
          </button>
        )}
      </div>

      {/* Items */}
      <div className="scrollable" style={{ flex: 1, overflowY: "auto", padding: "var(--sp-sm)" }}>
        {cart.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: "var(--sp-sm)",
              color: "var(--color-gray-400)",
            }}
          >
            <ShoppingCartIcon style={{ width: "40px", height: "40px", color: "var(--color-gray-300)" }} />
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>Aggiungi prodotti</span>
          </div>
        ) : (
          cart.map((item) => {
            const extras = item.selectedOptions.filter((o) => !o.isRemoval && o.priceDelta !== 0);
            const removals = item.selectedOptions.filter((o) => o.isRemoval);
            const modifiers = item.selectedOptions.filter((o) => !o.isRemoval && o.priceDelta === 0);

            return (
              <div
                key={item.cartKey}
                style={{
                  padding: "10px var(--sp-sm)",
                  borderBottom: "1px solid var(--color-gray-100)",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--sp-sm)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-900)" }}>
                      {item.name}
                    </div>
                    {/* Modifiers (single/multi with no price delta) */}
                    {modifiers.length > 0 && (
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-500)", marginTop: "2px" }}>
                        {modifiers.map((o) => o.name).join(", ")}
                      </div>
                    )}
                    {/* Extras with price */}
                    {extras.length > 0 && (
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-brand)", marginTop: "2px" }}>
                        + {extras.map((o) => `${o.name} (+€${o.priceDelta.toFixed(2)})`).join(", ")}
                      </div>
                    )}
                    {/* Removals */}
                    {removals.length > 0 && (
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-danger)", marginTop: "2px" }}>
                        senza {removals.map((o) => o.name).join(", ")}
                      </div>
                    )}
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", marginTop: "3px" }}>
                      €{item.finalPrice.toFixed(2)} cad.
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                    <button
                      onClick={() => updateCartQty(item.cartKey, item.quantity - 1)}
                      style={{
                        width: "32px", height: "32px", borderRadius: "50%",
                        background: "var(--color-gray-100)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "18px", cursor: "pointer", fontWeight: 700,
                        color: "var(--color-gray-700)", border: "none",
                      }}
                    >
                      −
                    </button>
                    <span style={{ width: "24px", textAlign: "center", fontSize: "var(--text-md)", fontWeight: 700 }}>
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateCartQty(item.cartKey, item.quantity + 1)}
                      style={{
                        width: "32px", height: "32px", borderRadius: "50%",
                        background: "var(--color-brand)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "18px", cursor: "pointer", fontWeight: 700,
                        color: "var(--color-white)", border: "none",
                      }}
                    >
                      +
                    </button>
                  </div>

                  <div style={{ minWidth: "52px", textAlign: "right", fontWeight: 700, fontSize: "var(--text-sm)", flexShrink: 0 }}>
                    €{(item.finalPrice * item.quantity).toFixed(2)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "var(--sp-md)",
          borderTop: "1px solid var(--color-gray-100)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--sp-sm)",
          flexShrink: 0,
        }}
      >
        {error && (
          <div
            style={{
              background: "rgba(239,68,68,0.1)",
              color: "var(--color-danger)",
              borderRadius: "var(--radius-md)",
              padding: "10px 14px",
              fontSize: "var(--text-sm)",
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}

        {cart.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ color: "var(--color-gray-500)", fontSize: "var(--text-sm)" }}>Totale</span>
            <span style={{ fontSize: "var(--text-xxl)", fontWeight: 700, color: "var(--color-brand)" }}>
              €{total.toFixed(2)}
            </span>
          </div>
        )}

        <Button
          fullWidth
          size="xl"
          disabled={cart.length === 0 || loading || !currentShift}
          loading={loading}
          onClick={() => void handleCheckout()}
        >
          {!currentShift
            ? "Apri un turno per procedere"
            : cart.length === 0
              ? "Carrello vuoto"
              : `Vai al pagamento · €${total.toFixed(2)}`}
        </Button>
      </div>
    </div>
  );
}
