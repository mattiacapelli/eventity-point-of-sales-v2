import { randomUUID } from "node:crypto";
import type { EventBus } from "@pos/event-bus";
import type { Order, OrderStatus } from "@pos/shared-types";
import { ALLOWED_TRANSITIONS } from "./transitions.js";
import type { KitchenRepository } from "../repository/kitchen.repository.js";

export class KitchenValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KitchenValidationError";
  }
}

export class KitchenService {
  constructor(
    private readonly repo: KitchenRepository,
    private readonly eventBus: EventBus,
  ) {}

  async getQueue(): Promise<Order[]> {
    return this.repo.findQueue();
  }

  async getOrder(id: string): Promise<Order> {
    const order = await this.repo.findById(id);
    if (!order) throw new KitchenValidationError(`Order ${id} not found`);
    return order;
  }

  /**
   * Validates the transition is legal, then emits ORDER_STATUS_REQUESTED.
   * OrderService is the sole entity that will write the new status and emit ORDER_UPDATED.
   * Returns the current order snapshot (pre-transition) so the HTTP response is immediate.
   */
  async requestTransition(id: string, newStatus: OrderStatus): Promise<Order> {
    const order = await this.getOrder(id);

    const allowed = ALLOWED_TRANSITIONS[order.status];
    if (!allowed.includes(newStatus)) {
      throw new KitchenValidationError(
        `Cannot transition order from "${order.status}" to "${newStatus}"`,
      );
    }

    this.eventBus.emit("ORDER_STATUS_REQUESTED", {
      traceId: randomUUID(),
      orderId: id,
      newStatus,
      requestedBy: "kitchen",
      timestamp: new Date(),
    });

    return order;
  }
}
