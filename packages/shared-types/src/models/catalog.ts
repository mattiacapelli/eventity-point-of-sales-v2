export interface Category {
  id: number;
  name: string;
  color: string | null;
  sortOrder: number;
  active: boolean;
}

export type ProductReceiptPrintMode = "inherit" | "included" | "separate";

export interface Product {
  id: number;
  name: string;
  price: number;
  categoryId: number | null;
  categoryName: string | null;
  productionCenterId: number | null;
  active: boolean;
  color: string | null;
  description: string | null;
  imageData: string | null;
  sortOrder: number;
  vatRate: number;
  receiptPrintMode: ProductReceiptPrintMode;
  availableDates: string[] | null;
  createdAt: number | null;
  updatedAt: number | null;
}

export interface ProductGridSlot {
  productId: number;
  slotX: number;
  slotY: number;
  spanW: number;
  spanH: number;
}

export type ReceiptPrintMode = "included" | "separate";

export interface ProductionCenter {
  id: number;
  name: string;
  color: string | null;
  icon: string | null;
  receiptPrintMode: ReceiptPrintMode;
  sortOrder: number;
}

export interface ProductionCenterWithCategories extends ProductionCenter {
  categories: Category[];
}

export type OptionGroupType = "single" | "multi" | "removal";

export type OptionPrefix = "+" | "-" | ">>";

export interface Option {
  id: number;
  optionGroupId: number;
  name: string;
  priceDelta: number;
  prefix: OptionPrefix;
  active: boolean;
  sortOrder: number;
}

export interface OptionGroup {
  id: number;
  productId: number;
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
