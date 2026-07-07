import { randomUUID } from "node:crypto";
import { eq, desc, and, gte, lte, inArray, orders, orderItems, orderItemOptions, products, options, sql, appSettings, receiptCounters } from "@pos/db";
import type { DbClient } from "@pos/db";
import type { Order, OrderItem, OrderItemOption, VatBreakdown, CreateOrderInput, OrderStatus, UpdateOrderInput } from "@pos/shared-types";

export function formatReceiptNumber(
  n: number | undefined,
  id: string,
  prefix: string,
  padding: number,
): string {
  if (n === undefined) return id.slice(-6).toUpperCase();
  const padded = padding > 0 ? String(n).padStart(padding, "0") : String(n);
  return `${prefix}${padded}`;
}

type DbOrderRow = {
  id: string;
  tableId: string | null;
  customerName: string | null;
  eventId: string | null;
  shiftId: string | null;
  terminalId: string | null;
  status: string;
  totalAmount: number;
  discountAmount: number;
  discountType: string | null;
  notes: string | null;
  pax: number | null;
  receiptNumber: number | null;
  fiscalDocNumber: string | null;
  fiscalDocDate: string | null;
  fiscalRtSerial: string | null;
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
  vatRate?: number;
  notes: string | null;
};

type JoinRow = {
  orderId: string;
  tableId: string | null;
  customerName: string | null;
  eventId: string | null;
  shiftId: string | null;
  terminalId: string | null;
  status: string;
  totalAmount: number;
  discountAmount: number;
  discountType: string | null;
  orderNotes: string | null;
  pax: number | null;
  receiptNumber: number | null;
  fiscalDocNumber: string | null;
  fiscalDocDate: string | null;
  fiscalRtSerial: string | null;
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

  private async _getAppSetting(key: string): Promise<string | null> {
    const rows = await this.db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, key));
    return rows[0]?.value ?? null;
  }

  private async _nextReceiptNumber(scope: string): Promise<number> {
    // Single atomic upsert+increment+return — SQLite serialises writes so no two
    // concurrent callers can read the same counter value.
    const [row] = await this.db
      .insert(receiptCounters)
      .values({ scope, lastValue: 1 })
      .onConflictDoUpdate({
        target: receiptCounters.scope,
        set: { lastValue: sql`${receiptCounters.lastValue} + 1` },
      })
      .returning({ v: receiptCounters.lastValue });
    return row!.v;
  }

  async findById(id: string): Promise<Order | null> {
    const rows = await this.db
      .select({
        // order columns
        orderId:        orders.id,
        tableId:        orders.tableId,
        customerName:   orders.customerName,
        eventId:        orders.eventId,
        shiftId:        orders.shiftId,
        terminalId:     orders.terminalId,
        status:         orders.status,
        totalAmount:    orders.totalAmount,
        discountAmount: orders.discountAmount,
        discountType:   orders.discountType,
        orderNotes:     orders.notes,
        pax:             orders.pax,
        receiptNumber:   orders.receiptNumber,
        fiscalDocNumber: orders.fiscalDocNumber,
        fiscalDocDate:   orders.fiscalDocDate,
        fiscalRtSerial:  orders.fiscalRtSerial,
        createdAt:       orders.createdAt,
        updatedAt:       orders.updatedAt,
        syncedAt:        orders.syncedAt,
        // item columns (null when no items)
        itemId:         orderItems.id,
        productId:      orderItems.productId,
        itemName:       orderItems.name,
        quantity:       orderItems.quantity,
        unitPrice:      orderItems.unitPrice,
        notes:          orderItems.notes,
      })
      .from(orders)
      .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(eq(orders.id, id));

    if (rows.length === 0) return null;
    return (await this._collapseRowsWithOptions(rows as unknown as JoinRow[]))[0] ?? null;
  }

  async findAll(filters?: { status?: OrderStatus; shiftId?: string; terminalId?: string; from?: number; to?: number; limit?: number; offset?: number }): Promise<Order[]> {
    const conditions = [];
    if (filters?.status !== undefined) conditions.push(eq(orders.status, filters.status));
    if (filters?.shiftId !== undefined) conditions.push(eq(orders.shiftId, filters.shiftId));
    if (filters?.terminalId !== undefined) conditions.push(eq(orders.terminalId, filters.terminalId));
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
        orderId:        orders.id,
        tableId:        orders.tableId,
        customerName:   orders.customerName,
        eventId:        orders.eventId,
        shiftId:        orders.shiftId,
        terminalId:     orders.terminalId,
        status:         orders.status,
        totalAmount:    orders.totalAmount,
        discountAmount: orders.discountAmount,
        discountType:   orders.discountType,
        orderNotes:     orders.notes,
        pax:             orders.pax,
        receiptNumber:   orders.receiptNumber,
        fiscalDocNumber: orders.fiscalDocNumber,
        fiscalDocDate:   orders.fiscalDocDate,
        fiscalRtSerial:  orders.fiscalRtSerial,
        createdAt:       orders.createdAt,
        updatedAt:       orders.updatedAt,
        syncedAt:        orders.syncedAt,
        itemId:          orderItems.id,
        productId:       orderItems.productId,
        itemName:       orderItems.name,
        quantity:       orderItems.quantity,
        unitPrice:      orderItems.unitPrice,
        notes:          orderItems.notes,
      })
      .from(orders)
      .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(inArray(orders.id, matchingIds))
      .orderBy(desc(orders.createdAt));

    return this._collapseRowsWithOptions(rows as unknown as JoinRow[]);
  }

  async create(input: CreateOrderInput): Promise<Order> {
    const id = randomUUID();
    const now = new Date();

    // Resolve canonical prices from DB — never trust client-supplied prices
    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const productRows = await this.db
      .select({ id: products.id, price: products.price, vatRate: products.vatRate })
      .from(products)
      .where(inArray(products.id, productIds));
    const productPriceMap = new Map(productRows.map((p) => [p.id, { price: p.price, vatRate: p.vatRate ?? 10 }]));

    // Collect all option IDs across all items
    const allOptionIds = input.items.flatMap((i) => i.selectedOptionIds ?? []);
    const optionMap = new Map<string, { priceDelta: number; name: string }>();
    if (allOptionIds.length > 0) {
      const optionRows = await this.db
        .select({ id: options.id, priceDelta: options.priceDelta, name: options.name })
        .from(options)
        .where(inArray(options.id, allOptionIds));
      for (const o of optionRows) optionMap.set(o.id, { priceDelta: o.priceDelta, name: o.name });
    }

    const itemsWithIds = input.items.map((item) => {
      const productData = productPriceMap.get(item.productId);
      if (productData === undefined) throw new Error(`Product not found: ${item.productId}`);
      const optionDelta = (item.selectedOptionIds ?? []).reduce(
        (sum, oid) => sum + (optionMap.get(oid)?.priceDelta ?? 0),
        0
      );
      return {
        id: randomUUID(),
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: productData.price + optionDelta,
        vatRate: productData.vatRate,
        notes: item.notes ?? null,
        selectedOptionIds: item.selectedOptionIds ?? [],
      };
    });

    const subtotal = itemsWithIds.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );
    const discountAmount = Math.min(input.discountAmount ?? 0, subtotal);
    const totalAmount = subtotal - discountAmount;

    const mode = await this._getAppSetting("receipt_number_mode") ?? "shift";
    let receiptNumber: number | null = null;
    if (mode === "global") {
      receiptNumber = await this._nextReceiptNumber("global");
    } else if (mode === "shift") {
      // No active shift (e.g. order created outside a shift) — fall back to a
      // global progressive so the receipt still gets a number instead of silently staying null.
      receiptNumber = await this._nextReceiptNumber(input.shiftId ? `shift:${input.shiftId}` : "global");
    }

    await this.db.insert(orders).values({
      id,
      tableId: input.tableId ?? null,
      customerName: null,
      eventId: input.eventId ?? null,
      shiftId: input.shiftId ?? null,
      terminalId: input.terminalId ?? null,
      status: "pending",
      totalAmount,
      discountAmount,
      discountType: input.discountType ?? null,
      notes: input.notes ?? null,
      pax: input.pax ?? null,
      receiptNumber,
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

      // Persist selected options for each item
      const optionInserts = itemsWithIds.flatMap((item) =>
        item.selectedOptionIds.flatMap((oid) => {
          const opt = optionMap.get(oid);
          if (!opt) return [];
          return [{ id: randomUUID(), orderItemId: item.id, optionId: oid, optionName: opt.name, priceDelta: opt.priceDelta }];
        })
      );
      if (optionInserts.length > 0) {
        await this.db.insert(orderItemOptions).values(optionInserts);
      }
    }

    // Load persisted options for return value
    const allItemIds = itemsWithIds.map((i) => i.id);
    const persistedOptions = allItemIds.length > 0
      ? await this.db.select().from(orderItemOptions).where(inArray(orderItemOptions.orderItemId, allItemIds))
      : [];
    const optsByItemId = new Map<string, OrderItemOption[]>();
    for (const o of persistedOptions) {
      const arr = optsByItemId.get(o.orderItemId) ?? [];
      arr.push({ optionId: o.optionId, optionName: o.optionName, priceDelta: o.priceDelta });
      optsByItemId.set(o.orderItemId, arr);
    }

    return this.toOrder(
      {
        id,
        tableId: input.tableId ?? null,
        customerName: null,
        eventId: input.eventId ?? null,
        shiftId: input.shiftId ?? null,
        terminalId: input.terminalId ?? null,
        status: "pending",
        totalAmount,
        discountAmount,
        discountType: input.discountType ?? null,
        notes: input.notes ?? null,
        pax: input.pax ?? null,
        receiptNumber,
        fiscalDocNumber: null,
        fiscalDocDate: null,
        fiscalRtSerial: null,
        createdAt: now,
        updatedAt: now,
        syncedAt: null,
      },
      itemsWithIds.map((item) => ({ ...item, orderId: id })),
      optsByItemId,
    );
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order | null> {
    await this.db
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(orders.id, id));

    return this.findById(id);
  }

  async updateFiscalData(id: string, data: { fiscalDocNumber: string; fiscalDocDate: string; fiscalRtSerial: string }): Promise<void> {
    await this.db
      .update(orders)
      .set({ fiscalDocNumber: data.fiscalDocNumber, fiscalDocDate: data.fiscalDocDate, fiscalRtSerial: data.fiscalRtSerial, updatedAt: new Date() })
      .where(eq(orders.id, id));
  }

  async updateDetails(id: string, data: { tableId?: string | null; customerName?: string | null }): Promise<Order | null> {
    const update: { tableId?: string | null; customerName?: string | null; updatedAt: Date } = { updatedAt: new Date() };
    if ("tableId" in data) update.tableId = data.tableId ?? null;
    if ("customerName" in data) update.customerName = data.customerName ?? null;

    await this.db.update(orders).set(update).where(eq(orders.id, id));
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(orderItems).where(eq(orderItems.orderId, id));
    await this.db.delete(orders).where(eq(orders.id, id));
  }

  private async _loadOptionsMap(itemIds: string[]): Promise<Map<string, OrderItemOption[]>> {
    const map = new Map<string, OrderItemOption[]>();
    if (itemIds.length === 0) return map;
    const rows = await this.db.select().from(orderItemOptions).where(inArray(orderItemOptions.orderItemId, itemIds));
    for (const o of rows) {
      const arr = map.get(o.orderItemId) ?? [];
      arr.push({ optionId: o.optionId, optionName: o.optionName, priceDelta: o.priceDelta });
      map.set(o.orderItemId, arr);
    }
    return map;
  }

  private async _collapseRowsWithOptions(rows: JoinRow[]): Promise<Order[]> {
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
    const allItemIds = [...orderMap.values()].flatMap(({ items }) => items.map((i) => i.id));
    const optsByItemId = await this._loadOptionsMap(allItemIds);

    return [...orderMap.values()].map(({ row, items }) =>
      this.toOrder(
        {
          id: row.orderId,
          tableId: row.tableId,
          customerName: row.customerName,
          eventId: row.eventId,
          shiftId: row.shiftId,
          terminalId: row.terminalId,
          status: row.status,
          totalAmount: row.totalAmount,
          discountAmount: row.discountAmount,
          discountType: row.discountType,
          notes: row.orderNotes,
          pax: row.pax,
          receiptNumber: row.receiptNumber,
          fiscalDocNumber: row.fiscalDocNumber,
          fiscalDocDate: row.fiscalDocDate,
          fiscalRtSerial: row.fiscalRtSerial,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          syncedAt: row.syncedAt,
        },
        items,
        optsByItemId,
      )
    );
  }

  private toOrder(row: DbOrderRow, items: DbItemRow[], optsByItemId?: Map<string, OrderItemOption[]>): Order {
    const mappedItems = items.map((i): OrderItem => {
      const opts = optsByItemId?.get(i.id) ?? [];
      return {
        id: i.id,
        productId: i.productId,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        ...(i.vatRate !== undefined ? { vatRate: i.vatRate } : {}),
        ...(i.notes !== null ? { notes: i.notes } : {}),
        ...(opts.length > 0 ? { options: opts } : {}),
      };
    });

    const vatBreakdown = computeVatBreakdown(mappedItems, row.discountAmount, row.totalAmount);

    const base: Order = {
      id: row.id,
      status: row.status as OrderStatus,
      totalAmount: row.totalAmount,
      discountAmount: row.discountAmount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      items: mappedItems,
      ...(vatBreakdown.length > 0 ? { vatBreakdown } : {}),
      ...(row.tableId !== null ? { tableId: row.tableId } : {}),
      ...(row.customerName !== null ? { customerName: row.customerName } : {}),
      ...(row.eventId !== null ? { eventId: row.eventId } : {}),
      ...(row.shiftId !== null ? { shiftId: row.shiftId } : {}),
      ...(row.terminalId !== null ? { terminalId: row.terminalId } : {}),
      ...(row.discountType !== null ? { discountType: row.discountType } : {}),
      ...(row.notes !== null ? { notes: row.notes } : {}),
      ...(row.pax !== null ? { pax: row.pax } : {}),
      ...(row.receiptNumber !== null ? { receiptNumber: row.receiptNumber } : {}),
      ...(row.fiscalDocNumber !== null ? { fiscalDocNumber: row.fiscalDocNumber } : {}),
      ...(row.fiscalDocDate !== null ? { fiscalDocDate: row.fiscalDocDate } : {}),
      ...(row.fiscalRtSerial !== null ? { fiscalRtSerial: row.fiscalRtSerial } : {}),
      ...(row.syncedAt !== null ? { syncedAt: row.syncedAt } : {}),
    };
    return base;
  }
}

export function computeVatBreakdown(items: ReadonlyArray<OrderItem>, discountAmount: number, totalAmount: number): VatBreakdown[] {
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const discountRatio = subtotal > 0 ? (1 - discountAmount / subtotal) : 1;

  const byRate = new Map<number, number>();
  for (const item of items) {
    const rate = item.vatRate ?? 10;
    const gross = item.unitPrice * item.quantity * discountRatio;
    byRate.set(rate, (byRate.get(rate) ?? 0) + gross);
  }

  return [...byRate.entries()].map(([rate, gross]): VatBreakdown => {
    const divisor = 1 + rate / 100;
    const taxable = Math.round((gross / divisor) * 100) / 100;
    const tax = Math.round((gross - taxable) * 100) / 100;
    return { rate, taxable, tax };
  });
}
