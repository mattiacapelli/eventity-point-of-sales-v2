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

  // Order-level extras
  const [showExtras, setShowExtras] = useState(false);
  const [orderNotes, setOrderNotes] = useState("");
  const [pax, setPax] = useState<number | null>(null);
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountInput, setDiscountInput] = useState("");
  const [discountMode, setDiscountMode] = useState<"pct" | "fixed">("pct");

  const subtotal = cartTotal();

  const discountNum = parseFloat(discountInput) || 0;
  const discountAmount = discountMode === "pct"
    ? Math.min((discountNum / 100) * subtotal, subtotal)
    : Math.min(discountNum, subtotal);
  const total = subtotal - discountAmount;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const order = await apiClient.orders.create({
        ...(currentShift ? { shiftId: currentShift.id } : {}),
        ...(orderNotes.trim() ? { notes: orderNotes.trim() } : {}),
        ...(pax !== null ? { pax } : {}),
        ...(discountAmount > 0 ? { discountAmount, discountType: discountMode === "pct" ? `${discountNum}%` : "fixed" } : {}),
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
      // Reset extras after successful checkout
      setOrderNotes("");
      setPax(null);
      setDiscountInput("");
      setShowDiscount(false);
      setShowExtras(false);
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

      {/* Extras panel — notes, pax, discount */}
      {cart.length > 0 && showExtras && (
        <div style={{
          padding: "var(--sp-sm) var(--sp-md)",
          borderTop: "1px solid var(--color-gray-100)",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          flexShrink: 0,
          background: "#f9fafb",
        }}>
          {/* Pax */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-600)", fontWeight: 600, minWidth: "60px" }}>Coperti</span>
            <button onClick={() => setPax((p) => Math.max(1, (p ?? 1) - 1))} style={{ width: "28px", height: "28px", borderRadius: "50%", border: "1px solid var(--color-gray-300)", background: "white", cursor: "pointer", fontWeight: 700 }}>−</button>
            <span style={{ minWidth: "24px", textAlign: "center", fontWeight: 700 }}>{pax ?? "—"}</span>
            <button onClick={() => setPax((p) => (p ?? 0) + 1)} style={{ width: "28px", height: "28px", borderRadius: "50%", border: "1px solid var(--color-gray-300)", background: "white", cursor: "pointer", fontWeight: 700 }}>+</button>
            {pax !== null && <button onClick={() => setPax(null)} style={{ fontSize: "11px", color: "var(--color-gray-400)", background: "none", border: "none", cursor: "pointer" }}>✕</button>}
          </div>

          {/* Notes */}
          <textarea
            placeholder="Note ordine (allergie, preferenze…)"
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            rows={2}
            style={{
              width: "100%",
              padding: "6px 8px",
              borderRadius: "var(--radius-md)",
              border: "1.5px solid var(--color-gray-200)",
              fontFamily: "var(--font)",
              fontSize: "var(--text-xs)",
              resize: "none",
              boxSizing: "border-box",
            }}
          />

          {/* Discount */}
          <div>
            <button
              onClick={() => setShowDiscount((v) => !v)}
              style={{ fontSize: "var(--text-xs)", color: "var(--color-brand)", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              {showDiscount ? "− Rimuovi sconto" : "+ Aggiungi sconto"}
            </button>
            {showDiscount && (
              <div style={{ display: "flex", gap: "6px", marginTop: "6px", alignItems: "center" }}>
                <button
                  onClick={() => setDiscountMode("pct")}
                  style={{ padding: "4px 10px", borderRadius: "var(--radius-md)", border: `1.5px solid ${discountMode === "pct" ? "var(--color-brand)" : "var(--color-gray-300)"}`, background: discountMode === "pct" ? "rgba(48,107,52,0.08)" : "white", cursor: "pointer", fontWeight: 600, fontSize: "var(--text-xs)", color: discountMode === "pct" ? "var(--color-brand)" : "var(--color-gray-700)" }}
                >%</button>
                <button
                  onClick={() => setDiscountMode("fixed")}
                  style={{ padding: "4px 10px", borderRadius: "var(--radius-md)", border: `1.5px solid ${discountMode === "fixed" ? "var(--color-brand)" : "var(--color-gray-300)"}`, background: discountMode === "fixed" ? "rgba(48,107,52,0.08)" : "white", cursor: "pointer", fontWeight: 600, fontSize: "var(--text-xs)", color: discountMode === "fixed" ? "var(--color-brand)" : "var(--color-gray-700)" }}
                >€</button>
                <input
                  type="number"
                  min="0"
                  max={discountMode === "pct" ? "100" : undefined}
                  step="0.01"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  placeholder={discountMode === "pct" ? "10" : "5.00"}
                  style={{ flex: 1, height: "30px", padding: "0 8px", borderRadius: "var(--radius-md)", border: "1.5px solid var(--color-gray-200)", fontFamily: "var(--font)", fontSize: "var(--text-sm)", fontWeight: 600 }}
                />
              </div>
            )}
          </div>
        </div>
      )}

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
          <div>
            {discountAmount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--color-gray-500)", marginBottom: "2px" }}>
                <span>Subtotale</span>
                <span>€{subtotal.toFixed(2)}</span>
              </div>
            )}
            {discountAmount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--color-success)", marginBottom: "4px", fontWeight: 600 }}>
                <span>Sconto {discountMode === "pct" ? `${discountNum}%` : `€${discountNum.toFixed(2)}`}</span>
                <span>−€{discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "var(--color-gray-500)", fontSize: "var(--text-sm)" }}>Totale</span>
                {cart.length > 0 && (
                  <button
                    onClick={() => setShowExtras((v) => !v)}
                    title="Note / coperti / sconto"
                    style={{
                      fontSize: "16px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      opacity: showExtras || orderNotes || pax || discountAmount > 0 ? 1 : 0.5,
                    }}
                  >
                    ✏️
                  </button>
                )}
              </div>
              <span style={{ fontSize: "var(--text-xxl)", fontWeight: 700, color: "var(--color-brand)" }}>
                €{total.toFixed(2)}
              </span>
            </div>
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
