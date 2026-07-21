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

type OrderFilters = { status?: string; shiftId?: string; terminalId?: string; from?: number; to?: number; limit?: number; offset?: number; search?: string };

type ShiftStats = {
  totalSales: number;
  totalOrders: number;
  avgTicket: number;
  byPaymentMethod: { method: string; amount: number }[];
  byCategory: { categoryName: string; amount: number }[];
};

export type ZReport = {
  shift: {
    id: number;
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

export type PeriodStats = {
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
  byTerminal: { terminalName: string; count: number; amount: number; byMethod: { method: string; count: number; amount: number }[] }[];
  byHour: { hour: number; orders: number; amount: number }[];
  byDay: { date: string; sales: number; orders: number }[];
  topProducts: { name: string; quantity: number; amount: number }[];
};

export type ShiftFullStats = {
  shift: {
    id: number;
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
  byTerminal: { terminalName: string; count: number; amount: number; byMethod: { method: string; count: number; amount: number }[] }[];
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
      if (filters?.search !== undefined && filters.search.trim() !== "") params.set("search", filters.search.trim());
      const qs = params.toString();
      return request<Order[]>("GET", qs ? `/orders?${qs}` : "/orders");
    },
    getById: (id: number) =>
      request<Order>("GET", `/orders/${id}`),
    create: (input: CreateOrderInput) => {
      const terminalId = useTerminalStore.getState().terminalId;
      const extraHeaders = terminalId !== null ? { "X-Terminal-Id": String(terminalId) } : undefined;
      return request<Order>("POST", "/orders", input, extraHeaders);
    },
    updateStatus: (id: number, status: string) =>
      request<Order>("PATCH", `/orders/${id}/status`, { status }),
    updateDetails: (id: number, data: { tableId?: string | null; customerName?: string | null }) =>
      request<Order>("PATCH", `/orders/${id}/details`, data),
    updateItems: (id: number, items: Array<{ productId: number; name: string; quantity: number; selectedOptionIds?: number[]; customPriceDelta?: number; notes?: string }>) =>
      request<Order>("PATCH", `/orders/${id}/items`, { items }),
    cancel: (id: number, reason?: string) =>
      request<Order>("DELETE", `/orders/${id}`, { reason }),
    reprint: (id: number) => {
      const terminalId = useTerminalStore.getState().terminalId;
      const extraHeaders = terminalId !== null ? { "X-Terminal-Id": String(terminalId) } : undefined;
      return request<{ ok: boolean }>("POST", `/orders/${id}/reprint`, {}, extraHeaders);
    },
    reprintKitchen: (id: number) =>
      request<{ ok: boolean }>("POST", `/orders/${id}/reprint-kitchen`, {}),
  },
  kitchen: {
    queue: () =>
      request<{ orders: Order[] }>("GET", "/kitchen/queue"),
    transition: (id: number, status: string) =>
      request<Order>("PATCH", `/kitchen/orders/${id}/status`, { status }),
  },
  payments: {
    pay: (input: CreatePaymentInput) => {
      const terminalId = useTerminalStore.getState().terminalId;
      const extraHeaders = terminalId !== null ? { "X-Terminal-Id": String(terminalId) } : undefined;
      return request<Payment>("POST", "/payments", input, extraHeaders);
    },
    listByOrder: (orderId: number) =>
      request<{ payments: Payment[] }>("GET", `/payments/order/${orderId}`),
    refund: (paymentId: number, reason?: string) =>
      request<Payment>("POST", `/payments/${paymentId}/refund`, { ...(reason !== undefined ? { reason } : {}) }),
  },
  stats: {
    shift: (shiftId: number) =>
      request<ShiftStats>("GET", `/stats/shift/${shiftId}`),
    period: (from: number, to: number, terminalId?: number) => {
      const url = `/stats/period?from=${from}&to=${to}${terminalId !== undefined ? `&terminalId=${terminalId}` : ""}`;
      return request<PeriodStats>("GET", url);
    },
    zreport: (shiftId: number) =>
      request<ZReport>("GET", `/stats/zreport/${shiftId}`),
    shiftFull: (shiftId: number, terminalId?: number) => {
      const url = `/stats/shift/${shiftId}/full${terminalId !== undefined ? `?terminalId=${terminalId}` : ""}`;
      return request<ShiftFullStats>("GET", url);
    },
    printShiftReport: (shiftId: number) => {
      const terminalId = useTerminalStore.getState().terminalId;
      const extraHeaders = terminalId !== null ? { "X-Terminal-Id": String(terminalId) } : undefined;
      return request<{ ok: boolean; message?: string }>("POST", `/stats/shift/${shiftId}/print`, {}, extraHeaders);
    },
    pdfShift: (shiftId: number, terminalId?: number) => {
      const url = `/stats/shift/${shiftId}/pdf${terminalId !== undefined ? `?terminalId=${terminalId}` : ""}`;
      const token = useStore.getState().session?.token;
      return fetch(`${BASE}${url}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    },
    pdfPeriod: (from: number, to: number, terminalId?: number) => {
      const url = `/stats/period/pdf?from=${from}&to=${to}${terminalId !== undefined ? `&terminalId=${terminalId}` : ""}`;
      const token = useStore.getState().session?.token;
      return fetch(`${BASE}${url}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    },
  },
  auth: {
    changePin: (currentPin: string, newPin: string) =>
      request<void>("PATCH", "/auth/change-pin", { currentPin, newPin }),
  },
};
