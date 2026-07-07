import type { RtDocumentInput, RtSaleRow, RtPayment } from "./rt-adapter/rt-adapter.interface.js";

export interface OrderItemForFiscal {
  name: string;
  quantity: number;
  unitPrice: number;
  vatRate?: number;
}

export interface PaymentForFiscal {
  method: "cash" | "card" | "digital_wallet" | "tab";
  amount: number;
}

export function buildRtDocument(items: OrderItemForFiscal[], payment: PaymentForFiscal): RtDocumentInput {
  const rows: RtSaleRow[] = items.map((item) => ({
    description: item.name.slice(0, 40),
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    vatRate: item.vatRate ?? 10,
  }));

  const rtPayment: RtPayment = {
    method: payment.method,
    amount: payment.amount,
  };

  return { rows, payment: rtPayment };
}
