import { useEffect } from "react";
import { wsClient } from "./ws-client.js";
import { useStore } from "../state/global-store.js";
import { useShiftStore } from "../state/shift-store.js";
import { useTerminalStore } from "../state/terminal-store.js";
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
    const refreshShift = () => {
      const tid = useTerminalStore.getState().terminalId;
      adminApi.shifts.current()
        .then((s) => setCurrentShift(s, tid))
        .catch(() => setCurrentShift(null, tid));
    };

    const unsubs = [
      wsClient.on("ORDER_CREATED",   (p) => upsertOrder(p.order)),
      wsClient.on("ORDER_UPDATED",   (p) => upsertOrder(p.order)),
      wsClient.on("ORDER_CANCELLED", (p) => removeOrder(p.orderId)),

      wsClient.on("PAYMENT_COMPLETED", (p) => {
        removeOrder(p.payment.orderId);
        if (useStore.getState().checkoutOrder?.id === p.payment.orderId) {
          setCheckoutOrder(null);
          clearCart();
        }
        refreshShift();
      }),

      // Shift lifecycle — keep every POS in sync regardless of who opened/closed
      wsClient.on("SHIFT_OPENED",  refreshShift),
      wsClient.on("SHIFT_CLOSED",  refreshShift),
      wsClient.on("SHIFT_UPDATED", refreshShift),

      // Terminal changes — if this terminal was deactivated or deleted, clear it
      wsClient.on("TERMINAL_UPDATED", (p) => {
        const { terminalId, clearTerminal } = useTerminalStore.getState();
        if (!terminalId || p.id !== terminalId) return;
        adminApi.terminals.list()
          .then((list) => {
            const still = list.find((t) => t.id === terminalId && t.active);
            if (!still) {
              clearTerminal();
              useToastStore.getState().show("Questo terminale è stato disattivato", "error");
            }
          })
          .catch(() => {});
      }),
      wsClient.on("TERMINAL_DELETED", (p) => {
        const { terminalId, clearTerminal } = useTerminalStore.getState();
        if (terminalId && p.id === terminalId) {
          clearTerminal();
          useToastStore.getState().show("Questo terminale è stato eliminato", "error");
        }
      }),

      wsClient.on("PRINTER_OFFLINE", (p) => {
        useToastStore.getState().show(`Stampante "${p.printerName}" non raggiungibile`, "error");
      }),
    ];

    return () => { for (const u of unsubs) u(); };
  }, [upsertOrder, removeOrder, checkoutOrder, setCheckoutOrder, clearCart, setCurrentShift]);
}
