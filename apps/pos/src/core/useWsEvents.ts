import { useEffect } from "react";
import { wsClient } from "./ws-client.js";
import { useStore } from "../state/global-store.js";
import { useShiftStore } from "../state/shift-store.js";
import { adminApi } from "./admin-api.js";
import { useToastStore } from "../components/ui/Toast.js";

export function useWsEvents() {
  const upsertOrder       = useStore((s) => s.upsertOrder);
  const removeOrder       = useStore((s) => s.removeOrder);
  const checkoutOrder     = useStore((s) => s.checkoutOrder);
  const setCheckoutOrder  = useStore((s) => s.setCheckoutOrder);
  const clearCart         = useStore((s) => s.clearCart);
  const setCurrentShift   = useShiftStore((s) => s.setCurrentShift);

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
      // Refresh shift totals from server — they are updated server-side on ORDER_UPDATED completed
      adminApi.shifts.current().then(setCurrentShift).catch(() => {});
    });
    const unsub5 = wsClient.on("PRINTER_OFFLINE", (p) => {
      useToastStore.getState().show(`Stampante "${p.printerName}" non raggiungibile`, "error");
    });

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
  }, [upsertOrder, removeOrder, checkoutOrder, setCheckoutOrder, clearCart, setCurrentShift]);
}
