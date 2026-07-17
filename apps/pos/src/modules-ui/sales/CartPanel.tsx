import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { OptionGroupWithOptions } from "@pos/shared-types";
import { useStore } from "../../state/global-store.js";
import { useShiftStore } from "../../state/shift-store.js";
import { useTerminalStore } from "../../state/terminal-store.js";
import { apiClient } from "../../core/api-client.js";
import { adminApi } from "../../core/admin-api.js";
import { Button } from "../../components/ui/Button.js";
import { ShoppingCartIcon } from "../../components/ui/icons.js";

// ─── Cart feature flags ───────────────────────────────────────────────────────

interface CartFeatures {
  notes: boolean;
  pax: boolean;
  discount: boolean;
  tableInputMode: "checkout" | "sidebar";
  tableEnabled: boolean;
  tableRequired: boolean;
  customerRequired: boolean;
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

// ─── Variant dialog (per-item option groups) ──────────────────────────────────

interface VariantDialogProps {
  cartKey: string;
  productId: number;
  productName: string;
  unitPrice: number;
  existingNotes?: string;
  onClose: () => void;
}

function VariantDialog({ cartKey, productId, productName, unitPrice, existingNotes, onClose }: VariantDialogProps) {
  const addToCart = useStore((s) => s.addToCart);
  const updateItemNotes = useStore((s) => s.updateItemNotes);
  const updateCartQty = useStore((s) => s.updateCartQty);
  const originalQuantity = useStore((s) => s.cart.find((c) => c.cartKey === cartKey)?.quantity ?? 1);
  const [groups, setGroups] = useState<OptionGroupWithOptions[] | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [freeNote, setFreeNote] = useState(existingNotes ?? "");
  const [freeNotePrefix, setFreeNotePrefix] = useState<"+" | "-">("+");
  const [defaultAddPrice, setDefaultAddPrice] = useState(0);
  const [defaultRemovePrice, setDefaultRemovePrice] = useState(0);

  useEffect(() => {
    adminApi.optionGroups.list(productId)
      .then((g) => setGroups(g))
      .catch(() => setLoadErr(true));
    adminApi.settings.get()
      .then((s) => { setDefaultAddPrice(s.customNoteAddPrice ?? 0); setDefaultRemovePrice(s.customNoteRemovePrice ?? 0); })
      .catch(() => {});
  }, [productId]);

  // Close on backdrop click or Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(optId: number, groupType: string, maxSel: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(optId)) {
        next.delete(optId);
      } else {
        if (groupType === "single") {
          const groupOpts = groups?.find((g) => g.options.some((o) => o.id === optId))?.options ?? [];
          groupOpts.forEach((o) => next.delete(o.id));
        }
        if (next.size < maxSel || groupType === "single") next.add(optId);
      }
      return next;
    });
  }

  function handleSave() {
    if (!groups) return;
    const allOptions = groups.flatMap((g) => g.options.map((o) => ({ ...o, optionGroupId: g.id, groupType: g.type })));
    const opts = allOptions
      .filter((o) => selected.has(o.id))
      .map((o) => ({ optionId: o.id, optionGroupId: o.optionGroupId, name: o.name, priceDelta: o.priceDelta, prefix: o.prefix ?? (o.groupType === "removal" ? "-" : "+"), isRemoval: o.prefix === "-" || o.groupType === "removal" }));
    const trimmedNote = freeNote.trim();
    if (trimmedNote) {
      const notePriceDelta = freeNotePrefix === "+" ? defaultAddPrice : -(defaultRemovePrice);
      opts.push({ optionId: 0, optionGroupId: 0, name: trimmedNote, priceDelta: notePriceDelta, prefix: freeNotePrefix, isRemoval: freeNotePrefix === "-" });
    }
    if (opts.length > 0) {
      updateCartQty(cartKey, 0);
      addToCart({ productId, name: productName, unitPrice, selectedOptions: opts, quantity: originalQuantity });
    } else {
      updateItemNotes(cartKey, "");
    }
    onClose();
  }

  const hasSelection = selected.size > 0 || freeNote.trim().length > 0;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-white)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          width: "100%", maxWidth: "480px",
          maxHeight: "80vh",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid var(--color-gray-100)",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", fontWeight: 500, marginBottom: "2px" }}>
              Modifica variante
            </div>
            <div style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--color-gray-900)" }}>
              {productName}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: "32px", height: "32px", borderRadius: "50%",
              background: "var(--color-gray-100)", border: "none", cursor: "pointer",
              color: "var(--color-gray-500)", fontSize: "16px", fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >✕</button>
        </div>

        {/* Body — scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {!groups && !loadErr && (
            <div style={{ textAlign: "center", padding: "32px", color: "var(--color-gray-400)" }}>
              <span style={{ display: "inline-block", width: "20px", height: "20px", border: "2px solid var(--color-gray-200)", borderTopColor: "var(--color-brand)", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
            </div>
          )}

          {loadErr && (
            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-danger)", textAlign: "center", padding: "16px" }}>
              Impossibile caricare le opzioni
            </div>
          )}

          {groups && groups.map((group) => (
            <div key={group.id} style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "10px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-gray-800)" }}>
                  {group.name}
                </span>
                <span style={{ fontSize: "11px", color: "var(--color-gray-400)" }}>
                  {group.type === "single" && "· scegli 1"}
                  {group.type === "multi" && `· max ${group.maxSel}`}
                  {group.type === "removal" && "· rimozioni"}
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {group.options.filter((o) => o.active).map((opt) => {
                  const on = selected.has(opt.id);
                  const prefix = opt.prefix ?? (group.type === "removal" ? "-" : "+");
                  const isNeg = prefix === "-";
                  const isNote = prefix === ">>";
                  const activeColor = isNeg ? "var(--color-danger)" : isNote ? "var(--color-gray-500)" : "var(--color-brand)";
                  return (
                    <button
                      key={opt.id}
                      onClick={() => toggle(opt.id, group.type, group.maxSel)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "999px",
                        border: `2px solid ${on ? activeColor : "var(--color-gray-200)"}`,
                        background: on ? (isNeg ? "rgba(239,68,68,0.08)" : isNote ? "rgba(107,114,128,0.08)" : "rgba(48,107,52,0.08)") : "var(--color-white)",
                        fontFamily: "var(--font)", fontSize: "var(--text-sm)",
                        fontWeight: on ? 700 : 500,
                        color: on ? activeColor : "var(--color-gray-700)",
                        cursor: "pointer",
                        display: "inline-flex", alignItems: "center", gap: "5px",
                        transition: "border-color 0.1s, background 0.1s",
                      }}
                    >
                      <span style={{ fontWeight: 800, opacity: on ? 1 : 0.35 }}>{prefix}</span>
                      <span style={{ textDecoration: isNeg && on ? "line-through" : "none" }}>{opt.name}</span>
                      {prefix !== ">>" && opt.priceDelta !== 0 && (
                        <span style={{ fontSize: "12px", color: on ? activeColor : "var(--color-gray-400)" }}>
                          {opt.priceDelta > 0 ? `+€${opt.priceDelta.toFixed(2)}` : `-€${Math.abs(opt.priceDelta).toFixed(2)}`}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Free note — always visible */}
          {groups !== null && (
            <div style={{ borderTop: groups.length > 0 ? "1px solid var(--color-gray-100)" : "none", paddingTop: groups.length > 0 ? "16px" : 0 }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-gray-800)", marginBottom: "8px" }}>
                Nota libera
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                {/* +/- toggle */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", flexShrink: 0 }}>
                  {(["+", "-"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setFreeNotePrefix(p)}
                      style={{
                        width: "36px", height: "36px",
                        borderRadius: "var(--radius-md)",
                        border: `2px solid ${freeNotePrefix === p ? (p === "+" ? "var(--color-brand)" : "var(--color-danger)") : "var(--color-gray-200)"}`,
                        background: freeNotePrefix === p ? (p === "+" ? "rgba(48,107,52,0.08)" : "rgba(239,68,68,0.08)") : "var(--color-white)",
                        color: freeNotePrefix === p ? (p === "+" ? "var(--color-brand)" : "var(--color-danger)") : "var(--color-gray-400)",
                        fontFamily: "var(--font)", fontSize: "18px", fontWeight: 800,
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.12s",
                      }}
                    >{p}</button>
                  ))}
                  {(freeNotePrefix === "+" ? defaultAddPrice : defaultRemovePrice) !== 0 && (
                    <div style={{ fontSize: "10px", color: "var(--color-gray-400)", textAlign: "center", fontWeight: 600 }}>
                      {freeNotePrefix === "+" ? `+€${defaultAddPrice.toFixed(2)}` : `-€${defaultRemovePrice.toFixed(2)}`}
                    </div>
                  )}
                </div>
                <textarea
                  rows={3}
                  autoFocus={groups.length === 0}
                  placeholder="Es. senza cipolla, ben cotto, allergie…"
                  value={freeNote}
                  onChange={(e) => setFreeNote(e.target.value)}
                  style={{
                    flex: 1, padding: "10px 12px",
                    border: "2px solid var(--color-gray-200)", borderRadius: "var(--radius-md)",
                    fontFamily: "var(--font)", fontSize: "var(--text-sm)",
                    resize: "none", boxSizing: "border-box", outline: "none",
                    transition: "border-color 0.1s",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-brand)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-gray-200)"; }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {groups !== null && (
          <div style={{
            padding: "12px 20px 16px",
            borderTop: "1px solid var(--color-gray-100)",
            display: "flex", gap: "8px", flexShrink: 0,
          }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, padding: "11px",
                borderRadius: "var(--radius-md)",
                border: "1.5px solid var(--color-gray-200)",
                background: "var(--color-white)",
                color: "var(--color-gray-600)",
                fontFamily: "var(--font)", fontSize: "var(--text-sm)", fontWeight: 600,
                cursor: "pointer",
              }}
            >Annulla</button>
            <button
              onClick={handleSave}
              disabled={!hasSelection}
              style={{
                flex: 2, padding: "11px",
                borderRadius: "var(--radius-md)", border: "none",
                background: hasSelection ? "var(--color-brand)" : "var(--color-gray-200)",
                color: hasSelection ? "white" : "var(--color-gray-400)",
                fontFamily: "var(--font)", fontSize: "var(--text-sm)", fontWeight: 700,
                cursor: hasSelection ? "pointer" : "not-allowed",
                transition: "background 0.1s",
              }}
            >Salva</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function CartPanel() {
  const { cart, updateCartQty, clearCart, cartTotal, setCheckoutOrder } = useStore();
  const addToCart = useStore((s) => s.addToCart);
  const editingOrderId = useStore((s) => s.editingOrderId);
  const setEditingOrderId = useStore((s) => s.setEditingOrderId);
  const { currentShift } = useShiftStore();
  const { terminalId } = useTerminalStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Feature flags + text size (loaded once)
  const [features, setFeatures] = useState<CartFeatures>({ notes: true, pax: true, discount: true, tableInputMode: "checkout", tableEnabled: false, tableRequired: false, customerRequired: false });
  const [cartTextSize, setCartTextSize] = useState(14);
  const [disableTableInput, setDisableTableInput] = useState(false);
  useEffect(() => {
    adminApi.settings.get()
      .then((s) => {
        setFeatures({
          notes: s.cartNotesEnabled,
          pax: s.cartPaxEnabled,
          discount: s.cartDiscountEnabled,
          tableInputMode: s.tableInputMode ?? "checkout",
          tableEnabled: s.tablesEnabled,
          tableRequired: s.tableRequired ?? false,
          customerRequired: s.customerRequired ?? false,
        });
        setCartTextSize(s.cartTextSize ?? 14);
      })
      .catch(() => { /* keep defaults */ });
    if (terminalId) {
      adminApi.terminals.list()
        .then((ts) => {
          const mine = ts.find((t) => t.id === terminalId);
          if (mine) setDisableTableInput(mine.disableTableInput ?? false);
        })
        .catch(() => {});
    }
  }, [terminalId]);

  // Table / customer (sidebar mode) — pre-filled from store when ProductGrid sets them via pre-order modal
  const pendingTableId = useStore((s) => s.pendingTableId);
  const pendingCustomerName = useStore((s) => s.pendingCustomerName);
  const setPendingOrderInfo = useStore((s) => s.setPendingOrderInfo);
  const [sidebarTableId, setSidebarTableId] = useState(pendingTableId ?? "");
  const [sidebarCustomerName, setSidebarCustomerName] = useState(pendingCustomerName ?? "");

  useEffect(() => {
    setSidebarTableId(pendingTableId ?? "");
    setSidebarCustomerName(pendingCustomerName ?? "");
  }, [pendingTableId, pendingCustomerName]);

  // Order-level extras
  const [orderNotes, setOrderNotes] = useState("");
  const [pax, setPax] = useState<number | null>(null);
  const [discountInput, setDiscountInput] = useState("");
  const [discountMode, setDiscountMode] = useState<"pct" | "fixed">("pct");
  const [openExtras, setOpenExtras] = useState<ExtrasKind>(null);
  const extrasRef = useRef<HTMLDivElement>(null);

  // Variant popover
  const [variantTarget, setVariantTarget] = useState<{ cartKey: string; productId: number; name: string; unitPrice: number } | null>(null);

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

  function openVariant(item: { cartKey: string; productId: number; name: string; unitPrice: number }) {
    setOpenExtras(null);
    setVariantTarget((prev) => prev?.cartKey === item.cartKey ? null : item);
  }

  const handleSaveEdit = async () => {
    if (cart.length === 0 || !editingOrderId) return;
    setLoading(true);
    setError(null);
    try {
      await apiClient.orders.updateItems(editingOrderId, cart.map((c) => ({
        productId: c.productId,
        name: c.name,
        quantity: c.quantity,
        ...(c.selectedOptions.length > 0
          ? {
              selectedOptionIds: c.selectedOptions.map((o) => o.optionId).filter((id) => id !== 0),
              notes: c.selectedOptions.map((o) => {
                const p = o.prefix ?? (o.isRemoval ? "-" : "+");
                if (p === "-") return `senza ${o.name}`;
                if (p === ">>") return `>> ${o.name}`;
                return o.name;
              }).join(", "),
            }
          : c.notes !== undefined ? { notes: c.notes } : {}),
      })));
      setEditingOrderId(null);
      clearCart();
      setOrderNotes(""); setPax(null); setDiscountInput(""); setOpenExtras(null); setVariantTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore salvataggio modifiche");
    } finally {
      setLoading(false);
    }
  };

  const isSidebarMode = features.tableEnabled && features.tableInputMode === "sidebar" && !disableTableInput;
  const sidebarTableMissing = isSidebarMode && features.tableRequired && sidebarTableId.trim() === "";
  const sidebarCustomerMissing = isSidebarMode && features.customerRequired && sidebarCustomerName.trim() === "";
  const sidebarBlocked = sidebarTableMissing || sidebarCustomerMissing;

  const handleCheckout = async () => {
    if (cart.length === 0 || sidebarBlocked) return;
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
        ...(isSidebarMode && sidebarTableId.trim() ? { tableId: sidebarTableId.trim() } : {}),
        ...(isSidebarMode && sidebarCustomerName.trim() ? { customerName: sidebarCustomerName.trim() } : {}),
        items: cart.map((c) => ({
          productId: c.productId,
          name: c.name,
          quantity: c.quantity,
          ...(c.selectedOptions.length > 0
            ? {
                selectedOptionIds: c.selectedOptions.map((o) => o.optionId).filter((id) => id !== 0),
                notes: c.selectedOptions.map((o) => {
                  const p = o.prefix ?? (o.isRemoval ? "-" : "+");
                  if (p === "-") return `senza ${o.name}`;
                  if (p === ">>") return `>> ${o.name}`;
                  return o.name;
                }).join(", "),
              }
            : c.notes !== undefined ? { notes: c.notes } : {}),
        })),
      });
      setCheckoutOrder(order);
      setOrderNotes(""); setPax(null); setDiscountInput(""); setOpenExtras(null); setVariantTarget(null);
      setSidebarTableId(""); setSidebarCustomerName("");
      setPendingOrderInfo({ tableId: null, customerName: null });
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

      {/* Edit order banner */}
      {editingOrderId && (
        <div style={{
          padding: "7px var(--sp-md)",
          background: "#fef3c7",
          borderBottom: "1px solid #fcd34d",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "#92400e" }}>
            ✏️ Modifica ordine #{editingOrderId}
          </span>
          <button
            onClick={() => { setEditingOrderId(null); clearCart(); }}
            style={{ fontSize: "11px", fontWeight: 600, color: "#b45309", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font)" }}
          >
            Annulla
          </button>
        </div>
      )}

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

      {/* Item list — newest first */}
      <div className="scrollable" style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {!hasItems ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: "var(--sp-sm)", color: "var(--color-gray-300)" }}>
            <ShoppingCartIcon style={{ width: "36px", height: "36px" }} />
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>Nessun prodotto</span>
          </div>
        ) : (
          <div>
            {[...cart].reverse().map((item) => {
              const extras = item.selectedOptions.filter((o) => (o.prefix ?? "+") !== "-" && (o.prefix ?? "+") !== ">>" && o.priceDelta !== 0);
              const removals = item.selectedOptions.filter((o) => (o.prefix ?? (o.isRemoval ? "-" : "+")) === "-");
              const notes_ = item.selectedOptions.filter((o) => (o.prefix ?? "+") === ">>");
              const modifiers = item.selectedOptions.filter((o) => (o.prefix ?? "+") === "+" && o.priceDelta === 0);
              const isVariantOpen = variantTarget?.cartKey === item.cartKey;

              const btnBase: React.CSSProperties = {
                height: "34px",
                borderRadius: "var(--radius-md)",
                border: "none", cursor: "pointer", fontWeight: 700, fontSize: "16px",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "background 0.12s, color 0.12s",
              };

              const subSize = Math.max(9, cartTextSize - 3);

              return (
                <div key={item.cartKey} style={{ borderBottom: "1px solid var(--color-gray-100)", padding: "10px 12px" }}>
                  {/* Row 1: name + price */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "8px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: `${cartTextSize}px`, fontWeight: 700, color: "var(--color-gray-900)", lineHeight: 1.3 }}>
                        {item.name}
                      </div>
                      {modifiers.length > 0 && (
                        <div style={{ fontSize: `${subSize}px`, color: "var(--color-brand)", marginTop: "2px" }}>
                          + {modifiers.map((o) => o.name).join(", ")}
                        </div>
                      )}
                      {extras.length > 0 && (
                        <div style={{ fontSize: `${subSize}px`, color: "var(--color-brand)", marginTop: "2px" }}>
                          + {extras.map((o) => `${o.name} +€${o.priceDelta.toFixed(2)}`).join(", ")}
                        </div>
                      )}
                      {removals.length > 0 && (
                        <div style={{ fontSize: `${subSize}px`, color: "var(--color-danger)", marginTop: "2px" }}>
                          − {removals.map((o) => o.name).join(", ")}
                        </div>
                      )}
                      {notes_.length > 0 && (
                        <div style={{ fontSize: `${subSize}px`, color: "var(--color-gray-500)", fontStyle: "italic", marginTop: "2px" }}>
                          &gt;&gt; {notes_.map((o) => o.name).join(", ")}
                        </div>
                      )}
                      {item.notes && (
                        <div style={{ fontSize: `${Math.max(9, cartTextSize - 4)}px`, color: "var(--color-gray-400)", fontStyle: "italic", marginTop: "2px" }}>
                          ✏️ {item.notes}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: `${cartTextSize}px`, fontWeight: 800, color: "var(--color-gray-900)", whiteSpace: "nowrap" }}>
                        €{(item.finalPrice * item.quantity).toFixed(2)}
                      </div>
                      {item.quantity > 1 && (
                        <div style={{ fontSize: `${subSize}px`, color: "var(--color-gray-400)", marginTop: "1px" }}>
                          €{item.finalPrice.toFixed(2)} cad.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 2: controls */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {/* − qty + stepper */}
                    <div style={{ display: "flex", alignItems: "center", background: "var(--color-gray-100)", borderRadius: "var(--radius-md)", overflow: "hidden", flexShrink: 0 }}>
                      <button
                        onClick={() => updateCartQty(item.cartKey, item.quantity - 1)}
                        style={{ ...btnBase, width: "34px", background: "transparent", color: "var(--color-gray-600)" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-gray-200)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >−</button>
                      <span style={{ fontSize: "var(--text-md)", fontWeight: 700, minWidth: "28px", textAlign: "center", color: "var(--color-gray-900)" }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateCartQty(item.cartKey, item.quantity + 1)}
                        style={{ ...btnBase, width: "34px", background: "var(--color-brand)", color: "white" }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                      >+</button>
                    </div>

                    <div style={{ flex: 1 }} />

                    {/* Variante */}
                    <button
                      onClick={() => openVariant({ cartKey: item.cartKey, productId: item.productId, name: item.name, unitPrice: item.unitPrice })}
                      style={{ ...btnBase, width: "34px", background: isVariantOpen ? "var(--color-brand)" : "var(--color-gray-100)", color: isVariantOpen ? "white" : "var(--color-gray-500)", fontSize: "14px" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = isVariantOpen ? "var(--color-brand)" : "var(--color-gray-200)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = isVariantOpen ? "var(--color-brand)" : "var(--color-gray-100)"; }}
                      title="Variante / nota"
                    >✎</button>

                    {/* Rimuovi */}
                    <button
                      onClick={() => updateCartQty(item.cartKey, 0)}
                      style={{ ...btnBase, width: "34px", background: "var(--color-gray-100)", color: "var(--color-gray-400)", fontSize: "13px" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-danger)"; e.currentTarget.style.color = "white"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "var(--color-gray-100)"; e.currentTarget.style.color = "var(--color-gray-400)"; }}
                      title="Rimuovi"
                    >✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Variant dialog — rendered via portal over the whole page */}
      {variantTarget && (() => {
        const itemNotes = cart.find((c) => c.cartKey === variantTarget.cartKey)?.notes;
        return (
          <VariantDialog
            key={variantTarget.cartKey}
            cartKey={variantTarget.cartKey}
            productId={variantTarget.productId}
            productName={variantTarget.name}
            unitPrice={variantTarget.unitPrice}
            {...(itemNotes !== undefined ? { existingNotes: itemNotes } : {})}
            onClose={() => setVariantTarget(null)}
          />
        );
      })()}

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

      {/* Tavolo / Cliente — sidebar mode */}
      {isSidebarMode && hasItems && (
        <div style={{
          padding: "10px var(--sp-md)",
          borderTop: "1px solid var(--color-gray-100)",
          display: "flex", flexDirection: "column", gap: "8px", flexShrink: 0,
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-gray-500)", display: "block", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Tavolo{features.tableRequired ? " *" : ""}
              </label>
              <input
                value={sidebarTableId}
                onChange={(e) => setSidebarTableId(e.target.value)}
                placeholder="Es. 12"
                style={{
                  width: "100%", height: "36px", padding: "0 10px",
                  borderRadius: "var(--radius-md)",
                  border: `2px solid ${sidebarTableMissing ? "var(--color-danger)" : "var(--color-gray-200)"}`,
                  fontFamily: "var(--font)", fontSize: "var(--text-sm)", boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-gray-500)", display: "block", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Cliente{features.customerRequired ? " *" : ""}
              </label>
              <input
                value={sidebarCustomerName}
                onChange={(e) => setSidebarCustomerName(e.target.value)}
                placeholder="Es. Mario"
                style={{
                  width: "100%", height: "36px", padding: "0 10px",
                  borderRadius: "var(--radius-md)",
                  border: `2px solid ${sidebarCustomerMissing ? "var(--color-danger)" : "var(--color-gray-200)"}`,
                  fontFamily: "var(--font)", fontSize: "var(--text-sm)", boxSizing: "border-box",
                }}
              />
            </div>
          </div>
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

        {editingOrderId ? (
          <Button
            fullWidth size="xl"
            disabled={!hasItems || loading}
            loading={loading}
            onClick={() => void handleSaveEdit()}
          >
            {!hasItems ? "Carrello vuoto" : "Salva modifiche"}
          </Button>
        ) : (
          <Button
            fullWidth size="xl"
            disabled={!hasItems || loading || !currentShift || sidebarBlocked}
            loading={loading}
            onClick={() => void handleCheckout()}
          >
            {!currentShift ? "Apri un turno per iniziare" : !hasItems ? "Carrello vuoto" : "Paga"}
          </Button>
        )}
      </div>
    </div>
  );
}
