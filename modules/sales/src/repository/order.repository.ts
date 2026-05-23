import { randomUUID } from "node:crypto";
import { eq, desc, and, gte, lte, inArray, orders, orderItems, products, options, sql } from "@pos/db";
import type { DbClient } from "@pos/db";
import type { Order, OrderItem, CreateOrderInput, OrderStatus, UpdateOrderInput } from "@pos/shared-types";

type DbOrderRow = {
  id: string;
  tableId: string | null;
  eventId: string | null;
  shiftId: string | null;
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

type JoinRow = {
  orderId: string;
  tableId: string | null;
  eventId: string | null;
  shiftId: string | null;
  status: string;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
  syncedAt: Date | null;
  // nullable when order has no items (left join)
  itemId: string | null;
  productId: string | null;
  itemName: string | null;
  quantity: number | null;
  unitPrice: number | null;
  notes: string | null;
};

export class OrderRepository {
  constructor(private readonly db: DbClient) {}

  async findById(id: string): Promise<Order | null> {
    const rows = await this.db
      .select({
        // order columns
        orderId:      orders.id,
        tableId:      orders.tableId,
        eventId:      orders.eventId,
        shiftId:      orders.shiftId,
        status:       orders.status,
        totalAmount:  orders.totalAmount,
        createdAt:    orders.createdAt,
        updatedAt:    orders.updatedAt,
        syncedAt:     orders.syncedAt,
        // item columns (null when no items)
        itemId:       orderItems.id,
        productId:    orderItems.productId,
        itemName:     orderItems.name,
        quantity:     orderItems.quantity,
        unitPrice:    orderItems.unitPrice,
        notes:        orderItems.notes,
      })
      .from(orders)
      .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(eq(orders.id, id));

    if (rows.length === 0) return null;
    return this._collapseRows(rows as unknown as JoinRow[])[0] ?? null;
  }

  async findAll(filters?: { status?: OrderStatus; shiftId?: string; from?: number; to?: number; limit?: number; offset?: number }): Promise<Order[]> {
    const conditions = [];
    if (filters?.status !== undefined) conditions.push(eq(orders.status, filters.status));
    if (filters?.shiftId !== undefined) conditions.push(eq(orders.shiftId, filters.shiftId));
    if (filters?.from !== undefined) conditions.push(gte(orders.createdAt, new Date(filters.from)));
    if (filters?.to !== undefined) conditions.push(lte(orders.createdAt, new Date(filters.to)));

    // Subquery: get matching order IDs with pagination, then JOIN items
    const idQuery = this.db
      .select({ id: orders.id })
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(filters?.limit ?? 200)
      .offset(filters?.offset ?? 0);

    const filteredIdQuery = conditions.length > 0
      ? idQuery.where(and(...conditions))
      : idQuery;

    const matchingIds = (await filteredIdQuery).map((r) => r.id);
    if (matchingIds.length === 0) return [];

    const rows = await this.db
      .select({
        orderId:      orders.id,
        tableId:      orders.tableId,
        eventId:      orders.eventId,
        shiftId:      orders.shiftId,
        status:       orders.status,
        totalAmount:  orders.totalAmount,
        createdAt:    orders.createdAt,
        updatedAt:    orders.updatedAt,
        syncedAt:     orders.syncedAt,
        itemId:       orderItems.id,
        productId:    orderItems.productId,
        itemName:     orderItems.name,
        quantity:     orderItems.quantity,
        unitPrice:    orderItems.unitPrice,
        notes:        orderItems.notes,
      })
      .from(orders)
      .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(inArray(orders.id, matchingIds))
      .orderBy(desc(orders.createdAt));

    return this._collapseRows(rows as unknown as JoinRow[]);
  }

  async create(input: CreateOrderInput): Promise<Order> {
    const id = randomUUID();
    const now = new Date();

    // Resolve canonical prices from DB — never trust client-supplied prices
    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const productRows = await this.db
      .select({ id: products.id, price: products.price })
      .from(products)
      .where(inArray(products.id, productIds));
    const productPriceMap = new Map(productRows.map((p) => [p.id, p.price]));

    // Collect all option IDs across all items
    const allOptionIds = input.items.flatMap((i) => i.selectedOptionIds ?? []);
    const optionDeltaMap = new Map<string, number>();
    if (allOptionIds.length > 0) {
      const optionRows = await this.db
        .select({ id: options.id, priceDelta: options.priceDelta })
        .from(options)
        .where(inArray(options.id, allOptionIds));
      for (const o of optionRows) optionDeltaMap.set(o.id, o.priceDelta);
    }

    const itemsWithIds = input.items.map((item) => {
      const basePrice = productPriceMap.get(item.productId) ?? 0;
      const optionDelta = (item.selectedOptionIds ?? []).reduce(
        (sum, oid) => sum + (optionDeltaMap.get(oid) ?? 0),
        0
      );
      return {
        id: randomUUID(),
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: basePrice + optionDelta,
        notes: item.notes ?? null,
      };
    });

    const totalAmount = itemsWithIds.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );

    await this.db.insert(orders).values({
      id,
      tableId: input.tableId ?? null,
      eventId: input.eventId ?? null,
      shiftId: input.shiftId ?? null,
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
          notes: item.notes,
        }))
      );
    }

    return this.toOrder(
      {
        id,
        tableId: input.tableId ?? null,
        eventId: input.eventId ?? null,
        shiftId: input.shiftId ?? null,
        status: "pending",
        totalAmount,
        createdAt: now,
        updatedAt: now,
        syncedAt: null,
      },
      itemsWithIds.map((item) => ({ ...item, orderId: id }))
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

  private _collapseRows(rows: JoinRow[]): Order[] {
    const orderMap = new Map<string, { row: JoinRow; items: DbItemRow[] }>();
    for (const r of rows) {
      if (!orderMap.has(r.orderId)) {
        orderMap.set(r.orderId, { row: r, items: [] });
      }
      if (r.itemId !== null && r.productId !== null && r.itemName !== null && r.quantity !== null && r.unitPrice !== null) {
        orderMap.get(r.orderId)!.items.push({
          id: r.itemId,
          orderId: r.orderId,
          productId: r.productId,
          name: r.itemName,
          quantity: r.quantity,
          unitPrice: r.unitPrice,
          notes: r.notes,
        });
      }
    }
    return [...orderMap.values()].map(({ row, items }) =>
      this.toOrder(
        {
          id: row.orderId,
          tableId: row.tableId,
          eventId: row.eventId,
          shiftId: row.shiftId,
          status: row.status,
          totalAmount: row.totalAmount,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          syncedAt: row.syncedAt,
        },
        items,
      )
    );
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
      ...(row.shiftId !== null ? { shiftId: row.shiftId } : {}),
      ...(row.syncedAt !== null ? { syncedAt: row.syncedAt } : {}),
    };
    return base;
  }
}
