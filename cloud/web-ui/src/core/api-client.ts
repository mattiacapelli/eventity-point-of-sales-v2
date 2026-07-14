import type { Category, Product } from "./types.js";

export const API_BASE = import.meta.env["VITE_API_BASE"] ?? "http://localhost:4000";

export function getTenantSlug(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("t") ?? import.meta.env["VITE_DEFAULT_TENANT"] ?? "";
}

export interface MenuResponse {
  tenant: {
    slug: string;
    name: string;
    logoUrl: string | null;
    colorBrand: string | null;
    colorAccent: string | null;
  };
  categories: Category[];
  products: Product[];
}

export async function fetchMenu(slug: string): Promise<MenuResponse> {
  const res = await fetch(`${API_BASE}/api/tenants/${encodeURIComponent(slug)}/menu`);
  if (!res.ok) throw new Error(`Impossibile caricare il menu (HTTP ${res.status})`);
  return res.json() as Promise<MenuResponse>;
}

export interface CreateOrderInput {
  tableId: string;
  customerName?: string;
  items: { productId: string; quantity: number; selectedOptionIds?: string[] }[];
}

export interface CreateOrderResponse {
  orderCode: string;
  total: number;
  qrPayload: string;
}

export async function createOrder(slug: string, input: CreateOrderInput): Promise<CreateOrderResponse> {
  const res = await fetch(`${API_BASE}/api/tenants/${encodeURIComponent(slug)}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Impossibile creare l'ordine (HTTP ${res.status})`);
  }
  return res.json() as Promise<CreateOrderResponse>;
}
