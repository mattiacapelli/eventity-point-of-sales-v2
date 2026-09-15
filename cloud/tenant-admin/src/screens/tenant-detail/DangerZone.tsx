import { useState } from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { deleteTenant } from "../../core/api-client.js";
import { Button } from "../../components/Button.js";
import { ConfirmDialog } from "../../components/ConfirmDialog.js";
import { useToast } from "../../components/Toast.js";

export function DangerZone({ tenantId, tenantName, onDeleted }: {
  tenantId: string;
  tenantName: string;
  onDeleted: (id: string) => void;
}) {
  const { showToast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleDelete() {
    await deleteTenant(tenantId);
    onDeleted(tenantId);
    showToast("Evento eliminato");
  }

  return (
    <div
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sp-md)",
        marginTop: "var(--sp-sm)", padding: "var(--sp-md)",
        border: "1px solid var(--color-danger-border)", borderRadius: "var(--radius-lg)",
        background: "var(--color-danger-wash)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <ExclamationTriangleIcon width={20} height={20} color="var(--color-danger)" style={{ flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-gray-800)" }}>Zona pericolosa</div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-500)" }}>L'eliminazione dell'evento non è reversibile.</div>
        </div>
      </div>
      <Button variant="danger" onClick={() => setConfirmDelete(true)}>Elimina evento</Button>

      {confirmDelete && (
        <ConfirmDialog
          title="Elimina evento"
          description={`Confermi l'eliminazione definitiva di "${tenantName}"? L'operazione non è reversibile.`}
          confirmLabel="Elimina"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
