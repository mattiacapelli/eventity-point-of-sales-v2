import { useState } from "react";
import type { Tenant } from "../../core/types.js";
import { updateTenant } from "../../core/api-client.js";
import { Button } from "../../components/Button.js";
import { Badge } from "../../components/Badge.js";
import { ConfirmDialog } from "../../components/ConfirmDialog.js";
import { useToast } from "../../components/Toast.js";

export function TenantStatusToggle({ tenant, canWrite, onUpdated }: {
  tenant: Tenant;
  canWrite: boolean;
  onUpdated: (t: Tenant) => void;
}) {
  const { showToast } = useToast();
  const [toggling, setToggling] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);

  async function handleToggleActive() {
    setToggling(true);
    try {
      const updated = await updateTenant(tenant.id, { active: !tenant.active });
      onUpdated(updated);
      showToast(updated.active ? "Tenant attivato" : "Tenant disattivato");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Operazione non riuscita", "error");
    } finally {
      setToggling(false);
      setConfirmToggle(false);
    }
  }

  return (
    <>
      <Badge tone={tenant.active ? "success" : "danger"}>{tenant.active ? "Attivo" : "Disattivato"}</Badge>
      {canWrite && (
        <Button variant="secondary" onClick={() => setConfirmToggle(true)} disabled={toggling}>
          {tenant.active ? "Disattiva" : "Attiva"}
        </Button>
      )}

      {confirmToggle && (
        <ConfirmDialog
          title={tenant.active ? "Disattiva tenant" : "Attiva tenant"}
          description={tenant.active
            ? "Il tenant disattivato non potrà più sincronizzare il menu né ricevere ordini."
            : "Il tenant tornerà operativo e potrà sincronizzare il menu e ricevere ordini."}
          confirmLabel={tenant.active ? "Disattiva" : "Attiva"}
          danger={tenant.active}
          onConfirm={handleToggleActive}
          onCancel={() => setConfirmToggle(false)}
        />
      )}
    </>
  );
}
