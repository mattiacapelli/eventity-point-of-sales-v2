const BASE = "/api";

interface LoginResponse {
  token: string;
  role: string;
  userId: string;
}

interface MeResponse {
  userId: string;
  role: string;
  username: string;
  name: string;
}

export const authClient = {
  async login(pin: string): Promise<LoginResponse> {
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      throw new Error(err.error ?? err.message ?? "Credenziali non valide");
    }
    return res.json() as Promise<LoginResponse>;
  },

  async logout(token: string): Promise<void> {
    await fetch(`${BASE}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  async me(token: string): Promise<MeResponse> {
    const res = await fetch(`${BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Unauthorized");
    return res.json() as Promise<MeResponse>;
  },

  getStoredToken(): string | null {
    return localStorage.getItem("pos_token");
  },

  storeToken(token: string): void {
    localStorage.setItem("pos_token", token);
  },

  clearToken(): void {
    localStorage.removeItem("pos_token");
  },
};
