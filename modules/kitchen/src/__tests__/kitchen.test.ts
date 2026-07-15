import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { KitchenService, KitchenValidationError } from "../service/kitchen.service.js";
import { KitchenRepository } from "../repository/kitchen.repository.js";
import { EventBus } from "@pos/event-bus";
import { createTestDb } from "./test-db.js";
import { orders, orderItems, orderCenterNumbers, productionCenters } from "@pos/db";
import type { DbClient } from "@pos/db";

let db: DbClient;
let cleanup: () => void;
let repo: KitchenRepository;
let service: KitchenService;
let eventBus: EventBus;

beforeEach(() => {
  ({ db, cleanup } = createTestDb());
  eventBus = new EventBus();
  repo = new KitchenRepository(db);
  service = new KitchenService(repo, eventBus);
});

afterEach(() => cleanup());

// ── Seed helpers ──────────────────────────────────────────────────────────────

type OrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";

async function seedOrder(status: OrderStatus = "pending", createdAt?: Date) {
  const now = createdAt ?? new Date();
  const [ord] = await db.insert(orders).values({
    status,
    totalAmount: 10,
    discountAmount: 0,
    createdAt: now,
    updatedAt: now,
  }).returning({ id: orders.id });
  return ord!.id;
}

async function seedOrderWithItem(status: OrderStatus = "pending") {
  const orderId = await seedOrder(status);
  await db.insert(orderItems).values({
    orderId,
    productId: 1,
    name: "Pizza",
    quantity: 2,
    unitPrice: 5,
  });
  return orderId;
}

// ── KitchenRepository.findQueue ───────────────────────────────────────────────

describe("KitchenRepository.findQueue", () => {
  it("coda vuota → []", async () => {
    const result = await repo.findQueue();
    expect(result).toEqual([]);
  });

  it("include ordini pending, confirmed, preparing, ready", async () => {
    await seedOrder("pending");
    await seedOrder("confirmed");
    await seedOrder("preparing");
    await seedOrder("ready");
    const result = await repo.findQueue();
    expect(result).toHaveLength(4);
    const statuses = result.map((o) => o.status);
    expect(statuses).toContain("pending");
    expect(statuses).toContain("confirmed");
    expect(statuses).toContain("preparing");
    expect(statuses).toContain("ready");
  });

  it("esclude ordini completed e cancelled", async () => {
    await seedOrder("completed");
    await seedOrder("cancelled");
    const result = await repo.findQueue();
    expect(result).toHaveLength(0);
  });

  it("misto: solo gli status attivi appaiono in coda", async () => {
    await seedOrder("pending");
    await seedOrder("completed");
    await seedOrder("cancelled");
    const result = await repo.findQueue();
    expect(result).toHaveLength(1);
    expect(result[0]!.status).toBe("pending");
  });

  it("include gli items dell'ordine", async () => {
    const orderId = await seedOrderWithItem("pending");
    const result = await repo.findQueue();
    const found = result.find((o) => o.id === orderId);
    expect(found).toBeDefined();
    expect(found!.items).toHaveLength(1);
    expect(found!.items[0]!.name).toBe("Pizza");
  });

  it("include centerNumbers se presenti in order_center_numbers", async () => {
    const [center] = await db.insert(productionCenters).values({ name: "Cucina" }).returning({ id: productionCenters.id });
    const centerId = center!.id;
    const orderId = await seedOrder("pending");
    await db.insert(orderCenterNumbers).values({ orderId, productionCenterId: centerId, centerNumber: 5 });

    const result = await repo.findQueue();
    const found = result.find((o) => o.id === orderId);
    expect(found!.centerNumbers).toBeDefined();
    expect(found!.centerNumbers![centerId]).toBe(5);
  });

  it("non include centerNumbers quando non ci sono righe in order_center_numbers", async () => {
    await seedOrder("pending");
    const result = await repo.findQueue();
    expect(result[0]!.centerNumbers).toBeUndefined();
  });
});

// ── KitchenRepository.findById ────────────────────────────────────────────────

describe("KitchenRepository.findById", () => {
  it("ritorna ordine esistente con items", async () => {
    const orderId = await seedOrderWithItem("pending");
    const found = await repo.findById(orderId);
    expect(found).toBeDefined();
    expect(found!.id).toBe(orderId);
    expect(found!.items).toHaveLength(1);
  });

  it("ritorna undefined per ID inesistente", async () => {
    const result = await repo.findById(99999);
    expect(result).toBeUndefined();
  });

  it("include centerNumbers se presenti", async () => {
    const [center] = await db.insert(productionCenters).values({ name: "Bar" }).returning({ id: productionCenters.id });
    const centerId = center!.id;
    const orderId = await seedOrder("pending");
    await db.insert(orderCenterNumbers).values({ orderId, productionCenterId: centerId, centerNumber: 3 });

    const found = await repo.findById(orderId);
    expect(found!.centerNumbers![centerId]).toBe(3);
  });
});

// ── KitchenService.getQueue ───────────────────────────────────────────────────

describe("KitchenService.getQueue", () => {
  it("delega a repository e ritorna lista", async () => {
    await seedOrder("pending");
    await seedOrder("preparing");
    const queue = await service.getQueue();
    expect(queue).toHaveLength(2);
  });

  it("coda vuota → []", async () => {
    const queue = await service.getQueue();
    expect(queue).toEqual([]);
  });
});

// ── KitchenService.getOrder ───────────────────────────────────────────────────

describe("KitchenService.getOrder", () => {
  it("ritorna ordine esistente", async () => {
    const orderId = await seedOrder("pending");
    const order = await service.getOrder(orderId);
    expect(order.id).toBe(orderId);
    expect(order.status).toBe("pending");
  });

  it("lancia KitchenValidationError per ID inesistente", async () => {
    await expect(service.getOrder(99999)).rejects.toThrow(KitchenValidationError);
  });
});

// ── KitchenService.requestTransition ─────────────────────────────────────────

describe("KitchenService.requestTransition", () => {
  it("pending → confirmed: emette ORDER_STATUS_REQUESTED e ritorna ordine corrente", async () => {
    const orderId = await seedOrder("pending");
    let emitted = false;
    eventBus.on("ORDER_STATUS_REQUESTED", (p) => {
      emitted = true;
      expect(p.orderId).toBe(orderId);
      expect(p.newStatus).toBe("confirmed");
    });
    const order = await service.requestTransition(orderId, "confirmed");
    expect(emitted).toBe(true);
    expect(order.id).toBe(orderId);
    expect(order.status).toBe("pending"); // ritorna snapshot pre-transizione
  });

  it("confirmed → preparing: transizione valida", async () => {
    const orderId = await seedOrder("confirmed");
    let emitted = false;
    eventBus.on("ORDER_STATUS_REQUESTED", () => { emitted = true; });
    await service.requestTransition(orderId, "preparing");
    expect(emitted).toBe(true);
  });

  it("preparing → ready: transizione valida", async () => {
    const orderId = await seedOrder("preparing");
    let emitted = false;
    eventBus.on("ORDER_STATUS_REQUESTED", () => { emitted = true; });
    await service.requestTransition(orderId, "ready");
    expect(emitted).toBe(true);
  });

  it("ready → completed: transizione permessa", async () => {
    const orderId = await seedOrder("ready");
    let emitted = false;
    eventBus.on("ORDER_STATUS_REQUESTED", () => { emitted = true; });
    await service.requestTransition(orderId, "completed");
    expect(emitted).toBe(true);
  });

  it("pending → ready: transizione NON permessa → KitchenValidationError", async () => {
    const orderId = await seedOrder("pending");
    await expect(service.requestTransition(orderId, "ready")).rejects.toThrow(KitchenValidationError);
  });

  it("completed → confirmed: transizione NON permessa → KitchenValidationError", async () => {
    const orderId = await seedOrder("completed");
    await expect(service.requestTransition(orderId, "confirmed")).rejects.toThrow(KitchenValidationError);
  });

  it("ordine inesistente → KitchenValidationError", async () => {
    await expect(service.requestTransition(99999, "confirmed")).rejects.toThrow(KitchenValidationError);
  });

  it("requestTransition NON aggiorna il DB direttamente (delega via evento)", async () => {
    const orderId = await seedOrder("pending");
    await service.requestTransition(orderId, "confirmed");
    // Lo status in DB rimane invariato — sarà OrderService ad aggiornarlo
    const order = await repo.findById(orderId);
    expect(order!.status).toBe("pending");
  });
});
