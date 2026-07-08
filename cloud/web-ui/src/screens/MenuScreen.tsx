import { useMemo, useState } from "react";
import type { CartLine, Category, OrderInfo, Product } from "../core/types.js";
import { ProductCard } from "../components/ProductCard.js";
import { ProductOptionsModal } from "../components/ProductOptionsModal.js";
import { Button } from "../components/Button.js";

function formatEur(n: number): string {
  return `€${n.toFixed(2)}`;
}

export function MenuScreen({
  categories, products, info, cart, onQuantityChange, onAddItemWithOptions, onProceed, onBack,
}: {
  categories: Category[];
  products: Product[];
  info: OrderInfo;
  cart: CartLine[];
  onQuantityChange: (productId: string, quantity: number) => void;
  onAddItemWithOptions: (productId: string, selectedOptionIds: string[], quantity: number) => void;
  onProceed: () => void;
  onBack: () => void;
}) {
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [configuring, setConfiguring] = useState<Product | null>(null);

  const isSearching = search.trim().length > 0;
  const categoryNameById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);

  const visibleProducts = isSearching
    ? products.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    : products.filter((p) => p.categoryId === activeCategory);

  const totalItems = cart.reduce((sum, l) => sum + l.quantity, 0);
  const totalAmount = cart.reduce((sum, l) => {
    const product = products.find((p) => p.id === l.productId);
    return sum + (product ? product.price * l.quantity : 0);
  }, 0);

  const quantityFor = (productId: string) => cart.filter((l) => l.productId === productId).reduce((s, l) => s + l.quantity, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div
        style={{
          background: "var(--color-brand)",
          padding: `calc(var(--sp-md) + var(--safe-top)) var(--sp-lg) var(--sp-md)`,
          display: "flex",
          flexDirection: "column",
          gap: "var(--sp-sm)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-sm)" }}>
          <button
            onClick={onBack}
            aria-label="Indietro"
            style={{
              flexShrink: 0,
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.18)",
              color: "var(--color-white)",
              fontSize: "var(--text-lg)",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ←
          </button>
          <div style={{ position: "relative", flex: 1 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca un piatto..."
              style={{
                width: "100%",
                height: "40px",
                padding: "0 14px",
                borderRadius: "var(--radius-pill)",
                border: "none",
                background: "rgba(255,255,255,0.92)",
                color: "var(--color-gray-900)",
                fontSize: "var(--text-sm)",
              }}
            />
            {isSearching && (
              <button
                onClick={() => setSearch("")}
                aria-label="Cancella ricerca"
                style={{
                  position: "absolute", right: "6px", top: "50%", transform: "translateY(-50%)",
                  width: "28px", height: "28px", borderRadius: "50%",
                  background: "var(--color-gray-200)", color: "var(--color-gray-600)",
                  fontSize: "var(--text-sm)", fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                ✕
              </button>
            )}
          </div>
          <div
            style={{
              flexShrink: 0,
              padding: "10px 16px",
              borderRadius: "var(--radius-pill)",
              background: "var(--color-white)",
              color: "var(--color-brand)",
              fontSize: "var(--text-sm)",
              fontWeight: 700,
            }}
          >
            {info.tableId ? `Tavolo ${info.tableId}` : "—"}
          </div>
        </div>

        {!isSearching && (
          <div
            className="scrollable-x"
            style={{ display: "flex", gap: "8px" }}
          >
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                style={{
                  flexShrink: 0,
                  padding: "10px 18px",
                  borderRadius: "var(--radius-pill)",
                  background: activeCategory === c.id ? "var(--color-white)" : "rgba(255,255,255,0.15)",
                  color: activeCategory === c.id ? "var(--color-brand)" : "var(--color-white)",
                  fontSize: "var(--text-sm)",
                  fontWeight: 700,
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className="scrollable"
        style={{
          flex: 1,
          minHeight: 0,
          padding: "var(--sp-lg)",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--sp-md)",
          alignContent: "start",
        }}
      >
        {visibleProducts.length === 0 ? (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "var(--color-gray-400)", padding: "var(--sp-xxl) 0" }}>
            Nessun prodotto trovato
          </div>
        ) : (
          visibleProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              categoryLabel={isSearching ? categoryNameById[product.categoryId] : undefined}
              quantity={quantityFor(product.id)}
              onChange={(q) => onQuantityChange(product.id, q)}
              onOpenOptions={() => setConfiguring(product)}
            />
          ))
        )}
      </div>

      <div style={{ padding: "var(--sp-md) var(--sp-lg) calc(var(--sp-md) + var(--safe-bottom))", flexShrink: 0, background: "var(--color-white)", borderTop: "1px solid var(--color-gray-100)" }}>
        <Button disabled={totalItems === 0} onClick={onProceed}>
          {totalItems > 0
            ? `Procedi con l'ordine · ${totalItems} art. · ${formatEur(totalAmount)}`
            : "Procedi con l'ordine"}
        </Button>
      </div>

      {configuring && (
        <ProductOptionsModal
          product={configuring}
          onClose={() => setConfiguring(null)}
          onConfirm={(selectedOptionIds, quantity) => onAddItemWithOptions(configuring.id, selectedOptionIds, quantity)}
        />
      )}
    </div>
  );
}
