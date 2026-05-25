import { randomUUID } from "node:crypto";
import type { EventBus } from "@pos/event-bus";
import type { Payment, CreatePaymentInput } from "@pos/shared-types";
import { eq, orders } from "@pos/db";
import type { PaymentRepository } from "../repository/payment.repository.js";
import type { DbClient } from "@pos/db";

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
    private readonly db: DbClient,
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

    // Validate amount matches order total (tolerance ±0.01 for floating point)
    const [orderRow] = await this.db.select({ totalAmount: orders.totalAmount, status: orders.status })
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1);

    if (!orderRow) {
      throw new PaymentError(`Order ${input.orderId} not found`);
    }
    if (orderRow.status === "completed" || orderRow.status === "cancelled") {
      throw new PaymentError(`Order is already ${orderRow.status}`);
    }
    if (Math.abs(input.amount - orderRow.totalAmount) > 0.01) {
      throw new PaymentError(
        `Payment amount €${input.amount.toFixed(2)} does not match order total €${orderRow.totalAmount.toFixed(2)}`
      );
    }

    const payment = await this.repo.create(input);

    this.eventBus.emit("PAYMENT_COMPLETED", {
      traceId: randomUUID(),
      payment,
      input,
      ...(input.terminalId !== undefined ? { terminalId: input.terminalId } : {}),
      timestamp: new Date(),
    });

    return payment;
  }

  async getPaymentsForOrder(orderId: string): Promise<Payment[]> {
    return this.repo.findByOrderId(orderId);
  }

  async refund(paymentId: string, reason?: string): Promise<Payment> {
    const payment = await this.repo.findById(paymentId);
    if (!payment) throw new PaymentError(`Payment ${paymentId} not found`);
    if (payment.status !== "completed") {
      throw new PaymentError(`Cannot refund a payment with status "${payment.status}"`);
    }

    const updated = await this.repo.updateStatus(paymentId, "refunded");
    if (!updated) throw new PaymentError(`Payment ${paymentId} not found after update`);

    this.eventBus.emit("PAYMENT_REFUNDED", {
      traceId: randomUUID(),
      paymentId,
      orderId: payment.orderId,
      amount: payment.amount,
      ...(reason !== undefined ? { reason } : {}),
      timestamp: new Date(),
    });

    return updated;
  }
}
