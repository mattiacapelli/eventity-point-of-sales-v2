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

      const me = await authClient.me(result.token);

      setSession({
        token: result.token,
        userId: result.userId,
        role: result.role,
        name: me.name,
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
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-brand)",
        padding: "40px",
        position: "relative",
      }}
    >
      {/* Close button */}
      <button
        onClick={() => window.close()}
        title="Chiudi applicazione"
        style={{
          position: "absolute",
          top: "16px",
          right: "16px",
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          border: "none",
          background: "rgba(255,255,255,0.15)",
          color: "rgba(255,255,255,0.8)",
          cursor: "pointer",
          fontSize: "18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.25)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.15)"; }}
      >
        ✕
      </button>

      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        {/* Brand header */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "0 4px" }}>
          <span style={{ fontSize: "30px", fontWeight: 700, letterSpacing: "-0.04em", color: "#FFFFFF" }}>
            epos
          </span>
          <span style={{ fontSize: "13px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-brand-light)" }}>
            Point of Sale
          </span>
        </div>

        {/* Card */}
        <div
          style={{
            background: "var(--color-white)",
            borderRadius: "var(--radius-xl)",
            padding: "30px",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, letterSpacing: "-0.02em" }}>
              Inserisci il PIN
            </h1>
            <p style={{ margin: 0, fontSize: "15px", color: "var(--color-gray-700)" }}>
              Minimo {MIN_PIN} cifre · premi ✓ per confermare
            </p>
          </div>

          {/* PIN display */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              height: "56px",
              padding: "0 18px",
              borderRadius: "12px",
              background: "var(--color-gray-100)",
              border: "1px solid var(--color-gray-200)",
            }}
          >
            <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-gray-700)" }}>PIN</span>
            <span
              style={{
                flex: 1,
                fontSize: "26px",
                fontWeight: 700,
                letterSpacing: "0.3em",
                color: "var(--color-gray-900)",
              }}
            >
              {pin ? "•".repeat(pin.length) : "– – – –"}
            </span>
          </div>

          {error && (
            <div style={{
              background: "rgba(154,44,34,0.08)", color: "var(--color-danger)",
              padding: "10px 14px", borderRadius: "var(--radius-md)",
              fontSize: "14px", fontWeight: 500, textAlign: "center",
            }}>
              {error}
            </div>
          )}

          {/* Keypad */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
            {KEYPAD.flat().map((key, i) => {
              const isConfirm = key === "✓";
              const isMuted = key === "⌫";
              const isActive = isConfirm ? canSubmit : !!key;
              return (
                <button
                  key={i}
                  onClick={() => { if (key) handleKeypad(key); }}
                  disabled={!key || loading || (isConfirm && !canSubmit)}
                  style={{
                    height: "62px",
                    borderRadius: "12px",
                    background: isConfirm
                      ? "transparent"
                      : isMuted ? "var(--color-gray-100)" : (key ? "var(--color-white)" : "transparent"),
                    border: isConfirm || isMuted || !key ? "none" : "1px solid var(--color-gray-200)",
                    fontSize: (key === "⌫" || key === "✓") ? "22px" : "24px",
                    fontWeight: isMuted ? 600 : 700,
                    color: isConfirm
                      ? "var(--color-gray-700)"
                      : isMuted ? "var(--color-gray-700)" : "var(--color-gray-900)",
                    cursor: (key && isActive) ? "pointer" : "default",
                    fontFamily: "var(--font)",
                    transition: "background var(--transition)",
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading && key === "✓" ? "…" : key}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => { void handleLogin(pin); }}
            disabled={!canSubmit}
            style={{
              height: "60px",
              borderRadius: "14px",
              background: canSubmit ? "var(--color-brand)" : "var(--color-gray-100)",
              color: canSubmit ? "var(--color-white)" : "var(--color-gray-400)",
              fontSize: "19px",
              fontWeight: 700,
              cursor: canSubmit ? "pointer" : "default",
              transition: "background var(--transition)",
            }}
            onMouseEnter={(e) => { if (canSubmit) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-brand-dark)"; }}
            onMouseLeave={(e) => { if (canSubmit) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-brand)"; }}
          >
            {loading ? "Accesso…" : "Accedi"}
          </button>
        </div>
      </div>
    </div>
  );
}
