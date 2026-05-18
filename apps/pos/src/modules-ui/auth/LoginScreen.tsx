import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { authClient } from "../../core/auth-client.js";
import { wsClient } from "../../core/ws-client.js";
import { useStore } from "../../state/global-store.js";

const PIN_LENGTH = 6;

const KEYPAD = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "⌫"],
];

export function LoginScreen() {
  const navigate = useNavigate();
  const setSession = useStore((s) => s.setSession);

  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleKeypad = useCallback(
    (key: string) => {
      if (key === "⌫") {
        setPin((p) => p.slice(0, -1));
        setError(null);
        return;
      }
      if (pin.length >= PIN_LENGTH) return;
      setPin((p) => p + key);
    },
    [pin],
  );

  const handleLogin = useCallback(async () => {
    if (pin.length === 0) return;
    setError(null);
    setLoading(true);
    try {
      const result = await authClient.login(pin);
      authClient.storeToken(result.token);

      setSession({
        token: result.token,
        userId: result.userId,
        role: result.role,
        username: "",
      });

      wsClient.connect(
        `ws://${window.location.host}/ws`,
        result.token,
      );

      navigate("/pos");
    } catch (err) {
      setError(err instanceof Error ? err.message : "PIN non valido");
      setPin("");
    } finally {
      setLoading(false);
    }
  }, [pin, setSession, navigate]);

  // Auto-submit when PIN reaches max length
  React.useEffect(() => {
    if (pin.length === PIN_LENGTH) {
      void handleLogin();
    }
  }, [pin, handleLogin]);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(160deg, var(--color-brand) 0%, var(--color-brand-dark) 100%)",
        padding: "var(--sp-xl)",
        gap: "var(--sp-xl)",
      }}
    >
      {/* Logo */}
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: "var(--text-hero)",
            fontWeight: 700,
            color: "var(--color-accent)",
            letterSpacing: "-0.5px",
          }}
        >
          Eventity
        </div>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "var(--text-md)", marginTop: "4px" }}>
          Point of Sale
        </div>
      </div>

      {/* Card */}
      <div
        style={{
          background: "var(--color-white)",
          borderRadius: "var(--radius-xl)",
          padding: "var(--sp-xl)",
          width: "100%",
          maxWidth: "340px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--sp-lg)",
        }}
      >
        <div>
          <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "4px" }}>
            Inserisci PIN
          </div>
          <div style={{ color: "var(--color-gray-400)", fontSize: "var(--text-sm)" }}>
            {PIN_LENGTH} cifre
          </div>
        </div>

        {/* PIN dots */}
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div
              key={i}
              style={{
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                background: i < pin.length ? "var(--color-brand)" : "var(--color-gray-200)",
                transition: "background var(--transition)",
              }}
            />
          ))}
        </div>

        {error && (
          <div
            style={{
              background: "rgba(239,68,68,0.1)",
              color: "var(--color-danger)",
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              fontSize: "var(--text-sm)",
              fontWeight: 500,
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

        {/* Keypad */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
          {KEYPAD.flat().map((key, i) => (
            <button
              key={i}
              onClick={() => { if (key) handleKeypad(key); }}
              disabled={!key || loading}
              style={{
                height: "64px",
                borderRadius: "var(--radius-lg)",
                background: key ? "var(--color-gray-50)" : "transparent",
                border: key ? "2px solid var(--color-gray-200)" : "none",
                fontSize: key === "⌫" ? "var(--text-lg)" : "var(--text-xl)",
                fontWeight: 600,
                color: "var(--color-gray-900)",
                cursor: key ? "pointer" : "default",
                fontFamily: "var(--font)",
                transition: "background var(--transition)",
              }}
              onPointerDown={(e) => { if (key) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-gray-100)"; }}
              onPointerUp={(e) => { if (key) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-gray-50)"; }}
              onPointerLeave={(e) => { if (key) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-gray-50)"; }}
            >
              {loading && key === "0" ? "…" : key}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
