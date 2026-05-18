import { randomUUID } from "node:crypto";
import type { EventBus } from "@pos/event-bus";
import type { Payment, CreatePaymentInput } from "@pos/shared-types";
import type { PaymentRepository } from "../repository/payment.repository.js";

export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentError";
  }
}

export class PaymentService {
  constructor(
    private readonly repo: PaymentRepository,
    private readonly eventBus: EventBus,
  ) {}

  /**
   * Records the payment and emits PAYMENT_COMPLETED.
   * Order status transition (→ completed) is handled by OrderService
   * listening to PAYMENT_COMPLETED — PaymentService never touches the orders table.
   */
  async pay(input: CreatePaymentInput): Promise<Payment> {
    if (input.amount <= 0) {
      throw new PaymentError("Payment amount must be greater than zero");
    }

    const payment = await this.repo.create(input);

    this.eventBus.emit("PAYMENT_COMPLETED", {
      traceId: randomUUID(),
      payment,
      input,
      timestamp: new Date(),
    });

    return payment;
  }

  async getPaymentsForOrder(orderId: string): Promise<Payment[]> {
    return this.repo.findByOrderId(orderId);
  }
}
