import { randomUUID } from "node:crypto";
import { eq, desc, payments } from "@pos/db";
import type { DbClient } from "@pos/db";
import type { Payment, CreatePaymentInput } from "@pos/shared-types";

type DbPaymentRow = {
  id: string;
  orderId: string;
  method: "cash" | "card" | "digital_wallet" | "tab";
  status: "pending" | "completed" | "failed" | "refunded";
  amount: number;
  currency: string;
  reference: string | null;
  createdAt: Date;
  syncedAt: Date | null;
};

export class PaymentRepository {
  constructor(private readonly db: DbClient) {}

  async create(input: CreatePaymentInput): Promise<Payment> {
    const id = randomUUID();
    const now = new Date();

    await this.db.insert(payments).values({
      id,
      orderId: input.orderId,
      method: input.method,
      status: "completed",
      amount: input.amount,
      currency: input.currency ?? "EUR",
      reference: input.reference ?? null,
      createdAt: now,
    });

    const [row] = await this.db.select().from(payments).where(eq(payments.id, id)).limit(1);
    return this.toPayment(row as unknown as DbPaymentRow);
  }

  async findByOrderId(orderId: string): Promise<Payment[]> {
    const rows = await this.db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .orderBy(desc(payments.createdAt));
    return (rows as unknown as DbPaymentRow[]).map(this.toPayment);
  }

  async findById(id: string): Promise<Payment | undefined> {
    const [row] = await this.db.select().from(payments).where(eq(payments.id, id)).limit(1);
    return row ? this.toPayment(row as unknown as DbPaymentRow) : undefined;
  }

  private toPayment(row: DbPaymentRow): Payment {
    return {
      id: row.id,
      orderId: row.orderId,
      method: row.method,
      status: row.status,
      amount: row.amount,
      currency: row.currency,
      createdAt: row.createdAt,
      ...(row.reference !== null ? { reference: row.reference } : {}),
      ...(row.syncedAt !== null ? { syncedAt: row.syncedAt } : {}),
    };
  }
}
