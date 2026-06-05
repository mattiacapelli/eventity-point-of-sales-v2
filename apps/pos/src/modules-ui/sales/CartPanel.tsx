import React, { useState, useRef, useEffect, useCallback } from "react";
import type { OptionGroupWithOptions } from "@pos/shared-types";
import { useStore } from "../../state/global-store.js";
import { useShiftStore } from "../../state/shift-store.js";
import { apiClient } from "../../core/api-client.js";
import { adminApi } from "../../core/admin-api.js";
import { Button } from "../../components/ui/Button.js";
import { ShoppingCartIcon } from "../../components/ui/icons.js";

// ─── Cart feature flags ───────────────────────────────────────────────────────

interface CartFeatures {
  notes: boolean;
  pax: boolean;
  discount: boolean;
}

// ─── Shared toggle styles ─────────────────────────────────────────────────────

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onClose]);
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "4px 10px",
        borderRadius: "999px",
        border: `1.5px solid ${active ? "var(--color-brand)" : "var(--color-gray-200)"}`,
        background: active ? "rgba(48,107,52,0.08)" : "transparent",
        fontFamily: "var(--font)",
        fontSize: "12px",
        fontWeight: active ? 700 : 500,
        color: active ? "var(--color-brand)" : "var(--color-gray-400)",
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "all 0.12s",
      }}
    >
      {children}
    </button>
  );
}

// ─── Order extras popover ─────────────────────────────────────────────────────

type ExtrasKind = "notes" | "pax" | "discount" | null;

interface ExtrasPopoverProps {
  kind: ExtrasKind;
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

function ExtrasPopover(props: ExtrasPopoverProps) {
  const { kind, orderNotes, pax, discountInput, discountMode,
    onNotesChange, onPaxChange, onDiscountInputChange, onDiscountModeChange, onClose } = props;
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose);

  if (!kind) return null;

  const inp: React.CSSProperties = {
    width: "100%", padding: "8px 10px",
    border: "1.5px solid var(--color-gray-200)", borderRadius: "var(--radius-md)",
    fontFamily: "var(--font)", fontSize: "var(--text-sm)", boxSizing: "border-box", outline: "none",
  };

  return (
    <div ref={ref} style={{
      position: "absolute", bottom: "calc(100% + 6px)", left: 0, right: 0,
      background: "var(--color-white)",
      border: "1.5px solid var(--color-gray-200)",
      borderRadius: "var(--radius-lg)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.13)",
      padding: "var(--sp-md)", zIndex: 200,
    }}>
      {kind === "notes" && (
        <>
          <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", marginBottom: "8px" }}>Note ordine</div>
          <textarea
            autoFocus rows={3}
            placeholder="Allergie, preferenze, istruzioni…"
            value={orderNotes}
            onChange={(e) => onNotesChange(e.target.value)}
            style={{ ...inp, resize: "none" }}
          />
          {orderNotes && (
            <button onClick={() => onNotesChange("")}
              style={{ marginTop: "6px", fontSize: "var(--text-xs)", color: "var(--color-danger)", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "var(--font)" }}>
              Cancella nota
            </button>
          )}
        </>
      )}

      {kind === "pax" && (
        <>
          <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", marginBottom: "12px" }}>Coperti</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "20px" }}>
            <button onClick={() => onPaxChange(Math.max(1, (pax ?? 1) - 1))}
              style={{ width: "44px", height: "44px", borderRadius: "50%", border: "1.5px solid var(--color-gray-300)", background: "var(--color-gray-50)", fontSize: "22px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              −
            </button>
            <span style={{ fontSize: "var(--text-xxl)", fontWeight: 800, minWidth: "52px", textAlign: "center" }}>
              {pax ?? "—"}
            </span>
            <button onClick={() => onPaxChange((pax ?? 0) + 1)}
              style={{ width: "44px", height: "44px", borderRadius: "50%", border: "none", background: "var(--color-brand)", fontSize: "22px", fontWeight: 700, cursor: "pointer", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
              +
            </button>
          </div>
          {pax !== null && (
            <div style={{ textAlign: "center", marginTop: "10px" }}>
              <button onClick={() => onPaxChange(null)}
                style={{ fontSize: "var(--text-xs)", color: "var(--color-danger)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font)" }}>
                Rimuovi
              </button>
            </div>
          )}
        </>
      )}

      {kind === "discount" && (
        <>
          <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", marginBottom: "10px" }}>Sconto</div>
          <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
            {(["pct", "fixed"] as const).map((m) => (
              <button key={m} onClick={() => onDiscountModeChange(m)} style={{
                flex: 1, padding: "8px",
                borderRadius: "var(--radius-md)",
                border: `1.5px solid ${discountMode === m ? "var(--color-brand)" : "var(--color-gray-200)"}`,
                background: discountMode === m ? "rgba(48,107,52,0.07)" : "white",
                fontFamily: "var(--font)", fontWeight: 700, fontSize: "var(--text-sm)",
                color: discountMode === m ? "var(--color-brand)" : "var(--color-gray-500)", cursor: "pointer",
              }}>
                {m === "pct" ? "Percentuale %" : "Importo fisso €"}
              </button>
            ))}
          </div>
          <input autoFocus type="number" min="0" max={discountMode === "pct" ? "100" : undefined} step="0.01"
            value={discountInput}
            onChange={(e) => onDiscountInputChange(e.target.value)}
            placeholder={discountMode === "pct" ? "Es. 10" : "Es. 5.00"}
            style={inp}
          />
          {discountInput && (
            <button onClick={() => onDiscountInputChange("")}
              style={{ marginTop: "6px", fontSize: "var(--text-xs)", color: "var(--color-danger)", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "var(--font)" }}>
              Rimuovi sconto
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── Variant popover (per-item option groups) ─────────────────────────────────

interface VariantPopoverProps {
  cartKey: string;
  productId: string;
  productName: string;
  unitPrice: number;
  onClose: () => void;
}

function VariantPopover({ cartKey, productId, productName, unitPrice, onClose }: VariantPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const addToCart = useStore((s) => s.addToCart);
  const [groups, setGroups] = useState<OptionGroupWithOptions[] | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useClickOutside(ref, onClose);

  useEffect(() => {
    adminApi.optionGroups.list(productId)
      .then((g) => setGroups(g))
      .catch(() => setLoadErr(true));
  }, [productId]);

  function toggle(optId: string, groupType: string, maxSel: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(optId)) {
        next.delete(optId);
      } else {
        if (groupType === "single") {
          // deselect others in same group first
          const groupOpts = groups?.find((g) => g.options.some((o) => o.id === optId))?.options ?? [];
          groupOpts.forEach((o) => next.delete(o.id));
        }
        if (next.size < maxSel || groupType === "single") next.add(optId);
      }
      return next;
    });
  }

  function handleAdd() {
    if (!groups) return;
    const allOptions = groups.flatMap((g) => g.options.map((o) => ({ ...o, optionGroupId: g.id, groupType: g.type })));
    const opts = allOptions
      .filter((o) => selected.has(o.id))
      .map((o) => ({ optionId: o.id, optionGroupId: o.optionGroupId, name: o.name, priceDelta: o.priceDelta, isRemoval: o.groupType === "removal" }));
    addToCart({ productId, name: productName, unitPrice, selectedOptions: opts });
    onClose();
  }

  return (
    <div ref={ref} style={{
      position: "absolute", bottom: "calc(100% + 6px)", left: 0, right: 0,
      background: "var(--color-white)",
      border: "1.5px solid var(--color-gray-200)",
      borderRadius: "var(--radius-lg)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.13)",
      padding: "var(--sp-md)", zIndex: 200,
      maxHeight: "340px", overflowY: "auto",
    }}>
      <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", marginBottom: "12px", color: "var(--color-gray-900)" }}>
        Variante — {productName}
      </div>

      {!groups && !loadErr && (
        <div style={{ textAlign: "center", color: "var(--color-gray-400)", fontSize: "var(--text-xs)", padding: "12px" }}>
          <span style={{ display: "inline-block", width: "16px", height: "16px", border: "2px solid var(--color-gray-200)", borderTopColor: "var(--color-brand)", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
        </div>
      )}

      {loadErr && (
        <div style={{ fontSize: "var(--text-xs)", color: "var(--color-danger)" }}>
          Impossibile caricare le opzioni
        </div>
      )}

      {groups && groups.length === 0 && (
        <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>
          Nessuna variante disponibile per questo prodotto
        </div>
      )}

      {groups && groups.map((group) => (
        <div key={group.id} style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-gray-500)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
            {group.name}
            {group.type === "single" && <span style={{ fontWeight: 400, marginLeft: "4px" }}>(scegli 1)</span>}
            {group.type === "multi" && <span style={{ fontWeight: 400, marginLeft: "4px" }}>(max {group.maxSel})</span>}
            {group.type === "removal" && <span style={{ fontWeight: 400, marginLeft: "4px" }}>(rimozioni)</span>}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {group.options.filter((o) => o.active).map((opt) => {
              const on = selected.has(opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => toggle(opt.id, group.type, group.maxSel)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "999px",
                    border: `1.5px solid ${on ? "var(--color-brand)" : "var(--color-gray-200)"}`,
                    background: on ? "rgba(48,107,52,0.08)" : "white",
                    fontFamily: "var(--font)",
                    fontSize: "12px",
                    fontWeight: on ? 700 : 500,
                    color: on ? "var(--color-brand)" : "var(--color-gray-700)",
                    cursor: "pointer",
                  }}
                >
                  {opt.name}
                  {opt.priceDelta !== 0 && (
                    <span style={{ marginLeft: "4px", fontSize: "11px", color: on ? "var(--color-brand)" : "var(--color-gray-400)" }}>
                      {opt.priceDelta > 0 ? `+€${opt.priceDelta.toFixed(2)}` : `-€${Math.abs(opt.priceDelta).toFixed(2)}`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {groups && groups.length > 0 && (
        <button
          onClick={handleAdd}
          disabled={selected.size === 0}
          style={{
            marginTop: "4px",
            width: "100%",
            padding: "10px",
            borderRadius: "var(--radius-md)",
            border: "none",
            background: selected.size > 0 ? "var(--color-brand)" : "var(--color-gray-200)",
            color: selected.size > 0 ? "white" : "var(--color-gray-400)",
            fontFamily: "var(--font)",
            fontSize: "var(--text-sm)",
            fontWeight: 700,
            cursor: selected.size > 0 ? "pointer" : "not-allowed",
          }}
        >
          Aggiungi variante al carrello
        </button>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function CartPanel() {
  const { cart, updateCartQty, clearCart, cartTotal, setCheckoutOrder } = useStore();
  const addToCart = useStore((s) => s.addToCart);
  const { currentShift } = useShiftStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Feature flags (loaded once)
  const [features, setFeatures] = useState<CartFeatures>({ notes: true, pax: true, discount: true });
  useEffect(() => {
    adminApi.settings.get()
      .then((s) => setFeatures({ notes: s.cartNotesEnabled, pax: s.cartPaxEnabled, discount: s.cartDiscountEnabled }))
      .catch(() => { /* keep defaults */ });
  }, []);

  // Order-level extras
  const [orderNotes, setOrderNotes] = useState("");
  const [pax, setPax] = useState<number | null>(null);
  const [discountInput, setDiscountInput] = useState("");
  const [discountMode, setDiscountMode] = useState<"pct" | "fixed">("pct");
  const [openExtras, setOpenExtras] = useState<ExtrasKind>(null);
  const extrasRef = useRef<HTMLDivElement>(null);

  // Variant popover
  const [variantTarget, setVariantTarget] = useState<{ cartKey: string; productId: string; name: string; unitPrice: number } | null>(null);
  const variantRef = useRef<HTMLDivElement>(null);

  const subtotal = cartTotal();
  const discountNum = parseFloat(discountInput) || 0;
  const discountAmount = discountInput
    ? discountMode === "pct"
      ? Math.min((discountNum / 100) * subtotal, subtotal)
      : Math.min(discountNum, subtotal)
    : 0;
  const total = subtotal - discountAmount;

  const toggleExtras = useCallback((kind: ExtrasKind) => {
    setVariantTarget(null);
    setOpenExtras((prev) => (prev === kind ? null : kind));
  }, []);

  function openVariant(item: { cartKey: string; productId: string; name: string; unitPrice: number }) {
    setOpenExtras(null);
    setVariantTarget((prev) => prev?.cartKey === item.cartKey ? null : item);
  }

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
      setOrderNotes(""); setPax(null); setDiscountInput(""); setOpenExtras(null); setVariantTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore creazione ordine");
    } finally {
      setLoading(false);
    }
  };

  const hasItems = cart.length > 0;
  const hasAnyFeature = features.notes || features.pax || features.discount;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--color-white)", borderLeft: "1px solid var(--color-gray-200)" }}>

      {/* Header */}
      <div style={{
        padding: "11px var(--sp-md)",
        borderBottom: "1px solid var(--color-gray-100)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--color-gray-900)" }}>Ordine</span>
          {hasItems && (
            <span style={{
              background: "var(--color-brand)", color: "white",
              borderRadius: "999px", fontSize: "11px", fontWeight: 700, padding: "1px 7px",
            }}>
              {cart.reduce((s, i) => s + i.quantity, 0)}
            </span>
          )}
        </div>
        {hasItems && (
          <button onClick={clearCart} disabled={loading} style={{
            color: "var(--color-gray-400)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase",
            cursor: loading ? "not-allowed" : "pointer", background: "none", border: "none", fontFamily: "var(--font)",
          }}>
            Svuota
          </button>
        )}
      </div>

      {/* Item list */}
      <div className="scrollable" style={{ flex: 1, overflowY: "auto" }}>
        {!hasItems ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "var(--sp-sm)", color: "var(--color-gray-300)" }}>
            <ShoppingCartIcon style={{ width: "36px", height: "36px" }} />
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>Nessun prodotto</span>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "36px" }} />
              <col />
              <col style={{ width: "60px" }} />
              <col style={{ width: "24px" }} />
            </colgroup>
            <tbody>
              {cart.map((item) => {
                const extras = item.selectedOptions.filter((o) => !o.isRemoval && o.priceDelta !== 0);
                const removals = item.selectedOptions.filter((o) => o.isRemoval);
                const modifiers = item.selectedOptions.filter((o) => !o.isRemoval && o.priceDelta === 0);
                const isVariantOpen = variantTarget?.cartKey === item.cartKey;

                return (
                  <tr key={item.cartKey} style={{ borderBottom: "1px solid var(--color-gray-100)" }}>
                    {/* Qty stepper */}
                    <td style={{ padding: "8px 0 8px 10px", verticalAlign: "middle" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                        <button onClick={() => updateCartQty(item.cartKey, item.quantity + 1)} style={{
                          width: "20px", height: "20px", borderRadius: "50%",
                          background: "var(--color-brand)", border: "none", cursor: "pointer",
                          color: "white", fontWeight: 700, fontSize: "13px",
                          display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
                        }}>+</button>
                        <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, lineHeight: 1 }}>{item.quantity}</span>
                        <button onClick={() => updateCartQty(item.cartKey, item.quantity - 1)} style={{
                          width: "20px", height: "20px", borderRadius: "50%",
                          background: "var(--color-gray-100)", border: "none", cursor: "pointer",
                          color: "var(--color-gray-600)", fontWeight: 700, fontSize: "13px",
                          display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
                        }}>−</button>
                      </div>
                    </td>

                    {/* Name + tags + variant button */}
                    <td style={{ padding: "8px 6px", verticalAlign: "middle" }}>
                      <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-900)", lineHeight: 1.3 }}>
                        {item.name}
                      </div>
                      {modifiers.length > 0 && (
                        <div style={{ fontSize: "11px", color: "var(--color-gray-400)", marginTop: "1px" }}>
                          {modifiers.map((o) => o.name).join(", ")}
                        </div>
                      )}
                      {extras.length > 0 && (
                        <div style={{ fontSize: "11px", color: "var(--color-brand)", marginTop: "1px" }}>
                          +{extras.map((o) => o.name).join(", ")}
                        </div>
                      )}
                      {removals.length > 0 && (
                        <div style={{ fontSize: "11px", color: "var(--color-danger)", marginTop: "1px" }}>
                          senza {removals.map((o) => o.name).join(", ")}
                        </div>
                      )}
                      {/* Variant button */}
                      <button
                        onClick={() => openVariant({ cartKey: item.cartKey, productId: item.productId, name: item.name, unitPrice: item.unitPrice })}
                        style={{
                          marginTop: "3px",
                          fontSize: "10px", fontWeight: 600,
                          color: isVariantOpen ? "var(--color-brand)" : "var(--color-gray-400)",
                          background: "none", border: "none", cursor: "pointer", padding: 0,
                          fontFamily: "var(--font)", letterSpacing: "0.02em",
                          textDecoration: "underline", textUnderlineOffset: "2px",
                        }}
                      >
                        + variante
                      </button>
                    </td>

                    {/* Price */}
                    <td style={{ padding: "8px 4px", verticalAlign: "middle", textAlign: "right" }}>
                      <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, whiteSpace: "nowrap" }}>
                        €{(item.finalPrice * item.quantity).toFixed(2)}
                      </span>
                      {item.quantity > 1 && (
                        <div style={{ fontSize: "10px", color: "var(--color-gray-400)", marginTop: "1px" }}>
                          €{item.finalPrice.toFixed(2)} cad.
                        </div>
                      )}
                    </td>

                    {/* Delete */}
                    <td style={{ padding: "8px 8px 8px 0", verticalAlign: "middle", textAlign: "center" }}>
                      <button
                        onClick={() => updateCartQty(item.cartKey, 0)}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-danger)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-gray-300)"; }}
                        style={{
                          width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center",
                          background: "none", border: "none", cursor: "pointer", color: "var(--color-gray-300)",
                          fontSize: "13px", borderRadius: "50%", transition: "color 0.12s",
                        }}
                        title="Rimuovi"
                      >✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Variant popover anchor */}
      {hasItems && (
        <div ref={variantRef} style={{ position: "relative", flexShrink: 0 }}>
          {variantTarget && (
            <VariantPopover
              key={variantTarget.cartKey}
              cartKey={variantTarget.cartKey}
              productId={variantTarget.productId}
              productName={variantTarget.name}
              unitPrice={variantTarget.unitPrice}
              onClose={() => setVariantTarget(null)}
            />
          )}
        </div>
      )}

      {/* Chips bar — only shown if at least one feature is enabled */}
      {hasItems && hasAnyFeature && (
        <div ref={extrasRef} style={{
          padding: "7px var(--sp-md)",
          borderTop: "1px solid var(--color-gray-100)",
          display: "flex", gap: "6px", flexShrink: 0, flexWrap: "wrap",
          position: "relative",
        }}>
          {features.notes && (
            <Chip active={!!orderNotes} onClick={() => toggleExtras("notes")}>
              📝 {orderNotes ? "Nota ✓" : "Nota"}
            </Chip>
          )}
          {features.pax && (
            <Chip active={pax !== null} onClick={() => toggleExtras("pax")}>
              👥 {pax !== null ? `${pax} cop.` : "Coperti"}
            </Chip>
          )}
          {features.discount && (
            <Chip active={discountAmount > 0} onClick={() => toggleExtras("discount")}>
              {discountAmount > 0
                ? (discountMode === "pct" ? `−${discountNum}%` : `−€${discountAmount.toFixed(2)}`)
                : "% Sconto"}
            </Chip>
          )}

          <ExtrasPopover
            kind={openExtras}
            orderNotes={orderNotes}
            pax={pax}
            discountInput={discountInput}
            discountMode={discountMode}
            onNotesChange={setOrderNotes}
            onPaxChange={setPax}
            onDiscountInputChange={setDiscountInput}
            onDiscountModeChange={setDiscountMode}
            onClose={() => setOpenExtras(null)}
          />
        </div>
      )}

      {/* Footer */}
      <div style={{
        padding: "var(--sp-md)",
        borderTop: "1px solid var(--color-gray-100)",
        display: "flex", flexDirection: "column", gap: "var(--sp-sm)", flexShrink: 0,
      }}>
        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", color: "var(--color-danger)", borderRadius: "var(--radius-md)", padding: "8px 12px", fontSize: "var(--text-xs)", fontWeight: 500 }}>
            {error}
          </div>
        )}

        {hasItems && (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {discountAmount > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>
                  <span>Subtotale</span><span>€{subtotal.toFixed(2)}</span>
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
          fullWidth size="xl"
          disabled={!hasItems || loading || !currentShift}
          loading={loading}
          onClick={() => void handleCheckout()}
        >
          {!currentShift ? "Apri un turno per iniziare" : !hasItems ? "Carrello vuoto" : `Invia ordine · €${total.toFixed(2)}`}
        </Button>
      </div>
    </div>
  );
}
