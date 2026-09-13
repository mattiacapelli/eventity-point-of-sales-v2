import { CakeIcon } from "@heroicons/react/24/outline";
import type { Product } from "../core/types.js";

function formatEur(n: number): string {
  return `€${n.toFixed(2)}`;
}

export function ProductCard({ product, categoryLabel, categoryEmoji, quantity, onChange, onOpenOptions }: {
  product: Product;
  categoryLabel?: string | undefined;
  categoryEmoji?: string | null | undefined;
  quantity: number;
  onChange: (q: number) => void;
  onOpenOptions: () => void;
}) {
  const hasOptions = product.optionGroups.length > 0;
  const selected = quantity > 0;
  const hasImage = Boolean(product.imageUrl);

  return (
    <div
      className="hoverable"
      style={{
        background: "var(--color-white)",
        borderRadius: "var(--radius-lg)",
        border: `1.5px solid ${selected ? "var(--color-brand)" : "var(--color-gray-200)"}`,
        boxShadow: selected ? "var(--shadow-sm)" : "none",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-sm)",
        minHeight: "116px",
      }}
    >
      {hasImage ? (
        <img
          src={product.imageUrl!}
          alt=""
          style={{ width: "100%", height: "96px", objectFit: "cover", display: "block" }}
        />
      ) : null}

      <div style={{ flex: 1, display: "flex", gap: "10px", padding: hasImage ? "0 var(--sp-md)" : "var(--sp-md) var(--sp-md) 0" }}>
        {!hasImage && (
          <div
            style={{
              flexShrink: 0,
              width: "40px",
              height: "40px",
              borderRadius: "var(--radius-md)",
              background: "rgba(48,107,52,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {categoryEmoji ? (
              <span style={{ fontSize: "20px", lineHeight: 1 }}>{categoryEmoji}</span>
            ) : (
              <CakeIcon width={20} height={20} color="var(--color-brand)" />
            )}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {categoryLabel && (
            <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-gray-400)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "2px" }}>
              {categoryLabel}
            </div>
          )}
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-gray-900)", lineHeight: 1.3 }}>
            {product.name}
          </div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-brand)", marginTop: "4px" }}>
            {formatEur(product.price)}
          </div>
        </div>
      </div>

      <div style={{ padding: "0 var(--sp-md) var(--sp-md)" }}>
      {hasOptions ? (
        <button
          onClick={onOpenOptions}
          style={{
            width: "100%", padding: "8px", borderRadius: "var(--radius-md)",
            border: "1.5px solid var(--color-brand)", background: selected ? "var(--color-brand)" : "var(--color-white)",
            color: selected ? "var(--color-white)" : "var(--color-brand)", fontSize: "var(--text-sm)", fontWeight: 700,
          }}
        >
          {selected ? `Configura (${quantity})` : "Configura"}
        </button>
      ) : selected ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
          <button
            onClick={() => onChange(quantity - 1)}
            aria-label="Diminuisci"
            style={{
              width: "34px", height: "34px", borderRadius: "var(--radius-md)",
              border: "1.5px solid var(--color-gray-200)", background: "var(--color-gray-50)",
              fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--color-gray-700)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            −
          </button>
          <span style={{ fontSize: "var(--text-md)", fontWeight: 700, minWidth: "20px", textAlign: "center" }}>{quantity}</span>
          <button
            onClick={() => onChange(quantity + 1)}
            aria-label="Aumenta"
            style={{
              width: "34px", height: "34px", borderRadius: "var(--radius-md)",
              border: "none", background: "var(--color-brand)",
              fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--color-white)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            +
          </button>
        </div>
      ) : (
        <button
          onClick={() => onChange(1)}
          style={{
            width: "100%", padding: "8px", borderRadius: "var(--radius-md)",
            border: "1.5px solid var(--color-brand)", background: "var(--color-white)",
            color: "var(--color-brand)", fontSize: "var(--text-sm)", fontWeight: 700,
          }}
        >
          Aggiungi
        </button>
      )}
      </div>
    </div>
  );
}
