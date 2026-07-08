import { useEffect, useState } from "react";
import { useOrderStore } from "./state/order-store.js";
import { fetchMenu, createOrder, getTenantSlug, type MenuResponse } from "./core/api-client.js";
import { InfoScreen } from "./screens/InfoScreen.js";
import { MenuScreen } from "./screens/MenuScreen.js";
import { ReviewScreen } from "./screens/ReviewScreen.js";
import { ConfirmedScreen } from "./screens/ConfirmedScreen.js";

export function App() {
  const { screen, info, cart, orderCode, qrPayload, setInfo, goTo, setQuantity, addItemWithOptions, setOrderResult, resetOrder, pruneCart } = useOrderStore();
  const [menu, setMenu] = useState<MenuResponse | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const slug = getTenantSlug();

  useEffect(() => {
    if (!slug) {
      setMenuError("Nessun locale specificato nel link. Scansiona il QR sul tavolo.");
      return;
    }
    fetchMenu(slug)
      .then((m) => {
        setMenu(m);
        pruneCart(new Set(m.products.map((p) => p.id)));
      })
      .catch((err) => setMenuError(err instanceof Error ? err.message : "Errore nel caricamento del menu"));
  }, [slug]);

  if (menuError) {
    return (
      <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", padding: "var(--sp-xl)", textAlign: "center", color: "var(--color-gray-500)" }}>
        {menuError}
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
