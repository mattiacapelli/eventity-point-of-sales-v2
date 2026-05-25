export interface Printer {
  id: string;
  name: string;
  type: string;
  connectionType: string;
  host: string | null;
  port: number | null;
  active: boolean;
  receiptEnabled: boolean;
  kitchenEnabled: boolean;
  printMode: "text" | "image";
}
