import type { Order, CreateOrderInput, Payment, CreatePaymentInput } from "@pos/shared-types";
import { useStore } from "../state/global-store.js";

const BASE = "/api";

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
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
  return res.json() as Promise<T>;
}

type OrderFilters = { status?: string; shiftId?: string; from?: number; to?: number };

type ShiftStats = {
  totalSales: number;
  totalOrders: number;
  avgTicket: number;
  byPaymentMethod: { method: string; amount: number }[];
  byCategory: { categoryName: string; amount: number }[];
};

type PeriodStats = {
  totalSales: number;
  totalOrders: number;
  avgTicket: number;
  byCategory: { categoryName: string; amount: number }[];
  byDay: { date: string; sales: number }[];
};

export const apiClient = {
  orders: {
    list: (filters?: OrderFilters) => {
      const params = new URLSearchParams();
      if (filters?.status) params.set("status", filters.status);
      if (filters?.shiftId) params.set("shiftId", filters.shiftId);
      if (filters?.from !== undefined) params.set("from", String(filters.from));
      if (filters?.to !== undefined) params.set("to", String(filters.to));
      const qs = params.toString();
      return request<Order[]>("GET", qs ? `/orders?${qs}` : "/orders");
    },
    getById: (id: string) =>
      request<Order>("GET", `/orders/${id}`),
    create: (input: CreateOrderInput) =>
      request<Order>("POST", "/orders", input),
    updateStatus: (id: string, status: string) =>
      request<Order>("PATCH", `/orders/${id}/status`, { status }),
    cancel: (id: string, reason?: string) =>
      request<Order>("DELETE", `/orders/${id}`, { reason }),
    reprint: (id: string) =>
      request<{ ok: boolean }>("POST", `/orders/${id}/reprint`, {}),
  },
  kitchen: {
    queue: () =>
      request<{ orders: Order[] }>("GET", "/kitchen/queue"),
    transition: (id: string, status: string) =>
      request<Order>("PATCH", `/kitchen/orders/${id}/status`, { status }),
  },
  payments: {
    pay: (input: CreatePaymentInput) =>
      request<Payment>("POST", "/payments", input),
    listByOrder: (orderId: string) =>
      request<{ payments: Payment[] }>("GET", `/payments/order/${orderId}`),
  },
  stats: {
    shift: (shiftId: string) =>
      request<ShiftStats>("GET", `/stats/shift/${shiftId}`),
    period: (from: number, to: number) =>
      request<PeriodStats>("GET", `/stats/period?from=${from}&to=${to}`),
  },
  auth: {
    changePin: (currentPin: string, newPin: string) =>
      request<void>("PATCH", "/auth/change-pin", { currentPin, newPin }),
  },
};
