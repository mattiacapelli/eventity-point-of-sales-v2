import { randomUUID } from "node:crypto";
import { claimEvent, eq, appSettings } from "@pos/db";
import type { DbClient } from "@pos/db";
import type { IEventBus } from "@pos/event-bus";
import { ORDER_STATUS_TRANSITIONS } from "@pos/shared-types";
import type { Order, CreateOrderInput, OrderStatus } from "@pos/shared-types";
import type { OrderRepository } from "../repository/order.repository.js";

export class OrderService {
  constructor(
    private readonly repo: OrderRepository,
    private readonly eventBus: IEventBus,
    private readonly db: DbClient,
  ) {}

  /**
   * Subscribe to all inbound command events.
   * Call once during module init — wires this service as the sole order writer.
   */
  subscribeToStatusRequests(): void {
    this._subscribeStatusRequested();
    this._subscribePaymentCompleted();
  }

  private _subscribeStatusRequested(): void {
    this.eventBus.on("ORDER_STATUS_REQUESTED", async (payload) => {
      // Idempotency: ignore if this exact traceId was already handled
      const claimed = await claimEvent(this.db, "order-service:status-requested", payload.traceId);
      if (!claimed) return;

      try {
        await this.updateStatus(payload.orderId, payload.newStatus);
      } catch (err) {
        this.eventBus.emit("MODULE_ERROR", {
          moduleName: "sales",
          error: err instanceof Error ? err.message : String(err),
          timestamp: new Date(),
        });
      }
    });
  }

  private async _isExpressMode(): Promise<boolean> {
    const rows = await this.db.select().from(appSettings).where(eq(appSettings.key, "express_mode"));
    return rows[0]?.value === "true";
  }

  /** When payment completes, transition the order based on express_mode setting. */
  private _subscribePaymentCompleted(): void {
    this.eventBus.on("PAYMENT_COMPLETED", async (payload) => {
      const claimed = await claimEvent(this.db, "order-service:payment-completed", payload.traceId);
      if (!claimed) return;

      try {
        const express = await this._isExpressMode();
        const targetStatus = express ? "completed" : "confirmed";
        await this.updateStatus(payload.payment.orderId, targetStatus);
      } catch (err) {
        this.eventBus.emit("MODULE_ERROR", {
          moduleName: "sales",
          error: err instanceof Error ? err.message : String(err),
          timestamp: new Date(),
        });
      }
    });
  }

  async getById(id: string): Promise<Order> {
    const order = await this.repo.findById(id);
    if (order === null) throw new OrderNotFoundError(id);
    return order;
  }

  async list(filters?: { status?: OrderStatus; shiftId?: string; terminalId?: string; from?: number; to?: number; limit?: number; offset?: number }): Promise<Order[]> {
    return this.repo.findAll(filters);
  }

  async create(input: CreateOrderInput): Promise<Order> {
    if (input.items.length === 0) {
      throw new OrderValidationError("Order must have at least one item");
    }

    const order = await this.repo.create(input);

    this.eventBus.emit("ORDER_CREATED", {
      traceId: randomUUID(),
      order,
      input,
      timestamp: new Date(),
    });

    return order;
  }

  /** The ONLY method that writes order status to the DB. */
  async updateStatus(id: string, newStatus: OrderStatus): Promise<Order> {
    const current = await this.getById(id);
    const allowed = ORDER_STATUS_TRANSITIONS[current.status];

    if (!allowed.includes(newStatus)) {
      throw new OrderValidationError(
        `Cannot transition order from "${current.status}" to "${newStatus}"`,
      );
    }

    const updated = await this.repo.updateStatus(id, newStatus);
    if (updated === null) throw new OrderNotFoundError(id);

    if (newStatus === "cancelled") {
      this.eventBus.emit("ORDER_CANCELLED", {
        traceId: randomUUID(),
        orderId: id,
        timestamp: new Date(),
      });
    } else {
      this.eventBus.emit("ORDER_UPDATED", {
        traceId: randomUUID(),
        order: updated,
        input: { id, status: newStatus },
        previousStatus: current.status,
        timestamp: new Date(),
      });
    }

    return updated;
  }

  async updateDetails(id: string, data: { tableId?: string | null; customerName?: string | null }): Promise<Order> {
    const current = await this.getById(id); // throws OrderNotFoundError if missing
    const updated = await this.repo.updateDetails(id, data);
    if (updated === null) throw new OrderNotFoundError(id);

    this.eventBus.emit("ORDER_UPDATED", {
      traceId: randomUUID(),
      order: updated,
      input: { id, ...data },
      previousStatus: current.status,
      timestamp: new Date(),
    });

    return updated;
  }

  async updateItems(id: string, items: Array<{ productId: string; name: string; quantity: number; selectedOptionIds?: string[] | undefined; notes?: string | undefined }>): Promise<Order> {
    const current = await this.getById(id);
    if (current.status === "completed" || current.status === "cancelled") {
      throw new OrderValidationError(`Cannot edit items on order in status "${current.status}"`);
    }
    const updated = await this.repo.replaceItems(id, items);
    if (updated === null) throw new OrderNotFoundError(id);
    this.eventBus.emit("ORDER_UPDATED", {
      traceId: randomUUID(),
      order: updated,
      input: { id },
      previousStatus: current.status,
      timestamp: new Date(),
    });
    return updated;
  }

  async cancel(id: string, reason?: string): Promise<Order> {
    const current = await this.getById(id);

    if (!ORDER_STATUS_TRANSITIONS[current.status].includes("cancelled")) {
      throw new OrderValidationError(
        `Cannot cancel order in status "${current.status}"`,
      );
    }

    const updated = await this.repo.updateStatus(id, "cancelled");
    if (updated === null) throw new OrderNotFoundError(id);

    this.eventBus.emit("ORDER_CANCELLED", {
      traceId: randomUUID(),
      orderId: id,
      ...(reason !== undefined ? { reason } : {}),
      timestamp: new Date(),
    });

    return updated;
  }
}

export class OrderNotFoundError extends Error {
  constructor(id: string) {
    super(`Order "${id}" not found`);
    this.name = "OrderNotFoundError";
  }
}

export class OrderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderValidationError";
  }
}
