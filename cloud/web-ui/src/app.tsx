import { useCallback, useEffect, useState } from "react";
import { useOrderStore } from "./state/order-store.js";
import { fetchMenu, createOrder, getTenantSlug, API_BASE, type MenuResponse } from "./core/api-client.js";
import { InfoScreen } from "./screens/InfoScreen.js";
import { MenuScreen } from "./screens/MenuScreen.js";
import { ReviewScreen } from "./screens/ReviewScreen.js";
import { ConfirmedScreen } from "./screens/ConfirmedScreen.js";
import { Button } from "./components/Button.js";

export function App() {
  const { screen, info, cart, orderCode, qrPayload, setInfo, goTo, setQuantity, addItemWithOptions, setOrderResult, resetOrder, pruneCart } = useOrderStore();
  const [menu, setMenu] = useState<MenuResponse | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const slug = getTenantSlug();

  const loadMenu = useCallback(() => {
    if (!slug) {
      setMenuError("Nessun locale specificato nel link. Scansiona il QR sul tavolo.");
      return;
    }
    setMenuError(null);
    fetchMenu(slug)
      .then((m) => {
        setMenu(m);
        pruneCart(new Set(m.products.map((p) => p.id)));
        const root = document.documentElement.style;
        if (m.tenant.colorBrand) root.setProperty("--color-brand", m.tenant.colorBrand);
        if (m.tenant.colorAccent) root.setProperty("--color-accent", m.tenant.colorAccent);
      })
      .catch((err) => setMenuError(err instanceof Error ? err.message : "Errore nel caricamento del menu"))
      .finally(() => setRetrying(false));
  }, [slug]);

  useEffect(() => { loadMenu(); }, [loadMenu]);

  if (menuError) {
    return (
      <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: "var(--sp-md)", alignItems: "center", justifyContent: "center", padding: "var(--sp-xl)", textAlign: "center", color: "var(--color-gray-500)" }}>
        <div>{menuError}</div>
        {slug && (
          <Button
            variant="outline"
            style={{ width: "auto", padding: "10px 20px" }}
            disabled={retrying}
            onClick={() => { setRetrying(true); loadMenu(); }}
          >
            {retrying ? "Riprovo..." : "Riprova"}
          </Button>
        )}
      </div>
    );
  }

  if (!menu) {
    return (
      <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", color: "var(--color-gray-400)" }}>
        Caricamento menu...
      </div>
    );
  }

  if (screen === "info") {
    return (
      <InfoScreen
        initial={info}
        logoUrl={menu.tenant.logoUrl ? `${API_BASE}${menu.tenant.logoUrl}` : null}
        onSubmit={(nextInfo) => { setInfo(nextInfo); goTo("menu"); }}
      />
    );
  }

  if (screen === "menu") {
    return (
      <MenuScreen
        categories={menu.categories}
        products={menu.products}
        info={info}
        cart={cart}
        onQuantityChange={setQuantity}
        onAddItemWithOptions={addItemWithOptions}
        onProceed={() => goTo("review")}
        onBack={() => goTo("info")}
      />
    );
  }

  if (screen === "review") {
    return (
      <ReviewScreen
        products={menu.products}
        info={info}
        cart={cart}
        onBack={() => goTo("menu")}
        onConfirm={async () => {
          const result = await createOrder(slug, {
            tableId: info.tableId,
            ...(info.customerName ? { customerName: info.customerName } : {}),
            items: cart.map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
              ...(l.selectedOptionIds.length > 0 ? { selectedOptionIds: l.selectedOptionIds } : {}),
            })),
          });
          setOrderResult(result.orderCode, result.qrPayload);
        }}
      />
    );
  }

  return (
    <ConfirmedScreen
      orderCode={orderCode ?? "—"}
      qrPayload={qrPayload ?? ""}
      onNewOrder={resetOrder}
    />
  );
}
