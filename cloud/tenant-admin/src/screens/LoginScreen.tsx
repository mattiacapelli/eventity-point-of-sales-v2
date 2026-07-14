import { useState } from "react";
import { getMe, login, setToken } from "../core/api-client.js";
import type { CurrentUser } from "../core/types.js";
import { Input } from "../components/Input.js";
import { Button } from "../components/Button.js";

export function LoginScreen({ onLoggedIn }: { onLoggedIn: (user: CurrentUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const token = await login(email, password);
      setToken(token);
      const user = await getMe();
      onLoggedIn(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore di accesso");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(160deg, var(--color-brand) 0%, #1a4a1e 100%)",
        padding: "var(--sp-xl)",
        gap: "var(--sp-xl)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <img src="/logo.svg" alt="epos" style={{ height: "64px", marginBottom: "8px" }} />
        <div style={{ color: "rgba(255,255,255,0.85)", fontSize: "var(--text-md)" }}>
          Cloud Dashboard
        </div>
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        style={{
          width: "100%",
          maxWidth: "340px",
          background: "var(--color-white)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          padding: "var(--sp-xl)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--sp-lg)",
        }}
      >
        <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-900)" }}>
          Accedi alla dashboard
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-md)" }}>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            autoFocus
          />
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
          />
        </div>
        {error && (
          <div style={{
            background: "rgba(239,68,68,0.1)", color: "var(--color-danger)",
            padding: "10px 14px", borderRadius: "var(--radius-md)",
            fontSize: "var(--text-sm)", fontWeight: 500, textAlign: "center",
          }}>
            {error}
          </div>
        )}
        <Button type="submit" loading={loading} style={{ height: "44px", width: "100%" }}>
          Accedi
        </Button>
      </form>
    </div>
  );
}
