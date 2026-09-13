export type ShiftReportBlockType =
  | "logo"
  | "restaurant-name"
  | "restaurant-address"
  | "restaurant-phone"
  | "restaurant-vat"
  | "text"
  | "divider"
  | "shift-period"
  | "kpi-summary"
  | "by-hour"
  | "by-category"
  | "by-production-center"
  | "by-payment-method"
  | "by-terminal"
  | "top-products"
  | "footer";

export interface ShiftReportBlock {
  id: string;
  type: ShiftReportBlockType;
  align: "left" | "center" | "right";
  fontSize: number;
  fontFamily: string;
  bold: boolean;
  paddingTop: number;
  visible: boolean;
  content?: string;
  logoWidth?: number;
}

export interface ShiftReportTemplate {
  id: string;
  name: string;
  active: boolean;
  printMode: "text" | "image";
  canvasWidth: number;
  logoPath: string | null;
  blocks: ShiftReportBlock[] | null;
}
