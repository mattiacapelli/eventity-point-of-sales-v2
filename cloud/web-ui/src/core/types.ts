export interface Category {
  id: string;
  name: string;
}

export type OptionPrefix = "+" | "-" | ">>";
export type OptionGroupType = "single" | "multi" | "removal";

export interface ProductOption {
  id: string;
  name: string;
  priceDelta: number;
  prefix: OptionPrefix;
}

export interface ProductOptionGroup {
  id: string;
  name: string;
  type: OptionGroupType;
  required: boolean;
  minSel: number;
  maxSel: number;
  options: ProductOption[];
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  description?: string;
  optionGroups: ProductOptionGroup[];
}

export interface CartLine {
  productId: string;
  quantity: number;
  selectedOptionIds: string[];
}

export interface OrderInfo {
  tableId: string;
  customerName: string;
}
