export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

export interface OrderItem {
  readonly id: string;
  readonly productId: string;
  readonly name: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly notes?: string;
}

export interface Order {
  readonly id: string;
  readonly tableId?: string;
  readonly eventId?: string;
  readonly status: OrderStatus;
  readonly items: ReadonlyArray<OrderItem>;
  readonly totalAmount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly syncedAt?: Date;
}

/** Single source of truth for legal status transitions. */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, ReadonlyArray<OrderStatus>> = {
  pending:   ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready:     ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export interface CreateOrderItemInput {
  readonly productId: string;
  readonly name: string;
  readonly quantity: number;
  readonly selectedOptionIds?: ReadonlyArray<string>;
  readonly notes?: string;
}

export interface CreateOrderInput {
  readonly tableId?: string;
  readonly eventId?: string;
  readonly items: ReadonlyArray<CreateOrderItemInput>;
}

export interface UpdateOrderInput {
  readonly id: string;
  readonly status?: OrderStatus;
  readonly items?: ReadonlyArray<Omit<OrderItem, "id">>;
}
