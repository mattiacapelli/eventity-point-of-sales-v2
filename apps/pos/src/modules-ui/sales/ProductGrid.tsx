import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useStore } from "../../state/global-store.js";
import { useAdminStore } from "../../state/admin-store.js";
import { useShiftStore } from "../../state/shift-store.js";
import { adminApi } from "../../core/admin-api.js";
import type { Product } from "@pos/shared-types";
import { ProductConfigurator } from "./ProductConfigurator.js";
import {
  ClipboardDocumentListIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  Bars3Icon,
  WrenchScrewdriverIcon,
  TagIcon,
  ClockIcon,
} from "../../components/ui/icons.js";

const NAV_ITEMS = [
  { path: "/history",  label: "Storico ordini",  Icon: ClipboardDocumentListIcon },
  { path: "/stats",    label: "Statistiche",      Icon: ChartBarIcon },
  { path: "/settings", label: "Impostazioni",     Icon: Cog6ToothIcon },
  { path: "/admin",    label: "Amministrazione",  Icon: WrenchScrewdriverIcon },
] as const;

export function ProductGrid() {
  const { categories, products, optionGroupsByProduct, setOptionGroups } = useAdminStore();
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [configuratorProduct, setConfiguratorProduct] = useState<Product | null>(null);
  const addToCart = useStore((s) => s.addToCart);
  const { currentShift, setShiftModalOpen } = useShiftStore();
  const navigate  = useNavigate();
  const location  = useLocation();
  const menuRef   = useRef<HTMLDivElement>(null);

  async function handleProductClick(product: Product) {
    if (!currentShift) return;
    // Check if groups already cached
    let groups = optionGroupsByProduct[product.id];
    if (!groups) {
      groups = await adminApi.optionGroups.list(product.id);
      setOptionGroups(product.id, groups);
    }
    if (groups.length > 0) {
      setConfiguratorProduct(product);
    } else {
      addToCart({ productId: product.id, name: product.name, unitPrice: product.price });
    }
  }

  // Auto-select first category when data loads
  useEffect(() => {
    if (activeCategoryId === null && categories.length > 0) {
      setActiveCategoryId(categories[0]?.id ?? null);
    }
  }, [categories, activeCategoryId]);

  // Close fly-out on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const activeProducts = products.filter(
    (p) => p.active && p.categoryId === activeCategoryId,
  );

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", position: "relative" }}>
      {configuratorProduct && (
        <ProductConfigurator
          product={configuratorProduct}
          onClose={() => setConfiguratorProduct(null)}
        />
      )}

      {/* ── No-shift overlay ── */}
      {!currentShift && (
        <div style={{
          position: "absolute",
          top: 0, bottom: 0, left: "72px", right: 0,
          background: "rgba(248,249,250,0.92)",
          backdropFilter: "blur(4px)",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "20px",
        }}>
          <div style={{
            width: "72px", height: "72px", borderRadius: "50%",
            background: "var(--color-gray-100)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ClockIcon style={{ width: "36px", height: "36px", color: "var(--color-gray-400)" }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-700)", marginBottom: "6px" }}>
              Nessun turno aperto
            </div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-400)", maxWidth: "260px", lineHeight: 1.5 }}>
              Apri un turno per iniziare a prendere ordini.
            </div>
          </div>
          <button
            onClick={() => setShiftModalOpen("open")}
            style={{
              padding: "14px 32px",
              borderRadius: "var(--radius-lg)",
              border: "none",
              background: "var(--color-brand)",
              color: "var(--color-white)",
              fontSize: "var(--text-md)",
              fontWeight: 700,
              fontFamily: "var(--font)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 4px 16px rgba(48,107,52,0.35)",
              transition: "transform 0.1s",
            }}
            onPointerDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)"; }}
            onPointerUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
            onPointerLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
          >
            <ClockIcon style={{ width: "18px", height: "18px" }} />
            Apri turno
          </button>
        </div>
      )}

      {/* ── Sidebar ── */}
      <div
        ref={menuRef}
        style={{
          width: "72px",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          background: "var(--color-white)",
          borderRight: "1px solid var(--color-gray-200)",
          zIndex: 60,
        }}
      >
        {/* Categories */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px", padding: "var(--sp-sm) 6px", overflowY: "auto", visibility: currentShift ? "visible" : "hidden" }}>
          {categories.length === 0 ? (
            <div style={{ padding: "12px 4px", textAlign: "center" }}>
              <TagIcon style={{ width: "20px", height: "20px", color: "var(--color-gray-300)", margin: "0 auto" }} />
            </div>
          ) : (
            categories.map((cat) => {
              const active = activeCategoryId === cat.id;
              const accent = cat.color ?? "var(--color-brand)";
              return (
                <button
                  key={cat.id}
                  onClick={() => { setActiveCategoryId(cat.id); setMenuOpen(false); }}
                  style={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                    padding: "10px 4px",
                    borderRadius: "10px",
                    border: "none",
                    background: active ? accent : "transparent",
                    cursor: "pointer",
                    transition: "background var(--transition)",
                    minHeight: "64px",
                    fontFamily: "var(--font)",
                  }}
                >
                  <TagIcon
                    style={{
                      width: "20px",
                      height: "20px",
                      color: active ? "var(--color-white)" : (cat.color ?? "var(--color-gray-400)"),
                      transition: "color var(--transition)",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: active ? "var(--color-white)" : "var(--color-gray-500)",
                      textAlign: "center",
                      lineHeight: 1.2,
                      transition: "color var(--transition)",
                      wordBreak: "break-word",
                      hyphens: "auto",
                    }}
                  >
                    {cat.name}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: "var(--color-gray-200)", margin: "0 10px" }} />

        {/* Menu trigger */}
        <div style={{ padding: "8px 6px" }}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              padding: "10px 4px",
              borderRadius: "10px",
              border: "none",
              background: menuOpen ? "rgba(48,107,52,0.1)" : "transparent",
              cursor: "pointer",
              transition: "background var(--transition)",
              minHeight: "56px",
              fontFamily: "var(--font)",
            }}
          >
            <Bars3Icon style={{ width: "22px", height: "22px", color: menuOpen ? "var(--color-brand)" : "var(--color-gray-400)" }} />
            <span style={{ fontSize: "10px", fontWeight: 700, color: menuOpen ? "var(--color-brand)" : "var(--color-gray-500)" }}>
              Menu
            </span>
          </button>
        </div>

        {/* Fly-out panel */}
        {menuOpen && (
          <div
            style={{
              position: "absolute",
              left: "72px",
              bottom: "8px",
              background: "var(--color-white)",
              borderRadius: "12px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)",
              border: "1px solid var(--color-gray-200)",
              minWidth: "200px",
              overflow: "hidden",
              zIndex: 70,
              animation: "slideInLeft 0.15s ease",
            }}
          >
            {NAV_ITEMS.map((item, i) => {
              const active = location.pathname === item.path;
              const { Icon } = item;
              return (
                <button
                  key={item.path}
                  onClick={() => { navigate(item.path); setMenuOpen(false); }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "13px 16px",
                    border: "none",
                    borderBottom: i < NAV_ITEMS.length - 1 ? "1px solid var(--color-gray-100)" : "none",
                    background: active ? "rgba(48,107,52,0.06)" : "var(--color-white)",
                    cursor: "pointer",
                    fontFamily: "var(--font)",
                    textAlign: "left",
                    transition: "background var(--transition)",
                  }}
                >
                  <Icon style={{ width: "18px", height: "18px", color: active ? "var(--color-brand)" : "var(--color-gray-500)", flexShrink: 0 }} />
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: active ? "var(--color-brand)" : "var(--color-gray-700)" }}>
                    {item.label}
                  </span>
                  {active && (
                    <span style={{ marginLeft: "auto", width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-brand)", flexShrink: 0 }} />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Product grid ── */}
      <div
        className="scrollable"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "var(--sp-md)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: "10px",
          alignContent: "start",
        }}
      >
        {activeProducts.length === 0 && activeCategoryId !== null && (
          <div style={{
            gridColumn: "1 / -1",
            textAlign: "center",
            padding: "48px 16px",
            color: "var(--color-gray-400)",
            fontSize: "var(--text-sm)",
          }}>
            Nessun prodotto in questa categoria
          </div>
        )}
        {activeProducts.map((product) => {
          const hasColor = !!product.color;
          const locked = !currentShift;
          return (
            <button
              key={product.id}
              disabled={locked}
              onClick={() => void handleProductClick(product)}
              style={{
                background: product.color ?? "var(--color-white)",
                borderRadius: "var(--radius-lg)",
                border: "2px solid transparent",
                padding: "16px 12px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                cursor: locked ? "not-allowed" : "pointer",
                boxShadow: "var(--shadow-sm)",
                transition: "transform var(--transition), filter var(--transition)",
                minHeight: "90px",
                fontFamily: "var(--font)",
                opacity: locked ? 0.45 : 1,
              }}
              onPointerDown={(e) => { if (!locked) (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.96)"; }}
              onPointerUp={(e)   => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
              onPointerLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
            >
              <span style={{
                fontSize: "var(--text-md)",
                fontWeight: 600,
                color: hasColor ? "rgba(255,255,255,0.95)" : "var(--color-gray-800)",
                textAlign: "center",
                lineHeight: 1.3,
                textShadow: hasColor ? "0 1px 2px rgba(0,0,0,0.25)" : "none",
              }}>
                {product.name}
              </span>
              <span style={{
                fontSize: "var(--text-md)",
                fontWeight: 700,
                color: hasColor ? "rgba(255,255,255,0.9)" : "var(--color-brand)",
                textShadow: hasColor ? "0 1px 2px rgba(0,0,0,0.25)" : "none",
              }}>
                €{product.price.toFixed(2)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
