import { useCallback, useEffect, useState } from "react";
import type { CartLine, OrderInfo } from "../core/types.js";

export type Screen = "info" | "menu" | "review" | "confirmed";

interface OrderState {
  screen: Screen;
  info: OrderInfo;
  cart: CartLine[];
  orderCode: string | null;
  qrPayload: string | null;
}

const STORAGE_KEY = "epos-web-order";

const initialState: OrderState = {
  screen: "info",
  info: { tableId: "", customerName: "" },
  cart: [],
  orderCode: null,
  qrPayload: null,
};

function loadState(): OrderState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as Partial<OrderState>;
    return { ...initialState, ...parsed };
  } catch {
    return initialState;
  }
}

function saveState(state: OrderState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — ignore, order stays in-memory only */
  }
}

export function useOrderStore() {
  const [state, setState] = useState<OrderState>(loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const setInfo = useCallback((info: OrderInfo) => {
    setState((s) => ({ ...s, info }));
  }, []);

  const goTo = useCallback((screen: Screen) => {
    setState((s) => ({ ...s, screen }));
  }, []);

  function cartLineKey(productId: number, selectedOptionIds: number[]): string {
    return `${productId}::${[...selectedOptionIds].sort((a, b) => a - b).join(",")}`;
  }

  /** Simple products (no options): quantity stepper on the product card. */
  const setQuantity = useCallback((productId: number, quantity: number) => {
    setState((s) => {
      const existing = s.cart.find((l) => l.productId === productId && l.selectedOptionIds.length === 0);
      if (quantity <= 0) {
        return { ...s, cart: s.cart.filter((l) => !(l.productId === productId && l.selectedOptionIds.length === 0)) };
      }
      if (existing) {
        return {
          ...s,
          cart: s.cart.map((l) => (l.productId === productId && l.selectedOptionIds.length === 0) ? { ...l, quantity } : l),
        };
      }
      return { ...s, cart: [...s.cart, { productId, quantity, selectedOptionIds: [] }] };
    });
  }, []);

  /** Products with options: each distinct option combination is its own cart line. */
  const addItemWithOptions = useCallback((productId: number, selectedOptionIds: number[], quantity: number) => {
    setState((s) => {
      const key = cartLineKey(productId, selectedOptionIds);
      const existing = s.cart.find((l) => cartLineKey(l.productId, l.selectedOptionIds) === key);
      if (existing) {
        return {
          ...s,
          cart: s.cart.map((l) => cartLineKey(l.productId, l.selectedOptionIds) === key ? { ...l, quantity: l.quantity + quantity } : l),
        };
      }
      return { ...s, cart: [...s.cart, { productId, quantity, selectedOptionIds }] };
    });
  }, []);

  const removeCartLine = useCallback((productId: number, selectedOptionIds: number[]) => {
    setState((s) => {
      const key = cartLineKey(productId, selectedOptionIds);
      return { ...s, cart: s.cart.filter((l) => cartLineKey(l.productId, l.selectedOptionIds) !== key) };
    });
  }, []);

  const setOrderResult = useCallback((orderCode: string, qrPayload: string) => {
    setState((s) => ({ ...s, orderCode, qrPayload, screen: "confirmed" }));
  }, []);

  /** Drops cart lines referencing product ids no longer present in the fetched menu
   *  (e.g. stale session left over from a previous/mock menu, or menu re-sync). */
  const pruneCart = useCallback((validProductIds: Set<number>) => {
    setState((s) => {
      const pruned = s.cart.filter((l) => validProductIds.has(l.productId));
      if (pruned.length === s.cart.length) return s;
      return { ...s, cart: pruned };
    });
  }, []);

  const resetOrder = useCallback(() => {
    setState(initialState);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  return {
    screen: state.screen,
    info: state.info,
    cart: state.cart,
    orderCode: state.orderCode,
    qrPayload: state.qrPayload,
    setInfo,
    goTo,
    setQuantity,
    addItemWithOptions,
    removeCartLine,
    setOrderResult,
    resetOrder,
    pruneCart,
  };
}
