export interface Printer {
  id: number;
  name: string;
  type: string;
  connectionType: string;
  host: string | null;
  port: number | null;
  usbVendorId: number | null;
  usbProductId: number | null;
  active: boolean;
  receiptEnabled: boolean;
  kitchenEnabled: boolean;
  printMode: "text" | "image";
}
