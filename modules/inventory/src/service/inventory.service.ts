import { randomUUID } from "node:crypto";
import type { IEventBus } from "@pos/event-bus";
import type { InventoryRepository, InventoryItem, InventoryMovement, MovementFilters } from "../repository/inventory.repository.js";

export class InventoryValidationError extends Error {}

export type OrderItemForInventory = {
  productId: number;
  quantity: number;
};

export class InventoryService {
  constructor(
    private readonly repo: InventoryRepository,
    private readonly eventBus: IEventBus,
  ) {}

  async listItems(): Promise<InventoryItem[]> {
    return this.repo.findAllItems();
  }

  async getItem(id: number): Promise<InventoryItem> {
    const item = await this.repo.findItemById(id);
    if (!item) throw new InventoryValidationError(`Item ${id} not found`);
    return item;
  }

  async createItem(data: {
    name: string;
    sku?: string | null;
    unit?: string;
    currentStock?: number;
    minStock?: number;
    productionCenterId?: number | null;
    productId?: number | null;
    resetOnShiftOpen?: boolean;
  }): Promise<InventoryItem> {
    const now = Math.floor(Date.now() / 1000);
    return this.repo.createItem({
      name: data.name,
      sku: data.sku ?? null,
      unit: data.unit ?? "pz",
      currentStock: data.currentStock ?? 0,
      minStock: data.minStock ?? 0,
      productionCenterId: data.productionCenterId ?? null,
      productId: data.productId ?? null,
      resetOnShiftOpen: data.resetOnShiftOpen ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  async updateItem(id: number, data: {
    name?: string;
    sku?: string | null;
    unit?: string;
    minStock?: number;
    productionCenterId?: number | null;
    productId?: number | null;
    resetOnShiftOpen?: boolean;
  }): Promise<InventoryItem> {
    const existing = await this.repo.findItemById(id);
    if (!existing) throw new InventoryValidationError(`Item ${id} not found`);

    const now = Math.floor(Date.now() / 1000);
    const update: Parameters<typeof this.repo.updateItem>[1] = { updatedAt: now };
    if (data.name !== undefined) update.name = data.name;
    if ("sku" in data) update.sku = data.sku ?? null;
    if (data.unit !== undefined) update.unit = data.unit;
    if (data.minStock !== undefined) update.minStock = data.minStock;
    if ("productionCenterId" in data) update.productionCenterId = data.productionCenterId ?? null;
    if ("productId" in data) update.productId = data.productId ?? null;
    if (data.resetOnShiftOpen !== undefined) update.resetOnShiftOpen = data.resetOnShiftOpen ? 1 : 0;

    return (await this.repo.updateItem(id, update))!;
  }

  async getItemsByProduct(productId: number): Promise<InventoryItem[]> {
    return this.repo.findItemsByProductId(productId);
  }

  async deleteItem(id: number): Promise<void> {
    const existing = await this.repo.findItemById(id);
    if (!existing) throw new InventoryValidationError(`Item ${id} not found`);
    await this.repo.deleteMovementsByItemId(id);
    await this.repo.deleteItem(id);
  }

  async adjustStock(id: number, quantity: number, reason?: string): Promise<InventoryItem> {
    const item = await this.repo.findItemById(id);
    if (!item) throw new InventoryValidationError(`Item ${id} not found`);

    const now = Math.floor(Date.now() / 1000);
    const newStock = item.currentStock + quantity;

    await this.repo.updateItem(id, { currentStock: newStock, updatedAt: now });
    await this.repo.createMovement({
      itemId: id,
      type: "manual",
      quantity,
      reason: reason ?? null,
      orderId: null,
      createdAt: now,
    });

    const traceId = randomUUID();
    this.eventBus.emit("INVENTORY_UPDATED", {
      traceId,
      itemId: id,
      movementType: "manual",
      quantity,
      timestamp: new Date(),
    });

    const updated = (await this.repo.findItemById(id))!;
    if (updated.currentStock <= updated.minStock && updated.minStock > 0) {
      this.eventBus.emit("LOW_STOCK_ALERT", {
        traceId,
        itemId: id,
        itemName: updated.name,
        currentStock: updated.currentStock,
        minStock: updated.minStock,
        timestamp: new Date(),
      });
    }

    return updated;
  }

  async listMovements(filters: MovementFilters = {}): Promise<InventoryMovement[]> {
    return this.repo.findMovements(filters);
  }

  async getItemMovements(itemId: number): Promise<InventoryMovement[]> {
    return this.repo.findMovements({ itemId });
  }

  async getLowStockAlerts(): Promise<InventoryItem[]> {
    return this.repo.findLowStockItems();
  }

  async decrementForOrder(orderId: number, items: OrderItemForInventory[]): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const traceId = randomUUID();

    type Delta = { itemId: number; itemName: string; delta: number };
    const deltas: Delta[] = [];

    for (const orderItem of items) {
      const ingredients = await this.repo.findIngredientsByProduct(orderItem.productId);

      if (ingredients.length > 0) {
        for (const ingredient of ingredients) {
          const invItem = await this.repo.findItemById(ingredient.inventoryItemId);
          if (!invItem) continue;
          deltas.push({
            itemId: invItem.id,
            itemName: invItem.name,
            delta: -(orderItem.quantity * ingredient.quantity),
          });
        }
      } else {
        const product = await this.repo.findProductById(orderItem.productId);
        if (!product) continue;
        const invItem = await this.repo.findItemByName(product.name);
        if (!invItem) continue;
        deltas.push({
          itemId: invItem.id,
          itemName: invItem.name,
          delta: -orderItem.quantity,
        });
      }
    }

    if (deltas.length === 0) return;

    const newStocks = this.repo.transaction((txRepo) => {
      const result: Map<number, { newStock: number; minStock: number }> = new Map();
      for (const d of deltas) {
        const current = txRepo.findItemByIdSync(d.itemId);
        if (!current) continue;
        const newStock = current.currentStock + d.delta;
        result.set(d.itemId, { newStock, minStock: current.minStock });
        void txRepo.updateItem(d.itemId, { currentStock: newStock, updatedAt: now });
        void txRepo.createMovement({
          itemId: d.itemId,
          type: "sale",
          quantity: d.delta,
          reason: null,
          orderId,
          createdAt: now,
        });
      }
      return result;
    });

    for (const d of deltas) {
      this.eventBus.emit("INVENTORY_UPDATED", {
        traceId,
        itemId: d.itemId,
        movementType: "sale",
        quantity: d.delta,
        timestamp: new Date(),
      });
      const entry = newStocks.get(d.itemId);
      if (entry && entry.newStock <= entry.minStock && entry.minStock > 0) {
        this.eventBus.emit("LOW_STOCK_ALERT", {
          traceId,
          itemId: d.itemId,
          itemName: d.itemName,
          currentStock: entry.newStock,
          minStock: entry.minStock,
          timestamp: new Date(),
        });
      }
    }
  }

  async getIngredientsByProduct(productId: number) {
    return this.repo.findIngredientsByProduct(productId);
  }

  async createIngredient(data: { productId: number; inventoryItemId: number; quantity?: number }) {
    return this.repo.createIngredient({
      productId: data.productId,
      inventoryItemId: data.inventoryItemId,
      quantity: data.quantity ?? 1,
    });
  }

  async deleteIngredient(id: number): Promise<void> {
    await this.repo.deleteIngredient(id);
  }
}
