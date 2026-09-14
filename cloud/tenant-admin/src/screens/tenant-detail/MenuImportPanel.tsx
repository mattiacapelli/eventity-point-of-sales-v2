import { useRef, useState } from "react";
import { importMenu } from "../../core/api-client.js";
import { Button } from "../../components/Button.js";
import { SettingsCard } from "../../components/SettingsCard.js";
import { ConfirmDialog } from "../../components/ConfirmDialog.js";
import { useToast } from "../../components/Toast.js";

export function MenuImportPanel({ tenantId, onImported }: {
  tenantId: string;
  onImported: () => void;
}) {
  const { showToast } = useToast();
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPendingImportFile(file);
    if (file) setConfirmImport(true);
    e.target.value = "";
  }

  async function handleConfirmImport() {
    if (!pendingImportFile) return;
    let payload: unknown;
    try {
      payload = JSON.parse(await pendingImportFile.text());
    } catch {
      throw new Error("Il file selezionato non è un JSON valido");
    }
    const result = await importMenu(tenantId, payload);
    setConfirmImport(false);
    setPendingImportFile(null);
    onImported();
    showToast(`Menu importato: ${result.categories} categorie, ${result.products} prodotti, ${result.optionGroups} gruppi opzione`);
  }

  return (
    <SettingsCard title="Importa menu da file" description="Carica il file JSON esportato dalla cassa (tab Catalogo → Cloud). Sostituisce l'intero catalogo attuale.">
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileSelected}
          style={{ display: "none" }}
        />
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
          Scegli file e importa
        </Button>
      </div>

      {confirmImport && pendingImportFile && (
        <ConfirmDialog
          title="Importa menu"
          description={`Questa operazione sostituirà l'intero catalogo attuale del tenant con il contenuto di "${pendingImportFile.name}". L'operazione non è reversibile. Continuare?`}
          confirmLabel="Importa"
          onConfirm={handleConfirmImport}
          onCancel={() => { setConfirmImport(false); setPendingImportFile(null); }}
        />
      )}
    </SettingsCard>
  );
}
