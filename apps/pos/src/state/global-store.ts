import { create } from "zustand";
import type { Order } from "@pos/shared-types";

const CART_STORAGE_KEY = "pos_cart_v1";

function loadPersistedCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CartItem[];
  } catch {
    return [];
  }
}

function persistCart(cart: CartItem[]): void {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch { /* ignore quota errors */ }
}

export type WsStatus = "connecting" | "connected" | "disconnected";

interface Session {
  readonly token: string;
  readonly userId: string;
  readonly role: string;
  readonly username: string;
}

export interface SelectedOption {
  readonly optionId: string;
  readonly optionGroupId: string;
  readonly name: string;
  readonly priceDelta: number;
  readonly prefix: "+" | "-" | ">>";
  readonly isRemoval: boolean;
}

export interface CartItem {
  readonly cartKey: string;       // productId + options fingerprint — unique per configuration
  readonly productId: string;
  readonly name: string;
  readonly unitPrice: number;     // base price
  readonly finalPrice: number;    // unitPrice + sum(priceDelta)
  readonly selectedOptions: SelectedOption[];
  quantity: number;
  notes?: string;
}

interface GlobalState {
  // Auth
  session: Session | null;
  setSession: (session: Session | null) => void;

  // Orders (live from WebSocket + API)
  orders: Order[];
  setOrders: (orders: Order[]) => void;
  upsertOrder: (order: Order) => void;
  removeOrder: (id: string) => void;

  // Cart (sales module)
  cart: CartItem[];
  addToCart: (item: {
    productId: string;
    name: string;
    unitPrice: number;
    selectedOptions?: SelectedOption[];
    quantity?: number;
    notes?: string;
  }) => void;
  updateCartQty: (cartKey: string, quantity: number) => void;
  updateItemNotes: (cartKey: string, notes: string) => void;
  removeFromCart: (cartKey: string) => void;
  clearCart: () => void;
  cartTotal: () => number;

  // Checkout flow: order created, waiting for payment
  checkoutOrder: Order | null;
  setCheckoutOrder: (order: Order | null) => void;

  // Table/customer name prefilled by a QR scan, read as a fallback by CheckoutModal
  // until an actual order exists (cleared whenever the cart is cleared).
  pendingTableId: string | null;
  pendingCustomerName: string | null;
  setPendingOrderInfo: (info: { tableId: string | null; customerName: string | null }) => void;

  // True while a product configurator (variant/option picker) is open — the QR scanner
  // ignores scans in this state to avoid silently contaminating the cart mid-configuration.
  productConfiguratorOpen: boolean;
  setProductConfiguratorOpen: (open: boolean) => void;

  // WS
  wsStatus: WsStatus;
  setWsStatus: (status: WsStatus) => void;

  // Offline
  isOffline: boolean;
  setOffline: (offline: boolean) => void;

  // Multi-terminal mode (read from app settings)
  multiTerminalEnabled: boolean;
  setMultiTerminalEnabled: (enabled: boolean) => void;
}

function makeCartKey(productId: string, selectedOptions: SelectedOption[]): string {
  if (selectedOptions.length === 0) return productId;
  const sorted = [...selectedOptions].sort((a, b) => a.optionId.localeCompare(b.optionId));
  return `${productId}::${sorted.map((o) => o.optionId).join(",")}`;
}

export const useStore = create<GlobalState>((set, get) => ({
  session: null,
  setSession: (session) => {
    // Clear cart on every session change (login or logout) to prevent cart data
    // from leaking between different users on the same device.
    persistCart([]);
    set({ session, cart: [] });
  },

  orders: [],
  setOrders: (orders) => set({ orders }),
  upsertOrder: (order) =>
    set((s) => {
      const idx = s.orders.findIndex((o) => o.id === order.id);
      if (idx === -1) return { orders: [order, ...s.orders] };
      const next = [...s.orders];
      next[idx] = order;
      return { orders: next };
    }),
  removeOrder: (id) =>
    set((s) => ({ orders: s.orders.filter((o) => o.id !== id) })),

  cart: [],
  addToCart: (item) =>
    set((s) => {
      const opts = item.selectedOptions ?? [];
      const cartKey = makeCartKey(item.productId, opts);
      const priceDelta = opts.reduce((sum, o) => sum + o.priceDelta, 0);
      const finalPrice = item.unitPrice + priceDelta;
      const existing = s.cart.find((c) => c.cartKey === cartKey);
      let nextCart: CartItem[];
      if (existing) {
        nextCart = s.cart.map((c) =>
          c.cartKey === cartKey
            ? { ...c, quantity: c.quantity + (item.quantity ?? 1) }
            : c,
        );
      } else {
        const newItem: CartItem = {
          cartKey,
          productId: item.productId,
          name: item.name,
          unitPrice: item.unitPrice,
          finalPrice,
          selectedOptions: opts,
          quantity: item.quantity ?? 1,
          ...(item.notes !== undefined ? { notes: item.notes } : {}),
        };
        nextCart = [...s.cart, newItem];
      }
      persistCart(nextCart);
      return { cart: nextCart };
    }),
  updateCartQty: (cartKey, quantity) =>
    set((s) => {
      const nextCart = quantity <= 0
        ? s.cart.filter((c) => c.cartKey !== cartKey)
        : s.cart.map((c) => (c.cartKey === cartKey ? { ...c, quantity } : c));
      persistCart(nextCart);
      return { cart: nextCart };
    }),
  updateItemNotes: (cartKey, notes) =>
    set((s) => {
      const trimmed = notes.trim();
      const nextCart = s.cart.map((c): CartItem => {
        if (c.cartKey !== cartKey) return c;
        const { notes: _n, ...rest } = c;
        return trimmed ? { ...rest, notes: trimmed } : { ...rest };
      });
      persistCart(nextCart);
      return { cart: nextCart };
    }),
  removeFromCart: (cartKey) =>
    set((s) => {
      const nextCart = s.cart.filter((c) => c.cartKey !== cartKey);
      persistCart(nextCart);
      return { cart: nextCart };
    }),
  clearCart: () => { persistCart([]); set({ cart: [], pendingTableId: null, pendingCustomerName: null }); },
  cartTotal: () =>
    get().cart.reduce((sum, item) => sum + item.finalPrice * item.quantity, 0),

  checkoutOrder: null,
  setCheckoutOrder: (checkoutOrder) => set({ checkoutOrder }),

  pendingTableId: null,
  pendingCustomerName: null,
  setPendingOrderInfo: ({ tableId, customerName }) => set({ pendingTableId: tableId, pendingCustomerName: customerName }),

  productConfiguratorOpen: false,
  setProductConfiguratorOpen: (productConfiguratorOpen) => set({ productConfiguratorOpen }),

  wsStatus: "disconnected",
  setWsStatus: (wsStatus) => set({ wsStatus }),

  isOffline: !navigator.onLine,
  setOffline: (isOffline) => set({ isOffline }),

  multiTerminalEnabled: false,
  setMultiTerminalEnabled: (multiTerminalEnabled) => set({ multiTerminalEnabled }),
}));
