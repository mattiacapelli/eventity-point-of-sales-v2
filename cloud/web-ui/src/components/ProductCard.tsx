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
  const action = hasOptions ? onOpenOptions : () => onChange(1);

  return (
    <div
      className="hoverable"
      style={{
        display: "flex", alignItems: "center", gap: "12px", padding: "12px",
        borderRadius: "16px", background: "var(--color-white)",
        boxShadow: selected ? "0 0 0 2px var(--color-brand)" : "0 0 0 1px var(--color-gray-200)",
      }}
    >
      <div
        style={{
          width: "60px", height: "60px", flexShrink: 0, borderRadius: "14px",
          display: "grid", placeItems: "center", overflow: "hidden",
          background: hasImage ? undefined : "repeating-linear-gradient(135deg, var(--color-gray-100) 0 7px, var(--color-white) 7px 14px)",
          border: hasImage ? undefined : "1px solid var(--color-gray-100)",
        }}
      >
        {hasImage ? (
          <img src={product.imageUrl!} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : categoryEmoji ? (
          <span style={{ fontSize: "22px", lineHeight: 1 }}>{categoryEmoji}</span>
        ) : (
          <CakeIcon width={22} height={22} color="var(--color-gray-400)" />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "3px" }}>
        {categoryLabel && (
          <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-gray-400)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {categoryLabel}
          </span>
        )}
        <span style={{ fontSize: "16.5px", fontWeight: 600, lineHeight: 1.3, color: "var(--color-gray-900)" }}>
          {product.name}
        </span>
        <span style={{ fontSize: "17px", fontWeight: 700, color: "var(--color-brand)", paddingTop: "2px" }}>
          {formatEur(product.price)}
        </span>
      </div>

      <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
        {hasOptions ? (
          <button
            onClick={action}
            style={{
              minWidth: "48px", height: "48px", padding: "0 14px", borderRadius: "14px",
              background: selected ? "var(--color-brand)" : "var(--color-white)",
              border: selected ? "none" : "1.5px solid var(--color-brand)",
              color: selected ? "var(--color-white)" : "var(--color-brand)",
              fontSize: "var(--text-sm)", fontWeight: 700,
            }}
          >
            {selected ? `Modifica (${quantity})` : "Scegli"}
          </button>
        ) : selected ? (
          <div style={{ display: "flex", alignItems: "center", gap: "2px", padding: "3px", borderRadius: "14px", background: "var(--color-gray-100)" }}>
            <button
              onClick={() => onChange(quantity - 1)}
              aria-label="Diminuisci"
              style={{
                width: "44px", height: "44px", borderRadius: "11px",
                background: "var(--color-white)", color: "var(--color-brand)",
                fontSize: "22px", fontWeight: 600,
              }}
            >
              −
            </button>
            <span style={{ minWidth: "30px", textAlign: "center", fontSize: "17px", fontWeight: 700 }}>{quantity}</span>
            <button
              onClick={() => onChange(quantity + 1)}
              aria-label="Aumenta"
              style={{
                width: "44px", height: "44px", borderRadius: "11px",
                background: "var(--color-brand)", color: "var(--color-white)",
                fontSize: "22px", fontWeight: 600,
              }}
            >
              +
            </button>
          </div>
        ) : (
          <button
            onClick={action}
            aria-label="Aggiungi"
            style={{
              width: "48px", height: "48px", borderRadius: "14px",
              background: "var(--color-brand)", color: "var(--color-white)",
              fontSize: "26px", fontWeight: 600, lineHeight: 1,
            }}
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}
