export type BlockType =
  | "logo"
  | "text"
  | "restaurant-name"
  | "restaurant-address"
  | "restaurant-phone"
  | "restaurant-vat"
  | "divider"
  | "order-number"
  | "timestamp"
  | "items"
  | "total"
  | "payment-method"
  | "footer"
  | "category-name";

export interface ReceiptBlock {
  id: string;
  type: BlockType;
  align: "left" | "center" | "right";
  fontSize: number;
  fontFamily: string;
  bold: boolean;
  paddingTop: number;
  visible: boolean;
  content?: string;
  logoWidth?: number;  // percentage of canvas width for logo blocks (10–100)
}

export interface ReceiptTemplate {
  id: string;
  name: string;
  headerText: string | null;
  footerText: string | null;
  showLogo: boolean;
  showOrderNumber: boolean;
  showTimestamp: boolean;
  showPaymentMethod: boolean;
  active: boolean;
  printMode: "text" | "image";
  canvasWidth: number;
  logoPath: string | null;
  blocks: ReceiptBlock[] | null;
  printMethod: "single" | "by_category" | "by_category_copy" | "per_item" | "per_item_copy";
  role: "master" | "sub" | "client_copy";
}
