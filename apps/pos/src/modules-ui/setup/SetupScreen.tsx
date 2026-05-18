import React, { useState } from "react";
import { bootstrapApi } from "../../core/bootstrap-api.js";

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  height: "48px",
  padding: "0 16px",
  borderRadius: "12px",
  border: "2px solid var(--color-gray-200)",
  fontSize: "var(--text-md)",
  fontFamily: "var(--font)",
  color: "var(--color-gray-800)",
  background: "var(--color-white)",
  outline: "none",
  boxSizing: "border-box",
};

interface Props {
  onDone: () => void;
}

export function SetupScreen({ onDone }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [storeName, setStoreName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUsername, setCreatedUsername] = useState("");

  const handleInit = async () => {
    if (pin !== pinConfirm) { setError("I PIN non corrispondono"); return; }
    if (pin.length < 4) { setError("Il PIN deve essere di almeno 4 cifre"); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await bootstrapApi.init({
        storeName: storeName.trim() || "Eventity POS",
        adminPin: pin,
        adminName: adminName.trim() || "Admin",
      });
      setCreatedUsername(result.username);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante l'inizializzazione");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, var(--color-brand) 0%, #1a4a1e 100%)",
      padding: "24px",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "440px",
        background: "var(--color-white)",
        borderRadius: "20px",
        padding: "40px",
        boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--color-brand)", letterSpacing: "-1px" }}>
            Eventity POS
          </div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-400)", marginTop: "4px" }}>
            Configurazione iniziale
          </div>
        </div>

        {/* Step indicators */}
        <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "32px" }}>
          {([1, 2, 3] as const).map((s) => (
            <div key={s} style={{
              width: "32px", height: "4px", borderRadius: "2px",
              background: s <= step ? "var(--color-brand)" : "var(--color-gray-200)",
              transition: "background 0.3s",
            }} />
          ))}
        </div>

        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div>
              <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-800)", marginBottom: "6px" }}>
                Benvenuto
              </div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)", lineHeight: 1.5 }}>
                Iniziamo configurando il tuo punto vendita. Questo processo richiede solo un minuto.
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-600)", marginBottom: "6px" }}>
                Nome del punto vendita
              </label>
              <input
                style={INPUT_STYLE}
                type="text"
                placeholder="es. La Trattoria, Bar Sport…"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-600)", marginBottom: "6px" }}>
                Nome amministratore
              </label>
              <input
                style={INPUT_STYLE}
                type="text"
                placeholder="es. Mario Rossi"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
              />
            </div>
            <button
              onClick={() => setStep(2)}
              disabled={storeName.trim().length === 0}
              style={{
                width: "100%", height: "48px",
                background: storeName.trim() ? "var(--color-brand)" : "var(--color-gray-200)",
                color: storeName.trim() ? "var(--color-white)" : "var(--color-gray-400)",
                border: "none", borderRadius: "12px",
                fontSize: "var(--text-md)", fontWeight: 700, fontFamily: "var(--font)",
                cursor: storeName.trim() ? "pointer" : "not-allowed",
                transition: "background 0.2s",
              }}
            >
              Continua →
            </button>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div>
              <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-800)", marginBottom: "6px" }}>
                PIN amministratore
              </div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)", lineHeight: 1.5 }}>
                Scegli un PIN di almeno 4 cifre. Verrà usato per accedere al POS.
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-600)", marginBottom: "6px" }}>
                PIN
              </label>
              <input
                style={INPUT_STYLE}
                type="password"
                inputMode="numeric"
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-600)", marginBottom: "6px" }}>
                Conferma PIN
              </label>
              <input
                style={INPUT_STYLE}
                type="password"
                inputMode="numeric"
                placeholder="••••"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && pin.length >= 4) void handleInit(); }}
              />
            </div>
            {error && (
              <div style={{
                background: "rgba(239,68,68,0.08)", color: "var(--color-danger)",
                borderRadius: "10px", padding: "12px 14px",
                fontSize: "var(--text-sm)", fontWeight: 500,
              }}>
                {error}
              </div>
            )}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => { setStep(1); setError(null); }}
                style={{
                  flex: 1, height: "48px",
                  background: "var(--color-gray-100)", color: "var(--color-gray-700)",
                  border: "none", borderRadius: "12px",
                  fontSize: "var(--text-md)", fontWeight: 600, fontFamily: "var(--font)",
                  cursor: "pointer",
                }}
              >
                ← Indietro
              </button>
              <button
                onClick={() => void handleInit()}
                disabled={loading || pin.length < 4 || pin !== pinConfirm}
                style={{
                  flex: 2, height: "48px",
                  background: (!loading && pin.length >= 4 && pin === pinConfirm) ? "var(--color-brand)" : "var(--color-gray-200)",
                  color: (!loading && pin.length >= 4 && pin === pinConfirm) ? "var(--color-white)" : "var(--color-gray-400)",
                  border: "none", borderRadius: "12px",
                  fontSize: "var(--text-md)", fontWeight: 700, fontFamily: "var(--font)",
                  cursor: (!loading && pin.length >= 4 && pin === pinConfirm) ? "pointer" : "not-allowed",
                }}
              >
                {loading ? "Inizializzazione…" : "Inizializza POS"}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px", textAlign: "center" }}>
            <div style={{
              width: "72px", height: "72px", borderRadius: "50%",
              background: "rgba(48,107,52,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto",
            }}>
              <svg style={{ width: "36px", height: "36px", color: "var(--color-brand)" }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-800)", marginBottom: "8px" }}>
                Configurazione completata!
              </div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)", lineHeight: 1.6 }}>
                Il POS è pronto. Accedi con:
              </div>
              <div style={{
                background: "var(--color-gray-50)", borderRadius: "10px",
                padding: "14px 16px", marginTop: "12px",
                fontSize: "var(--text-sm)", color: "var(--color-gray-700)",
                textAlign: "left", lineHeight: 1.8,
              }}>
                <div><strong>Username:</strong> {createdUsername}</div>
                <div><strong>PIN:</strong> il PIN che hai appena scelto</div>
              </div>
            </div>
            <button
              onClick={onDone}
              style={{
                width: "100%", height: "48px",
                background: "var(--color-brand)", color: "var(--color-white)",
                border: "none", borderRadius: "12px",
                fontSize: "var(--text-md)", fontWeight: 700, fontFamily: "var(--font)",
                cursor: "pointer",
              }}
            >
              Vai al login →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
