export type KitchenBlockType =
  | "center-name"
  | "order-number"
  | "table-number"
  | "customer-name"
  | "timestamp"
  | "items"
  | "divider"
  | "text";

export interface KitchenBlock {
  id: string;
  type: KitchenBlockType;
  align: "left" | "center" | "right";
  fontSize: number;
  fontFamily: string;
  bold: boolean;
  paddingTop: number;
  visible: boolean;
  content?: string;
  invertColors?: boolean; // image-mode only: black background, white text for this block's row
}

export interface KitchenTemplate {
  id: string;
  name: string;
  productionCenterId: string | null;
  active: boolean;
  printMode: "text" | "image";
  canvasWidth: number;
  blocks: KitchenBlock[] | null;
  logoPath: string | null;
}
