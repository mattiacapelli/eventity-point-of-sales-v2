import { eq } from "@pos/db";
import { orders, orderItems, products, appSettings, shifts } from "@pos/db";
import type { DbClient } from "@pos/db";
import type { FiscalSettings, RtType } from "@pos/shared-types";

export class FiscalRepository {
  constructor(private readonly db: DbClient) {}

  async getSettings(): Promise<FiscalSettings> {
    const keys = ["fiscal_enabled", "fiscal_rt_type", "fiscal_rt_host", "fiscal_rt_port", "fiscal_rt_serial"];
    const rows = await this.db.select().from(appSettings).where(
      // drizzle doesn't have inArray from @pos/db export directly in this module context, use multiple ORs
      eq(appSettings.key, keys[0]!)
    );
    // Load all relevant keys manually
    const all = await this.db.select().from(appSettings);
    const m: Record<string, string> = {};
    for (const row of all) m[row.key] = row.value;

    return {
      enabled: m["fiscal_enabled"] === "true",
      rtType: (m["fiscal_rt_type"] ?? "epson") as RtType,
      rtHost: m["fiscal_rt_host"] ?? "192.168.1.100",
      rtPort: parseInt(m["fiscal_rt_port"] ?? "8008", 10),
      rtSerial: m["fiscal_rt_serial"] ?? "",
    };
  }

  async getOrderWithItems(orderId: string): Promise<{
    id: string;
    fiscalDocNumber: string | null;
    items: { name: string; quantity: number; unitPrice: number; vatRate: number }[];
  } | null> {
    const [orderRow] = await this.db.select({
      id: orders.id,
      fiscalDocNumber: orders.fiscalDocNumber,
    }).from(orders).where(eq(orders.id, orderId)).limit(1);

    if (!orderRow) return null;

    const itemRows = await this.db.select({
      name: orderItems.name,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      vatRate: products.vatRate,
    })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, orderId));

    return {
      id: orderRow.id,
      fiscalDocNumber: orderRow.fiscalDocNumber,
      items: itemRows.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        vatRate: i.vatRate ?? 10,
      })),
    };
  }

  async saveFiscalData(orderId: string, data: { fiscalDocNumber: string; fiscalDocDate: string; fiscalRtSerial: string }): Promise<void> {
    await this.db.update(orders).set({
      fiscalDocNumber: data.fiscalDocNumber,
      fiscalDocDate: data.fiscalDocDate,
      fiscalRtSerial: data.fiscalRtSerial,
      updatedAt: new Date(),
    }).where(eq(orders.id, orderId));
  }

  async saveZReport(shiftId: string, data: object): Promise<void> {
    await this.db.update(shifts)
      .set({ zReportFiscal: JSON.stringify(data) })
      .where(eq(shifts.id, shiftId));
  }

  async getZReportFiscal(shiftId: string): Promise<string | null> {
    const [row] = await this.db.select({ zReportFiscal: shifts.zReportFiscal }).from(shifts).where(eq(shifts.id, shiftId)).limit(1);
    return row?.zReportFiscal ?? null;
  }
}
