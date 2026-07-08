import React, { useState } from "react";
import { ShieldCheckIcon, CheckCircleIcon, ExclamationCircleIcon } from "../../components/ui/icons.js";
import { Button } from "../../components/ui/Button.js";
import { inputStyle, labelStyle } from "./shared.js";

// Placeholder UI only — no real activation logic wired up yet.
const MOCK_LICENSE = {
  active: true,
  plan: "Pro",
  licenseKey: "EPOS-XXXX-XXXX-XXXX-XXXX",
  activatedOn: "12/01/2026",
  expiresOn: "12/01/2027",
  maxTerminals: 3,
  usedTerminals: 2,
};

export function LicenseTab() {
  const [keyInput, setKeyInput] = useState("");
  const [publicKeyInput, setPublicKeyInput] = useState("");
  const [activating, setActivating] = useState(false);

  const license = MOCK_LICENSE;

  async function handlePublicKeyFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setPublicKeyInput(text.trim());
    e.target.value = "";
  }

  return (
    <div style={{ padding: "var(--sp-lg)", maxWidth: "640px" }}>
      <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-800)", marginTop: 0, marginBottom: "6px" }}>
        Licenza
      </h2>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-400)", marginTop: 0, marginBottom: "var(--sp-lg)" }}>
        Stato di attivazione e gestione della chiave di licenza del software.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Status card */}
        <div
          style={{
            background: license.active
              ? "linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-dark) 100%)"
              : "var(--color-white)",
            borderRadius: "var(--radius-xl)",
            padding: "28px",
            boxShadow: "var(--shadow-sm)",
            border: license.active ? "none" : "1.5px solid #FECACA",
            color: license.active ? "var(--color-white)" : "var(--color-gray-800)",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "var(--radius-md)",
                  background: license.active ? "rgba(255,255,255,0.15)" : "#FEF2F2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <ShieldCheckIcon style={{ width: "24px", height: "24px", color: license.active ? "var(--color-white)" : "#DC2626" }} />
              </div>
              <div>
                <div style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>
                  {license.active ? "Licenza attiva" : "Licenza non attiva"}
                </div>
                <div style={{ fontSize: "var(--text-sm)", opacity: 0.85 }}>
                  Piano {license.plan}
                </div>
              </div>
            </div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                borderRadius: "999px",
                background: license.active ? "rgba(255,255,255,0.15)" : "#FEF2F2",
                color: license.active ? "var(--color-white)" : "#DC2626",
                fontSize: "var(--text-xs)",
                fontWeight: 700,
              }}
            >
              {license.active ? <CheckCircleIcon style={{ width: "14px", height: "14px" }} /> : <ExclamationCircleIcon style={{ width: "14px", height: "14px" }} />}
              {license.active ? "Attiva" : "Scaduta"}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "16px",
              paddingTop: "16px",
              borderTop: license.active ? "1px solid rgba(255,255,255,0.2)" : "1px solid var(--color-gray-100)",
            }}
          >
            <div>
              <div style={{ fontSize: "var(--text-xs)", opacity: 0.75, marginBottom: "2px" }}>Attivata il</div>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{license.activatedOn}</div>
            </div>
            <div>
              <div style={{ fontSize: "var(--text-xs)", opacity: 0.75, marginBottom: "2px" }}>Scade il</div>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{license.expiresOn}</div>
            </div>
            <div>
              <div style={{ fontSize: "var(--text-xs)", opacity: 0.75, marginBottom: "2px" }}>Terminali</div>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>
                {license.usedTerminals} / {license.maxTerminals}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "var(--text-xs)", opacity: 0.75, marginBottom: "2px" }}>Chiave</div>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, fontFamily: "monospace", letterSpacing: "0.02em" }}>
                {license.licenseKey}
              </div>
            </div>
          </div>
        </div>

        {/* Activation card */}
        <div style={{ background: "var(--color-white)", borderRadius: "var(--radius-xl)", padding: "28px", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--color-gray-700)", marginBottom: "4px" }}>
              Attiva o cambia licenza
            </div>
            <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>
              Inserisci la chiave di licenza ricevuta via email per attivare o rinnovare il software.
            </p>
          </div>

          <div>
            <label style={labelStyle}>Chiave di licenza</label>
            <input
              style={{ ...inputStyle, fontFamily: "monospace" }}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="EPOS-XXXX-XXXX-XXXX-XXXX"
            />
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Public key</label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 12px", borderRadius: "var(--radius-md)", border: "1.5px solid var(--color-gray-200)", background: "var(--color-white)", cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-gray-700)" }}>
                Carica da file
                <input type="file" accept=".pem,.pub,.key,text/plain" style={{ display: "none" }} onChange={(e) => void handlePublicKeyFile(e)} />
              </label>
            </div>
            <textarea
              style={{ ...inputStyle, height: "120px", padding: "12px 14px", fontFamily: "monospace", fontSize: "var(--text-xs)", lineHeight: 1.5, resize: "vertical" }}
              value={publicKeyInput}
              onChange={(e) => setPublicKeyInput(e.target.value)}
              placeholder={"-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Button size="sm" loading={activating} disabled={!keyInput.trim() || !publicKeyInput.trim()} onClick={() => setActivating(true)}>
              Attiva licenza
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
