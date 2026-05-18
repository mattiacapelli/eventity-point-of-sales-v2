import type { Category, Product, ProductionCenter, OptionGroupWithOptions, Option, PaymentMethodRecord, Printer, ReceiptTemplate, Shift } from "@pos/shared-types";
import { useStore } from "../state/global-store.js";

export interface BackupMeta {
  id: string;
  filename: string;
  size: number;
  sha256: string;
  createdAt: number;
}

const BASE = "/api";

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = useStore.getState().session?.token;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export const adminApi = {
  categories: {
    list: () => req<Category[]>("GET", "/categories"),
    create: (data: { name: string; color?: string | null }) => req<Category>("POST", "/categories", data),
    update: (id: string, data: { name?: string; color?: string | null }) => req<Category>("PATCH", `/categories/${id}`, data),
    delete: (id: string) => req<void>("DELETE", `/categories/${id}`),
  },
  products: {
    list: () => req<Product[]>("GET", "/products"),
    create: (data: { name: string; price: number; categoryId?: string; active?: boolean; color?: string | null }) =>
      req<Product>("POST", "/products", data),
    update: (id: string, data: Partial<{ name: string; price: number; categoryId: string | null; active: boolean; color: string | null }>) =>
      req<Product>("PATCH", `/products/${id}`, data),
    delete: (id: string) => req<void>("DELETE", `/products/${id}`),
  },
  productionCenters: {
    list: () => req<ProductionCenter[]>("GET", "/production-centers"),
    create: (data: { name: string; color?: string | null }) => req<ProductionCenter>("POST", "/production-centers", data),
    update: (id: string, data: { name?: string; color?: string | null }) => req<ProductionCenter>("PATCH", `/production-centers/${id}`, data),
    delete: (id: string) => req<void>("DELETE", `/production-centers/${id}`),
    getCategories: (id: string) => req<Category[]>("GET", `/production-centers/${id}/categories`),
    assignCategory: (id: string, categoryId: string) =>
      req<void>("POST", `/production-centers/${id}/categories`, { categoryId }),
    removeCategory: (id: string, categoryId: string) =>
      req<void>("DELETE", `/production-centers/${id}/categories/${categoryId}`),
  },
  optionGroups: {
    list: (productId: string) =>
      req<OptionGroupWithOptions[]>("GET", `/option-groups?productId=${productId}`),
    create: (data: { productId: string; name: string; type: "single" | "multi" | "removal"; required?: boolean; minSel?: number; maxSel?: number; sortOrder?: number }) =>
      req<OptionGroupWithOptions>("POST", "/option-groups", data),
    update: (id: string, data: Partial<{ name: string; type: "single" | "multi" | "removal"; required: boolean; minSel: number; maxSel: number; sortOrder: number }>) =>
      req<OptionGroupWithOptions>("PATCH", `/option-groups/${id}`, data),
    delete: (id: string) => req<void>("DELETE", `/option-groups/${id}`),
    createOption: (groupId: string, data: { name: string; priceDelta?: number; sortOrder?: number }) =>
      req<Option>("POST", `/option-groups/${groupId}/options`, data),
    updateOption: (optionId: string, data: Partial<{ name: string; priceDelta: number; active: boolean; sortOrder: number }>) =>
      req<Option>("PATCH", `/options/${optionId}`, data),
    deleteOption: (optionId: string) => req<void>("DELETE", `/options/${optionId}`),
  },
  paymentMethods: {
    list: () => req<PaymentMethodRecord[]>("GET", "/payment-methods"),
    create: (data: { name: string; type: string; active?: boolean; sortOrder?: number; icon?: string | null }) =>
      req<PaymentMethodRecord>("POST", "/payment-methods", data),
    update: (id: string, data: Partial<{ name: string; type: string; active: boolean; sortOrder: number; icon: string | null }>) =>
      req<PaymentMethodRecord>("PATCH", `/payment-methods/${id}`, data),
    delete: (id: string) => req<void>("DELETE", `/payment-methods/${id}`),
  },
  printers: {
    list: () => req<Printer[]>("GET", "/printers"),
    create: (data: { name: string; type?: string; connectionType?: string; host?: string; port?: number; active?: boolean; receiptEnabled?: boolean; kitchenEnabled?: boolean }) =>
      req<Printer>("POST", "/printers", data),
    update: (id: string, data: Partial<{ name: string; type: string; connectionType: string; host: string | null; port: number | null; active: boolean; receiptEnabled: boolean; kitchenEnabled: boolean }>) =>
      req<Printer>("PATCH", `/printers/${id}`, data),
    delete: (id: string) => req<void>("DELETE", `/printers/${id}`),
    testPrint: (id: string) => req<{ success: boolean; message: string }>("POST", `/printers/${id}/test-print`),
  },
  receiptTemplates: {
    list: () => req<ReceiptTemplate[]>("GET", "/receipt-templates"),
    getActive: () => req<ReceiptTemplate>("GET", "/receipt-templates/active"),
    create: (data: { name: string; headerText?: string; footerText?: string; showLogo?: boolean; showOrderNumber?: boolean; showTimestamp?: boolean; showPaymentMethod?: boolean; active?: boolean }) =>
      req<ReceiptTemplate>("POST", "/receipt-templates", data),
    update: (id: string, data: Partial<{ name: string; headerText: string | null; footerText: string | null; showLogo: boolean; showOrderNumber: boolean; showTimestamp: boolean; showPaymentMethod: boolean; active: boolean }>) =>
      req<ReceiptTemplate>("PATCH", `/receipt-templates/${id}`, data),
  },
  shifts: {
    current: () => req<Shift>("GET", "/shifts/current"),
    history: () => req<Shift[]>("GET", "/shifts/history"),
    open: (data: { userId: string; openingCash?: number; notes?: string }) =>
      req<Shift>("POST", "/shifts/open", data),
    close: (id: string, data: { closingCash?: number; notes?: string }) =>
      req<Shift>("POST", `/shifts/${id}/close`, data),
    updateTotals: (id: string, data: { totalSales?: number; totalOrders?: number }) =>
      req<Shift>("PATCH", `/shifts/${id}`, data),
  },
  backups: {
    list: () => req<BackupMeta[]>("GET", "/admin/backups/list"),
    create: () => req<BackupMeta>("POST", "/admin/backups/create"),
    delete: (id: string) => req<void>("DELETE", `/admin/backups/${id}`),
    downloadUrl: (id: string) => `/api/admin/backups/download/${id}`,
  },
};
