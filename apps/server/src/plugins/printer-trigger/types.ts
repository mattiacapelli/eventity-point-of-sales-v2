export type OrderItemRow = {
  id: number;
  productId: number;
  quantity: number;
  name: string;
  unitPrice: number;
  notes: string | null;
  vatRate?: number | null;
};

export type OrderItemOptionRow = {
  orderItemId: number;
  optionId: number;
  optionName: string;
  priceDelta: number;
};

export type PrinterRow = {
  id: number;
  connectionType: string;
  host: string | null;
  port: number | null;
  usbVendorId: number | null;
  usbProductId: number | null;
  winPrinterName: string | null;
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
  orderId: number;
  amount: number;
  currency: string;
  method: string;
  paidAt: Date;
  terminalId?: number;
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
    terminalId: number | null;
    tableId: string | null;
    customerName: string | null;
  } | undefined;
  restaurant: RestaurantInfo;
  displayNum: string;
  paymentMethodName: string;
  orderTerminalName: string | undefined;
  resolvedLogoPath: string | null;
  productCategoryMap: Record<number, number | null>;
  categoryNameMap: Record<number, string>;
  categoryPrintModeMap: Record<number, string>;
  productPrintModeMap: Record<number, string>;
  categoryCentersMap: Record<number, number[]>;
  categoryFirstCenterMap: Record<number, number>;
  centerNameMap: Record<number, string>;
  centerPrintModeMap: Record<number, string>;
};
