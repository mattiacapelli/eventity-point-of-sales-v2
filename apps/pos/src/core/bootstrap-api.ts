export interface BootstrapStatus {
  initialized: boolean;
  checks: {
    hasAdmin: boolean;
    hasPaymentMethods: boolean;
    hasCategories: boolean;
  };
}

export interface BootstrapInitBody {
  storeName: string;
  adminPin: string;
  adminName?: string;
}

export interface BootstrapInitResult {
  ok: boolean;
  username: string;
  message: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const bootstrapApi = {
  status: () => request<BootstrapStatus>("/api/bootstrap/status"),
  init: (body: BootstrapInitBody) =>
    request<BootstrapInitResult>("/api/bootstrap/init", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
