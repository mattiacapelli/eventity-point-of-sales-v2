export interface Category {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
  active: boolean;
}

export type ProductReceiptPrintMode = "inherit" | "included" | "separate";

export interface Product {
  id: string;
  name: string;
  price: number;
  categoryId: string | null;
  categoryName: string | null;
  productionCenterId: string | null;
  active: boolean;
  color: string | null;
  description: string | null;
  imageData: string | null;
  sortOrder: number;
  vatRate: number;
  receiptPrintMode: ProductReceiptPrintMode;
  createdAt: number | null;
  updatedAt: number | null;
}

export interface ProductGridSlot {
  productId: string;
  slotX: number;
  slotY: number;
  spanW: number;
  spanH: number;
}

export type ReceiptPrintMode = "included" | "separate";

export interface ProductionCenter {
  id: string;
  name: string;
  color: string | null;
  receiptPrintMode: ReceiptPrintMode;
  sortOrder: number;
}

export interface ProductionCenterWithCategories extends ProductionCenter {
  categories: Category[];
}

export type OptionGroupType = "single" | "multi" | "removal";

export type OptionPrefix = "+" | "-" | ">>";

export interface Option {
  id: string;
  optionGroupId: string;
  name: string;
  priceDelta: number;
  prefix: OptionPrefix;
  active: boolean;
  sortOrder: number;
}

export interface OptionGroup {
  id: string;
  productId: string;
  name: string;
  type: OptionGroupType;
  required: boolean;
  minSel: number;
  maxSel: number;
  sortOrder: number;
}

export interface OptionGroupWithOptions extends OptionGroup {
  options: Option[];
}
