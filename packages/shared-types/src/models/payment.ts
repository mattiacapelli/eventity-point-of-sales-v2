export type PaymentMethod = string;
export type PaymentStatus = "pending" | "completed" | "failed" | "refunded";

export interface Payment {
  readonly id: number;
  readonly orderId: number;
  readonly method: PaymentMethod;
  readonly status: PaymentStatus;
  readonly amount: number;
  readonly currency: string;
  readonly reference?: string;
  readonly createdAt: Date;
  readonly syncedAt?: Date;
}

export interface CreatePaymentInput {
  readonly orderId: number;
  readonly method: PaymentMethod;
  readonly amount: number;
  readonly currency?: string;
  readonly reference?: string;
  readonly terminalId?: number;
}
