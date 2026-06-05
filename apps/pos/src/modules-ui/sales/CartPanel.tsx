import React, { useState, useRef, useEffect } from "react";
import { useStore } from "../../state/global-store.js";
import { useShiftStore } from "../../state/shift-store.js";
import { apiClient } from "../../core/api-client.js";
import { Button } from "../../components/ui/Button.js";
import { ShoppingCartIcon } from "../../components/ui/icons.js";

// ─── Popover ──────────────────────────────────────────────────────────────────

type PopoverKind = "notes" | "pax" | "discount" | null;

interface PopoverProps {
  kind: PopoverKind;
  orderNotes: string;
  pax: number | null;
  discountInput: string;
  discountMode: "pct" | "fixed";
  onNotesChange: (v: string) => void;
  onPaxChange: (v: number | null) => void;
  onDiscountInputChange: (v: string) => void;
  onDiscountModeChange: (v: "pct" | "fixed") => void;
  onClose: () => void;
}

function Popover({
  kind, orderNotes, pax, discountInput, discountMode,
  onNotesChange, onPaxChange, onDiscountInputChange, onDiscountModeChange, onClose,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  if (!kind) return null;

  const inputBase: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    border: "1.5px solid var(--color-gray-200)",
    borderRadius: "var(--radius-md)",
    fontFamily: "var(--font)",
    fontSize: "var(--text-sm)",
    boxSizing: "border-box",
    outline: "none",
  };

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        bottom: "calc(100% + 8px)",
        left: 0,
        right: 0,
        background: "var(--color-white)",
        border: "1.5px solid var(--color-gray-200)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
        padding: "var(--sp-md)",
        zIndex: 200,
      }}
    >
      {kind === "notes" && (
        <>
          <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", marginBottom: "8px", color: "var(--color-gray-800)" }}>
            Note ordine
          </div>
          <textarea
            autoFocus
            placeholder="Allergie, preferenze, istruzioni…"
            value={orderNotes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={3}
            style={{ ...inputBase, resize: "none" }}
          />
          {orderNotes && (
            <button
              onClick={() => onNotesChange("")}
              style={{ marginTop: "6px", fontSize: "var(--text-xs)", color: "var(--color-danger)", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "var(--font)" }}
            >
              Cancella
            </button>
          )}
        </>
      )}

      {kind === "pax" && (
        <>
          <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", marginBottom: "12px", color: "var(--color-gray-800)" }}>
            Coperti
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px" }}>
            <button
              onClick={() => onPaxChange(Math.max(1, (pax ?? 1) - 1))}
              style={{
                width: "40px", height: "40px", borderRadius: "50%",
                border: "1.5px solid var(--color-gray-300)",
                background: "var(--color-gray-50)",
                fontSize: "20px", fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >−</button>
            <span style={{ fontSize: "var(--text-xxl)", fontWeight: 700, minWidth: "48px", textAlign: "center" }}>
              {pax ?? "—"}
            </span>
            <button
              onClick={() => onPaxChange((pax ?? 0) + 1)}
              style={{
                width: "40px", height: "40px", borderRadius: "50%",
                border: "none",
                background: "var(--color-brand)",
                fontSize: "20px", fontWeight: 700, cursor: "pointer",
                color: "white",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >+</button>
          </div>
          {pax !== null && (
            <div style={{ textAlign: "center", marginTop: "10px" }}>
              <button
                onClick={() => onPaxChange(null)}
                style={{ fontSize: "var(--text-xs)", color: "var(--color-danger)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font)" }}
              >
                Rimuovi
              </button>
            </div>
          )}
        </>
      )}

      {kind === "discount" && (
        <>
          <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", marginBottom: "10px", color: "var(--color-gray-800)" }}>
            Sconto
          </div>
          <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
            {(["pct", "fixed"] as const).map((m) => (
              <button
                key={m}
                onClick={() => onDiscountModeChange(m)}
                style={{
                  flex: 1,
                  padding: "8px",
                  borderRadius: "var(--radius-md)",
                  border: `1.5px solid ${discountMode === m ? "var(--color-brand)" : "var(--color-gray-200)"}`,
                  background: discountMode === m ? "rgba(48,107,52,0.07)" : "white",
                  fontFamily: "var(--font)",
                  fontWeight: 700,
                  fontSize: "var(--text-sm)",
                  color: discountMode === m ? "var(--color-brand)" : "var(--color-gray-600)",
                  cursor: "pointer",
                }}
              >
                {m === "pct" ? "Percentuale %" : "Importo fisso €"}
              </button>
            ))}
          </div>
          <input
            autoFocus
            type="number"
            min="0"
            max={discountMode === "pct" ? "100" : undefined}
            step="0.01"
            value={discountInput}
            onChange={(e) => onDiscountInputChange(e.target.value)}
            placeholder={discountMode === "pct" ? "Es. 10" : "Es. 5.00"}
            style={inputBase}
          />
          {discountInput && (
            <button
              onClick={() => { onDiscountInputChange(""); }}
              style={{ marginTop: "6px", fontSize: "var(--text-xs)", color: "var(--color-danger)", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "var(--font)" }}
            >
              Rimuovi sconto
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

interface ChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function Chip({ active, onClick, children }: ChipProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "4px 10px",
        borderRadius: "999px",
        border: `1.5px solid ${active ? "var(--color-brand)" : "var(--color-gray-300)"}`,
        background: active ? "rgba(48,107,52,0.08)" : "transparent",
        fontFamily: "var(--font)",
        fontSize: "12px",
        fontWeight: active ? 700 : 500,
        color: active ? "var(--color-brand)" : "var(--color-gray-500)",
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "all 0.15s",
      }}
    >
      {children}
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function CartPanel() {
  const { cart, updateCartQty, clearCart, cartTotal, setCheckoutOrder } = useStore();
  const { currentShift } = useShiftStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [orderNotes, setOrderNotes] = useState("");
  const [pax, setPax] = useState<number | null>(null);
  const [discountInput, setDiscountInput] = useState("");
  const [discountMode, setDiscountMode] = useState<"pct" | "fixed">("pct");
  const [openPopover, setOpenPopover] = useState<PopoverKind>(null);

  const subtotal = cartTotal();
  const discountNum = parseFloat(discountInput) || 0;
  const discountAmount = discountInput
    ? discountMode === "pct"
      ? Math.min((discountNum / 100) * subtotal, subtotal)
      : Math.min(discountNum, subtotal)
    : 0;
  const total = subtotal - discountAmount;

  const togglePopover = (kind: PopoverKind) =>
    setOpenPopover((prev) => (prev === kind ? null : kind));

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const order = await apiClient.orders.create({
        ...(currentShift ? { shiftId: currentShift.id } : {}),
        ...(orderNotes.trim() ? { notes: orderNotes.trim() } : {}),
        ...(pax !== null ? { pax } : {}),
        ...(discountAmount > 0
          ? { discountAmount, discountType: discountMode === "pct" ? `${discountNum}%` : "fixed" }
          : {}),
        items: cart.map((c) => ({
          productId: c.productId,
          name: c.name,
          quantity: c.quantity,
          ...(c.selectedOptions.length > 0
            ? {
                selectedOptionIds: c.selectedOptions.map((o) => o.optionId),
                notes: c.selectedOptions.map((o) => (o.isRemoval ? `senza ${o.name}` : o.name)).join(", "),
              }
            : c.notes !== undefined ? { notes: c.notes } : {}),
        })),
      });
      setCheckoutOrder(order);
      setOrderNotes("");
      setPax(null);
      setDiscountInput("");
      setOpenPopover(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore creazione ordine");
    } finally {
      setLoading(false);
    }
  };

  const hasItems = cart.length > 0;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--color-white)", borderLeft: "1px solid var(--color-gray-200)" }}>

      {/* Header */}
      <div style={{
        padding: "12px var(--sp-md)",
        borderBottom: "1px solid var(--color-gray-100)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--color-gray-900)" }}>
          Ordine
          {hasItems && (
            <span style={{
              marginLeft: "8px",
              background: "var(--color-brand)",
              color: "white",
              borderRadius: "999px",
              fontSize: "11px",
              fontWeight: 700,
              padding: "1px 7px",
            }}>
              {cart.reduce((s, i) => s + i.quantity, 0)}
            </span>
          )}
        </span>
        {hasItems && (
          <button
            onClick={clearCart}
            disabled={loading}
            style={{
              color: loading ? "var(--color-gray-400)" : "var(--color-gray-400)",
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              background: "none",
              border: "none",
              fontFamily: "var(--font)",
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
          >
            Svuota
          </button>
        )}
      </div>

      {/* Item list */}
      <div className="scrollable" style={{ flex: 1, overflowY: "auto" }}>
        {!hasItems ? (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            gap: "var(--sp-sm)",
            color: "var(--color-gray-300)",
          }}>
            <ShoppingCartIcon style={{ width: "36px", height: "36px" }} />
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>Nessun prodotto</span>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "36px" }} />
              <col />
              <col style={{ width: "60px" }} />
              <col style={{ width: "28px" }} />
            </colgroup>
            <tbody>
              {cart.map((item) => {
                const extras = item.selectedOptions.filter((o) => !o.isRemoval && o.priceDelta !== 0);
                const removals = item.selectedOptions.filter((o) => o.isRemoval);
                const modifiers = item.selectedOptions.filter((o) => !o.isRemoval && o.priceDelta === 0);

                return (
                  <React.Fragment key={item.cartKey}>
                    <tr style={{ borderBottom: "1px solid var(--color-gray-100)" }}>
                      {/* Qty stepper */}
                      <td style={{ padding: "10px 0 10px 10px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                          <button
                            onClick={() => updateCartQty(item.cartKey, item.quantity + 1)}
                            style={{
                              width: "22px", height: "22px", borderRadius: "50%",
                              background: "var(--color-brand)",
                              border: "none", cursor: "pointer",
                              color: "white", fontWeight: 700, fontSize: "14px",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              lineHeight: 1,
                            }}
                          >+</button>
                          <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, lineHeight: 1, color: "var(--color-gray-900)" }}>
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateCartQty(item.cartKey, item.quantity - 1)}
                            style={{
                              width: "22px", height: "22px", borderRadius: "50%",
                              background: "var(--color-gray-100)",
                              border: "none", cursor: "pointer",
                              color: "var(--color-gray-600)", fontWeight: 700, fontSize: "14px",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              lineHeight: 1,
                            }}
                          >−</button>
                        </div>
                      </td>

                      {/* Name + modifiers */}
                      <td style={{ padding: "10px 6px", verticalAlign: "middle" }}>
                        <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-900)", lineHeight: 1.3 }}>
                          {item.name}
                        </div>
                        {modifiers.length > 0 && (
                          <div style={{ fontSize: "11px", color: "var(--color-gray-400)", marginTop: "2px", lineHeight: 1.3 }}>
                            {modifiers.map((o) => o.name).join(", ")}
                          </div>
                        )}
                        {extras.length > 0 && (
                          <div style={{ fontSize: "11px", color: "var(--color-brand)", marginTop: "2px", lineHeight: 1.3 }}>
                            +{extras.map((o) => o.name).join(", ")}
                          </div>
                        )}
                        {removals.length > 0 && (
                          <div style={{ fontSize: "11px", color: "var(--color-danger)", marginTop: "2px", lineHeight: 1.3 }}>
                            senza {removals.map((o) => o.name).join(", ")}
                          </div>
                        )}
                      </td>

                      {/* Line total */}
                      <td style={{ padding: "10px 6px", verticalAlign: "middle", textAlign: "right" }}>
                        <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-gray-900)", whiteSpace: "nowrap" }}>
                          €{(item.finalPrice * item.quantity).toFixed(2)}
                        </span>
                        {item.quantity > 1 && (
                          <div style={{ fontSize: "10px", color: "var(--color-gray-400)", marginTop: "1px" }}>
                            €{item.finalPrice.toFixed(2)} cad.
                          </div>
                        )}
                      </td>

                      {/* Delete */}
                      <td style={{ padding: "10px 8px 10px 0", verticalAlign: "middle", textAlign: "center" }}>
                        <button
                          onClick={() => updateCartQty(item.cartKey, 0)}
                          style={{
                            width: "20px", height: "20px",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: "none", border: "none", cursor: "pointer",
                            color: "var(--color-gray-300)",
                            fontSize: "14px",
                            borderRadius: "50%",
                            transition: "color 0.15s",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget.style.color = "var(--color-danger)"); }}
                          onMouseLeave={(e) => { (e.currentTarget.style.color = "var(--color-gray-300)"); }}
                          title="Rimuovi"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Chips bar — notes / pax / discount (always visible when cart has items) */}
      {hasItems && (
        <div style={{
          padding: "8px var(--sp-md)",
          borderTop: "1px solid var(--color-gray-100)",
          display: "flex",
          gap: "6px",
          flexShrink: 0,
          flexWrap: "wrap",
          position: "relative",
        }}>
          <Chip active={!!orderNotes} onClick={() => togglePopover("notes")}>
            📝 {orderNotes ? "Nota" : "Nota"}
          </Chip>
          <Chip active={pax !== null} onClick={() => togglePopover("pax")}>
            👥 {pax !== null ? `${pax} cop.` : "Coperti"}
          </Chip>
          <Chip active={discountAmount > 0} onClick={() => togglePopover("discount")}>
            % {discountAmount > 0
              ? discountMode === "pct" ? `−${discountNum}%` : `−€${discountAmount.toFixed(2)}`
              : "Sconto"}
          </Chip>

          {/* Popover anchored to the chips bar */}
          <Popover
            kind={openPopover}
            orderNotes={orderNotes}
            pax={pax}
            discountInput={discountInput}
            discountMode={discountMode}
            onNotesChange={setOrderNotes}
            onPaxChange={setPax}
            onDiscountInputChange={setDiscountInput}
            onDiscountModeChange={setDiscountMode}
            onClose={() => setOpenPopover(null)}
          />
        </div>
      )}

      {/* Footer */}
      <div style={{
        padding: "var(--sp-md)",
        borderTop: "1px solid var(--color-gray-100)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-sm)",
        flexShrink: 0,
      }}>
        {error && (
          <div style={{
            background: "rgba(239,68,68,0.1)",
            color: "var(--color-danger)",
            borderRadius: "var(--radius-md)",
            padding: "8px 12px",
            fontSize: "var(--text-xs)",
            fontWeight: 500,
          }}>
            {error}
          </div>
        )}

        {/* Totals */}
        {hasItems && (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {discountAmount > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>
                  <span>Subtotale</span>
                  <span>€{subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "#16a34a", fontWeight: 600 }}>
                  <span>Sconto {discountMode === "pct" ? `${discountNum}%` : `€${discountNum.toFixed(2)}`}</span>
                  <span>−€{discountAmount.toFixed(2)}</span>
                </div>
              </>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)", fontWeight: 600 }}>Totale</span>
              <span style={{ fontSize: "var(--text-xxl)", fontWeight: 800, color: "var(--color-gray-900)", letterSpacing: "-0.5px" }}>
                €{total.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        <Button
          fullWidth
          size="xl"
          disabled={!hasItems || loading || !currentShift}
          loading={loading}
          onClick={() => void handleCheckout()}
        >
          {!currentShift
            ? "Apri un turno per iniziare"
            : !hasItems
              ? "Carrello vuoto"
              : `Invia ordine · €${total.toFixed(2)}`}
        </Button>
      </div>
    </div>
  );
}
