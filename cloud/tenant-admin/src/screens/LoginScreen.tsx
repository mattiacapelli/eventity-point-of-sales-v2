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
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--sp-lg)" }}>
      <form
        onSubmit={(e) => void handleSubmit(e)}
        style={{
          width: "100%",
          maxWidth: "360px",
          background: "var(--color-white)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-md)",
          padding: "var(--sp-xl)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--sp-md)",
        }}
      >
        <img src="/logo.svg" alt="epos" style={{ height: "32px", width: "auto", filter: "invert(1)", marginBottom: "var(--sp-sm)" }} />
        <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--color-gray-900)" }}>
          Accedi alla dashboard
        </div>
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
        {error && <div style={{ color: "var(--color-danger)", fontSize: "var(--text-sm)", fontWeight: 600 }}>{error}</div>}
        <Button type="submit" loading={loading} style={{ height: "44px", width: "100%" }}>
          Accedi
        </Button>
      </form>
    </div>
  );
}
