import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { InventoryService, InventoryValidationError } from "../service/inventory.service.js";
import { InventoryRepository } from "../repository/inventory.repository.js";
import { EventBus } from "@pos/event-bus";
import { createTestDb } from "./test-db.js";
import { products, categories, orders } from "@pos/db";
import type { DbClient } from "@pos/db";
import { randomUUID } from "node:crypto";

let db: DbClient;
let cleanup: () => void;
let service: InventoryService;
let eventBus: EventBus;
let _catId: string | null = null;

beforeEach(() => {
  _catId = null;
  ({ db, cleanup } = createTestDb());
  // Silent event bus: no logging, swallows all async handler errors in tests
  eventBus = new EventBus();
  const repo = new InventoryRepository(db);
  service = new InventoryService(repo, eventBus);
});

afterEach(async () => {
  // Flush microtask queue so async event handlers finish before DB closes.
  await new Promise((r) => setTimeout(r, 10));
  cleanup();
});

// Shared category to avoid FK violations from repeated inserts in the same test
async function ensureCategory() {
  if (!_catId) {
    _catId = randomUUID();
    await db.insert(categories).values({ id: _catId, name: "Food" });
  }
  return _catId;
}

async function seedProduct(name: string) {
  const catId = await ensureCategory();
  const prodId = randomUUID();
  await db.insert(products).values({ id: prodId, name, price: 5, categoryId: catId, active: true });
  return prodId;
}

async function seedOrder(id: string) {
  const now = new Date();
  await db.insert(orders).values({ id, status: "pending", totalAmount: 5, discountAmount: 0, createdAt: now, updatedAt: now });
}

describe("InventoryService.createItem / getItem", () => {
  it("creates an inventory item and retrieves it", async () => {
    const item = await service.createItem({ name: "Flour", unit: "kg", currentStock: 50, minStock: 5 });
    const fetched = await service.getItem(item.id);
    expect(fetched.name).toBe("Flour");
    expect(fetched.currentStock).toBe(50);
  });
});

describe("InventoryService.adjustStock", () => {
  it("increases stock by the given quantity", async () => {
    const item = await service.createItem({ name: "Sugar", unit: "kg", currentStock: 10 });
    const updated = await service.adjustStock(item.id, 5, "restock");
    expect(updated.currentStock).toBe(15);
  });

  it("decreases stock by a negative quantity", async () => {
    const item = await service.createItem({ name: "Sugar", unit: "kg", currentStock: 10 });
    const updated = await service.adjustStock(item.id, -3, "manual");
    expect(updated.currentStock).toBe(7);
  });

  it("allows stock to go below zero (no lower-bound guard in current impl)", async () => {
    // adjustStock does not enforce a floor — callers must validate if needed.
    const item = await service.createItem({ name: "Salt", unit: "kg", currentStock: 2 });
    const updated = await service.adjustStock(item.id, -5);
    expect(updated.currentStock).toBe(-3);
  });

  it("emits LOW_STOCK_ALERT when stock falls at or below minStock", async () => {
    const item = await service.createItem({ name: "Oil", unit: "L", currentStock: 5, minStock: 3 });
    let alerted = false;
    eventBus.on("LOW_STOCK_ALERT", () => { alerted = true; });
    await service.adjustStock(item.id, -3); // stock → 2, below minStock 3
    expect(alerted).toBe(true);
  });
});

describe("InventoryService.decrementForOrder (fix 7: atomic stock read)", () => {
  it("decrements stock for a product matched by name fallback", async () => {
    const orderId = randomUUID();
    await seedOrder(orderId);
    const prodId = await seedProduct("Pasta");
    const item = await service.createItem({ name: "Pasta", unit: "kg", currentStock: 20 });
    await service.decrementForOrder(orderId, [{ productId: prodId, quantity: 3 }]);
    const updated = await service.getItem(item.id);
    expect(updated.currentStock).toBe(17);
  });

  it("decrements stock for a product with ingredient mapping", async () => {
    const orderId = randomUUID();
    await seedOrder(orderId);
    const prodId = await seedProduct("Pizza Margherita");
    const flour = await service.createItem({ name: "Flour", unit: "kg", currentStock: 10 });
    await service.createIngredient({ productId: prodId, inventoryItemId: flour.id, quantity: 0.3 });
    await service.decrementForOrder(orderId, [{ productId: prodId, quantity: 2 }]);
    const updated = await service.getItem(flour.id);
    // 2 pizzas × 0.3 kg = 0.6 kg used → 10 - 0.6 = 9.4
    expect(updated.currentStock).toBeCloseTo(9.4, 5);
  });

  it("is a no-op when the product has no inventory mapping", async () => {
    const orderId = randomUUID();
    await seedOrder(orderId);
    const prodId = await seedProduct("UnmappedProduct");
    // No inventory item with matching name — should not throw
    await expect(
      service.decrementForOrder(orderId, [{ productId: prodId, quantity: 1 }])
    ).resolves.toBeUndefined();
  });

  it("decrements stock atomically (write inside transaction)", async () => {
    const orderId = randomUUID();
    await seedOrder(orderId);
    const prodId = await seedProduct("Rice");
    const item = await service.createItem({ name: "Rice", unit: "kg", currentStock: 5 });
    await service.decrementForOrder(orderId, [{ productId: prodId, quantity: 1 }]);
    const after = await service.getItem(item.id);
    expect(after.currentStock).toBe(4);
  });
});

describe("InventoryService.getLowStockAlerts", () => {
  it("returns items whose currentStock <= minStock", async () => {
    await service.createItem({ name: "A", unit: "pz", currentStock: 2, minStock: 5 });
    await service.createItem({ name: "B", unit: "pz", currentStock: 10, minStock: 5 });
    const alerts = await service.getLowStockAlerts();
    expect(alerts.map((a) => a.name)).toContain("A");
    expect(alerts.map((a) => a.name)).not.toContain("B");
  });
});
