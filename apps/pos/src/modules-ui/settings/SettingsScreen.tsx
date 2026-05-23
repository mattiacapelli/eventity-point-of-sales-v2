import React, { useState, useEffect } from "react";
import { PosLayout } from "../../layout/PosLayout.js";
import { Modal } from "../../components/ui/Modal.js";
import { Button } from "../../components/ui/Button.js";
import { Input } from "../../components/ui/Input.js";
import { useStore } from "../../state/global-store.js";
import { apiClient } from "../../core/api-client.js";

// ─── Theme persistence ────────────────────────────────────────────────────────

function applyTheme(dark: boolean) {
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  localStorage.setItem("pos_theme", dark ? "dark" : "light");
}

function applyFontScale(scale: string) {
  document.documentElement.setAttribute("data-font-scale", scale);
  localStorage.setItem("pos_font_size", scale);
}

// ─── Change PIN modal ─────────────────────────────────────────────────────────

function ChangePinModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function reset() {
    setCurrentPin(""); setNewPin(""); setConfirmPin("");
    setError(null); setSuccess(false);
  }

  function handleClose() { reset(); onClose(); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPin.length < 4) { setError("Il nuovo PIN deve essere di almeno 4 cifre"); return; }
    if (newPin !== confirmPin) { setError("I PIN non coincidono"); return; }
    setLoading(true);
    try {
      await apiClient.auth.changePin(currentPin, newPin);
      setSuccess(true);
      setTimeout(() => handleClose(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore cambio PIN");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Cambia PIN">
      {success ? (
        <div style={{ textAlign: "center", padding: "var(--sp-lg) 0" }}>
          <div style={{ fontSize: "48px", marginBottom: "var(--sp-sm)" }}>✓</div>
          <span style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--color-success)" }}>
            PIN aggiornato con successo
          </span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-md)" }}>
          <Input
            label="PIN attuale"
            type="password"
            inputMode="numeric"
            maxLength={12}
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value)}
            autoFocus
          />
          <Input
            label="Nuovo PIN"
            type="password"
            inputMode="numeric"
            maxLength={12}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
          />
          <Input
            label="Conferma nuovo PIN"
            type="password"
            inputMode="numeric"
            maxLength={12}
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
            {...(error !== null ? { error } : {})}
          />
          <Button type="submit" fullWidth loading={loading} style={{ marginTop: "var(--sp-sm)" }}>
            Aggiorna PIN
          </Button>
        </form>
      )}
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function SettingsScreen() {
  const session = useStore((s) => s.session);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("pos_theme") === "dark");
  const [fontScale, setFontScale] = useState(() => localStorage.getItem("pos_font_size") ?? "normal");

  function toggleDark() {
    const next = !darkMode;
    setDarkMode(next);
    applyTheme(next);
  }

  function handleFontScale(scale: string) {
    setFontScale(scale);
    applyFontScale(scale);
  }

  const cardStyle: React.CSSProperties = {
    background: "var(--color-white)",
    borderRadius: "var(--radius-xl)",
    boxShadow: "var(--shadow-sm)",
    border: "1px solid var(--color-gray-100)",
    padding: "var(--sp-lg)",
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: "var(--text-sm)",
    fontWeight: 700,
    color: "var(--color-gray-500)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: "var(--sp-md)",
  };

  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "var(--sp-sm) 0",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "var(--text-md)",
    fontWeight: 500,
    color: "var(--color-gray-800)",
  };

  const subLabelStyle: React.CSSProperties = {
    fontSize: "var(--text-sm)",
    color: "var(--color-gray-400)",
    marginTop: "2px",
  };

  return (
    <PosLayout>
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "var(--sp-lg)", display: "flex", flexDirection: "column", gap: "var(--sp-lg)" }}>
        <h1 style={{ fontSize: "var(--text-xxl)", fontWeight: 700, color: "var(--color-gray-900)", margin: 0 }}>
          Impostazioni
        </h1>

        {/* Profilo */}
        <div style={cardStyle}>
          <div style={sectionTitle}>Profilo</div>
          <div style={rowStyle}>
            <div>
              <div style={labelStyle}>{session?.username ?? "—"}</div>
              <div style={subLabelStyle}>{session?.role}</div>
            </div>
          </div>
          <div style={{ borderTop: "1px solid var(--color-gray-100)", paddingTop: "var(--sp-md)", marginTop: "var(--sp-sm)" }}>
            <Button variant="secondary" size="sm" onClick={() => setPinModalOpen(true)}>
              Cambia PIN
            </Button>
          </div>
        </div>

        {/* Apparenza */}
        <div style={cardStyle}>
          <div style={sectionTitle}>Apparenza</div>

          <div style={rowStyle}>
            <div>
              <div style={labelStyle}>Modalità scura</div>
              <div style={subLabelStyle}>Cambia il tema dell'interfaccia</div>
            </div>
            <Toggle checked={darkMode} onChange={toggleDark} />
          </div>

          <div style={{ borderTop: "1px solid var(--color-gray-100)", paddingTop: "var(--sp-md)", marginTop: "var(--sp-sm)" }}>
            <div style={{ ...labelStyle, marginBottom: "var(--sp-sm)" }}>Dimensione testo</div>
            <div style={{ display: "flex", gap: "var(--sp-sm)" }}>
              {(["normal", "large", "xlarge"] as const).map((scale) => (
                <button
                  key={scale}
                  onClick={() => handleFontScale(scale)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "var(--radius-md)",
                    border: fontScale === scale ? "2px solid var(--color-brand)" : "2px solid var(--color-gray-200)",
                    background: fontScale === scale ? "var(--color-brand)" : "var(--color-white)",
                    color: fontScale === scale ? "var(--color-white)" : "var(--color-gray-700)",
                    fontWeight: 600,
                    fontSize: scale === "normal" ? "14px" : scale === "large" ? "16px" : "18px",
                    cursor: "pointer",
                  }}
                >
                  {scale === "normal" ? "Normale" : scale === "large" ? "Grande" : "Molto grande"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ChangePinModal open={pinModalOpen} onClose={() => setPinModalOpen(false)} />
    </PosLayout>
  );
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      style={{
        width: "52px",
        height: "28px",
        borderRadius: "14px",
        background: checked ? "var(--color-brand)" : "var(--color-gray-200)",
        border: "none",
        cursor: "pointer",
        position: "relative",
        transition: "background var(--transition)",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "3px",
          left: checked ? "27px" : "3px",
          width: "22px",
          height: "22px",
          borderRadius: "50%",
          background: "var(--color-white)",
          boxShadow: "var(--shadow-sm)",
          transition: "left var(--transition)",
        }}
      />
    </button>
  );
}
