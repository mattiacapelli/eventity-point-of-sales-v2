import React, { useState } from "react";
import { ShieldCheckIcon, CheckCircleIcon, ExclamationCircleIcon } from "../../components/ui/icons.js";
import { Button } from "../../components/ui/Button.js";
import { inputStyle, labelStyle, PageHeader, FormGrid, SectionHeading } from "./shared.js";

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
    <div style={{ padding: "var(--sp-lg)" }}>
      <PageHeader title="Licenza" subtitle="Stato di attivazione e gestione della chiave di licenza del software." />

      {/* Status summary */}
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px",
          padding: "16px 0", borderBottom: "1px solid var(--color-gray-200)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "40px", height: "40px", borderRadius: "var(--radius-md)",
              background: license.active ? "rgba(23,102,60,0.08)" : "#FEF2F2",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <ShieldCheckIcon style={{ width: "20px", height: "20px", color: license.active ? "var(--color-brand)" : "#DC2626" }} />
          </div>
          <div>
            <div style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--color-gray-800)" }}>
              {license.active ? "Licenza attiva" : "Licenza non attiva"}
            </div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)" }}>Piano {license.plan}</div>
          </div>
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              padding: "4px 12px", borderRadius: "999px",
              background: license.active ? "#dcfce7" : "#FEF2F2",
              color: license.active ? "#15803d" : "#DC2626",
              fontSize: "var(--text-xs)", fontWeight: 700,
            }}
          >
            {license.active ? <CheckCircleIcon style={{ width: "13px", height: "13px" }} /> : <ExclamationCircleIcon style={{ width: "13px", height: "13px" }} />}
            {license.active ? "Attiva" : "Scaduta"}
          </span>
        </div>
      </div>

      <FormGrid>
        <div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", marginBottom: "2px" }}>Attivata il</div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-800)" }}>{license.activatedOn}</div>
        </div>
        <div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", marginBottom: "2px" }}>Scade il</div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-800)" }}>{license.expiresOn}</div>
        </div>
        <div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", marginBottom: "2px" }}>Terminali</div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-800)" }}>
            {license.usedTerminals} / {license.maxTerminals}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", marginBottom: "2px" }}>Chiave</div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-800)", fontFamily: "monospace", letterSpacing: "0.02em" }}>
            {license.licenseKey}
          </div>
        </div>
      </FormGrid>

      <SectionHeading title="Attiva o cambia licenza" subtitle="Inserisci la chiave di licenza ricevuta via email per attivare o rinnovare il software." />

      <FormGrid>
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
      </FormGrid>

      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "var(--sp-xl)" }}>
        <Button size="sm" loading={activating} disabled={!keyInput.trim() || !publicKeyInput.trim()} onClick={() => setActivating(true)}>
          Attiva licenza
        </Button>
      </div>
    </div>
  );
}
