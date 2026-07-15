import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { OrderRepository, formatReceiptNumber, computeVatBreakdown } from "../repository/order.repository.js";
import { createTestDb } from "./test-db.js";
import type { DbClient } from "@pos/db";
import { products, categories, options, appSettings, orderCenterNumbers, productionCenters } from "@pos/db";

let db: DbClient;
let cleanup: () => void;
let repo: OrderRepository;

beforeEach(() => {
  ({ db, cleanup } = createTestDb());
  repo = new OrderRepository(db);
});

afterEach(() => cleanup());

// ── Seed helpers ─────────────────────────────────────────────────────────────

async function seedCategory(name = "Food") {
  const [row] = await db.insert(categories).values({ name }).returning({ id: categories.id });
  return row!.id;
}

async function seedProduct(name = "Pizza", price = 10, catId?: number) {
  const categoryId = catId ?? await seedCategory();
  const [row] = await db.insert(products).values({ name, price, categoryId, active: true }).returning({ id: products.id });
  return row!.id;
}

async function seedProductionCenter(name = "Cucina") {
  const [row] = await db.insert(productionCenters).values({ name }).returning({ id: productionCenters.id });
  return row!.id;
}

async function seedOption(productId: number, name = "Extra cheese", priceDelta = 1.5) {
  const { optionGroups } = await import("@pos/db");
  const [grp] = await db.insert(optionGroups).values({ productId, name: "Extras", type: "multi" }).returning({ id: optionGroups.id });
  const [row] = await db.insert(options).values({ name, priceDelta, optionGroupId: grp!.id }).returning({ id: options.id });
  return row!.id;
}

async function setReceiptMode(mode: string) {
  await db.insert(appSettings).values({ key: "receipt_number_mode", value: mode })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: mode } });
}

// ── formatReceiptNumber (pure) ────────────────────────────────────────────────

describe("formatReceiptNumber", () => {
  it("falls back to last 6 chars of orderId when receiptNumber is undefined", () => {
    expect(formatReceiptNumber(undefined, "abcdef123456", "", 0)).toBe("123456");
  });

  it("formats with prefix and zero-padding", () => {
    expect(formatReceiptNumber(7, "id", "REC-", 4)).toBe("REC-0007");
  });

  it("formats without padding when padding is 0", () => {
    expect(formatReceiptNumber(42, "id", "A", 0)).toBe("A42");
  });

  it("uses the numeric receipt number when provided, ignoring orderId", () => {
    expect(formatReceiptNumber(99, "any-id", "", 0)).toBe("99");
  });
});

// ── computeVatBreakdown (pure) ────────────────────────────────────────────────

describe("computeVatBreakdown", () => {
  it("returns empty array for no items", () => {
    expect(computeVatBreakdown([], 0, 0)).toEqual([]);
  });

  it("single aliquota: taxable + tax ≈ gross", () => {
    const items = [{ id: 1, productId: 1, name: "Pizza", quantity: 1, unitPrice: 10, vatRate: 10 }];
    const [entry] = computeVatBreakdown(items, 0, 10);
    expect(entry).toBeDefined();
    expect(entry!.rate).toBe(10);
    expect(entry!.taxable + entry!.tax).toBeCloseTo(10, 2);
    expect(entry!.tax).toBeCloseTo(10 / 11, 2);
  });

  it("items con aliquote diverse generano record separati", () => {
    const items = [
      { id: 1, productId: 1, name: "Pizza", quantity: 1, unitPrice: 10, vatRate: 10 },
      { id: 2, productId: 2, name: "Wine", quantity: 1, unitPrice: 20, vatRate: 22 },
    ];
    const breakdown = computeVatBreakdown(items, 0, 30);
    expect(breakdown).toHaveLength(2);
    const rates = breakdown.map((b) => b.rate).sort();
    expect(rates).toEqual([10, 22]);
  });

  it("applica lo sconto proporzionalmente su ogni aliquota", () => {
    const items = [{ id: 1, productId: 1, name: "Pizza", quantity: 2, unitPrice: 10, vatRate: 10 }];
    // subtotal 20, sconto 10, total 10
    const [entry] = computeVatBreakdown(items, 10, 10);
    expect(entry!.taxable + entry!.tax).toBeCloseTo(10, 2);
  });
});

// ── _nextReceiptNumber ────────────────────────────────────────────────────────

describe("Receipt counter atomicity", () => {
  it("incrementi sequenziali di 1", async () => {
    const r1 = await (repo as unknown as { _nextReceiptNumber(s: string): Promise<number> })._nextReceiptNumber("global");
    const r2 = await (repo as unknown as { _nextReceiptNumber(s: string): Promise<number> })._nextReceiptNumber("global");
    expect(r2).toBe(r1 + 1);
  });

  it("10 chiamate concorrenti senza duplicati", async () => {
    const calls = Array.from({ length: 10 }, () =>
      (repo as unknown as { _nextReceiptNumber(s: string): Promise<number> })._nextReceiptNumber("global")
    );
    const results = await Promise.all(calls);
    expect(new Set(results).size).toBe(10);
  });

  it("scope diversi hanno contatori indipendenti", async () => {
    const a = await (repo as unknown as { _nextReceiptNumber(s: string): Promise<number> })._nextReceiptNumber("scope-A");
    const b = await (repo as unknown as { _nextReceiptNumber(s: string): Promise<number> })._nextReceiptNumber("scope-B");
    expect(a).toBe(1);
    expect(b).toBe(1);
  });
});

// ── OrderRepository.create() ──────────────────────────────────────────────────

describe("OrderRepository.create", () => {
  it("crea ordine con un item → totalAmount corretto e status pending", async () => {
    const prodId = await seedProduct("Pizza", 12);
    const order = await repo.create({ items: [{ productId: prodId, name: "Pizza", quantity: 2 }] });
    expect(order.status).toBe("pending");
    expect(order.totalAmount).toBeCloseTo(24);
    expect(order.items).toHaveLength(1);
    expect(order.items[0]!.quantity).toBe(2);
  });

  it("crea ordine multi-item → totalAmount somma corretta", async () => {
    const catId = await seedCategory();
    const p1 = await seedProduct("Pizza", 10, catId);
    const p2 = await seedProduct("Birra", 5, catId);
    const order = await repo.create({
      items: [
        { productId: p1, name: "Pizza", quantity: 1 },
        { productId: p2, name: "Birra", quantity: 2 },
      ],
    });
    expect(order.totalAmount).toBeCloseTo(20);
    expect(order.items).toHaveLength(2);
  });

  it("crea ordine con opzione → unitPrice include priceDelta", async () => {
    const prodId = await seedProduct("Burger", 10);
    const optId = await seedOption(prodId, "Extra cheese", 1.5);
    const order = await repo.create({
      items: [{ productId: prodId, name: "Burger", quantity: 1, selectedOptionIds: [optId] }],
    });
    expect(order.totalAmount).toBeCloseTo(11.5);
    expect(order.items[0]!.unitPrice).toBeCloseTo(11.5);
  });

  it("modalità global → receiptNumber intero positivo assegnato", async () => {
    await setReceiptMode("global");
    const prodId = await seedProduct();
    const order = await repo.create({ items: [{ productId: prodId, name: "Pizza", quantity: 1 }] });
    expect(order.receiptNumber).toBeGreaterThan(0);
  });

  it("modalità shift con shiftId → receiptNumber assegnato", async () => {
    await setReceiptMode("shift");
    const prodId = await seedProduct();
    const order = await repo.create({ shiftId: 42, items: [{ productId: prodId, name: "Pizza", quantity: 1 }] });
    expect(order.receiptNumber).toBeGreaterThan(0);
  });

  it("modalità shift senza shiftId → fallback su contatore global", async () => {
    await setReceiptMode("shift");
    const prodId = await seedProduct();
    const order = await repo.create({ items: [{ productId: prodId, name: "Pizza", quantity: 1 }] });
    expect(order.receiptNumber).toBeGreaterThan(0);
  });

  it("modalità default → receiptNumber null/undefined", async () => {
    await setReceiptMode("default");
    const prodId = await seedProduct();
    const order = await repo.create({ items: [{ productId: prodId, name: "Pizza", quantity: 1 }] });
    expect(order.receiptNumber == null).toBe(true);
  });

  it("modalità center con shiftId → centerNumbers nel return e righe in order_center_numbers", async () => {
    await setReceiptMode("center");
    const centerId = await seedProductionCenter("Cucina");
    const catId = await seedCategory();
    const [prodRow] = await db.insert(products).values({
      name: "Pizza", price: 10, categoryId: catId, active: true, productionCenterId: centerId,
    }).returning({ id: products.id });
    const prodId = prodRow!.id;

    const order = await repo.create({
      shiftId: 1,
      items: [{ productId: prodId, name: "Pizza", quantity: 1 }],
    });

    expect(order.centerNumbers).toBeDefined();
    expect(order.centerNumbers![centerId]).toBeGreaterThan(0);
    const cnRows = await db.select().from(orderCenterNumbers);
    expect(cnRows).toHaveLength(1);
    expect(cnRows[0]!.productionCenterId).toBe(centerId);
  });

  it("lancia errore se il productId non esiste", async () => {
    await expect(repo.create({ items: [{ productId: 99999, name: "Ghost", quantity: 1 }] })).rejects.toThrow();
  });

  it("preserva tableId, notes, pax nel risultato", async () => {
    const prodId = await seedProduct();
    const order = await repo.create({
      tableId: "T5",
      notes: "senza cipolla",
      pax: 3,
      items: [{ productId: prodId, name: "Pizza", quantity: 1 }],
    });
    expect(order.tableId).toBe("T5");
    expect(order.notes).toBe("senza cipolla");
    expect(order.pax).toBe(3);
  });
});

// ── OrderRepository.findById() ────────────────────────────────────────────────

describe("OrderRepository.findById", () => {
  it("ritorna ordine con items", async () => {
    const prodId = await seedProduct();
    const created = await repo.create({ items: [{ productId: prodId, name: "Pizza", quantity: 1 }] });
    const found = await repo.findById(created.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(created.id);
    expect(found!.items).toHaveLength(1);
  });

  it("ritorna undefined/null per ID inesistente", async () => {
    const result = await repo.findById(99999);
    expect(result == null).toBe(true);
  });
});

// ── OrderRepository.findAll() ─────────────────────────────────────────────────

describe("OrderRepository.findAll", () => {
  it("lista vuota → []", async () => {
    const result = await repo.findAll();
    expect(result).toEqual([]);
  });

  it("ritorna tutti gli ordini creati", async () => {
    const prodId = await seedProduct();
    await repo.create({ items: [{ productId: prodId, name: "Pizza", quantity: 1 }] });
    await repo.create({ items: [{ productId: prodId, name: "Pizza", quantity: 2 }] });
    const result = await repo.findAll();
    expect(result).toHaveLength(2);
  });

  it("filtro per status", async () => {
    const prodId = await seedProduct();
    const o = await repo.create({ items: [{ productId: prodId, name: "Pizza", quantity: 1 }] });
    await repo.updateStatus(o.id, "confirmed");
    const pending = await repo.findAll({ status: "pending" });
    const confirmed = await repo.findAll({ status: "confirmed" });
    expect(pending).toHaveLength(0);
    expect(confirmed).toHaveLength(1);
  });

  it("filtro per shiftId", async () => {
    const prodId = await seedProduct();
    await repo.create({ shiftId: 1, items: [{ productId: prodId, name: "Pizza", quantity: 1 }] });
    await repo.create({ shiftId: 2, items: [{ productId: prodId, name: "Pizza", quantity: 1 }] });
    const result = await repo.findAll({ shiftId: 1 });
    expect(result).toHaveLength(1);
    expect(result[0]!.shiftId).toBe(1);
  });
});

// ── OrderRepository.updateStatus() ───────────────────────────────────────────

describe("OrderRepository.updateStatus", () => {
  it("aggiorna status e restituisce ordine aggiornato", async () => {
    const prodId = await seedProduct();
    const order = await repo.create({ items: [{ productId: prodId, name: "Pizza", quantity: 1 }] });
    const updated = await repo.updateStatus(order.id, "confirmed");
    expect(updated).toBeDefined();
    expect(updated!.status).toBe("confirmed");
  });

  it("ritorna null per ID inesistente", async () => {
    const result = await repo.updateStatus(99999, "confirmed");
    expect(result).toBeNull();
  });
});

// ── OrderRepository.updateDetails() ──────────────────────────────────────────

describe("OrderRepository.updateDetails", () => {
  it("aggiorna tableId e customerName", async () => {
    const prodId = await seedProduct();
    const order = await repo.create({ items: [{ productId: prodId, name: "Pizza", quantity: 1 }] });
    const updated = await repo.updateDetails(order.id, { tableId: "T3", customerName: "Mario" });
    expect(updated!.tableId).toBe("T3");
    expect(updated!.customerName).toBe("Mario");
  });

  it("patch semantics: campo omesso non viene alterato", async () => {
    const prodId = await seedProduct();
    const order = await repo.create({ tableId: "T1", items: [{ productId: prodId, name: "Pizza", quantity: 1 }] });
    const updated = await repo.updateDetails(order.id, { customerName: "Giulia" });
    expect(updated!.tableId).toBe("T1");
    expect(updated!.customerName).toBe("Giulia");
  });
});

// ── OrderRepository.updateFiscalData() ───────────────────────────────────────

describe("OrderRepository.updateFiscalData", () => {
  it("aggiorna i campi fiscali", async () => {
    const prodId = await seedProduct();
    const order = await repo.create({ items: [{ productId: prodId, name: "Pizza", quantity: 1 }] });
    await repo.updateFiscalData(order.id, {
      fiscalDocNumber: "RT001",
      fiscalDocDate: "2024-01-15",
      fiscalRtSerial: "SN123456",
    });
    const found = await repo.findById(order.id);
    expect(found!.fiscalDocNumber).toBe("RT001");
    expect(found!.fiscalDocDate).toBe("2024-01-15");
    expect(found!.fiscalRtSerial).toBe("SN123456");
  });
});

// ── OrderRepository.replaceItems() ───────────────────────────────────────────

describe("OrderRepository.replaceItems", () => {
  it("sostituisce items e ricalcola totalAmount", async () => {
    const catId = await seedCategory();
    const p1 = await seedProduct("Pizza", 10, catId);
    const p2 = await seedProduct("Pasta", 8, catId);
    const order = await repo.create({ items: [{ productId: p1, name: "Pizza", quantity: 1 }] });
    expect(order.totalAmount).toBeCloseTo(10);

    const updated = await repo.replaceItems(order.id, [
      { productId: p2, name: "Pasta", quantity: 3 },
    ]);
    expect(updated!.totalAmount).toBeCloseTo(24);
    expect(updated!.items).toHaveLength(1);
    expect(updated!.items[0]!.name).toBe("Pasta");
  });

  it("aggiunta di un secondo item al posto del primo", async () => {
    const catId = await seedCategory();
    const p1 = await seedProduct("Pizza", 10, catId);
    const p2 = await seedProduct("Coca", 3, catId);
    const order = await repo.create({ items: [{ productId: p1, name: "Pizza", quantity: 1 }] });
    const updated = await repo.replaceItems(order.id, [{ productId: p2, name: "Coca", quantity: 2 }]);
    expect(updated!.totalAmount).toBeCloseTo(6);
    expect(updated!.items[0]!.name).toBe("Coca");
  });
});
