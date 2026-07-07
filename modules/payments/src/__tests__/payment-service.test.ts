import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PaymentService, PaymentError } from "../service/payment.service.js";
import { PaymentRepository } from "../repository/payment.repository.js";
import { EventBus } from "@pos/event-bus";
import { createTestDb } from "./test-db.js";
import { orders, categories, products } from "@pos/db";
import type { DbClient } from "@pos/db";
import { randomUUID } from "node:crypto";

let db: DbClient;
let cleanup: () => void;
let service: PaymentService;
let eventBus: EventBus;

beforeEach(() => {
  ({ db, cleanup } = createTestDb());
  eventBus = new EventBus();
  const repo = new PaymentRepository(db);
  service = new PaymentService(repo, eventBus, db);
});

afterEach(() => cleanup());

async function seedOrder(total: number, status: "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled" = "pending") {
  const catId = randomUUID();
  await db.insert(categories).values({ id: catId, name: "Food" });
  const prodId = randomUUID();
  await db.insert(products).values({ id: prodId, name: "Item", price: total, categoryId: catId, active: true });
  const orderId = randomUUID();
  const now = new Date();
  await db.insert(orders).values({
    id: orderId,
    status,
    totalAmount: total,
    discountAmount: 0,
    createdAt: now,
    updatedAt: now,
  });
  return orderId;
}

describe("PaymentService.pay — amount tolerance (fix 5)", () => {
  it("accepts a payment that exactly matches the order total", async () => {
    const orderId = await seedOrder(10.00);
    const payment = await service.pay({ orderId, method: "cash", amount: 10.00 });
    expect(payment.status).toBe("completed");
  });

  it("rejects a payment that is exactly 0.01 short (>= threshold now enforced)", async () => {
    const orderId = await seedOrder(100.00);
    await expect(service.pay({ orderId, method: "cash", amount: 99.99 }))
      .rejects.toThrow(PaymentError);
  });

  it("rejects a payment that is 0.02 short", async () => {
    const orderId = await seedOrder(50.00);
    await expect(service.pay({ orderId, method: "cash", amount: 49.98 }))
      .rejects.toThrow(PaymentError);
  });

  it("accepts tiny floating-point rounding within < 0.01", async () => {
    const orderId = await seedOrder(9.99);
    // 9.99 stored as float may differ by epsilon < 0.01
    const payment = await service.pay({ orderId, method: "cash", amount: 9.99 });
    expect(payment.status).toBe("completed");
  });

  it("rejects payment amount of zero", async () => {
    const orderId = await seedOrder(10.00);
    await expect(service.pay({ orderId, method: "cash", amount: 0 }))
      .rejects.toThrow(PaymentError);
  });
});

describe("PaymentService.pay — double-payment guard (fix 8)", () => {
  it("rejects a second payment for an already-paid order", async () => {
    const orderId = await seedOrder(20.00);
    await service.pay({ orderId, method: "cash", amount: 20.00 });
    await expect(service.pay({ orderId, method: "card", amount: 20.00 }))
      .rejects.toThrow(PaymentError);
  });

  it("rejects payment for a cancelled order", async () => {
    const orderId = await seedOrder(15.00, "cancelled");
    await expect(service.pay({ orderId, method: "cash", amount: 15.00 }))
      .rejects.toThrow(PaymentError);
  });

  it("rejects payment for a completed order", async () => {
    const orderId = await seedOrder(15.00, "completed");
    await expect(service.pay({ orderId, method: "cash", amount: 15.00 }))
      .rejects.toThrow(PaymentError);
  });
});

describe("PaymentService.refund", () => {
  it("refunds a completed payment", async () => {
    const orderId = await seedOrder(30.00);
    const payment = await service.pay({ orderId, method: "cash", amount: 30.00 });
    const refunded = await service.refund(payment.id);
    expect(refunded.status).toBe("refunded");
  });

  it("throws when refunding a non-existent payment", async () => {
    await expect(service.refund("nonexistent-id")).rejects.toThrow(PaymentError);
  });

  it("emits PAYMENT_REFUNDED event", async () => {
    const orderId = await seedOrder(30.00);
    const payment = await service.pay({ orderId, method: "cash", amount: 30.00 });
    let refundedEvent = false;
    eventBus.on("PAYMENT_REFUNDED", () => { refundedEvent = true; });
    await service.refund(payment.id);
    expect(refundedEvent).toBe(true);
  });
});
