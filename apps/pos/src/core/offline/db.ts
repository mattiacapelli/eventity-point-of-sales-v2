import Dexie, { type Table } from "dexie";
import type { Order, Payment } from "@pos/shared-types";

export class PosOfflineDb extends Dexie {
  orders!: Table<Order, string>;
  payments!: Table<Payment, string>;

  constructor() {
    super("eventity-pos");

    this.version(1).stores({
      orders: "id, status, tableId, eventId, createdAt",
      payments: "id, orderId, status, createdAt",
    });
  }
}

let _db: PosOfflineDb | null = null;

export function getOfflineDb(): PosOfflineDb {
  if (_db === null) {
    _db = new PosOfflineDb();
  }
  return _db;
}
