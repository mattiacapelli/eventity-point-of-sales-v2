export type PaymentMethod = "cash" | "card" | "digital_wallet" | "tab";
export type PaymentStatus = "pending" | "completed" | "failed" | "refunded";

export interface Payment {
  readonly id: string;
  readonly orderId: string;
  readonly method: PaymentMethod;
  readonly status: PaymentStatus;
  readonly amount: number;
  readonly currency: string;
  readonly reference?: string;
  readonly createdAt: Date;
  readonly syncedAt?: Date;
}

export interface CreatePaymentInput {
  readonly orderId: string;
  readonly method: PaymentMethod;
  readonly amount: number;
  readonly currency?: string;
  readonly reference?: string;
  readonly terminalId?: string;
}
