import { useRef, useState } from "react";
import type { Tenant } from "../../core/types.js";
import { uploadTenantLogo, deleteTenantLogo, updateTenantBranding, updateTenantSettings, API_BASE } from "../../core/api-client.js";
import { Button } from "../../components/Button.js";
import { SettingsCard } from "../../components/SettingsCard.js";
import { useToast } from "../../components/Toast.js";

export function BrandingPanel({ tenant, onUpdated }: {
  tenant: Tenant;
  onUpdated: (t: Tenant) => void;
}) {
  const { showToast } = useToast();
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);
  const [colorBrand, setColorBrand] = useState(tenant.colorBrand ?? "#17663C");
  const [colorAccent, setColorAccent] = useState(tenant.colorAccent ?? "#17663C");
  const [savingBranding, setSavingBranding] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const logoUrl = tenant.logoPath ? `${API_BASE}/api/static/${tenant.logoPath}` : null;

  async function handleLogoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return;
    setUploadingLogo(true);
    try {
      const { logoPath } = await uploadTenantLogo(tenant.id, file);
      onUpdated({ ...tenant, logoPath });
      showToast("Logo caricato");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossibile caricare il logo", "error");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleRemoveLogo() {
    setRemovingLogo(true);
    try {
      await deleteTenantLogo(tenant.id);
      onUpdated({ ...tenant, logoPath: null });
      showToast("Logo rimosso");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossibile rimuovere il logo", "error");
    } finally {
      setRemovingLogo(false);
    }
  }

  async function handleSaveBranding() {
    setSavingBranding(true);
    try {
      const updated = await updateTenantBranding(tenant.id, { colorBrand, colorAccent });
      onUpdated({ ...tenant, colorBrand: updated.colorBrand, colorAccent: updated.colorAccent });
      showToast("Colori aggiornati");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossibile aggiornare i colori", "error");
    } finally {
      setSavingBranding(false);
    }
  }

  async function handleToggleSetting(key: "requireTableId" | "requireCustomerName") {
    setSavingSettings(true);
    try {
      const updated = await updateTenantSettings(tenant.id, { [key]: !tenant[key] });
      onUpdated({ ...tenant, ...updated });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossibile aggiornare le impostazioni", "error");
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <>
      <SettingsCard title="Aspetto del menu self-order" description="Logo e colori mostrati ai clienti quando ordinano dal tavolo.">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-md)", flexWrap: "wrap" }}>
          <div
            style={{
              width: "56px", height: "56px", borderRadius: "50%",
              background: logoUrl ? "var(--color-white)" : "var(--color-gray-100)",
              border: "1px solid var(--color-gray-200)",
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden", flexShrink: 0,
            }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>Logo</span>
            )}
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => void handleLogoSelected(e)}
            style={{ display: "none" }}
          />
          <Button variant="secondary" onClick={() => logoInputRef.current?.click()} loading={uploadingLogo}>
            {logoUrl ? "Cambia logo" : "Carica logo"}
          </Button>
          {logoUrl && (
            <Button variant="ghost" onClick={() => void handleRemoveLogo()} loading={removingLogo}>
              Rimuovi
            </Button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-lg)", flexWrap: "wrap", paddingTop: "var(--sp-sm)", borderTop: "1px solid var(--color-gray-100)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "var(--text-sm)", fontWeight: 600 }}>
            Colore principale
            <input type="color" value={colorBrand} onChange={(e) => setColorBrand(e.target.value)} style={{ width: "36px", height: "28px", padding: 0, border: "1px solid var(--color-gray-200)", borderRadius: "var(--radius-sm)" }} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "var(--text-sm)", fontWeight: 600 }}>
            Colore accento
            <input type="color" value={colorAccent} onChange={(e) => setColorAccent(e.target.value)} style={{ width: "36px", height: "28px", padding: 0, border: "1px solid var(--color-gray-200)", borderRadius: "var(--radius-sm)" }} />
          </label>
          <Button variant="secondary" onClick={() => void handleSaveBranding()} loading={savingBranding}>
            Salva colori
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard title="Opzioni ordine" description="Cosa deve indicare il cliente per completare un ordine.">
        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "var(--text-sm)", fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={tenant.requireTableId}
            disabled={savingSettings}
            onChange={() => void handleToggleSetting("requireTableId")}
          />
          Tavolo obbligatorio
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "var(--text-sm)", fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={tenant.requireCustomerName}
            disabled={savingSettings}
            onChange={() => void handleToggleSetting("requireCustomerName")}
          />
          Nome cliente obbligatorio
        </label>
      </SettingsCard>
    </>
  );
}
