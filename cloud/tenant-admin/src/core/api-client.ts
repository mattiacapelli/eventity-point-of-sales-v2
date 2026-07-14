import type { AuditLogEntry, CategoryRecord, CurrentUser, Paginated, ProductRecord, Tenant, TenantStats, TenantUser, TenantUserRole } from "./types.js";

export const API_BASE = import.meta.env["VITE_API_BASE"] ?? "http://localhost:4000";
const TOKEN_KEY = "epos-admin-token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class SessionExpiredError extends Error {
  constructor() {
    super("Sessione scaduta");
  }
}

let onSessionExpired: (() => void) | null = null;
export function setOnSessionExpired(handler: () => void): void {
  onSessionExpired = handler;
}

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (res.status === 401) {
    clearToken();
    onSessionExpired?.();
    throw new SessionExpiredError();
  }
  return res;
}

async function throwIfNotOk(res: Response, fallbackMessage: string): Promise<void> {
  if (res.ok) return;
  if (res.status === 429) throw new Error("Troppi tentativi, riprova tra qualche minuto");
  const body = await res.json().catch(() => ({})) as { error?: string };
  throw new Error(body.error ?? fallbackMessage);
}

export async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_BASE}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  await throwIfNotOk(res, "Credenziali non valide");
  const data = await res.json() as { token: string };
  return data.token;
}

export async function getMe(): Promise<CurrentUser> {
  const res = await authedFetch("/admin/me");
  await throwIfNotOk(res, "Impossibile caricare l'utente");
  return res.json() as Promise<CurrentUser>;
}

export async function listTenants(params: { search?: string; page?: number; pageSize?: number } = {}): Promise<Paginated<Tenant>> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  const res = await authedFetch(`/admin/tenants?${query.toString()}`);
  await throwIfNotOk(res, "Impossibile caricare i tenant");
  return res.json() as Promise<Paginated<Tenant>>;
}

export async function createTenant(name: string): Promise<Tenant> {
  const res = await authedFetch("/admin/tenants", { method: "POST", body: JSON.stringify({ name }) });
  await throwIfNotOk(res, "Impossibile creare il tenant");
  return res.json() as Promise<Tenant>;
}

export async function updateTenant(id: string, data: Partial<{ name: string; active: boolean }>): Promise<Tenant> {
  const res = await authedFetch(`/admin/tenants/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  await throwIfNotOk(res, "Impossibile aggiornare il tenant");
  return res.json() as Promise<Tenant>;
}

export async function rotateTenantKey(id: string): Promise<{ apiKey: string }> {
  const res = await authedFetch(`/admin/tenants/${id}/rotate-key`, { method: "POST" });
  await throwIfNotOk(res, "Impossibile rigenerare la chiave");
  return res.json() as Promise<{ apiKey: string }>;
}

export async function deleteTenant(id: string): Promise<void> {
  const res = await authedFetch(`/admin/tenants/${id}`, { method: "DELETE" });
  await throwIfNotOk(res, "Impossibile eliminare il tenant");
}

export async function fetchTenantStats(id: string): Promise<TenantStats> {
  const res = await authedFetch(`/admin/tenants/${id}/stats`);
  await throwIfNotOk(res, "Impossibile caricare le statistiche");
  return res.json() as Promise<TenantStats>;
}

export async function listTenantUsers(tenantId: string): Promise<TenantUser[]> {
  const res = await authedFetch(`/admin/tenants/${tenantId}/users`);
  await throwIfNotOk(res, "Impossibile caricare gli utenti");
  return res.json() as Promise<TenantUser[]>;
}

export async function inviteTenantUser(tenantId: string, email: string, role: TenantUserRole): Promise<{ userId: string; email: string; role: TenantUserRole; tempPassword?: string }> {
  const res = await authedFetch(`/admin/tenants/${tenantId}/users/invite`, {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
  await throwIfNotOk(res, "Impossibile invitare l'utente");
  return res.json();
}

export async function removeTenantUser(tenantId: string, userId: string): Promise<void> {
  const res = await authedFetch(`/admin/tenants/${tenantId}/users/${userId}`, { method: "DELETE" });
  await throwIfNotOk(res, "Impossibile rimuovere l'utente");
}

export async function fetchAuditLog(tenantId: string, page = 1, pageSize = 20): Promise<Paginated<AuditLogEntry>> {
  const res = await authedFetch(`/admin/tenants/${tenantId}/audit-log?page=${page}&pageSize=${pageSize}`);
  await throwIfNotOk(res, "Impossibile caricare l'audit log");
  return res.json() as Promise<Paginated<AuditLogEntry>>;
}

export async function downloadOrdersCsv(tenantId: string): Promise<Blob> {
  const res = await authedFetch(`/admin/tenants/${tenantId}/orders/export.csv`);
  if (!res.ok) throw new Error("Impossibile esportare gli ordini");
  return res.blob();
}

export interface MenuImportResult {
  ok: true;
  categories: number;
  products: number;
  optionGroups: number;
}

export async function importMenu(tenantId: string, payload: unknown): Promise<MenuImportResult> {
  const res = await authedFetch(`/admin/tenants/${tenantId}/menu/import`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  await throwIfNotOk(res, "Impossibile importare il menu");
  return res.json() as Promise<MenuImportResult>;
}

export async function uploadTenantLogo(tenantId: string, file: File): Promise<{ logoPath: string }> {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/admin/tenants/${tenantId}/logo`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  await throwIfNotOk(res, "Impossibile caricare il logo");
  return res.json() as Promise<{ logoPath: string }>;
}

export async function deleteTenantLogo(tenantId: string): Promise<void> {
  const res = await authedFetch(`/admin/tenants/${tenantId}/logo`, { method: "DELETE" });
  await throwIfNotOk(res, "Impossibile rimuovere il logo");
}

export async function updateTenantBranding(tenantId: string, data: Partial<{ colorBrand: string; colorAccent: string }>): Promise<{ colorBrand: string | null; colorAccent: string | null }> {
  const res = await authedFetch(`/admin/tenants/${tenantId}/branding`, { method: "PATCH", body: JSON.stringify(data) });
  await throwIfNotOk(res, "Impossibile aggiornare i colori");
  return res.json() as Promise<{ colorBrand: string | null; colorAccent: string | null }>;
}

export async function listCategories(tenantId: string): Promise<CategoryRecord[]> {
  const res = await authedFetch(`/admin/tenants/${tenantId}/categories`);
  await throwIfNotOk(res, "Impossibile caricare le categorie");
  return res.json() as Promise<CategoryRecord[]>;
}

export async function reorderCategories(tenantId: string, order: string[]): Promise<void> {
  const res = await authedFetch(`/admin/tenants/${tenantId}/categories/reorder`, {
    method: "PATCH",
    body: JSON.stringify({ order }),
  });
  await throwIfNotOk(res, "Impossibile riordinare le categorie");
}

export async function listProducts(tenantId: string): Promise<ProductRecord[]> {
  const res = await authedFetch(`/admin/tenants/${tenantId}/products`);
  await throwIfNotOk(res, "Impossibile caricare i prodotti");
  return res.json() as Promise<ProductRecord[]>;
}

export async function renameProduct(tenantId: string, productId: string, name: string): Promise<ProductRecord> {
  const res = await authedFetch(`/admin/tenants/${tenantId}/products/${productId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
  await throwIfNotOk(res, "Impossibile rinominare il prodotto");
  return res.json() as Promise<ProductRecord>;
}
