import { useEffect } from "react";
import { wsClient } from "./ws-client.js";
import { useStore } from "../state/global-store.js";

export function useWsEvents() {
  const upsertOrder       = useStore((s) => s.upsertOrder);
  const removeOrder       = useStore((s) => s.removeOrder);
  const checkoutOrder     = useStore((s) => s.checkoutOrder);
  const setCheckoutOrder  = useStore((s) => s.setCheckoutOrder);
  const clearCart         = useStore((s) => s.clearCart);

  useEffect(() => {
    const unsub1 = wsClient.on("ORDER_CREATED",   (p) => upsertOrder(p.order));
    const unsub2 = wsClient.on("ORDER_UPDATED",   (p) => upsertOrder(p.order));
    const unsub3 = wsClient.on("ORDER_CANCELLED", (p) => removeOrder(p.orderId));
    const unsub4 = wsClient.on("PAYMENT_COMPLETED", (p) => {
      removeOrder(p.payment.orderId);
      if (checkoutOrder?.id === p.payment.orderId) {
        setCheckoutOrder(null);
        clearCart();
      }
    });

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [upsertOrder, removeOrder, checkoutOrder, setCheckoutOrder, clearCart]);
}
