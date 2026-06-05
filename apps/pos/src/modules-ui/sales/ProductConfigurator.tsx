import React, { useState, useEffect } from "react";
import type { Product, OptionGroupWithOptions } from "@pos/shared-types";
import { adminApi } from "../../core/admin-api.js";
import { useAdminStore } from "../../state/admin-store.js";
import { useStore, type SelectedOption } from "../../state/global-store.js";
import { XMarkIcon } from "../../components/ui/icons.js";

interface Props {
  product: Product;
  onClose: () => void;
}

export function ProductConfigurator({ product, onClose }: Props) {
  const { optionGroupsByProduct, setOptionGroups } = useAdminStore();
  const addToCart = useStore((s) => s.addToCart);

  const [groups, setGroups] = useState<OptionGroupWithOptions[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // selected: optionGroupId → Set of optionIds
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});

  function fetchGroups() {
    setLoading(true);
    setLoadError(null);
    adminApi.optionGroups.list(product.id)
      .then((gs) => {
        setGroups(gs);
        setOptionGroups(product.id, gs);
      })
      .catch((e: Error) => setLoadError(e.message ?? "Errore caricamento opzioni"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const cached = optionGroupsByProduct[product.id];
    if (cached) {
      setGroups(cached);
      return;
    }
    fetchGroups();
  }, [product.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prevent background scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  function toggleOption(group: OptionGroupWithOptions, optionId: string) {
    setSelected((prev) => {
      const cur = new Set(prev[group.id] ?? []);
      if (group.type === "single") {
        if (cur.has(optionId)) {
          cur.clear();
        } else {
          cur.clear();
          cur.add(optionId);
        }
      } else {
        // multi or removal
        if (cur.has(optionId)) {
          cur.delete(optionId);
        } else {
          if (group.type === "multi" && cur.size >= group.maxSel) return prev; // max reached
          cur.add(optionId);
        }
      }
      return { ...prev, [group.id]: cur };
    });
  }

  // Validation: all required groups have at least one selection
  const isValid = groups.every((g) => {
    if (!g.required) return true;
    const sel = selected[g.id];
    return sel !== undefined && sel.size > 0;
  });

  // Compute live total
  const priceDelta = groups.reduce((sum, g) => {
    const sel = selected[g.id] ?? new Set<string>();
    return sum + g.options
      .filter((o) => sel.has(o.id))
      .reduce((s, o) => s + o.priceDelta, 0);
  }, 0);
  const total = product.price + priceDelta;

  function handleAdd() {
    if (!isValid) return;
    const selectedOptions: SelectedOption[] = groups.flatMap((g) => {
      const sel = selected[g.id] ?? new Set<string>();
      return g.options
        .filter((o) => sel.has(o.id))
        .map((o) => ({
          optionId: o.id,
          optionGroupId: g.id,
          name: o.name,
          priceDelta: o.priceDelta,
          isRemoval: g.type === "removal",
        }));
    });
    addToCart({
      productId: product.id,
      name: product.name,
      unitPrice: product.price,
      selectedOptions,
    });
    onClose();
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: "16px",
      }}
    >
      <div
        style={{
          background: "var(--color-white)",
          borderRadius: "var(--radius-xl)",
          width: "100%",
          maxWidth: "600px",
          maxHeight: "90dvh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid var(--color-gray-100)",
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          flexShrink: 0,
        }}>
          {product.color && (
            <div style={{
              width: "44px",
              height: "44px",
              borderRadius: "var(--radius-md)",
              background: product.color,
              flexShrink: 0,
            }} />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-900)", lineHeight: 1.2 }}>
              {product.name}
            </div>
            <div style={{ fontSize: "var(--text-md)", color: "var(--color-gray-400)", marginTop: "2px" }}>
              Base €{product.price.toFixed(2)}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: "none",
              background: "var(--color-gray-100)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <XMarkIcon style={{ width: "18px", height: "18px", color: "var(--color-gray-600)" }} />
          </button>
        </div>

        {/* Body */}
        <div className="scrollable" style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {loading && (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--color-gray-400)", fontSize: "var(--text-sm)" }}>
              Caricamento opzioni…
            </div>
          )}
          {!loading && loadError && (
            <div style={{ padding: "40px", textAlign: "center" }}>
              <div style={{ color: "var(--color-danger)", fontSize: "var(--text-sm)", marginBottom: "12px" }}>
                {loadError}
              </div>
              <button
                onClick={fetchGroups}
                style={{ padding: "8px 20px", borderRadius: "var(--radius-md)", border: "1.5px solid var(--color-brand)", background: "transparent", color: "var(--color-brand)", fontFamily: "var(--font)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer" }}
              >
                Riprova
              </button>
            </div>
          )}
          {!loading && !loadError && groups.length === 0 && (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--color-gray-400)", fontSize: "var(--text-sm)" }}>
              Nessuna opzione configurabile
            </div>
          )}
          {!loading && !loadError && groups.map((group) => {
            const sel = selected[group.id] ?? new Set<string>();
            const activeOptions = group.options.filter((o) => o.active);
            const isRemoval = group.type === "removal";

            return (
              <div key={group.id} style={{ padding: "16px 24px", borderBottom: "1px solid var(--color-gray-100)" }}>
                {/* Group header */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <span style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--color-gray-800)" }}>
                    {group.name}
                  </span>
                  {group.required && (
                    <span style={{
                      fontSize: "var(--text-xs)",
                      fontWeight: 700,
                      color: "var(--color-danger)",
                      background: "rgba(239,68,68,0.1)",
                      padding: "2px 8px",
                      borderRadius: "999px",
                    }}>
                      Obbligatorio
                    </span>
                  )}
                  <span style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                    color: "var(--color-gray-400)",
                    background: "var(--color-gray-100)",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    marginLeft: "auto",
                  }}>
                    {group.type === "single" ? "Scelta singola" : group.type === "multi" ? `Max ${group.maxSel}` : "Rimozioni"}
                  </span>
                </div>

                {/* Options */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {activeOptions.map((option) => {
                    const isSelected = sel.has(option.id);
                    return (
                      <button
                        key={option.id}
                        onClick={() => toggleOption(group, option.id)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "10px 16px",
                          borderRadius: "999px",
                          border: isSelected
                            ? `2px solid ${isRemoval ? "var(--color-danger)" : "var(--color-brand)"}`
                            : "2px solid var(--color-gray-200)",
                          background: isSelected
                            ? isRemoval ? "rgba(239,68,68,0.08)" : "rgba(48,107,52,0.08)"
                            : "var(--color-white)",
                          cursor: "pointer",
                          fontSize: "var(--text-sm)",
                          fontWeight: 600,
                          color: isSelected
                            ? isRemoval ? "var(--color-danger)" : "var(--color-brand)"
                            : "var(--color-gray-700)",
                          fontFamily: "var(--font)",
                          transition: "all 0.15s ease",
                          whiteSpace: "nowrap",
                        }}
                        onPointerDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.96)"; }}
                        onPointerUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
                        onPointerLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
                      >
                        {isRemoval && isSelected && (
                          <span style={{ fontSize: "12px", lineHeight: 1 }}>✕</span>
                        )}
                        <span style={{ textDecoration: isRemoval && isSelected ? "line-through" : "none" }}>
                          {option.name}
                        </span>
                        {!isRemoval && option.priceDelta !== 0 && (
                          <span style={{
                            fontSize: "var(--text-xs)",
                            fontWeight: 700,
                            opacity: 0.8,
                          }}>
                            {option.priceDelta > 0 ? "+" : ""}€{option.priceDelta.toFixed(2)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px",
          borderTop: "1px solid var(--color-gray-100)",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          flexShrink: 0,
          background: "var(--color-white)",
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", fontWeight: 600 }}>TOTALE</div>
            <div style={{ fontSize: "var(--text-xxl)", fontWeight: 700, color: "var(--color-brand)", lineHeight: 1.1 }}>
              €{total.toFixed(2)}
            </div>
            {priceDelta !== 0 && (
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>
                {priceDelta > 0 ? "+" : ""}€{priceDelta.toFixed(2)} opzioni
              </div>
            )}
          </div>
          <button
            onClick={handleAdd}
            disabled={!isValid}
            style={{
              height: "60px",
              padding: "0 32px",
              borderRadius: "var(--radius-lg)",
              border: "none",
              background: isValid ? "var(--color-accent)" : "var(--color-gray-200)",
              color: isValid ? "var(--color-gray-900)" : "var(--color-gray-400)",
              fontSize: "var(--text-lg)",
              fontWeight: 700,
              fontFamily: "var(--font)",
              cursor: isValid ? "pointer" : "not-allowed",
              transition: "background 0.15s, transform 0.1s",
              whiteSpace: "nowrap",
            }}
            onPointerDown={(e) => { if (isValid) (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)"; }}
            onPointerUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
            onPointerLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
          >
            Aggiungi al carrello
          </button>
        </div>
      </div>
    </div>
  );
}
