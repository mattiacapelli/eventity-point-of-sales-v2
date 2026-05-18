import type { Order, CreateOrderInput, UpdateOrderInput } from "../models/order.js";
import type { Payment, CreatePaymentInput } from "../models/payment.js";

export interface PlatformEventMap {
  // Order lifecycle — command event: any module may request a transition; OrderService is the sole executor
  ORDER_STATUS_REQUESTED: {
    readonly traceId: string;
    readonly orderId: string;
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
    readonly timestamp: Date;
  };
  ORDER_CANCELLED: {
    readonly traceId: string;
    readonly orderId: string;
    readonly reason?: string;
    readonly timestamp: Date;
  };

  // Payment lifecycle
  PAYMENT_COMPLETED: {
    readonly traceId: string;
    readonly payment: Payment;
    readonly input: CreatePaymentInput;
    readonly timestamp: Date;
  };
  PAYMENT_FAILED: {
    readonly traceId: string;
    readonly orderId: string;
    readonly reason: string;
    readonly timestamp: Date;
  };

  // Auth
  USER_LOGGED_IN: {
    readonly traceId: string;
    readonly userId: string;
    readonly role: string;
    readonly timestamp: Date;
  };
  USER_LOGGED_OUT: {
    readonly traceId: string;
    readonly userId: string;
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
}

export type PlatformEventName = keyof PlatformEventMap;
export type PlatformEventPayload<K extends PlatformEventName> = PlatformEventMap[K];
