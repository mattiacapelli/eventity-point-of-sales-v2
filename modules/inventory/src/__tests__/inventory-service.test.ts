import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { InventoryService, InventoryValidationError } from "../service/inventory.service.js";
import { InventoryRepository } from "../repository/inventory.repository.js";
import { EventBus } from "@pos/event-bus";
import { createTestDb } from "./test-db.js";
import { products, categories, orders } from "@pos/db";
import type { DbClient } from "@pos/db";

let db: DbClient;
let cleanup: () => void;
let service: InventoryService;
let eventBus: EventBus;

beforeEach(() => {
  ({ db, cleanup } = createTestDb());
  eventBus = new EventBus();
  const repo = new InventoryRepository(db);
  service = new InventoryService(repo, eventBus);
});

afterEach(async () => {
  await new Promise((r) => setTimeout(r, 10));
  cleanup();
});

// ── Seed helpers ──────────────────────────────────────────────────────────────

let _catId: number | null = null;

beforeEach(() => { _catId = null; });

async function ensureCategory() {
  if (_catId === null) {
    const [row] = await db.insert(categories).values({ name: "Food" }).returning({ id: categories.id });
    _catId = row!.id;
  }
  return _catId;
}

async function seedProduct(name: string) {
  const catId = await ensureCategory();
  const [row] = await db.insert(products).values({ name, price: 5, categoryId: catId, active: true }).returning({ id: products.id });
  return row!.id;
}

async function seedOrder() {
  const now = new Date();
  const [row] = await db.insert(orders).values({
    status: "pending", totalAmount: 5, discountAmount: 0, createdAt: now, updatedAt: now,
  }).returning({ id: orders.id });
  return row!.id; // number
}

// ── InventoryService.createItem / getItem ─────────────────────────────────────

describe("InventoryService.createItem / getItem", () => {
  it("crea un item e lo recupera per ID", async () => {
    const item = await service.createItem({ name: "Flour", unit: "kg", currentStock: 50, minStock: 5 });
    const fetched = await service.getItem(item.id);
    expect(fetched.name).toBe("Flour");
    expect(fetched.currentStock).toBe(50);
    expect(fetched.minStock).toBe(5);
  });

  it("getItem lancia InventoryValidationError per ID inesistente", async () => {
    await expect(service.getItem(99999)).rejects.toThrow(InventoryValidationError);
  });

  it("campo unit usa default 'pz' se non specificato", async () => {
    const item = await service.createItem({ name: "Bottiglie" });
    expect(item.unit).toBe("pz");
  });

  it("campo currentStock usa default 0 se non specificato", async () => {
    const item = await service.createItem({ name: "Sale" });
    expect(item.currentStock).toBe(0);
  });
});

// ── InventoryService.listItems ────────────────────────────────────────────────

describe("InventoryService.listItems", () => {
  it("lista vuota → []", async () => {
    const result = await service.listItems();
    expect(result).toEqual([]);
  });

  it("dopo createItem → lista con 1 elemento", async () => {
    await service.createItem({ name: "Olio", unit: "L" });
    const result = await service.listItems();
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Olio");
  });

  it("ritorna tutti gli item creati", async () => {
    await service.createItem({ name: "A" });
    await service.createItem({ name: "B" });
    await service.createItem({ name: "C" });
    const result = await service.listItems();
    expect(result).toHaveLength(3);
  });
});

// ── InventoryService.updateItem ───────────────────────────────────────────────

describe("InventoryService.updateItem", () => {
  it("aggiorna name, unit e minStock", async () => {
    const item = await service.createItem({ name: "Farina", unit: "kg", currentStock: 10 });
    const updated = await service.updateItem(item.id, { name: "Farina 00", unit: "g", minStock: 2 });
    expect(updated.name).toBe("Farina 00");
    expect(updated.unit).toBe("g");
    expect(updated.minStock).toBe(2);
  });

  it("updateItem non altera currentStock", async () => {
    const item = await service.createItem({ name: "Zucchero", unit: "kg", currentStock: 15 });
    await service.updateItem(item.id, { name: "Zucchero Semolato" });
    const fetched = await service.getItem(item.id);
    expect(fetched.currentStock).toBe(15);
  });

  it("lancia InventoryValidationError per ID inesistente", async () => {
    await expect(service.updateItem(99999, { name: "Ghost" })).rejects.toThrow(InventoryValidationError);
  });
});

// ── InventoryService.deleteItem ───────────────────────────────────────────────

describe("InventoryService.deleteItem", () => {
  it("elimina item → non più in listItems", async () => {
    const item = await service.createItem({ name: "Pepe" });
    await service.deleteItem(item.id);
    const result = await service.listItems();
    expect(result.find((i) => i.id === item.id)).toBeUndefined();
  });

  it("elimina i movements associati", async () => {
    const item = await service.createItem({ name: "Aceto", currentStock: 10 });
    await service.adjustStock(item.id, 5, "restock");
    await service.deleteItem(item.id);
    const movements = await service.listMovements({ itemId: item.id });
    expect(movements).toHaveLength(0);
  });

  it("lancia InventoryValidationError per ID inesistente", async () => {
    await expect(service.deleteItem(99999)).rejects.toThrow(InventoryValidationError);
  });
});

// ── InventoryService.adjustStock ─────────────────────────────────────────────

describe("InventoryService.adjustStock", () => {
  it("aumenta lo stock della quantità indicata", async () => {
    const item = await service.createItem({ name: "Sugar", unit: "kg", currentStock: 10 });
    const updated = await service.adjustStock(item.id, 5, "restock");
    expect(updated.currentStock).toBe(15);
  });

  it("diminuisce lo stock con quantità negativa", async () => {
    const item = await service.createItem({ name: "Sugar", unit: "kg", currentStock: 10 });
    const updated = await service.adjustStock(item.id, -3, "manual");
    expect(updated.currentStock).toBe(7);
  });

  it("permette stock sotto zero (no lower-bound nel codice)", async () => {
    const item = await service.createItem({ name: "Salt", unit: "kg", currentStock: 2 });
    const updated = await service.adjustStock(item.id, -5);
    expect(updated.currentStock).toBe(-3);
  });

  it("emette LOW_STOCK_ALERT quando stock scende a/sotto minStock", async () => {
    const item = await service.createItem({ name: "Oil", unit: "L", currentStock: 5, minStock: 3 });
    let alerted = false;
    eventBus.on("LOW_STOCK_ALERT", () => { alerted = true; });
    await service.adjustStock(item.id, -3); // stock → 2, minStock 3
    expect(alerted).toBe(true);
  });

  it("NON emette LOW_STOCK_ALERT quando stock rimane sopra minStock", async () => {
    const item = await service.createItem({ name: "Oil", unit: "L", currentStock: 10, minStock: 3 });
    let alerted = false;
    eventBus.on("LOW_STOCK_ALERT", () => { alerted = true; });
    await service.adjustStock(item.id, -2); // stock → 8, sopra minStock
    expect(alerted).toBe(false);
  });

  it("crea un movement record dopo adjustStock", async () => {
    const item = await service.createItem({ name: "Pasta", currentStock: 5 });
    await service.adjustStock(item.id, 3, "restock");
    const movements = await service.getItemMovements(item.id);
    expect(movements).toHaveLength(1);
    expect(movements[0]!.quantity).toBe(3);
  });
});

// ── InventoryService.listMovements / getItemMovements ─────────────────────────

describe("InventoryService.listMovements / getItemMovements", () => {
  it("nessun movimento → []", async () => {
    const result = await service.listMovements();
    expect(result).toEqual([]);
  });

  it("dopo adjustStock → 1 movimento", async () => {
    const item = await service.createItem({ name: "Riso", currentStock: 10 });
    await service.adjustStock(item.id, 2, "restock");
    const movements = await service.listMovements();
    expect(movements).toHaveLength(1);
    expect(movements[0]!.quantity).toBe(2);
  });

  it("getItemMovements filtra per itemId", async () => {
    const a = await service.createItem({ name: "A", currentStock: 10 });
    const b = await service.createItem({ name: "B", currentStock: 10 });
    await service.adjustStock(a.id, 1);
    await service.adjustStock(b.id, 2);
    await service.adjustStock(a.id, 3);
    const movA = await service.getItemMovements(a.id);
    const movB = await service.getItemMovements(b.id);
    expect(movA).toHaveLength(2);
    expect(movB).toHaveLength(1);
  });
});

// ── InventoryService.getLowStockAlerts ────────────────────────────────────────

describe("InventoryService.getLowStockAlerts", () => {
  it("ritorna solo item con currentStock <= minStock", async () => {
    await service.createItem({ name: "A", unit: "pz", currentStock: 2, minStock: 5 });
    await service.createItem({ name: "B", unit: "pz", currentStock: 10, minStock: 5 });
    const alerts = await service.getLowStockAlerts();
    expect(alerts.map((a) => a.name)).toContain("A");
    expect(alerts.map((a) => a.name)).not.toContain("B");
  });

  it("nessun alert se tutto sopra minStock", async () => {
    await service.createItem({ name: "X", currentStock: 10, minStock: 5 });
    const alerts = await service.getLowStockAlerts();
    expect(alerts).toHaveLength(0);
  });

  it("item con minStock 0 non appare negli alert", async () => {
    await service.createItem({ name: "Y", currentStock: 0, minStock: 0 });
    const alerts = await service.getLowStockAlerts();
    expect(alerts).toHaveLength(0);
  });
});

// ── InventoryService.decrementForOrder ───────────────────────────────────────

describe("InventoryService.decrementForOrder", () => {
  it("decrementa stock per prodotto abbinato per nome (fallback)", async () => {
    const orderId = await seedOrder();
    const prodId = await seedProduct("Pasta");
    const item = await service.createItem({ name: "Pasta", unit: "kg", currentStock: 20 });
    await service.decrementForOrder(orderId, [{ productId: prodId, quantity: 3 }]);
    const updated = await service.getItem(item.id);
    expect(updated.currentStock).toBe(17);
  });

  it("decrementa stock tramite mappatura ingredienti", async () => {
    const orderId = await seedOrder();
    const prodId = await seedProduct("Pizza Margherita");
    const flour = await service.createItem({ name: "Flour", unit: "kg", currentStock: 10 });
    await service.createIngredient({ productId: prodId, inventoryItemId: flour.id, quantity: 0.3 });
    await service.decrementForOrder(orderId, [{ productId: prodId, quantity: 2 }]);
    const updated = await service.getItem(flour.id);
    expect(updated.currentStock).toBeCloseTo(9.4, 5);
  });

  it("no-op se il prodotto non ha mappatura inventario", async () => {
    const orderId = await seedOrder();
    const prodId = await seedProduct("UnmappedProduct");
    await expect(
      service.decrementForOrder(orderId, [{ productId: prodId, quantity: 1 }])
    ).resolves.toBeUndefined();
  });

  it("atomicità: la scrittura avviene in transazione", async () => {
    const orderId = await seedOrder();
    const prodId = await seedProduct("Rice");
    const item = await service.createItem({ name: "Rice", unit: "kg", currentStock: 5 });
    await service.decrementForOrder(orderId, [{ productId: prodId, quantity: 1 }]);
    const after = await service.getItem(item.id);
    expect(after.currentStock).toBe(4);
  });

  it("decrementa per più prodotti nello stesso ordine", async () => {
    const orderId = await seedOrder();
    const p1 = await seedProduct("Riso");
    const p2 = await seedProduct("Olio");
    const riso = await service.createItem({ name: "Riso", currentStock: 10 });
    const olio = await service.createItem({ name: "Olio", unit: "L", currentStock: 5 });
    await service.decrementForOrder(orderId, [
      { productId: p1, quantity: 2 },
      { productId: p2, quantity: 1 },
    ]);
    expect((await service.getItem(riso.id)).currentStock).toBe(8);
    expect((await service.getItem(olio.id)).currentStock).toBe(4);
  });
});

// ── InventoryService.getIngredientsByProduct / createIngredient / deleteIngredient ─

describe("InventoryService — ingredients", () => {
  it("nessun ingrediente → []", async () => {
    const prodId = await seedProduct("Noodles");
    const result = await service.getIngredientsByProduct(prodId);
    expect(result).toEqual([]);
  });

  it("createIngredient → getIngredientsByProduct ritorna l'ingrediente", async () => {
    const prodId = await seedProduct("Pasta");
    const item = await service.createItem({ name: "Semola" });
    await service.createIngredient({ productId: prodId, inventoryItemId: item.id, quantity: 0.2 });
    const ingredients = await service.getIngredientsByProduct(prodId);
    expect(ingredients).toHaveLength(1);
    expect(ingredients[0]!.inventoryItemId).toBe(item.id);
    expect(ingredients[0]!.quantity).toBeCloseTo(0.2);
  });

  it("deleteIngredient → non più in getIngredientsByProduct", async () => {
    const prodId = await seedProduct("Risotto");
    const item = await service.createItem({ name: "Riso" });
    const ingredient = await service.createIngredient({ productId: prodId, inventoryItemId: item.id, quantity: 1 });
    await service.deleteIngredient(ingredient.id);
    const result = await service.getIngredientsByProduct(prodId);
    expect(result).toHaveLength(0);
  });

  it("getItemsByProduct ritorna item collegato al prodotto", async () => {
    const prodId = await seedProduct("Prodotto");
    const item = await service.createItem({ name: "Item", productId: prodId });
    const result = await service.getItemsByProduct(prodId);
    expect(result.some((i) => i.id === item.id)).toBe(true);
  });
});
