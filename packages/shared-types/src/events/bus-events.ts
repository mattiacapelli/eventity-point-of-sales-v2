import type { Order, CreateOrderInput, UpdateOrderInput } from "../models/order.js";
import type { Payment, CreatePaymentInput } from "../models/payment.js";

export interface PlatformEventMap {
  // Order lifecycle — command event: any module may request a transition; OrderService is the sole executor
  ORDER_STATUS_REQUESTED: {
    readonly traceId: string;
    readonly orderId: number;
    readonly newStatus: Order["status"];
    readonly requestedBy: string; // module name
    readonly timestamp: Date;
  };

  ORDER_CREATED: {
    readonly traceId: string;
    readonly order: Order;
    readonly input: CreateOrderInput;
    readonly timestamp: Date;
  };
  ORDER_UPDATED: {
    readonly traceId: string;
    readonly order: Order;
    readonly input: UpdateOrderInput;
    readonly previousStatus: Order["status"];
    readonly itemsChanged?: boolean;
    readonly timestamp: Date;
  };
  ORDER_CANCELLED: {
    readonly traceId: string;
    readonly orderId: number;
    readonly reason?: string;
    readonly timestamp: Date;
  };

  // Payment lifecycle
  PAYMENT_COMPLETED: {
    readonly traceId: string;
    readonly payment: Payment;
    readonly input: CreatePaymentInput;
    readonly terminalId?: number;
    readonly timestamp: Date;
  };
  PAYMENT_FAILED: {
    readonly traceId: string;
    readonly orderId: number;
    readonly reason: string;
    readonly timestamp: Date;
  };
  PAYMENT_REFUNDED: {
    readonly traceId: string;
    readonly paymentId: number;
    readonly orderId: number;
    readonly amount: number;
    readonly reason?: string;
    readonly timestamp: Date;
  };

  // Auth
  USER_LOGGED_IN: {
    readonly traceId: string;
    readonly userId: number;
    readonly role: string;
    readonly timestamp: Date;
  };
  USER_LOGGED_OUT: {
    readonly traceId: string;
    readonly userId: number;
    readonly timestamp: Date;
  };

  // Print jobs
  PRINT_JOB_QUEUED: {
    readonly traceId: string;
    readonly jobId: string;
    readonly type: "receipt" | "kitchen_ticket" | "report";
    readonly payload: unknown;
    readonly timestamp: Date;
  };

  // Sync
  SYNC_STARTED: { readonly traceId: string; readonly timestamp: Date };
  SYNC_COMPLETED: {
    readonly traceId: string;
    readonly syncedAt: Date;
    readonly recordsSynced: number;
  };
  SYNC_FAILED: {
    readonly traceId: string;
    readonly reason: string;
    readonly timestamp: Date;
  };

  // Module lifecycle
  MODULE_REGISTERED: {
    readonly moduleName: string;
    readonly version: string;
    readonly timestamp: Date;
  };
  MODULE_STARTED: {
    readonly moduleName: string;
    readonly timestamp: Date;
  };
  MODULE_ERROR: {
    readonly moduleName: string;
    readonly error: string;
    readonly timestamp: Date;
  };
  MODULE_STATE_CHANGED: {
    readonly traceId: string;
    readonly moduleName: string;
    readonly enabled: boolean;
    readonly timestamp: Date;
  };

  // Inventory
  INVENTORY_UPDATED: {
    readonly traceId: string;
    readonly itemId: number;
    readonly movementType: string;
    readonly quantity: number;
    readonly timestamp: Date;
  };
  LOW_STOCK_ALERT: {
    readonly traceId: string;
    readonly itemId: number;
    readonly itemName: string;
    readonly currentStock: number;
    readonly minStock: number;
    readonly timestamp: Date;
  };

  // Catalog — category
  CATEGORY_CREATED: { readonly traceId: string; readonly id: number; readonly timestamp: Date };
  CATEGORY_UPDATED: { readonly traceId: string; readonly id: number; readonly timestamp: Date };
  CATEGORY_DELETED: { readonly traceId: string; readonly id: number; readonly timestamp: Date };

  // Catalog — product
  PRODUCT_CREATED: { readonly traceId: string; readonly id: number; readonly timestamp: Date };
  PRODUCT_UPDATED: { readonly traceId: string; readonly id: number; readonly timestamp: Date };
  PRODUCT_DELETED: { readonly traceId: string; readonly id: number; readonly timestamp: Date };

  // Catalog — production center
  PRODUCTION_CENTER_CREATED: { readonly traceId: string; readonly id: number; readonly timestamp: Date };
  PRODUCTION_CENTER_UPDATED: { readonly traceId: string; readonly id: number; readonly timestamp: Date };
  PRODUCTION_CENTER_DELETED: { readonly traceId: string; readonly id: number; readonly timestamp: Date };

  // Catalog — option groups / options
  OPTION_GROUP_CREATED: { readonly traceId: string; readonly id: number; readonly productId: number; readonly timestamp: Date };
  OPTION_GROUP_UPDATED: { readonly traceId: string; readonly id: number; readonly productId: number; readonly timestamp: Date };
  OPTION_GROUP_DELETED: { readonly traceId: string; readonly id: number; readonly productId: number; readonly timestamp: Date };
  OPTION_CREATED: { readonly traceId: string; readonly id: number; readonly optionGroupId: number; readonly timestamp: Date };
  OPTION_UPDATED: { readonly traceId: string; readonly id: number; readonly optionGroupId: number; readonly timestamp: Date };
  OPTION_DELETED: { readonly traceId: string; readonly id: number; readonly optionGroupId: number; readonly timestamp: Date };

  // Payment methods
  PAYMENT_METHOD_CREATED: { readonly traceId: string; readonly id: string; readonly timestamp: Date };
  PAYMENT_METHOD_UPDATED: { readonly traceId: string; readonly id: string; readonly timestamp: Date };
  PAYMENT_METHOD_DELETED: { readonly traceId: string; readonly id: string; readonly timestamp: Date };

  // Printers
  PRINTER_CREATED: { readonly traceId: string; readonly id: number; readonly timestamp: Date };
  PRINTER_UPDATED: { readonly traceId: string; readonly id: number; readonly timestamp: Date };
  PRINTER_DELETED: { readonly traceId: string; readonly id: number; readonly timestamp: Date };
  PRINTER_OFFLINE: {
    readonly traceId: string;
    readonly printerId: number;
    readonly printerName: string;
    readonly reason: string;
    readonly timestamp: Date;
  };

  // Terminals
  TERMINAL_CREATED: { readonly traceId: string; readonly id: number; readonly timestamp: Date };
  TERMINAL_UPDATED: { readonly traceId: string; readonly id: number; readonly timestamp: Date };
  TERMINAL_DELETED: { readonly traceId: string; readonly id: number; readonly timestamp: Date };

  // Shifts
  SHIFT_OPENED: { readonly traceId: string; readonly shiftId: number; readonly userId: number; readonly timestamp: Date };
  SHIFT_CLOSED: { readonly traceId: string; readonly shiftId: number; readonly timestamp: Date };
  SHIFT_UPDATED: { readonly traceId: string; readonly shiftId: number; readonly timestamp: Date };
}

export type PlatformEventName = keyof PlatformEventMap;
export type PlatformEventPayload<K extends PlatformEventName> = PlatformEventMap[K];
