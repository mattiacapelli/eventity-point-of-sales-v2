import { create } from "zustand";
import type { Category, Product, ProductionCenter, OptionGroupWithOptions, Option, PaymentMethodRecord, Printer, ReceiptTemplate } from "@pos/shared-types";

interface AdminState {
  categories: Category[];
  products: Product[];
  productionCenters: ProductionCenter[];
  optionGroupsByProduct: Record<string, OptionGroupWithOptions[]>;
  paymentMethods: PaymentMethodRecord[];
  printers: Printer[];
  receiptTemplates: ReceiptTemplate[];
  loading: boolean;
  setCategories: (c: Category[]) => void;
  setProducts: (p: Product[]) => void;
  setProductionCenters: (pc: ProductionCenter[]) => void;
  setOptionGroups: (productId: number, groups: OptionGroupWithOptions[]) => void;
  setLoading: (l: boolean) => void;
  upsertCategory: (c: Category) => void;
  removeCategory: (id: number) => void;
  upsertProduct: (p: Product) => void;
  removeProduct: (id: number) => void;
  upsertProductionCenter: (pc: ProductionCenter) => void;
  removeProductionCenter: (id: number) => void;
  upsertOptionGroup: (productId: number, group: OptionGroupWithOptions) => void;
  removeOptionGroup: (productId: number, groupId: number) => void;
  upsertOption: (productId: number, groupId: number, option: Option) => void;
  removeOption: (productId: number, groupId: number, optionId: number) => void;
  setPaymentMethods: (m: PaymentMethodRecord[]) => void;
  upsertPaymentMethod: (m: PaymentMethodRecord) => void;
  removePaymentMethod: (id: string) => void;
  setPrinters: (p: Printer[]) => void;
  upsertPrinter: (p: Printer) => void;
  removePrinter: (id: number) => void;
  setReceiptTemplates: (t: ReceiptTemplate[]) => void;
  upsertReceiptTemplate: (t: ReceiptTemplate) => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  categories: [],
  products: [],
  productionCenters: [],
  optionGroupsByProduct: {},
  paymentMethods: [],
  printers: [],
  receiptTemplates: [],
  loading: false,
  setCategories: (categories) => set({ categories }),
  setProducts: (products) => set({ products }),
  setProductionCenters: (productionCenters) => set({ productionCenters }),
  setOptionGroups: (productId, groups) =>
    set((s) => ({ optionGroupsByProduct: { ...s.optionGroupsByProduct, [productId]: groups } })),
  setLoading: (loading) => set({ loading }),
  upsertCategory: (c) => set((s) => {
    const idx = s.categories.findIndex((x) => x.id === c.id);
    if (idx === -1) return { categories: [...s.categories, c] };
    const next = [...s.categories]; next[idx] = c; return { categories: next };
  }),
  removeCategory: (id) => set((s) => ({ categories: s.categories.filter((x) => x.id !== id) })),
  upsertProduct: (p) => set((s) => {
    const idx = s.products.findIndex((x) => x.id === p.id);
    if (idx === -1) return { products: [...s.products, p] };
    const next = [...s.products]; next[idx] = p; return { products: next };
  }),
  removeProduct: (id) => set((s) => ({ products: s.products.filter((x) => x.id !== id) })),
  upsertProductionCenter: (pc) => set((s) => {
    const idx = s.productionCenters.findIndex((x) => x.id === pc.id);
    if (idx === -1) return { productionCenters: [...s.productionCenters, pc] };
    const next = [...s.productionCenters]; next[idx] = pc; return { productionCenters: next };
  }),
  removeProductionCenter: (id) => set((s) => ({ productionCenters: s.productionCenters.filter((x) => x.id !== id) })),
  upsertOptionGroup: (productId, group) =>
    set((s) => {
      const existing = s.optionGroupsByProduct[productId] ?? [];
      const idx = existing.findIndex((g) => g.id === group.id);
      const next = idx === -1 ? [...existing, group] : existing.map((g, i) => i === idx ? group : g);
      return { optionGroupsByProduct: { ...s.optionGroupsByProduct, [productId]: next } };
    }),
  removeOptionGroup: (productId, groupId) =>
    set((s) => {
      const existing = s.optionGroupsByProduct[productId] ?? [];
      return { optionGroupsByProduct: { ...s.optionGroupsByProduct, [productId]: existing.filter((g) => g.id !== groupId) } };
    }),
  upsertOption: (productId, groupId, option) =>
    set((s) => {
      const groups = s.optionGroupsByProduct[productId] ?? [];
      const next = groups.map((g) => {
        if (g.id !== groupId) return g;
        const idx = g.options.findIndex((o) => o.id === option.id);
        const opts = idx === -1 ? [...g.options, option] : g.options.map((o, i) => i === idx ? option : o);
        return { ...g, options: opts };
      });
      return { optionGroupsByProduct: { ...s.optionGroupsByProduct, [productId]: next } };
    }),
  removeOption: (productId, groupId, optionId) =>
    set((s) => {
      const groups = s.optionGroupsByProduct[productId] ?? [];
      const next = groups.map((g) => {
        if (g.id !== groupId) return g;
        return { ...g, options: g.options.filter((o) => o.id !== optionId) };
      });
      return { optionGroupsByProduct: { ...s.optionGroupsByProduct, [productId]: next } };
    }),
  setPaymentMethods: (paymentMethods) => set({ paymentMethods }),
  upsertPaymentMethod: (m) => set((s) => {
    const idx = s.paymentMethods.findIndex((x) => x.id === m.id);
    if (idx === -1) return { paymentMethods: [...s.paymentMethods, m] };
    const next = [...s.paymentMethods]; next[idx] = m; return { paymentMethods: next };
  }),
  removePaymentMethod: (id) => set((s) => ({ paymentMethods: s.paymentMethods.filter((x) => x.id !== id) })),
  setPrinters: (printers) => set({ printers }),
  upsertPrinter: (p) => set((s) => {
    const idx = s.printers.findIndex((x) => x.id === p.id);
    if (idx === -1) return { printers: [...s.printers, p] };
    const next = [...s.printers]; next[idx] = p; return { printers: next };
  }),
  removePrinter: (id) => set((s) => ({ printers: s.printers.filter((x) => x.id !== id) })),
  setReceiptTemplates: (receiptTemplates) => set({ receiptTemplates }),
  upsertReceiptTemplate: (t) => set((s) => {
    const idx = s.receiptTemplates.findIndex((x) => x.id === t.id);
    if (idx === -1) return { receiptTemplates: [...s.receiptTemplates, t] };
    const next = [...s.receiptTemplates]; next[idx] = t; return { receiptTemplates: next };
  }),
}));
