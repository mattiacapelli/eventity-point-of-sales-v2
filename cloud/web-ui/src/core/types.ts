export interface Category {
  id: number;
  name: string;
  emoji: string | null;
}

export type OptionPrefix = "+" | "-" | ">>";
export type OptionGroupType = "single" | "multi" | "removal";

export interface ProductOption {
  id: number;
  name: string;
  priceDelta: number;
  prefix: OptionPrefix;
}

export interface ProductOptionGroup {
  id: number;
  name: string;
  type: OptionGroupType;
  required: boolean;
  minSel: number;
  maxSel: number;
  options: ProductOption[];
}

export interface Product {
  id: number;
  categoryId: number;
  name: string;
  price: number;
  description?: string;
  optionGroups: ProductOptionGroup[];
}

export interface CartLine {
  productId: number;
  quantity: number;
  selectedOptionIds: number[];
}

export interface OrderInfo {
  tableId: string;
  customerName: string;
}
