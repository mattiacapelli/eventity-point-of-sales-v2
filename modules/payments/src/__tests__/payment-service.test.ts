import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PaymentService, PaymentError } from "../service/payment.service.js";
import { PaymentRepository } from "../repository/payment.repository.js";
import { EventBus } from "@pos/event-bus";
import { createTestDb } from "./test-db.js";
import { orders } from "@pos/db";
import type { DbClient } from "@pos/db";

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

// ── Seed helper ───────────────────────────────────────────────────────────────
// paymentMethods sono già inseriti da runMigrations (cash, card, digital_wallet, tab)
// Non servono categorie/prodotti per testare i pagamenti

async function seedOrder(
  total: number,
  status: "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled" = "pending",
) {
  const now = new Date();
  const [ord] = await db.insert(orders).values({
    status,
    totalAmount: total,
    discountAmount: 0,
    createdAt: now,
    updatedAt: now,
  }).returning({ id: orders.id });
  return ord!.id; // number
}

// ── PaymentService.pay — tolleranza importo ───────────────────────────────────

describe("PaymentService.pay — amount tolerance", () => {
  it("accetta pagamento che corrisponde esattamente al totale ordine", async () => {
    const orderId = await seedOrder(10.00);
    const payment = await service.pay({ orderId, method: "cash", amount: 10.00 });
    expect(payment.status).toBe("completed");
    expect(payment.orderId).toBe(orderId);
    expect(payment.amount).toBeCloseTo(10.00);
    expect(payment.method).toBe("cash");
  });

  it("rifiuta pagamento di 0.01 in meno (soglia >= 0.01 applicata)", async () => {
    const orderId = await seedOrder(100.00);
    await expect(service.pay({ orderId, method: "cash", amount: 99.99 })).rejects.toThrow(PaymentError);
  });

  it("rifiuta pagamento di 0.02 in meno", async () => {
    const orderId = await seedOrder(50.00);
    await expect(service.pay({ orderId, method: "cash", amount: 49.98 })).rejects.toThrow(PaymentError);
  });

  it("accetta piccole differenze floating-point < 0.01", async () => {
    const orderId = await seedOrder(9.99);
    const payment = await service.pay({ orderId, method: "cash", amount: 9.99 });
    expect(payment.status).toBe("completed");
  });

  it("rifiuta importo zero", async () => {
    const orderId = await seedOrder(10.00);
    await expect(service.pay({ orderId, method: "cash", amount: 0 })).rejects.toThrow(PaymentError);
  });

  it("rifiuta importo negativo", async () => {
    const orderId = await seedOrder(10.00);
    await expect(service.pay({ orderId, method: "cash", amount: -5 })).rejects.toThrow(PaymentError);
  });
});

// ── PaymentService.pay — metodi di pagamento ─────────────────────────────────

describe("PaymentService.pay — payment methods", () => {
  it("pagamento con carta → status completed", async () => {
    const orderId = await seedOrder(20.00);
    const payment = await service.pay({ orderId, method: "card", amount: 20.00 });
    expect(payment.status).toBe("completed");
    expect(payment.method).toBe("card");
  });

  it("pagamento con digital_wallet → status completed", async () => {
    const orderId = await seedOrder(15.00);
    const payment = await service.pay({ orderId, method: "digital_wallet", amount: 15.00 });
    expect(payment.status).toBe("completed");
  });

  it("method inesistente → lancia PaymentError", async () => {
    const orderId = await seedOrder(10.00);
    await expect(service.pay({ orderId, method: "bitcoin" as never, amount: 10.00 })).rejects.toThrow(PaymentError);
  });
});

// ── PaymentService.pay — emissione evento ─────────────────────────────────────

describe("PaymentService.pay — eventi", () => {
  it("emette PAYMENT_COMPLETED con i dati corretti", async () => {
    const orderId = await seedOrder(30.00);
    let emittedPayment: unknown;
    eventBus.on("PAYMENT_COMPLETED", (payload) => { emittedPayment = payload.payment; });
    await service.pay({ orderId, method: "cash", amount: 30.00 });
    expect(emittedPayment).toBeDefined();
    expect((emittedPayment as { status: string }).status).toBe("completed");
  });
});

// ── PaymentService.pay — guard doppio pagamento ───────────────────────────────

describe("PaymentService.pay — double-payment guard", () => {
  it("rifiuta secondo pagamento su ordine già pagato", async () => {
    const orderId = await seedOrder(20.00);
    await service.pay({ orderId, method: "cash", amount: 20.00 });
    await expect(service.pay({ orderId, method: "card", amount: 20.00 })).rejects.toThrow(PaymentError);
  });

  it("rifiuta pagamento su ordine cancelled", async () => {
    const orderId = await seedOrder(15.00, "cancelled");
    await expect(service.pay({ orderId, method: "cash", amount: 15.00 })).rejects.toThrow(PaymentError);
  });

  it("rifiuta pagamento su ordine completed", async () => {
    const orderId = await seedOrder(15.00, "completed");
    await expect(service.pay({ orderId, method: "cash", amount: 15.00 })).rejects.toThrow(PaymentError);
  });

  it("ordine inesistente → lancia PaymentError", async () => {
    await expect(service.pay({ orderId: 99999, method: "cash", amount: 10.00 })).rejects.toThrow(PaymentError);
  });
});

// ── PaymentService.getPaymentsForOrder ────────────────────────────────────────

describe("PaymentService.getPaymentsForOrder", () => {
  it("nessun pagamento → []", async () => {
    const orderId = await seedOrder(10.00);
    const result = await service.getPaymentsForOrder(orderId);
    expect(result).toEqual([]);
  });

  it("un pagamento → array con 1 elemento con campi corretti", async () => {
    const orderId = await seedOrder(25.00);
    await service.pay({ orderId, method: "cash", amount: 25.00 });
    const result = await service.getPaymentsForOrder(orderId);
    expect(result).toHaveLength(1);
    expect(result[0]!.orderId).toBe(orderId);
    expect(result[0]!.amount).toBeCloseTo(25.00);
    expect(result[0]!.method).toBe("cash");
    expect(result[0]!.status).toBe("completed");
    expect(result[0]!.currency).toBe("EUR");
  });

  it("ordine diverso non appare nella lista", async () => {
    const o1 = await seedOrder(10.00);
    const o2 = await seedOrder(20.00);
    await service.pay({ orderId: o1, method: "cash", amount: 10.00 });
    const result = await service.getPaymentsForOrder(o2);
    expect(result).toHaveLength(0);
  });
});

// ── PaymentService.refund ─────────────────────────────────────────────────────

describe("PaymentService.refund", () => {
  it("rimborsa pagamento completato → status refunded", async () => {
    const orderId = await seedOrder(30.00);
    const payment = await service.pay({ orderId, method: "cash", amount: 30.00 });
    const refunded = await service.refund(payment.id);
    expect(refunded.status).toBe("refunded");
    expect(refunded.id).toBe(payment.id);
  });

  it("emette PAYMENT_REFUNDED con orderId e amount", async () => {
    const orderId = await seedOrder(30.00);
    const payment = await service.pay({ orderId, method: "cash", amount: 30.00 });
    let refundedPayload: unknown;
    eventBus.on("PAYMENT_REFUNDED", (p) => { refundedPayload = p; });
    await service.refund(payment.id);
    expect((refundedPayload as { orderId: number }).orderId).toBe(orderId);
    expect((refundedPayload as { amount: number }).amount).toBeCloseTo(30.00);
  });

  it("lancia PaymentError per payment non trovato", async () => {
    await expect(service.refund(99999)).rejects.toThrow(PaymentError);
  });

  it("lancia PaymentError se il pagamento non è completed (già rimborsato)", async () => {
    const orderId = await seedOrder(30.00);
    const payment = await service.pay({ orderId, method: "cash", amount: 30.00 });
    await service.refund(payment.id);
    await expect(service.refund(payment.id)).rejects.toThrow(PaymentError);
  });

  it("getPaymentsForOrder dopo refund mostra status refunded", async () => {
    const orderId = await seedOrder(40.00);
    const payment = await service.pay({ orderId, method: "cash", amount: 40.00 });
    await service.refund(payment.id);
    const payments = await service.getPaymentsForOrder(orderId);
    expect(payments[0]!.status).toBe("refunded");
  });
});
