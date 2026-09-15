import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { authClient } from "../../core/auth-client.js";
import { systemApi } from "../../core/system-api.js";
import { wsClient } from "../../core/ws-client.js";
import { useStore } from "../../state/global-store.js";
import { LockClosedIcon, BanknotesIcon, ClockIcon, ShieldCheckIcon } from "../../components/ui/icons.js";

const MIN_PIN = 4;
const MAX_PIN = 12;

const KEYPAD = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["⌫", "0", "✓"],
];

const HIGHLIGHTS = [
  { Icon: BanknotesIcon, text: "Cassa veloce per vendita, comande e scontrini" },
  { Icon: ClockIcon, text: "Gestione turni, magazzino e statistiche in tempo reale" },
  { Icon: ShieldCheckIcon, text: "Accesso protetto da PIN personale per ogni operatore" },
];

export function LoginScreen() {
  const navigate = useNavigate();
  const setSession = useStore((s) => s.setSession);

  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shuttingDown, setShuttingDown] = useState(false);

  const handleShutdown = useCallback(async () => {
    if (shuttingDown) return;
    setShuttingDown(true);
    try {
      await systemApi.shutdown();
    } catch {
      // Il dispositivo potrebbe spegnersi prima che la risposta arrivi:
      // un errore di rete a questo punto non è necessariamente un fallimento reale.
    }
  }, [shuttingDown]);

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
    <div style={{ height: "100%", display: "flex", minHeight: 0 }}>
      {/* Brand panel */}
      <div
        className="login-brand-panel"
        style={{
          flex: "1 1 46%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "var(--sp-xxl, 48px)",
          background: "linear-gradient(160deg, var(--color-brand-dark) 0%, var(--color-brand) 100%)",
          color: "var(--color-white)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute", inset: 0,
            backgroundImage: "radial-gradient(circle at 15% 15%, rgba(255,255,255,0.08) 0%, transparent 45%), radial-gradient(circle at 85% 90%, rgba(255,255,255,0.06) 0%, transparent 40%)",
          }}
        />

        <span style={{ position: "relative", fontSize: "26px", fontWeight: 700, letterSpacing: "-0.04em" }}>epos</span>

        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "var(--sp-xl, 32px)", maxWidth: "420px" }}>
          <h1 style={{ margin: 0, fontSize: "32px", lineHeight: 1.2, fontWeight: 700, letterSpacing: "-0.01em" }}>
            La cassa pensata per i tuoi eventi
          </h1>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-md)" }}>
            {HIGHLIGHTS.map(({ Icon, text }) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  flexShrink: 0, width: "34px", height: "34px", borderRadius: "var(--radius-md)",
                  background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon width={18} height={18} />
                </div>
                <span style={{ fontSize: "var(--text-sm)", color: "rgba(255,255,255,0.9)" }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <span style={{ position: "relative", fontSize: "var(--text-xs)", color: "rgba(255,255,255,0.6)" }}>
          © {new Date().getFullYear()} epos · Point of Sale
        </span>
      </div>

      {/* Form panel */}
      <div
        style={{
          flex: "1 1 54%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--color-gray-50)",
          padding: "var(--sp-xl)",
          position: "relative",
        }}
      >
        <button
          onClick={() => void handleShutdown()}
          disabled={shuttingDown}
          title="Spegni il dispositivo"
          style={{
            position: "absolute", top: "16px", right: "16px",
            width: "36px", height: "36px", borderRadius: "50%", border: "none",
            background: "var(--color-gray-100)", color: "var(--color-gray-500)",
            cursor: shuttingDown ? "default" : "pointer", fontSize: "18px",
            display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
            opacity: shuttingDown ? 0.6 : 1,
          }}
        >
          ✕
        </button>
        {shuttingDown && (
          <div style={{
            position: "absolute", top: "60px", right: "16px",
            fontSize: "var(--text-xs)", color: "var(--color-gray-500)",
            background: "var(--color-white)", padding: "6px 10px",
            borderRadius: "var(--radius-sm)", boxShadow: "var(--shadow-sm)",
          }}>
            Spegnimento in corso…
          </div>
        )}

        <div style={{ width: "100%", maxWidth: "360px", display: "flex", flexDirection: "column", gap: "var(--sp-lg)" }}>
          <div className="login-brand-mobile" style={{ display: "none", textAlign: "center", marginBottom: "var(--sp-sm)" }}>
            <span style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-0.04em", color: "var(--color-brand)" }}>epos</span>
          </div>

          <div>
            <div style={{ fontSize: "var(--text-xxl, 26px)", fontWeight: 700, color: "var(--color-gray-900)", letterSpacing: "-0.01em" }}>
              Bentornato
            </div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)", marginTop: "4px" }}>
              Inserisci il tuo PIN personale per accedere alla cassa.
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-700)", marginBottom: "6px" }}>
              PIN
            </label>
            <div
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                height: "48px", padding: "0 14px",
                borderRadius: "var(--radius-md)", border: "1.5px solid var(--color-gray-200)",
                background: "var(--color-white)",
              }}
            >
              <LockClosedIcon width={18} height={18} color="var(--color-gray-400)" style={{ flexShrink: 0 }} />
              <span
                style={{
                  flex: 1, fontSize: "20px", fontWeight: 700, letterSpacing: "0.3em",
                  color: pin ? "var(--color-gray-900)" : "var(--color-gray-300)",
                }}
              >
                {pin ? "•".repeat(pin.length) : "– – – –"}
              </span>
            </div>
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
                    height: "56px",
                    borderRadius: "0",
                    background: isConfirm
                      ? "transparent"
                      : isMuted ? "var(--color-gray-100)" : (key ? "var(--color-white)" : "transparent"),
                    border: isConfirm || isMuted || !key ? "none" : "1px solid var(--color-gray-200)",
                    fontSize: (key === "⌫" || key === "✓") ? "20px" : "22px",
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
              height: "48px",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: canSubmit ? "var(--color-brand)" : "var(--color-gray-100)",
              color: canSubmit ? "var(--color-white)" : "var(--color-gray-400)",
              fontSize: "var(--text-md, 16px)",
              fontWeight: 700,
              fontFamily: "var(--font)",
              cursor: canSubmit ? "pointer" : "default",
              transition: "background var(--transition)",
            }}
          >
            {loading ? "Accesso…" : "Accedi"}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--color-gray-400)", fontSize: "var(--text-xs)" }}>
            <ShieldCheckIcon width={14} height={14} />
            Connessione protetta · accesso riservato al personale autorizzato
          </div>
        </div>
      </div>
    </div>
  );
}
