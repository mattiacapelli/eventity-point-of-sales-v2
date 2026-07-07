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
  | "category-name"
  | "terminal-name"
  | "table-name"
  | "customer-name";

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
  invertColors?: boolean; // image-mode only: black background, white text for this block's row
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
  showItemCategory: boolean;
  active: boolean;
  printMode: "text" | "image";
  canvasWidth: number;
  logoPath: string | null;
  blocks: ReceiptBlock[] | null;
  printMethod: "single" | "by_category" | "by_category_copy" | "by_center" | "by_center_copy" | "per_item" | "per_item_copy";
  role: "master" | "sub" | "client_copy";
}
