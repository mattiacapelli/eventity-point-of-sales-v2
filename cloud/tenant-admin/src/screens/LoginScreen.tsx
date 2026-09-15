import { useState } from "react";
import { EnvelopeIcon, LockClosedIcon, ChartBarSquareIcon, QrCodeIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { getMe, login, setToken } from "../core/api-client.js";
import type { CurrentUser } from "../core/types.js";
import { Button } from "../components/Button.js";

const HIGHLIGHTS = [
  { Icon: QrCodeIcon, text: "Ordinazione self-order con QR code per ogni stand" },
  { Icon: ChartBarSquareIcon, text: "Statistiche vendite e incassi in tempo reale" },
  { Icon: ShieldCheckIcon, text: "Accessi separati per ruolo e per evento" },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-700)", marginBottom: "6px" }}>
      {children}
    </label>
  );
}

function IconField({ icon: Icon, ...rest }: { icon: React.ComponentType<React.SVGProps<SVGSVGElement>> } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div style={{ position: "relative" }}>
      <Icon width={18} height={18} color="var(--color-gray-400)" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
      <input
        className="input-field"
        style={{
          width: "100%",
          height: "44px",
          padding: "0 14px 0 42px",
          borderRadius: "var(--radius-md)",
          border: "1.5px solid var(--color-gray-200)",
          fontSize: "var(--text-sm)",
        }}
        {...rest}
      />
    </div>
  );
}

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
    <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      <div
        className="login-brand-panel"
        style={{
          flex: "1 1 46%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "var(--sp-xxl)",
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

        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "var(--sp-xl)", maxWidth: "420px" }}>
          <h1 style={{ margin: 0, fontSize: "32px", lineHeight: 1.2, fontWeight: 700, letterSpacing: "-0.01em" }}>
            La piattaforma cloud per gestire i tuoi eventi
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
          © {new Date().getFullYear()} epos · Cloud Dashboard
        </span>
      </div>

      <div
        style={{
          flex: "1 1 54%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--color-gray-50)",
          padding: "var(--sp-xl)",
        }}
      >
        <form
          onSubmit={(e) => void handleSubmit(e)}
          style={{
            width: "100%",
            maxWidth: "360px",
            display: "flex",
            flexDirection: "column",
            gap: "var(--sp-lg)",
          }}
        >
          <div className="login-brand-mobile" style={{ display: "none", textAlign: "center", marginBottom: "var(--sp-sm)" }}>
            <span style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-0.04em", color: "var(--color-brand)" }}>epos</span>
          </div>

          <div>
            <div style={{ fontSize: "var(--text-xxl)", fontWeight: 700, color: "var(--color-gray-900)", letterSpacing: "-0.01em" }}>
              Bentornato
            </div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)", marginTop: "4px" }}>
              Accedi con le credenziali del tuo account.
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-md)" }}>
            <div>
              <FieldLabel>Email</FieldLabel>
              <IconField
                icon={EnvelopeIcon}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@azienda.it"
                type="email"
                autoFocus
                autoComplete="username"
              />
            </div>
            <div>
              <FieldLabel>Password</FieldLabel>
              <IconField
                icon={LockClosedIcon}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                type="password"
                autoComplete="current-password"
              />
            </div>
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

          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--color-gray-400)", fontSize: "var(--text-xs)" }}>
            <ShieldCheckIcon width={14} height={14} />
            Connessione protetta · accesso riservato al personale autorizzato
          </div>
        </form>
      </div>
    </div>
  );
}
