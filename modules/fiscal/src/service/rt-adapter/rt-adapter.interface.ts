export interface RtSaleRow {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

export interface RtPayment {
  method: "cash" | "card" | "digital_wallet" | "tab";
  amount: number;
}

export interface RtDocumentInput {
  rows: RtSaleRow[];
  payment: RtPayment;
}

export interface RtDocumentResult {
  docNumber: string;
  docDate: string;
  rtSerial: string;
  raw?: string;
}

export interface RtZReportResult {
  date: string;
  totalGross: number;
  rtSerial: string;
  raw?: string;
}

export interface RtAdapter {
  emitDocument(input: RtDocumentInput): Promise<RtDocumentResult>;
  emitVoid(docNumber: string, docDate: string): Promise<void>;
  emitZReport(): Promise<RtZReportResult>;
  ping(): Promise<boolean>;
}
