import { eq, inArray, desc, orders, orderItems } from "@pos/db";
import type { DbClient } from "@pos/db";
import type { Order, OrderItem, OrderStatus } from "@pos/shared-types";

type DbOrderRow = {
  id: number;
  tableId: string | null;
  eventId: string | null;
  status: string;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
  syncedAt: Date | null;
};

type DbItemRow = {
  id: number;
  orderId: number;
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  notes: string | null;
};

const KITCHEN_STATUSES: OrderStatus[] = ["pending", "confirmed", "preparing", "ready"];

export class KitchenRepository {
  constructor(private readonly db: DbClient) {}

  async findQueue(): Promise<Order[]> {
    const rows = await this.db
      .select()
      .from(orders)
      .where(inArray(orders.status, KITCHEN_STATUSES))
      .orderBy(desc(orders.createdAt));

    return Promise.all(
      (rows as unknown as DbOrderRow[]).map((row) => this.hydrateOrder(row)),
    );
  }

  async findById(id: number): Promise<Order | undefined> {
    const [row] = await this.db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!row) return undefined;
    return this.hydrateOrder(row as unknown as DbOrderRow);
  }

  private async hydrateOrder(row: DbOrderRow): Promise<Order> {
    const items = await this.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, row.id));

    return {
      id: row.id,
      status: row.status as OrderStatus,
      totalAmount: row.totalAmount,
      discountAmount: (row as unknown as { discountAmount?: number }).discountAmount ?? 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      items: (items as unknown as DbItemRow[]).map((i): OrderItem => ({
        id: i.id,
        productId: i.productId,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        ...(i.notes !== null ? { notes: i.notes } : {}),
      })),
      ...(row.tableId !== null ? { tableId: row.tableId } : {}),
      ...(row.eventId !== null ? { eventId: row.eventId } : {}),
      ...(row.syncedAt !== null ? { syncedAt: row.syncedAt } : {}),
    };
  }
}
