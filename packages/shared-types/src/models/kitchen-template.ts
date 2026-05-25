export type KitchenBlockType =
  | "center-name"
  | "order-number"
  | "table-number"
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
