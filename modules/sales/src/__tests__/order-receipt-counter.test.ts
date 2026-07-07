import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { OrderRepository, formatReceiptNumber } from "../repository/order.repository.js";
import { createTestDb } from "./test-db.js";
import type { DbClient } from "@pos/db";
import { products, categories } from "@pos/db";
import { randomUUID } from "node:crypto";

let db: DbClient;
let cleanup: () => void;
let repo: OrderRepository;

beforeEach(() => {
  ({ db, cleanup } = createTestDb());
  repo = new OrderRepository(db);
});

afterEach(() => cleanup());

async function seedProduct(name = "Pizza") {
  const catId = randomUUID();
  await db.insert(categories).values({ id: catId, name: "Food" });
  const prodId = randomUUID();
  await db.insert(products).values({
    id: prodId,
    name,
    price: 10,
    categoryId: catId,
    active: true,
  });
  return prodId;
}

describe("formatReceiptNumber", () => {
  it("falls back to order id suffix when number is undefined", () => {
    const result = formatReceiptNumber(undefined, "abcdef123456", "", 0);
    expect(result).toBe("123456");
  });

  it("formats with prefix and padding", () => {
    expect(formatReceiptNumber(7, "id", "REC-", 4)).toBe("REC-0007");
  });

  it("formats without padding when padding is 0", () => {
    expect(formatReceiptNumber(42, "id", "A", 0)).toBe("A42");
  });
});

describe("Receipt counter atomicity (fix 6)", () => {
  it("increments by 1 for sequential calls", async () => {
    const prodId = await seedProduct();

    const o1 = await repo.create({
      items: [{ productId: prodId, name: "Pizza", quantity: 1 }],
    });
    const o2 = await repo.create({
      items: [{ productId: prodId, name: "Pizza", quantity: 1 }],
    });

    // Assign receipt numbers
    const r1 = await (repo as unknown as { _nextReceiptNumber(s: string): Promise<number> })._nextReceiptNumber("global");
    const r2 = await (repo as unknown as { _nextReceiptNumber(s: string): Promise<number> })._nextReceiptNumber("global");
    expect(r2).toBe(r1 + 1);

    expect(o1).toBeDefined();
    expect(o2).toBeDefined();
  });

  it("handles concurrent counter increments without duplicates", async () => {
    const calls = Array.from({ length: 10 }, () =>
      (repo as unknown as { _nextReceiptNumber(s: string): Promise<number> })._nextReceiptNumber("global")
    );
    const results = await Promise.all(calls);
    const unique = new Set(results);
    expect(unique.size).toBe(10);
  });
});
