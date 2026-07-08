import type { Product } from "../core/types.js";

function formatEur(n: number): string {
  return `€${n.toFixed(2)}`;
}

export function ProductCard({ product, categoryLabel, quantity, onChange, onOpenOptions }: {
  product: Product;
  categoryLabel?: string | undefined;
  quantity: number;
  onChange: (q: number) => void;
  onOpenOptions: () => void;
}) {
  const hasOptions = product.optionGroups.length > 0;
  const selected = quantity > 0;

  return (
    <div
      style={{
        background: "var(--color-white)",
        borderRadius: "var(--radius-lg)",
        border: `1.5px solid ${selected ? "var(--color-brand)" : "var(--color-gray-200)"}`,
        padding: "var(--sp-md)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-sm)",
        minHeight: "116px",
      }}
    >
      <div style={{ flex: 1 }}>
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
  );
}
