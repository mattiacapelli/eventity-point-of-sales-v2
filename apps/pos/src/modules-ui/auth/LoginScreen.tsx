import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { authClient } from "../../core/auth-client.js";
import { wsClient } from "../../core/ws-client.js";
import { useStore } from "../../state/global-store.js";

const MIN_PIN = 4;
const MAX_PIN = 12;

const KEYPAD = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["⌫", "0", "✓"],
];

export function LoginScreen() {
  const navigate = useNavigate();
  const setSession = useStore((s) => s.setSession);

  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = useCallback(async (currentPin: string) => {
    if (currentPin.length < MIN_PIN) return;
    setError(null);
    setLoading(true);
    try {
      const result = await authClient.login(currentPin);
      authClient.storeToken(result.token);

      setSession({
        token: result.token,
        userId: result.userId,
        role: result.role,
        username: "",
      });

      wsClient.connect(`ws://${window.location.host}/ws`, result.token);
      navigate("/pos");
    } catch (err) {
      setError(err instanceof Error ? err.message : "PIN non valido");
      setPin("");
    } finally {
      setLoading(false);
    }
  }, [setSession, navigate]);

  const handleKeypad = useCallback(
    (key: string) => {
      if (loading) return;
      if (key === "⌫") {
        setPin((p) => p.slice(0, -1));
        setError(null);
        return;
      }
      if (key === "✓") {
        void handleLogin(pin);
        return;
      }
      if (pin.length >= MAX_PIN) return;
      const next = pin + key;
      setPin(next);
    },
    [pin, loading, handleLogin],
  );

  // Also allow physical keyboard entry
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (loading) return;
      if (e.key >= "0" && e.key <= "9") {
        setPin((p) => p.length < MAX_PIN ? p + e.key : p);
        setError(null);
      } else if (e.key === "Backspace") {
        setPin((p) => p.slice(0, -1));
        setError(null);
      } else if (e.key === "Enter") {
        setPin((p) => { void handleLogin(p); return p; });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [loading, handleLogin]);

  const canSubmit = pin.length >= MIN_PIN && !loading;

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(160deg, var(--color-brand) 0%, #1a4a1e 100%)",
        padding: "var(--sp-xl)",
        gap: "var(--sp-xl)",
      }}
    >
      {/* Logo */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "var(--text-hero)", fontWeight: 700, color: "var(--color-accent)", letterSpacing: "-0.5px" }}>
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
            Minimo {MIN_PIN} cifre · premi ✓ per confermare
          </div>
        </div>

        {/* PIN dots — show actual entered length, min MIN_PIN slots */}
        <div style={{ display: "flex", gap: "10px", justifyContent: "center", minHeight: "24px", alignItems: "center" }}>
          {Array.from({ length: Math.max(pin.length, MIN_PIN) }).map((_, i) => (
            <div
              key={i}
              style={{
                width: "14px",
                height: "14px",
                borderRadius: "50%",
                background: i < pin.length ? "var(--color-brand)" : "var(--color-gray-200)",
                transition: "background var(--transition)",
                flexShrink: 0,
              }}
            />
          ))}
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

        {/* Keypad */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
          {KEYPAD.flat().map((key, i) => {
            const isConfirm = key === "✓";
            const isActive = isConfirm ? canSubmit : !!key;
            return (
              <button
                key={i}
                onClick={() => { if (key) handleKeypad(key); }}
                disabled={!key || loading || (isConfirm && !canSubmit)}
                style={{
                  height: "64px",
                  borderRadius: "var(--radius-lg)",
                  background: isConfirm
                    ? (canSubmit ? "var(--color-brand)" : "var(--color-gray-100)")
                    : (key ? "var(--color-gray-50)" : "transparent"),
                  border: isConfirm
                    ? "none"
                    : (key ? "2px solid var(--color-gray-200)" : "none"),
                  fontSize: (key === "⌫" || key === "✓") ? "var(--text-lg)" : "var(--text-xl)",
                  fontWeight: 600,
                  color: isConfirm
                    ? (canSubmit ? "var(--color-white)" : "var(--color-gray-300)")
                    : "var(--color-gray-900)",
                  cursor: (key && isActive) ? "pointer" : "default",
                  fontFamily: "var(--font)",
                  transition: "background var(--transition)",
                  opacity: loading ? 0.6 : 1,
                }}
                onPointerDown={(e) => {
                  if (!key || !isActive) return;
                  (e.currentTarget as HTMLButtonElement).style.background =
                    isConfirm ? "var(--color-brand-dark, #1a4a1e)" : "var(--color-gray-100)";
                }}
                onPointerUp={(e) => {
                  if (!key || !isActive) return;
                  (e.currentTarget as HTMLButtonElement).style.background =
                    isConfirm ? "var(--color-brand)" : "var(--color-gray-50)";
                }}
                onPointerLeave={(e) => {
                  if (!key || !isActive) return;
                  (e.currentTarget as HTMLButtonElement).style.background =
                    isConfirm ? "var(--color-brand)" : "var(--color-gray-50)";
                }}
              >
                {loading && key === "✓" ? "…" : key}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
