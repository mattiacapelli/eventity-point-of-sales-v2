import { useState } from "react";
import { login, setToken } from "../core/api-client.js";

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: "44px",
  padding: "0 14px",
  borderRadius: "var(--radius-md)",
  border: "1.5px solid var(--color-gray-200)",
  fontSize: "var(--text-md)",
};

export function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const token = await login(username, password);
      setToken(token);
      onLoggedIn();
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
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          style={inputStyle}
          autoFocus
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          style={inputStyle}
        />
        {error && <div style={{ color: "var(--color-danger)", fontSize: "var(--text-sm)", fontWeight: 600 }}>{error}</div>}
        <button
          type="submit"
          disabled={loading}
          style={{
            height: "44px",
            borderRadius: "var(--radius-md)",
            background: "var(--color-brand)",
            color: "var(--color-white)",
            fontWeight: 700,
            fontSize: "var(--text-md)",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Accesso..." : "Accedi"}
        </button>
      </form>
    </div>
  );
}
