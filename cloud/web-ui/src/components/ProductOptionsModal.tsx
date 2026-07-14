import { useState } from "react";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import type { Product } from "../core/types.js";
import { Button } from "./Button.js";

function formatEur(n: number): string {
  return `€${n.toFixed(2)}`;
}

export function ProductOptionsModal({ product, onClose, onConfirm }: {
  product: Product;
  onClose: () => void;
  onConfirm: (selectedOptionIds: string[], quantity: number) => void;
}) {
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});
  const [quantity, setQuantity] = useState(1);

  function toggleOption(groupId: string, optionId: string) {
    const group = product.optionGroups.find((g) => g.id === groupId);
    if (!group) return;
    setSelected((prev) => {
      const current = new Set(prev[groupId] ?? []);
      if (group.type === "single") {
        current.clear();
        current.add(optionId);
      } else {
        if (current.has(optionId)) {
          current.delete(optionId);
        } else {
          if (group.type === "multi" && current.size >= group.maxSel) return prev;
          current.add(optionId);
        }
      }
      return { ...prev, [groupId]: current };
    });
  }

  const priceDelta = product.optionGroups.reduce((sum, g) => {
    const sel = selected[g.id] ?? new Set<string>();
    return sum + g.options.filter((o) => sel.has(o.id)).reduce((s, o) => s + o.priceDelta, 0);
  }, 0);
  const unitTotal = product.price + priceDelta;

  const isValid = product.optionGroups.every((g) => {
    if (!g.required) return true;
    const sel = selected[g.id];
    return sel !== undefined && sel.size > 0;
  });

  function handleConfirm() {
    const allSelectedIds = Object.values(selected).flatMap((set) => [...set]);
    onConfirm(allSelectedIds, quantity);
    onClose();
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: "480px", maxHeight: "85vh",
          background: "var(--color-white)", borderRadius: "var(--radius-xl) var(--radius-xl) 0 0",
          display: "flex", flexDirection: "column",
          animation: "fade-in 0.2s ease",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
          <div style={{ width: "36px", height: "4px", borderRadius: "var(--radius-pill)", background: "var(--color-gray-200)" }} />
        </div>
        <div style={{ padding: "var(--sp-lg)", borderBottom: "1px solid var(--color-gray-100)" }}>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>{product.name}</div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--color-brand)", fontWeight: 600, marginTop: "4px" }}>
            {formatEur(product.price)}
          </div>
        </div>

        <div className="scrollable" style={{ flex: 1, overflowY: "auto", padding: "var(--sp-lg)", display: "flex", flexDirection: "column", gap: "var(--sp-lg)" }}>
          {product.optionGroups.map((group) => (
            <div key={group.id}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "var(--text-sm)", fontWeight: 700 }}>{group.name}</span>
                {group.required && (
                  <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-danger)", textTransform: "uppercase" }}>
                    Obbligatorio
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {group.options.map((option) => {
                  const isSelected = (selected[group.id] ?? new Set()).has(option.id);
                  const isRemoval = option.prefix === "-";
                  return (
                    <button
                      key={option.id}
                      onClick={() => toggleOption(group.id, option.id)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "12px 14px", borderRadius: "var(--radius-md)",
                        border: `1.5px solid ${isSelected ? "var(--color-brand)" : "var(--color-gray-200)"}`,
                        background: isSelected ? "rgba(48,107,52,0.06)" : "var(--color-white)",
                        textAlign: "left",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {isSelected && (
                          <CheckCircleIcon width={18} height={18} color={isRemoval ? "var(--color-danger)" : "var(--color-brand)"} style={{ flexShrink: 0 }} />
                        )}
                        <span
                          style={{
                            fontSize: "var(--text-sm)",
                            fontWeight: 600,
                            color: isRemoval && isSelected ? "var(--color-danger)" : "var(--color-gray-800)",
                            textDecoration: isRemoval && isSelected ? "line-through" : "none",
                          }}
                        >
                          {option.name}
                        </span>
                      </span>
                      {option.prefix !== ">>" && option.priceDelta !== 0 && (
                        <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: option.prefix === "-" ? "var(--color-danger)" : "var(--color-brand)" }}>
                          {option.prefix === "-" ? "-" : "+"}{formatEur(Math.abs(option.priceDelta))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: "var(--sp-lg)", borderTop: "1px solid var(--color-gray-100)", display: "flex", flexDirection: "column", gap: "var(--sp-md)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                style={{ width: "34px", height: "34px", borderRadius: "var(--radius-md)", border: "1.5px solid var(--color-gray-200)", background: "var(--color-gray-50)", fontSize: "var(--text-lg)", fontWeight: 700 }}
              >
                −
              </button>
              <span style={{ fontSize: "var(--text-md)", fontWeight: 700, minWidth: "20px", textAlign: "center" }}>{quantity}</span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                style={{ width: "34px", height: "34px", borderRadius: "var(--radius-md)", border: "none", background: "var(--color-brand)", color: "var(--color-white)", fontSize: "var(--text-lg)", fontWeight: 700 }}
              >
                +
              </button>
            </div>
            <span style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-brand)" }}>
              {formatEur(unitTotal * quantity)}
            </span>
          </div>
          <Button disabled={!isValid} onClick={handleConfirm}>
            Aggiungi al carrello
          </Button>
        </div>
      </div>
    </div>
  );
}
