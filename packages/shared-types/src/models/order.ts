export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

export interface OrderItemOption {
  readonly optionId: number;
  readonly optionName: string;
  readonly priceDelta: number;
}

export interface OrderItem {
  readonly id: number;
  readonly productId: number;
  readonly name: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly vatRate?: number;
  readonly notes?: string;
  readonly options?: ReadonlyArray<OrderItemOption>;
}

export interface VatBreakdown {
  readonly rate: number;
  readonly taxable: number;
  readonly tax: number;
}

export interface Order {
  readonly id: number;
  readonly tableId?: string;
  readonly customerName?: string;
  readonly eventId?: string;
  readonly shiftId?: number;
  readonly terminalId?: number;
  readonly status: OrderStatus;
  readonly items: ReadonlyArray<OrderItem>;
  readonly totalAmount: number;
  readonly discountAmount: number;
  readonly discountType?: string;
  readonly notes?: string;
  readonly pax?: number;
  readonly receiptNumber?: number;
  readonly fiscalDocNumber?: string;
  readonly fiscalDocDate?: string;
  readonly fiscalRtSerial?: string;
  readonly vatBreakdown?: ReadonlyArray<VatBreakdown>;
  readonly centerNumbers?: Record<number, number>;
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
  readonly productId: number;
  readonly name: string;
  readonly quantity: number;
  readonly selectedOptionIds?: ReadonlyArray<number>;
  readonly notes?: string;
}

export interface CreateOrderInput {
  readonly tableId?: string;
  readonly eventId?: string;
  readonly shiftId?: number;
  readonly terminalId?: number;
  readonly notes?: string;
  readonly discountAmount?: number;
  readonly discountType?: string;
  readonly pax?: number;
  readonly items: ReadonlyArray<CreateOrderItemInput>;
}

export interface UpdateOrderInput {
  readonly id: number;
  readonly status?: OrderStatus;
  readonly items?: ReadonlyArray<Omit<OrderItem, "id">>;
  readonly tableId?: string | null;
  readonly customerName?: string | null;
}
