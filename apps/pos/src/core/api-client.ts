import type { Order, CreateOrderInput, Payment, CreatePaymentInput } from "@pos/shared-types";
import { useStore } from "../state/global-store.js";
import { useTerminalStore } from "../state/terminal-store.js";

const BASE = "/api";

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const token = useStore.getState().session?.token;
  const hasBody = body !== undefined;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extraHeaders,
    },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

type OrderFilters = { status?: string; shiftId?: string; terminalId?: string; from?: number; to?: number; limit?: number; offset?: number };

type ShiftStats = {
  totalSales: number;
  totalOrders: number;
  avgTicket: number;
  byPaymentMethod: { method: string; amount: number }[];
  byCategory: { categoryName: string; amount: number }[];
};

export type ZReport = {
  shift: {
    id: string;
    openedAt: string;
    closedAt: string | null;
    openingCash: number;
    closingCash: number | null;
    notes: string | null;
  };
  summary: {
    totalSales: number;
    totalOrders: number;
    cancelledOrders: number;
    avgTicket: number;
    refundTotal: number;
    netSales: number;
  };
  byPaymentMethod: { method: string; count: number; amount: number }[];
  byCategory: { categoryName: string; quantity: number; amount: number }[];
  topProducts: { name: string; quantity: number; amount: number }[];
};

type PeriodStats = {
  totalSales: number;
  totalOrders: number;
  avgTicket: number;
  byCategory: { categoryName: string; amount: number }[];
  byDay: { date: string; sales: number }[];
};

export type ShiftFullStats = {
  shift: {
    id: string;
    openedAt: string;
    closedAt: string | null;
    openingCash: number;
    closingCash: number | null;
    notes: string | null;
  };
  summary: {
    totalSales: number;
    totalOrders: number;
    cancelledOrders: number;
    avgTicket: number;
    refundTotal: number;
    netSales: number;
    totalSalesExcluded: number;
  };
  byPaymentMethod: { method: string; count: number; amount: number; excludeFromTotal: boolean }[];
  byCategory: { categoryName: string; quantity: number; amount: number }[];
  byProductionCenter: { centerName: string; quantity: number; amount: number }[];
  byTerminal: { terminalName: string; count: number; amount: number }[];
  byHour: { hour: number; orders: number; amount: number }[];
  topProducts: { name: string; quantity: number; amount: number }[];
};

export const apiClient = {
  orders: {
    list: (filters?: OrderFilters) => {
      const params = new URLSearchParams();
      if (filters?.status) params.set("status", filters.status);
      if (filters?.shiftId) params.set("shiftId", filters.shiftId);
      if (filters?.terminalId) params.set("terminalId", filters.terminalId);
      if (filters?.from !== undefined) params.set("from", String(filters.from));
      if (filters?.to !== undefined) params.set("to", String(filters.to));
      if (filters?.limit !== undefined) params.set("limit", String(filters.limit));
      if (filters?.offset !== undefined) params.set("offset", String(filters.offset));
      const qs = params.toString();
      return request<Order[]>("GET", qs ? `/orders?${qs}` : "/orders");
    },
    getById: (id: string) =>
      request<Order>("GET", `/orders/${id}`),
    create: (input: CreateOrderInput) => {
      const terminalId = useTerminalStore.getState().terminalId;
      const extraHeaders = terminalId ? { "X-Terminal-Id": terminalId } : undefined;
      return request<Order>("POST", "/orders", input, extraHeaders);
    },
    updateStatus: (id: string, status: string) =>
      request<Order>("PATCH", `/orders/${id}/status`, { status }),
    updateDetails: (id: string, data: { tableId?: string | null; customerName?: string | null }) =>
      request<Order>("PATCH", `/orders/${id}/details`, data),
    updateItems: (id: string, items: Array<{ productId: string; name: string; quantity: number; selectedOptionIds?: string[]; notes?: string }>) =>
      request<Order>("PATCH", `/orders/${id}/items`, { items }),
    cancel: (id: string, reason?: string) =>
      request<Order>("DELETE", `/orders/${id}`, { reason }),
    reprint: (id: string) =>
      request<{ ok: boolean }>("POST", `/orders/${id}/reprint`, {}),
    reprintKitchen: (id: string) =>
      request<{ ok: boolean }>("POST", `/orders/${id}/reprint-kitchen`, {}),
  },
  kitchen: {
    queue: () =>
      request<{ orders: Order[] }>("GET", "/kitchen/queue"),
    transition: (id: string, status: string) =>
      request<Order>("PATCH", `/kitchen/orders/${id}/status`, { status }),
  },
  payments: {
    pay: (input: CreatePaymentInput) => {
      const terminalId = useTerminalStore.getState().terminalId;
      const extraHeaders = terminalId ? { "X-Terminal-Id": terminalId } : undefined;
      return request<Payment>("POST", "/payments", input, extraHeaders);
    },
    listByOrder: (orderId: string) =>
      request<{ payments: Payment[] }>("GET", `/payments/order/${orderId}`),
    refund: (paymentId: string, reason?: string) =>
      request<Payment>("POST", `/payments/${paymentId}/refund`, { ...(reason !== undefined ? { reason } : {}) }),
  },
  stats: {
    shift: (shiftId: string) =>
      request<ShiftStats>("GET", `/stats/shift/${shiftId}`),
    period: (from: number, to: number) =>
      request<PeriodStats>("GET", `/stats/period?from=${from}&to=${to}`),
    zreport: (shiftId: string) =>
      request<ZReport>("GET", `/stats/zreport/${shiftId}`),
    shiftFull: (shiftId: string) =>
      request<ShiftFullStats>("GET", `/stats/shift/${shiftId}/full`),
    printShiftReport: (shiftId: string) =>
      request<{ ok: boolean; message?: string }>("POST", `/stats/shift/${shiftId}/print`, {}),
  },
  auth: {
    changePin: (currentPin: string, newPin: string) =>
      request<void>("PATCH", "/auth/change-pin", { currentPin, newPin }),
  },
};
