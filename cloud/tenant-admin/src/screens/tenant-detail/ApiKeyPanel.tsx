import { useState } from "react";
import { Button } from "../../components/Button.js";
import { SectionLabel } from "../../components/SectionLabel.js";
import { SettingsCard } from "../../components/SettingsCard.js";

function maskApiKey(key: string): string {
  if (key.length <= 4) return "••••";
  return `${"•".repeat(Math.max(4, key.length - 4))}${key.slice(-4)}`;
}

export function ApiKeyPanel({ apiKey, orderUrl, canWrite, onRotate }: {
  apiKey: string;
  orderUrl: string;
  canWrite: boolean;
  onRotate: () => void;
}) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copia");

  async function handleCopyKey() {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopyLabel("Copiata!");
      setTimeout(() => setCopyLabel("Copia"), 1500);
    } catch { /* clipboard unavailable */ }
  }

  return (
    <SettingsCard title="Ordinazione e integrazione" description="Link del menu self-order e chiave API per la cassa.">
      <div>
        <SectionLabel>Link ordinazione (da stampare sul QR del tavolo)</SectionLabel>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--color-brand)", wordBreak: "break-all" }}>{orderUrl}</div>
      </div>

      <div>
        <SectionLabel>API Key (per il sync menu dalla cassa)</SectionLabel>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <code style={{ flex: 1, minWidth: "160px", padding: "8px 12px", background: "var(--color-gray-50)", border: "1px solid var(--color-gray-200)", borderRadius: "var(--radius-md)", fontSize: "var(--text-xs)", wordBreak: "break-all" }}>
            {showApiKey ? apiKey : maskApiKey(apiKey)}
          </code>
          <Button variant="secondary" onClick={() => setShowApiKey((v) => !v)}>
            {showApiKey ? "Nascondi" : "Mostra"}
          </Button>
          <Button variant="secondary" onClick={() => void handleCopyKey()}>{copyLabel}</Button>
          {canWrite && (
            <Button variant="secondary" onClick={onRotate}>Rigenera</Button>
          )}
        </div>
      </div>
    </SettingsCard>
  );
}
