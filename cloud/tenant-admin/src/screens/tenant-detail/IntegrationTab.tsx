import { useState } from "react";
import type { Tenant } from "../../core/types.js";
import { rotateTenantKey } from "../../core/api-client.js";
import { ConfirmDialog } from "../../components/ConfirmDialog.js";
import { useToast } from "../../components/Toast.js";
import { ApiKeyPanel } from "./ApiKeyPanel.js";

export function IntegrationTab({ tenant, canWrite, onUpdated }: {
  tenant: Tenant;
  canWrite: boolean;
  onUpdated: (t: Tenant) => void;
}) {
  const { showToast } = useToast();
  const [confirmRotate, setConfirmRotate] = useState(false);

  async function handleRotateKey() {
    const { apiKey } = await rotateTenantKey(tenant.id);
    onUpdated({ ...tenant, apiKey });
    showToast("Chiave API rigenerata");
    setConfirmRotate(false);
  }

  const orderUrl = `${window.location.origin.replace(/:\d+$/, ":5174")}/?t=${tenant.slug}`;

  return (
    <>
      <ApiKeyPanel
        apiKey={tenant.apiKey}
        orderUrl={orderUrl}
        canWrite={canWrite}
        onRotate={() => setConfirmRotate(true)}
      />

      {confirmRotate && (
        <ConfirmDialog
          title="Rigenera API key"
          description="La chiave attuale smetterà di funzionare immediatamente: la cassa dovrà essere riconfigurata con la nuova chiave."
          confirmLabel="Rigenera"
          onConfirm={handleRotateKey}
          onCancel={() => setConfirmRotate(false)}
        />
      )}
    </>
  );
}
