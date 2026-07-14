import { eq, desc, and, gte, lte } from "@pos/db";
import { inventoryItems, inventoryMovements, productIngredients, products } from "@pos/db";
import type { DbClient } from "@pos/db";

export type InventoryItem = {
  id: number;
  name: string;
  sku: string | null;
  unit: string;
  currentStock: number;
  minStock: number;
  productionCenterId: number | null;
  productId: number | null;
  resetOnShiftOpen: number;
  createdAt: number;
  updatedAt: number;
};

export type InventoryMovement = {
  id: number;
  itemId: number;
  type: "sale" | "restock" | "manual" | "waste";
  quantity: number;
  reason: string | null;
  orderId: number | null;
  createdAt: number;
};

export type ProductIngredient = {
  id: number;
  productId: number;
  inventoryItemId: number;
  quantity: number;
};

export type MovementFilters = {
  itemId?: number;
  type?: "sale" | "restock" | "manual" | "waste";
  from?: number;
  to?: number;
};

export class InventoryRepository {
  constructor(private readonly db: DbClient) {}

  async findAllItems(): Promise<InventoryItem[]> {
    return this.db.select().from(inventoryItems).orderBy(inventoryItems.name) as Promise<InventoryItem[]>;
  }

  async findItemById(id: number): Promise<InventoryItem | undefined> {
    const [row] = await this.db.select().from(inventoryItems).where(eq(inventoryItems.id, id)).limit(1);
    return row as InventoryItem | undefined;
  }

  // Synchronous variant for use inside better-sqlite3 transaction callbacks.
  findItemByIdSync(id: number): InventoryItem | undefined {
    const result = this.db.select().from(inventoryItems).where(eq(inventoryItems.id, id)).limit(1) as unknown as { all: () => InventoryItem[] };
    return result.all()[0];
  }

  async findItemByName(name: string): Promise<InventoryItem | undefined> {
    const [row] = await this.db.select().from(inventoryItems).where(eq(inventoryItems.name, name)).limit(1);
    return row as InventoryItem | undefined;
  }

  async findItemsByProductId(productId: number): Promise<InventoryItem[]> {
    const rows = await this.db.select().from(inventoryItems).where(eq(inventoryItems.productId, productId));
    return rows as unknown as InventoryItem[];
  }

  async findItemsWithShiftReset(): Promise<InventoryItem[]> {
    const rows = await this.db.select().from(inventoryItems).where(eq(inventoryItems.resetOnShiftOpen, 1));
    return rows as unknown as InventoryItem[];
  }

  async createItem(data: Omit<InventoryItem, "id" | "currentStock" | "minStock" | "productId" | "resetOnShiftOpen"> & { currentStock?: number; minStock?: number; productId?: number | null; resetOnShiftOpen?: number }): Promise<InventoryItem> {
    const [row] = await this.db.insert(inventoryItems).values({
      name: data.name,
      sku: data.sku ?? null,
      unit: data.unit,
      currentStock: data.currentStock ?? 0,
      minStock: data.minStock ?? 0,
      productionCenterId: data.productionCenterId ?? null,
      productId: data.productId ?? null,
      resetOnShiftOpen: data.resetOnShiftOpen ?? 0,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }).returning({ id: inventoryItems.id });
    return (await this.findItemById(row!.id))!;
  }

  async updateItem(id: number, data: Partial<Pick<InventoryItem, "name" | "sku" | "unit" | "currentStock" | "minStock" | "productionCenterId" | "productId" | "resetOnShiftOpen" | "updatedAt">>): Promise<InventoryItem | undefined> {
    if (Object.keys(data).length > 0) {
      await this.db.update(inventoryItems).set(data).where(eq(inventoryItems.id, id));
    }
    return this.findItemById(id);
  }

  async deleteMovementsByItemId(itemId: number): Promise<void> {
    await this.db.delete(inventoryMovements).where(eq(inventoryMovements.itemId, itemId));
  }

  async deleteItem(id: number): Promise<void> {
    await this.db.delete(inventoryItems).where(eq(inventoryItems.id, id));
  }

  async findLowStockItems(): Promise<InventoryItem[]> {
    const all = await this.findAllItems();
    return all.filter((item) => item.currentStock <= item.minStock && item.minStock > 0);
  }

  async findMovements(filters: MovementFilters = {}): Promise<InventoryMovement[]> {
    const conditions = [];
    if (filters.itemId !== undefined) conditions.push(eq(inventoryMovements.itemId, filters.itemId));
    if (filters.type !== undefined) conditions.push(eq(inventoryMovements.type, filters.type));
    if (filters.from !== undefined) conditions.push(gte(inventoryMovements.createdAt, filters.from));
    if (filters.to !== undefined) conditions.push(lte(inventoryMovements.createdAt, filters.to));

    const query = this.db.select().from(inventoryMovements).orderBy(desc(inventoryMovements.createdAt));
    const rows = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;
    return rows as unknown as InventoryMovement[];
  }

  async createMovement(data: Omit<InventoryMovement, "id">): Promise<InventoryMovement> {
    const [row] = await this.db.insert(inventoryMovements).values({
      itemId: data.itemId,
      type: data.type,
      quantity: data.quantity,
      reason: data.reason ?? null,
      orderId: data.orderId ?? null,
      createdAt: data.createdAt,
    }).returning();
    return row as unknown as InventoryMovement;
  }

  async findIngredientsByProduct(productId: number): Promise<ProductIngredient[]> {
    const rows = await this.db.select().from(productIngredients).where(eq(productIngredients.productId, productId));
    return rows as ProductIngredient[];
  }

  async createIngredient(data: Omit<ProductIngredient, "id">): Promise<ProductIngredient> {
    const [row] = await this.db.insert(productIngredients).values({
      productId: data.productId,
      inventoryItemId: data.inventoryItemId,
      quantity: data.quantity,
    }).returning();
    return row as unknown as ProductIngredient;
  }

  async deleteIngredient(id: number): Promise<void> {
    await this.db.delete(productIngredients).where(eq(productIngredients.id, id));
  }

  async findProductById(productId: number): Promise<{ id: number; name: string } | undefined> {
    const [row] = await this.db.select({ id: products.id, name: products.name })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    return row;
  }

  transaction<T>(fn: (repo: InventoryRepository) => T): T {
    // better-sqlite3 drizzle is synchronous — .transaction() runs the callback atomically
    return this.db.transaction((tx) => fn(new InventoryRepository(tx as unknown as DbClient)));
  }
}
