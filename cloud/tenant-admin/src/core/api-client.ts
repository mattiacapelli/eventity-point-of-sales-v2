import type { Tenant, TenantStats } from "./types.js";

const API_BASE = import.meta.env["VITE_API_BASE"] ?? "http://localhost:4000";
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
    window.location.reload();
    throw new Error("Sessione scaduta");
  }
  return res;
}

export async function login(username: string, password: string): Promise<string> {
  const res = await fetch(`${API_BASE}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Credenziali non valide");
  const data = await res.json() as { token: string };
  return data.token;
}

export async function listTenants(): Promise<Tenant[]> {
  const res = await authedFetch("/admin/tenants");
  if (!res.ok) throw new Error("Impossibile caricare i tenant");
  return res.json() as Promise<Tenant[]>;
}

export async function createTenant(name: string): Promise<Tenant> {
  const res = await authedFetch("/admin/tenants", { method: "POST", body: JSON.stringify({ name }) });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? "Impossibile creare il tenant");
  }
  return res.json() as Promise<Tenant>;
}

export async function updateTenant(id: string, data: Partial<{ name: string; active: boolean }>): Promise<Tenant> {
  const res = await authedFetch(`/admin/tenants/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  if (!res.ok) throw new Error("Impossibile aggiornare il tenant");
  return res.json() as Promise<Tenant>;
}

export async function rotateTenantKey(id: string): Promise<{ apiKey: string }> {
  const res = await authedFetch(`/admin/tenants/${id}/rotate-key`, { method: "POST" });
  if (!res.ok) throw new Error("Impossibile rigenerare la chiave");
  return res.json() as Promise<{ apiKey: string }>;
}

export async function deleteTenant(id: string): Promise<void> {
  const res = await authedFetch(`/admin/tenants/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Impossibile eliminare il tenant");
}

export async function fetchTenantStats(id: string): Promise<TenantStats> {
  const res = await authedFetch(`/admin/tenants/${id}/stats`);
  if (!res.ok) throw new Error("Impossibile caricare le statistiche");
  return res.json() as Promise<TenantStats>;
}
