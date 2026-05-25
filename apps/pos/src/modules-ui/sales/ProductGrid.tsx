import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useStore } from "../../state/global-store.js";
import { useAdminStore } from "../../state/admin-store.js";
import { useShiftStore } from "../../state/shift-store.js";
import { useGridStore } from "../../state/grid-store.js";
import { adminApi } from "../../core/admin-api.js";
import type { Product } from "@pos/shared-types";
import type { ProductGridSlot } from "@pos/shared-types";
import { ProductConfigurator } from "./ProductConfigurator.js";
import {
  ClipboardDocumentListIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  Bars3Icon,
  WrenchScrewdriverIcon,
  TagIcon,
  ClockIcon,
  ShieldCheckIcon,
} from "../../components/ui/icons.js";

// ─── Nav ──────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { path: "/history",  label: "Storico ordini",  Icon: ClipboardDocumentListIcon, adminOnly: false },
  { path: "/stats",    label: "Statistiche",      Icon: ChartBarIcon,              adminOnly: false },
  { path: "/settings", label: "Impostazioni",     Icon: Cog6ToothIcon,             adminOnly: false },
  { path: "/admin",    label: "Amministrazione",  Icon: WrenchScrewdriverIcon,     adminOnly: true  },
  { path: "/audit",    label: "Audit Log",        Icon: ShieldCheckIcon,           adminOnly: true  },
];

// ─── Sort helper ──────────────────────────────────────────────────────────────

function sortProducts(products: Product[], sortBy: string): Product[] {
  if (sortBy === "custom") return products;
  return [...products].sort((a, b) => {
    switch (sortBy) {
      case "name":     return a.name.localeCompare(b.name);
      case "price":    return a.price - b.price;
      case "color":    return (a.color ?? "").localeCompare(b.color ?? "");
      case "category": return (a.categoryName ?? "").localeCompare(b.categoryName ?? "");
      default:         return 0;
    }
  });
}

// ─── Card component ───────────────────────────────────────────────────────────

interface CardProps {
  product: Product;
  slot: ProductGridSlot | undefined;
  locked: boolean;
  editMode: boolean;
  showPrice: boolean;
  showDescription: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent, productId: string) => void;
  onResizeStart: (e: React.PointerEvent, productId: string, scope: string) => void;
  scope: string;
}

function ProductCard({ product, slot, locked, editMode, showPrice, showDescription, onClick, onDragStart, onResizeStart, scope }: CardProps) {
  const hasColor = !!product.color;
  const hasImage = !!product.imageData;
  const imageUrl = hasImage ? `/api/static/${product.imageData}` : null;
  const isResizingRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const spanW = slot?.spanW ?? 1;
  const spanH = slot?.spanH ?? 1;

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const onDragStartNative = (e: DragEvent) => { if (isResizingRef.current) e.preventDefault(); };
    const onPointerUp = () => { isResizingRef.current = false; };
    el.addEventListener("dragstart", onDragStartNative, true);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
    return () => {
      el.removeEventListener("dragstart", onDragStartNative, true);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  return (
    <div
      ref={cardRef}
      draggable={editMode}
      onDragStart={editMode ? (e) => {
        if (isResizingRef.current) { e.preventDefault(); return; }
        onDragStart(e, product.id);
      } : undefined}
      style={{
        gridColumn: slot ? `${slot.slotX + 1} / span ${spanW}` : undefined,
        gridRow: slot ? `${slot.slotY + 1} / span ${spanH}` : undefined,
        position: "relative",
        cursor: editMode ? "grab" : locked ? "not-allowed" : "pointer",
        opacity: locked && !editMode ? 0.45 : 1,
      }}
    >
      <button
        disabled={locked || editMode}
        onClick={onClick}
        style={{
          width: "100%",
          height: "100%",
          background: hasImage ? "var(--color-white)" : (product.color ?? "var(--color-white)"),
          borderRadius: "var(--radius-lg)",
          border: editMode ? "2px dashed var(--color-brand)" : "2px solid transparent",
          padding: hasImage ? "0" : "16px 12px",
          display: "flex",
          flexDirection: "column",
          alignItems: hasImage ? "stretch" : "center",
          justifyContent: hasImage ? "flex-start" : "center",
          gap: hasImage ? "0" : "8px",
          boxShadow: "var(--shadow-sm)",
          transition: "transform var(--transition), filter var(--transition)",
          fontFamily: "var(--font)",
          overflow: "hidden",
        }}
        onPointerDown={(e) => { if (!locked && !editMode) (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.96)"; }}
        onPointerUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
        onPointerLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
      >
        {hasImage && imageUrl && (
          <img
            src={imageUrl}
            alt={product.name}
            style={{ width: "100%", height: spanH > 1 ? "160px" : "80px", objectFit: "cover", display: "block", flexShrink: 0 }}
          />
        )}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "4px",
          padding: hasImage ? "8px 10px" : "0",
        }}>
          <span style={{
            fontSize: "var(--text-md)",
            fontWeight: 600,
            color: hasImage ? "var(--color-gray-800)" : (hasColor ? "rgba(255,255,255,0.95)" : "var(--color-gray-800)"),
            textAlign: "center",
            lineHeight: 1.3,
            textShadow: (!hasImage && hasColor) ? "0 1px 2px rgba(0,0,0,0.25)" : "none",
          }}>
            {product.name}
          </span>
          {showDescription && product.description && (
            <span style={{
              fontSize: "10px",
              fontWeight: 400,
              color: hasImage ? "var(--color-gray-500)" : (hasColor ? "rgba(255,255,255,0.7)" : "var(--color-gray-500)"),
              textAlign: "center",
              lineHeight: 1.3,
              textShadow: (!hasImage && hasColor) ? "0 1px 2px rgba(0,0,0,0.2)" : "none",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}>
              {product.description}
            </span>
          )}
          {showPrice && (
            <span style={{
              fontSize: "var(--text-md)",
              fontWeight: 700,
              color: hasImage ? "var(--color-brand)" : (hasColor ? "rgba(255,255,255,0.9)" : "var(--color-brand)"),
              textShadow: (!hasImage && hasColor) ? "0 1px 2px rgba(0,0,0,0.25)" : "none",
            }}>
              €{product.price.toFixed(2)}
            </span>
          )}
        </div>
      </button>

      {editMode && slot && (
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            isResizingRef.current = true;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            onResizeStart(e, product.id, scope);
          }}
          style={{
            position: "absolute", bottom: 4, right: 4,
            width: 16, height: 16, borderRadius: 3,
            background: "var(--color-brand)", cursor: "nwse-resize",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10,
          }}
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="white">
            <path d="M7 1L1 7M7 4L4 7M7 7H4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </div>
  );
}

// ─── Drop slot ────────────────────────────────────────────────────────────────

function DropSlot({ x, y, onDrop }: { x: number; y: number; onDrop: (x: number, y: number) => void }) {
  const [over, setOver] = useState(false);
  return (
    <div
      style={{
        gridColumn: `${x + 1} / span 1`, gridRow: `${y + 1} / span 1`,
        borderRadius: "var(--radius-lg)",
        border: `2px dashed ${over ? "var(--color-brand)" : "var(--color-gray-200)"}`,
        background: over ? "rgba(48,107,52,0.06)" : "transparent",
        transition: "border-color 0.15s, background 0.15s",
      }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onDrop(x, y); }}
    />
  );
}

// ─── Grid view ────────────────────────────────────────────────────────────────

interface GridAreaProps {
  products: Product[];
  slots: ProductGridSlot[];
  scope: string;
  baseCols: number;
  editMode: boolean;
  locked: boolean;
  showPrice: boolean;
  showDescription: boolean;
  onProductClick: (p: Product) => void;
  onDragStart: (e: React.DragEvent, productId: string, scope: string) => void;
  onDrop: (scope: string, x: number, y: number) => void;
  onResizeStart: (e: React.PointerEvent, productId: string, scope: string) => void;
}

function GridArea({ products, slots, scope, baseCols, editMode, locked, showPrice, showDescription, onProductClick, onDragStart, onDrop, onResizeStart }: GridAreaProps) {
  const slotMap = new Map(slots.map((s) => [s.productId, s]));
  const positioned = products.filter((p) => slotMap.has(p.id));
  const floating = products.filter((p) => !slotMap.has(p.id));

  const maxRow = slots.reduce((m, s) => Math.max(m, s.slotY + (s.spanH ?? 1)), 0);
  const totalRows = Math.max(maxRow + (editMode ? 2 : 0), 1);

  const occupied = new Set<string>();
  for (const s of slots) {
    for (let dy = 0; dy < (s.spanH ?? 1); dy++)
      for (let dx = 0; dx < (s.spanW ?? 1); dx++)
        occupied.add(`${s.slotX + dx},${s.slotY + dy}`);
  }

  const dropSlots: Array<{ x: number; y: number }> = [];
  if (editMode) {
    for (let y = 0; y < totalRows; y++)
      for (let x = 0; x < baseCols; x++)
        if (!occupied.has(`${x},${y}`)) dropSlots.push({ x, y });
  }

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${baseCols}, 1fr)`,
      gridAutoRows: "120px",
      gap: "10px",
    }}>
      {positioned.map((p) => (
        <ProductCard
          key={p.id}
          product={p}
          slot={slotMap.get(p.id)}
          locked={locked}
          editMode={editMode}
          showPrice={showPrice}
          showDescription={showDescription}
          onClick={() => onProductClick(p)}
          onDragStart={(e, id) => onDragStart(e, id, scope)}
          onResizeStart={onResizeStart}
          scope={scope}
        />
      ))}
      {editMode && dropSlots.map(({ x, y }) => (
        <DropSlot key={`${x},${y}`} x={x} y={y} onDrop={(dx, dy) => onDrop(scope, dx, dy)} />
      ))}
      {floating.map((p) => (
        <ProductCard
          key={p.id}
          product={p}
          slot={undefined}
          locked={locked}
          editMode={editMode}
          showPrice={showPrice}
          showDescription={showDescription}
          onClick={() => onProductClick(p)}
          onDragStart={(e, id) => onDragStart(e, id, scope)}
          onResizeStart={onResizeStart}
          scope={scope}
        />
      ))}
    </div>
  );
}

// ─── Main ProductGrid ─────────────────────────────────────────────────────────

export function ProductGrid() {
  const { categories, products, productionCenters, optionGroupsByProduct, setOptionGroups } = useAdminStore();
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [configuratorProduct, setConfiguratorProduct] = useState<Product | null>(null);
  const addToCart = useStore((s) => s.addToCart);
  const session = useStore((s) => s.session);
  const isAdmin = session?.role === "admin";
  const { currentShift, setShiftModalOpen } = useShiftStore();
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef  = useRef<HTMLDivElement>(null);

  const { viewMode, showPrice, showDescription, sortBy, baseCols, editMode, layouts, loadLayout, saveLayout, updateSlot, setEditMode, applyServerPrefs } = useGridStore();

  // Drag state
  const dragProductIdRef = useRef<string | null>(null);
  const dragScopeRef     = useRef<string | null>(null);

  // Resize state
  const resizeRef = useRef<{
    productId: string; scope: string;
    startX: number; startY: number;
    origSpanW: number; origSpanH: number;
    cellW: number; cellH: number;
  } | null>(null);

  // Activate editMode if ?editLayout=1 is in the URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("editLayout") === "1") {
      setEditMode(true);
      // Clean the param from the URL without reloading
      navigate(location.pathname, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load server prefs once on mount
  useEffect(() => {
    adminApi.settings.get()
      .then((s) => {
        applyServerPrefs({
          viewMode: s.gridViewMode,
          showPrice: s.gridShowPrice,
          showDescription: s.gridShowDescription,
          sortBy: s.gridSortBy,
          baseCols: s.gridBaseCols,
        });
      })
      .catch(() => {});
  }, [applyServerPrefs]);

  // Auto-select first category
  useEffect(() => {
    if (activeCategoryId === null && categories.length > 0) {
      setActiveCategoryId(categories[0]?.id ?? null);
    }
  }, [categories, activeCategoryId]);

  // Load layout for current scope
  useEffect(() => {
    if (viewMode === "category" && activeCategoryId) {
      void loadLayout(`category:${activeCategoryId}`);
    } else if (viewMode !== "category") {
      void loadLayout("global");
      if (viewMode === "grouped_category") {
        categories.forEach((c) => void loadLayout(`category:${c.id}`));
      }
    }
  }, [viewMode, activeCategoryId, categories, loadLayout]);

  // Resize pointer events (pointer instead of mouse because of setPointerCapture)
  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      const r = resizeRef.current;
      if (!r) return;
      const dx = Math.round((e.clientX - r.startX) / r.cellW);
      const dy = Math.round((e.clientY - r.startY) / r.cellH);
      updateSlot(r.scope, r.productId, {
        spanW: Math.max(1, Math.min(r.origSpanW + dx, baseCols)),
        spanH: Math.max(1, Math.min(r.origSpanH + dy, 4)),
      });
    }
    function onPointerUp() { resizeRef.current = null; }
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
    };
  }, [baseCols, updateSlot]);

  function handleDragStart(e: React.DragEvent, productId: string, scope: string) {
    dragProductIdRef.current = productId;
    dragScopeRef.current = scope;
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDrop(scope: string, x: number, y: number) {
    const productId = dragProductIdRef.current;
    if (!productId) return;
    const currentSlots = layouts[scope] ?? [];
    const sourceScopeId = dragScopeRef.current;
    if (sourceScopeId && sourceScopeId !== scope) {
      saveLayout(sourceScopeId, (layouts[sourceScopeId] ?? []).filter((s) => s.productId !== productId));
    }
    const existing = currentSlots.find((s) => s.productId === productId) ?? null;
    const targetSlot = currentSlots.find((s) => s.slotX === x && s.slotY === y && s.productId !== productId);
    let nextSlots = [...currentSlots];
    if (targetSlot && existing) {
      nextSlots = nextSlots.map((s) => {
        if (s.productId === productId) return { ...s, slotX: x, slotY: y };
        if (s.productId === targetSlot.productId) return { ...s, slotX: existing.slotX, slotY: existing.slotY };
        return s;
      });
    } else if (existing) {
      nextSlots = nextSlots.map((s) => s.productId === productId ? { ...s, slotX: x, slotY: y } : s);
    } else {
      nextSlots.push({ productId, slotX: x, slotY: y, spanW: 1, spanH: 1 });
    }
    saveLayout(scope, nextSlots);
    if (sourceScopeId && sourceScopeId !== scope) {
      if (scope.startsWith("category:")) void adminApi.products.update(productId, { categoryId: scope.replace("category:", "") });
      else if (scope.startsWith("center:")) void adminApi.products.update(productId, { productionCenterId: scope.replace("center:", "") });
    }
    dragProductIdRef.current = null;
    dragScopeRef.current = null;
  }

  function handleResizeStart(e: React.PointerEvent, productId: string, scope: string) {
    const slot = (layouts[scope] ?? []).find((s) => s.productId === productId);
    if (!slot) return;
    const gridEl = (e.currentTarget as HTMLElement).closest("[data-grid]") as HTMLElement | null;
    const cellW = gridEl ? (gridEl.offsetWidth - (baseCols - 1) * 10) / baseCols : 140;
    resizeRef.current = {
      productId, scope,
      startX: e.clientX, startY: e.clientY,
      origSpanW: slot.spanW ?? 1, origSpanH: slot.spanH ?? 1,
      cellW, cellH: 130,
    };
  }

  // Close fly-out on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  async function handleProductClick(product: Product) {
    if (!currentShift) return;
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

  // ── Compute products for each view ──────────────────────────────────────────

  const activeProducts = products.filter((p) => p.active);

  function getProductsForCategory(catId: string) {
    return sortProducts(activeProducts.filter((p) => p.categoryId === catId), sortBy);
  }

  function getGroupedProducts(): Array<{ label: string; color: string | null; products: Product[] }> {
    if (viewMode === "grouped_category") {
      return categories
        .filter((c) => activeProducts.some((p) => p.categoryId === c.id))
        .map((c) => ({
          label: c.name,
          color: c.color,
          products: sortProducts(activeProducts.filter((p) => p.categoryId === c.id), sortBy),
        }));
    }
    if (viewMode === "grouped_center") {
      const groups: Array<{ label: string; color: string | null; products: Product[] }> = [];
      productionCenters.forEach((pc) => {
        const ps = sortProducts(activeProducts.filter((p) => p.productionCenterId === pc.id), sortBy);
        if (ps.length > 0) groups.push({ label: pc.name, color: pc.color, products: ps });
      });
      const unassigned = sortProducts(activeProducts.filter((p) => !p.productionCenterId), sortBy);
      if (unassigned.length > 0) groups.push({ label: "Senza centro", color: null, products: unassigned });
      return groups;
    }
    if (viewMode === "grouped_color") {
      const colorSet = [...new Set(activeProducts.map((p) => p.color ?? ""))];
      return colorSet.map((color) => ({
        label: color || "Senza colore",
        color: color || null,
        products: sortProducts(activeProducts.filter((p) => (p.color ?? "") === color), sortBy),
      }));
    }
    return [];
  }

  const isGrouped = viewMode === "grouped_category" || viewMode === "grouped_center" || viewMode === "grouped_color";
  const showSidebar = viewMode === "category";

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", position: "relative", flexDirection: "column" }}>
      {configuratorProduct && (
        <ProductConfigurator
          product={configuratorProduct}
          onClose={() => setConfiguratorProduct(null)}
        />
      )}

      {/* No-shift overlay */}
      {!currentShift && (
        <div style={{
          position: "absolute",
          top: 0, bottom: 0, left: showSidebar ? "72px" : 0, right: 0,
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
              display: "flex", alignItems: "center", gap: "8px",
              boxShadow: "0 4px 16px rgba(48,107,52,0.35)",
            }}
          >
            <ClockIcon style={{ width: "18px", height: "18px" }} />
            Apri turno
          </button>
        </div>
      )}

      {/* Main body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar — only in category view */}
        {showSidebar && (
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
                        width: "100%", display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", gap: "4px",
                        padding: "10px 4px", borderRadius: "10px", border: "none",
                        background: active ? accent : "transparent",
                        cursor: "pointer", transition: "background var(--transition)",
                        minHeight: "64px", fontFamily: "var(--font)",
                      }}
                    >
                      <TagIcon style={{ width: "20px", height: "20px", color: active ? "var(--color-white)" : (cat.color ?? "var(--color-gray-400)"), flexShrink: 0 }} />
                      <span style={{ fontSize: "10px", fontWeight: 700, color: active ? "var(--color-white)" : "var(--color-gray-500)", textAlign: "center", lineHeight: 1.2, wordBreak: "break-word", hyphens: "auto" }}>
                        {cat.name}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div style={{ height: "1px", background: "var(--color-gray-200)", margin: "0 10px" }} />

            <div style={{ padding: "8px 6px" }}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                style={{
                  width: "100%", display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: "4px",
                  padding: "10px 4px", borderRadius: "10px", border: "none",
                  background: menuOpen ? "rgba(48,107,52,0.1)" : "transparent",
                  cursor: "pointer", minHeight: "56px", fontFamily: "var(--font)",
                }}
              >
                <Bars3Icon style={{ width: "22px", height: "22px", color: menuOpen ? "var(--color-brand)" : "var(--color-gray-400)" }} />
                <span style={{ fontSize: "10px", fontWeight: 700, color: menuOpen ? "var(--color-brand)" : "var(--color-gray-500)" }}>Menu</span>
              </button>
            </div>

            {menuOpen && (
              <div style={{
                position: "absolute", left: "72px", bottom: "8px",
                background: "var(--color-white)", borderRadius: "12px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.14)", border: "1px solid var(--color-gray-200)",
                minWidth: "200px", overflow: "hidden", zIndex: 70,
              }}>
                {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item, i, arr) => {
                  const active = location.pathname === item.path;
                  const { Icon } = item;
                  return (
                    <button
                      key={item.path}
                      onClick={() => { navigate(item.path); setMenuOpen(false); }}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: "12px",
                        padding: "13px 16px", border: "none",
                        borderBottom: i < arr.length - 1 ? "1px solid var(--color-gray-100)" : "none",
                        background: active ? "rgba(48,107,52,0.06)" : "var(--color-white)",
                        cursor: "pointer", fontFamily: "var(--font)", textAlign: "left",
                      }}
                    >
                      <Icon style={{ width: "18px", height: "18px", color: active ? "var(--color-brand)" : "var(--color-gray-500)", flexShrink: 0 }} />
                      <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: active ? "var(--color-brand)" : "var(--color-gray-700)" }}>{item.label}</span>
                      {active && <span style={{ marginLeft: "auto", width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-brand)", flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Content area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Edit mode banner */}
          {editMode && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 16px", flexShrink: 0,
              background: "rgba(48,107,52,0.08)",
              borderBottom: "1px solid var(--color-brand)",
            }}>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-brand)" }}>
                Modalità modifica layout — trascina le card, ridimensiona dall'angolo in basso a destra
              </span>
              <button
                onClick={() => setEditMode(false)}
                style={{
                  padding: "6px 16px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--color-brand)",
                  background: "var(--color-brand)", color: "var(--color-white)",
                  fontSize: "var(--text-sm)", fontWeight: 700, fontFamily: "var(--font)", cursor: "pointer",
                }}
              >
                Fine modifica
              </button>
            </div>
          )}

          <div className="scrollable" style={{ flex: 1, overflowY: "auto", padding: "var(--sp-md)" }} data-grid>

            {/* Category view */}
            {viewMode === "category" && activeCategoryId && (() => {
              const scope = `category:${activeCategoryId}`;
              const catProducts = getProductsForCategory(activeCategoryId);
              const slots = layouts[scope] ?? [];
              if (catProducts.length === 0) {
                return (
                  <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--color-gray-400)", fontSize: "var(--text-sm)" }}>
                    Nessun prodotto in questa categoria
                  </div>
                );
              }
              return (
                <GridArea
                  products={catProducts}
                  slots={slots}
                  scope={scope}
                  baseCols={baseCols}
                  editMode={editMode}
                  locked={!currentShift}
                  showPrice={showPrice}
                  showDescription={showDescription}
                  onProductClick={(p) => void handleProductClick(p)}
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  onResizeStart={handleResizeStart}
                />
              );
            })()}

            {/* All view */}
            {viewMode === "all" && (
              <GridArea
                products={sortProducts(activeProducts, sortBy)}
                slots={layouts["global"] ?? []}
                scope="global"
                baseCols={baseCols}
                editMode={editMode}
                locked={!currentShift}
                showPrice={showPrice}
                showDescription={showDescription}
                onProductClick={(p) => void handleProductClick(p)}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
                onResizeStart={handleResizeStart}
              />
            )}

            {/* Grouped views */}
            {isGrouped && getGroupedProducts().map((group) => (
              <div key={group.label} style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  {group.color && (
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: group.color, flexShrink: 0 }} />
                  )}
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-gray-600)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {group.label}
                  </span>
                  <div style={{ flex: 1, height: 1, background: "var(--color-gray-200)" }} />
                </div>
                <GridArea
                  products={group.products}
                  slots={[]}
                  scope={`group:${group.label}`}
                  baseCols={baseCols}
                  editMode={false}
                  locked={!currentShift}
                  showPrice={showPrice}
                  showDescription={showDescription}
                  onProductClick={(p) => void handleProductClick(p)}
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  onResizeStart={handleResizeStart}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
