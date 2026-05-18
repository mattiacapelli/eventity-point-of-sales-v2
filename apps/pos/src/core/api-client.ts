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

export const apiClient = {
  orders: {
    list: (status?: string) =>
      request<Order[]>("GET", status ? `/orders?status=${status}` : "/orders"),
    getById: (id: string) =>
      request<Order>("GET", `/orders/${id}`),
    create: (input: CreateOrderInput) =>
      request<Order>("POST", "/orders", input),
    updateStatus: (id: string, status: string) =>
      request<Order>("PATCH", `/orders/${id}/status`, { status }),
    cancel: (id: string, reason?: string) =>
      request<Order>("DELETE", `/orders/${id}`, { reason }),
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
};
