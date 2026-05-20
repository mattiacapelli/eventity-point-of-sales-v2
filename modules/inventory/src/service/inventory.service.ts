import { randomUUID } from "node:crypto";
import type { IEventBus } from "@pos/event-bus";
import type { InventoryRepository, InventoryItem, InventoryMovement, MovementFilters } from "../repository/inventory.repository.js";

export class InventoryValidationError extends Error {}

export type OrderItemForInventory = {
  productId: string;
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

  async getItem(id: string): Promise<InventoryItem> {
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
    productionCenterId?: string | null;
  }): Promise<InventoryItem> {
    const now = Math.floor(Date.now() / 1000);
    return this.repo.createItem({
      id: randomUUID(),
      name: data.name,
      sku: data.sku ?? null,
      unit: data.unit ?? "pz",
      currentStock: data.currentStock ?? 0,
      minStock: data.minStock ?? 0,
      productionCenterId: data.productionCenterId ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  async updateItem(id: string, data: {
    name?: string;
    sku?: string | null;
    unit?: string;
    minStock?: number;
    productionCenterId?: string | null;
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

    return (await this.repo.updateItem(id, update))!;
  }

  async deleteItem(id: string): Promise<void> {
    const existing = await this.repo.findItemById(id);
    if (!existing) throw new InventoryValidationError(`Item ${id} not found`);
    await this.repo.deleteItem(id);
  }

  async adjustStock(id: string, quantity: number, reason?: string): Promise<InventoryItem> {
    const item = await this.repo.findItemById(id);
    if (!item) throw new InventoryValidationError(`Item ${id} not found`);

    const now = Math.floor(Date.now() / 1000);
    const newStock = item.currentStock + quantity;

    await this.repo.updateItem(id, { currentStock: newStock, updatedAt: now });
    await this.repo.createMovement({
      id: randomUUID(),
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

  async getItemMovements(itemId: string): Promise<InventoryMovement[]> {
    return this.repo.findMovements({ itemId });
  }

  async getLowStockAlerts(): Promise<InventoryItem[]> {
    return this.repo.findLowStockItems();
  }

  async decrementForOrder(orderId: string, items: OrderItemForInventory[]): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const traceId = randomUUID();

    for (const orderItem of items) {
      const ingredients = await this.repo.findIngredientsByProduct(orderItem.productId);

      if (ingredients.length > 0) {
        for (const ingredient of ingredients) {
          const invItem = await this.repo.findItemById(ingredient.inventoryItemId);
          if (!invItem) continue;

          const delta = -(orderItem.quantity * ingredient.quantity);
          const newStock = invItem.currentStock + delta;
          await this.repo.updateItem(ingredient.inventoryItemId, { currentStock: newStock, updatedAt: now });
          await this.repo.createMovement({
            id: randomUUID(),
            itemId: ingredient.inventoryItemId,
            type: "sale",
            quantity: delta,
            reason: null,
            orderId,
            createdAt: now,
          });

          this.eventBus.emit("INVENTORY_UPDATED", {
            traceId,
            itemId: ingredient.inventoryItemId,
            movementType: "sale",
            quantity: delta,
            timestamp: new Date(),
          });

          const fresh = (await this.repo.findItemById(ingredient.inventoryItemId))!;
          if (fresh.currentStock <= fresh.minStock && fresh.minStock > 0) {
            this.eventBus.emit("LOW_STOCK_ALERT", {
              traceId,
              itemId: ingredient.inventoryItemId,
              itemName: fresh.name,
              currentStock: fresh.currentStock,
              minStock: fresh.minStock,
              timestamp: new Date(),
            });
          }
        }
      } else {
        // Fallback: try to find inventory item by product name
        const product = await this.repo.findProductById(orderItem.productId);
        if (!product) continue;

        const invItem = await this.repo.findItemByName(product.name);
        if (!invItem) continue; // no matching item configured → ignore

        const delta = -orderItem.quantity;
        const newStock = invItem.currentStock + delta;
        await this.repo.updateItem(invItem.id, { currentStock: newStock, updatedAt: now });
        await this.repo.createMovement({
          id: randomUUID(),
          itemId: invItem.id,
          type: "sale",
          quantity: delta,
          reason: null,
          orderId,
          createdAt: now,
        });

        this.eventBus.emit("INVENTORY_UPDATED", {
          traceId,
          itemId: invItem.id,
          movementType: "sale",
          quantity: delta,
          timestamp: new Date(),
        });

        const fresh = (await this.repo.findItemById(invItem.id))!;
        if (fresh.currentStock <= fresh.minStock && fresh.minStock > 0) {
          this.eventBus.emit("LOW_STOCK_ALERT", {
            traceId,
            itemId: invItem.id,
            itemName: fresh.name,
            currentStock: fresh.currentStock,
            minStock: fresh.minStock,
            timestamp: new Date(),
          });
        }
      }
    }
  }

  async getIngredientsByProduct(productId: string) {
    return this.repo.findIngredientsByProduct(productId);
  }

  async createIngredient(data: { productId: string; inventoryItemId: string; quantity?: number }) {
    return this.repo.createIngredient({
      id: randomUUID(),
      productId: data.productId,
      inventoryItemId: data.inventoryItemId,
      quantity: data.quantity ?? 1,
    });
  }

  async deleteIngredient(id: string): Promise<void> {
    await this.repo.deleteIngredient(id);
  }
}
