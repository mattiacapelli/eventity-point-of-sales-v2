export interface Category {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
  active: boolean;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  categoryId: string | null;
  categoryName: string | null;
  active: boolean;
  color: string | null;
  description: string | null;
  imageData: string | null;
  sortOrder: number;
  createdAt: number | null;
  updatedAt: number | null;
}

export interface ProductionCenter {
  id: string;
  name: string;
  color: string | null;
}

export interface ProductionCenterWithCategories extends ProductionCenter {
  categories: Category[];
}

export type OptionGroupType = "single" | "multi" | "removal";

export interface Option {
  id: string;
  optionGroupId: string;
  name: string;
  priceDelta: number;
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
