import { useMemo, useState } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
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
  onQuantityChange: (productId: number, quantity: number) => void;
  onAddItemWithOptions: (productId: number, selectedOptionIds: number[], quantity: number) => void;
  onProceed: () => void;
  onBack: () => void;
}) {
  const [activeCategory, setActiveCategory] = useState<number | null>(categories[0]?.id ?? null);
  const [search, setSearch] = useState("");
  const [configuring, setConfiguring] = useState<Product | null>(null);

  const isSearching = search.trim().length > 0;
  const categoryNameById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);
  const categoryEmojiById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.emoji])), [categories]);

  const visibleProducts = isSearching
    ? products.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    : products.filter((p) => p.categoryId === activeCategory);

  const totalItems = cart.reduce((sum, l) => sum + l.quantity, 0);
  const totalAmount = cart.reduce((sum, l) => {
    const product = products.find((p) => p.id === l.productId);
    return sum + (product ? product.price * l.quantity : 0);
  }, 0);

  const quantityFor = (productId: number) => cart.filter((l) => l.productId === productId).reduce((s, l) => s + l.quantity, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div
        style={{
          position: "sticky", top: 0, zIndex: 10,
          background: "var(--color-brand)",
          padding: `calc(14px + var(--safe-top)) 14px 12px`,
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={onBack}
            aria-label="Indietro"
            className="icon-btn"
            style={{
              flexShrink: 0,
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.14)",
              color: "var(--color-white)",
              fontSize: "19px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ←
          </button>
          <div style={{
            flex: 1, minWidth: 0, position: "relative", display: "flex", alignItems: "center",
            gap: "10px", height: "44px", padding: "0 14px", borderRadius: "12px", background: "var(--color-white)",
          }}>
            <span style={{ width: "10px", height: "10px", flexShrink: 0, borderRadius: "50%", border: "2.5px solid var(--color-gray-400)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca un piatto…"
              className="input-field"
              style={{
                flex: 1, minWidth: 0, border: "none", outline: "none",
                background: "transparent", fontSize: "15.5px", color: "var(--color-gray-900)",
              }}
            />
            {isSearching && (
              <button
                onClick={() => setSearch("")}
                aria-label="Cancella ricerca"
                className="icon-btn"
                style={{
                  flexShrink: 0, width: "24px", height: "24px", borderRadius: "50%",
                  background: "var(--color-gray-200)", color: "var(--color-gray-600)",
                  fontSize: "13px", fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                ✕
              </button>
            )}
          </div>
          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.2 }}>
            <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-brand-light)" }}>
              Tavolo
            </span>
            <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-white)", whiteSpace: "nowrap" }}>
              {info.tableId || "—"}
            </span>
          </div>
        </div>

        {!isSearching && (
          <nav
            className="scrollable-x"
            style={{ display: "flex", gap: "8px", margin: "0 -14px", padding: "0 14px 2px" }}
          >
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                style={{
                  flexShrink: 0,
                  height: "44px",
                  padding: "0 16px",
                  borderRadius: "12px",
                  background: activeCategory === c.id ? "var(--color-white)" : "rgba(255,255,255,0.16)",
                  color: activeCategory === c.id ? "var(--color-brand)" : "var(--color-white)",
                  fontSize: "15px",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {c.name}
              </button>
            ))}
          </nav>
        )}
      </div>

      <div
        className="scrollable"
        style={{
          flex: 1,
          minHeight: 0,
          padding: "16px 14px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          maxWidth: "560px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        {visibleProducts.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--sp-sm)", color: "var(--color-gray-400)", padding: "var(--sp-xxl) 0" }}>
            <MagnifyingGlassIcon width={40} height={40} color="var(--color-gray-300)" />
            <span>Nessun prodotto trovato</span>
          </div>
        ) : (
          visibleProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              categoryLabel={isSearching ? categoryNameById[product.categoryId] : undefined}
              categoryEmoji={categoryEmojiById[product.categoryId]}
              quantity={quantityFor(product.id)}
              onChange={(q) => onQuantityChange(product.id, q)}
              onOpenOptions={() => setConfiguring(product)}
            />
          ))
        )}
      </div>

      <div style={{
        position: "sticky", bottom: 0,
        padding: `12px 14px calc(18px + var(--safe-bottom))`,
        background: "var(--color-gray-100)", borderTop: "1px solid var(--color-gray-200)",
        display: "flex", flexDirection: "column", gap: "10px", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px", padding: "0 4px" }}>
          <span style={{ fontSize: "14px", color: "var(--color-gray-700)" }}>
            {totalItems === 0 ? "Nessun piatto" : totalItems === 1 ? "1 piatto" : `${totalItems} piatti`}
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-gray-900)" }}>
            {formatEur(totalAmount)}
          </span>
        </div>
        <Button disabled={totalItems === 0} onClick={onProceed}>
          {totalItems > 0 ? "Vai al riepilogo" : "Scegli almeno un piatto"}
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
