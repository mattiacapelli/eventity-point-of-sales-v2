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
        background: "var(--color-gray-50)",
        padding: "var(--sp-xl)",
        gap: "var(--sp-xl)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <span style={{ fontSize: "34px", fontWeight: 700, letterSpacing: "-0.04em", color: "var(--color-brand)" }}>epos</span>
        <div style={{ color: "var(--color-gray-500)", fontSize: "var(--text-md)", marginTop: "2px" }}>
          Cloud Dashboard
        </div>
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        style={{
          width: "100%",
          maxWidth: "340px",
          background: "var(--color-white)",
          border: "1px solid var(--color-gray-200)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-lg)",
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
            background: "var(--color-danger-wash)", color: "var(--color-danger)",
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
