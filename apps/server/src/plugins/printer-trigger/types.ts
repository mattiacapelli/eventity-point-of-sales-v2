export type OrderItemRow = {
  id: string;
  productId: string;
  quantity: number;
  name: string;
  unitPrice: number;
  notes: string | null;
  vatRate?: number | null;
};

export type OrderItemOptionRow = {
  orderItemId: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
};

export type PrinterRow = {
  id: string;
  host: string | null;
  port: number | null;
  kitchenEnabled: boolean;
  receiptEnabled: boolean;
  active: boolean;
  name: string;
  printMode: string;
};

export type RestaurantInfo = {
  name: string;
  address: string;
  city: string;
  vat: string;
  phone: string;
  logoPath: string | null;
};

export type ReceiptJobData = {
  orderId: string;
  amount: number;
  currency: string;
  method: string;
  paidAt: Date;
  terminalId?: string;
};

export type ReceiptContext = {
  items: OrderItemRow[];
  orderRow: {
    receiptNumber: number | null;
    discountAmount: number | null;
    totalAmount: number;
    fiscalDocNumber: string | null;
    fiscalDocDate: string | null;
    fiscalRtSerial: string | null;
    terminalId: string | null;
    tableId: string | null;
    customerName: string | null;
  } | undefined;
  restaurant: RestaurantInfo;
  displayNum: string;
  paymentMethodName: string;
  orderTerminalName: string | undefined;
  resolvedLogoPath: string | null;
  productCategoryMap: Record<string, string | null>;
  categoryNameMap: Record<string, string>;
  productPrintModeMap: Record<string, string>;
  categoryCentersMap: Record<string, string[]>;
  categoryFirstCenterMap: Record<string, string>;
  centerNameMap: Record<string, string>;
  centerPrintModeMap: Record<string, string>;
};
