import { useState } from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Modal } from "./Modal.js";
import { Button } from "./Button.js";

export function ConfirmDialog({ title, description, confirmLabel = "Conferma", danger = true, onConfirm, onCancel }: {
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operazione non riuscita");
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onCancel}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {danger && (
          <div style={{ flexShrink: 0, width: "36px", height: "36px", borderRadius: "50%", background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ExclamationTriangleIcon width={20} height={20} color="var(--color-danger)" />
          </div>
        )}
        <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--color-gray-900)" }}>{title}</div>
      </div>
      <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-600)" }}>{description}</div>
      {error && <div style={{ color: "var(--color-danger)", fontSize: "var(--text-sm)", fontWeight: 600 }}>{error}</div>}
      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
        <Button variant="secondary" onClick={onCancel} disabled={loading}>Annulla</Button>
        <Button variant={danger ? "danger" : "primary"} onClick={() => void handleConfirm()} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
