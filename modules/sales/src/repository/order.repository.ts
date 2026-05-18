import { randomUUID } from "node:crypto";
import { eq, desc, orders, orderItems } from "@pos/db";
import type { DbClient } from "@pos/db";
import type { Order, OrderItem, CreateOrderInput, OrderStatus } from "@pos/shared-types";

type DbOrderRow = {
  id: string;
  tableId: string | null;
  eventId: string | null;
  status: string;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
  syncedAt: Date | null;
};

type DbItemRow = {
  id: string;
  orderId: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes: string | null;
};

export class OrderRepository {
  constructor(private readonly db: DbClient) {}

  async findById(id: string): Promise<Order | null> {
    const [order] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);

    if (order === undefined) return null;

    const items = await this.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, id));

    return this.toOrder(order as unknown as DbOrderRow, items as unknown as DbItemRow[]);
  }

  async findAll(limit = 100): Promise<Order[]> {
    const rows = await this.db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(limit);

    const result: Order[] = [];
    for (const row of rows) {
      const items = await this.db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, row.id));
      result.push(this.toOrder(row as unknown as DbOrderRow, items as unknown as DbItemRow[]));
    }
    return result;
  }

  async findByStatus(status: OrderStatus): Promise<Order[]> {
    const rows = await this.db
      .select()
      .from(orders)
      .where(eq(orders.status, status))
      .orderBy(desc(orders.createdAt));

    const result: Order[] = [];
    for (const row of rows) {
      const items = await this.db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, row.id));
      result.push(this.toOrder(row as unknown as DbOrderRow, items as unknown as DbItemRow[]));
    }
    return result;
  }

  async create(input: CreateOrderInput): Promise<Order> {
    const id = randomUUID();
    const now = new Date();

    const itemsWithIds = input.items.map((item) => ({
      ...item,
      id: randomUUID(),
    }));

    const totalAmount = itemsWithIds.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );

    await this.db.insert(orders).values({
      id,
      tableId: input.tableId ?? null,
      eventId: input.eventId ?? null,
      status: "pending",
      totalAmount,
      createdAt: now,
      updatedAt: now,
    });

    if (itemsWithIds.length > 0) {
      await this.db.insert(orderItems).values(
        itemsWithIds.map((item) => ({
          id: item.id,
          orderId: id,
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          notes: item.notes ?? null,
        }))
      );
    }

    return this.toOrder(
      {
        id,
        tableId: input.tableId ?? null,
        eventId: input.eventId ?? null,
        status: "pending",
        totalAmount,
        createdAt: now,
        updatedAt: now,
        syncedAt: null,
      },
      itemsWithIds.map((item) => ({
        id: item.id,
        orderId: id,
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        notes: item.notes ?? null,
      }))
    );
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order | null> {
    await this.db
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(orders.id, id));

    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(orderItems).where(eq(orderItems.orderId, id));
    await this.db.delete(orders).where(eq(orders.id, id));
  }

  private toOrder(row: DbOrderRow, items: DbItemRow[]): Order {
    const base: Order = {
      id: row.id,
      status: row.status as OrderStatus,
      totalAmount: row.totalAmount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      items: items.map((i): OrderItem => {
        const item: OrderItem = {
          id: i.id,
          productId: i.productId,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          ...(i.notes !== null ? { notes: i.notes } : {}),
        };
        return item;
      }),
      ...(row.tableId !== null ? { tableId: row.tableId } : {}),
      ...(row.eventId !== null ? { eventId: row.eventId } : {}),
      ...(row.syncedAt !== null ? { syncedAt: row.syncedAt } : {}),
    };
    return base;
  }
}
