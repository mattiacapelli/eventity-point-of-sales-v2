export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

export interface OrderItemOption {
  readonly optionId: string;
  readonly optionName: string;
  readonly priceDelta: number;
}

export interface OrderItem {
  readonly id: string;
  readonly productId: string;
  readonly name: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly notes?: string;
  readonly options?: ReadonlyArray<OrderItemOption>;
}

export interface Order {
  readonly id: string;
  readonly tableId?: string;
  readonly eventId?: string;
  readonly shiftId?: string;
  readonly status: OrderStatus;
  readonly items: ReadonlyArray<OrderItem>;
  readonly totalAmount: number;
  readonly discountAmount: number;
  readonly discountType?: string;
  readonly notes?: string;
  readonly pax?: number;
  readonly receiptNumber?: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly syncedAt?: Date;
}

/** Single source of truth for legal status transitions. */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, ReadonlyArray<OrderStatus>> = {
  pending:   ["confirmed", "completed", "cancelled"],
  confirmed: ["preparing", "completed", "cancelled"],
  preparing: ["ready",     "completed", "cancelled"],
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
  readonly shiftId?: string;
  readonly notes?: string;
  readonly discountAmount?: number;
  readonly discountType?: string;
  readonly pax?: number;
  readonly items: ReadonlyArray<CreateOrderItemInput>;
}

export interface UpdateOrderInput {
  readonly id: string;
  readonly status?: OrderStatus;
  readonly items?: ReadonlyArray<Omit<OrderItem, "id">>;
}
