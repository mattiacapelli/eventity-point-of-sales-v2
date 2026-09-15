import { useEffect, useRef, useState } from "react";
import { adminApi, type BackupMeta } from "../../core/admin-api.js";
import { AdminTablePage } from "./shared.js";
import { Modal } from "../../components/ui/Modal.js";
import { Button } from "../../components/ui/Button.js";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
}

// Poll /api/health until the server responds, then reload the page
function waitForServerAndReload() {
  const poll = () => {
    fetch("/api/health")
      .then((r) => { if (r.ok) window.location.reload(); else setTimeout(poll, 2000); })
      .catch(() => setTimeout(poll, 2000));
  };
  // Give the server a moment to begin shutdown before polling
  setTimeout(poll, 3000);
}

type ConfirmAction =
  | { type: "restore"; backup: BackupMeta }
  | { type: "delete"; backup: BackupMeta }
  | { type: "upload"; file: File };

export function BackupTab() {
  const [backups, setBackups] = useState<BackupMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const list = await adminApi.backups.list();
      setBackups(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento backup");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadBackups(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const meta = await adminApi.backups.create();
      setBackups((prev) => [meta, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore creazione backup");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await adminApi.backups.delete(id);
      setBackups((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore eliminazione backup");
    } finally {
      setConfirm(null);
    }
  };

  const handleRestore = async (backup: BackupMeta) => {
    setConfirm(null);
    setRestoring(true);
    try {
      await adminApi.backups.restore(backup.id);
      waitForServerAndReload();
    } catch (err) {
      setRestoring(false);
      setError(err instanceof Error ? err.message : "Errore durante il ripristino");
    }
  };

  const handleUploadRestore = async (file: File) => {
    setConfirm(null);
    setRestoring(true);
    try {
      await adminApi.backups.restoreUpload(file);
      waitForServerAndReload();
    } catch (err) {
      setRestoring(false);
      setError(err instanceof Error ? err.message : "Errore durante l'importazione");
    }
  };

  const handleFileSelected = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.endsWith(".db")) {
      setError("Il file deve avere estensione .db");
      return;
    }
    setConfirm({ type: "upload", file });
  };

  const handleConfirm = () => {
    if (!confirm) return;
    if (confirm.type === "restore") void handleRestore(confirm.backup);
    else if (confirm.type === "delete") void handleDelete(confirm.backup.id);
    else if (confirm.type === "upload") void handleUploadRestore(confirm.file);
  };

  if (restoring) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        minHeight: "400px", gap: "24px",
      }}>
        <div style={{
          width: "48px", height: "48px", borderRadius: "50%",
          border: "4px solid var(--color-gray-200)",
          borderTopColor: "var(--color-brand)",
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--color-gray-800)", marginBottom: "8px" }}>
            Ripristino in corso…
          </div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)" }}>
            Il server si sta riavviando. La pagina si aggiornerà automaticamente.
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div style={{
          background: "rgba(239,68,68,0.08)", color: "var(--color-danger)",
          borderRadius: "10px", padding: "12px 14px",
          fontSize: "var(--text-sm)", fontWeight: 500, margin: "var(--sp-lg) var(--sp-lg) 0",
        }}>
          {error}
          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: "12px", background: "none", border: "none",
              color: "var(--color-danger)", cursor: "pointer", fontWeight: 700,
              fontFamily: "var(--font)", fontSize: "var(--text-sm)",
            }}
          >
            ×
          </button>
        </div>
      )}

      <AdminTablePage
        title="Backup"
        subtitle="Crea, esporta e ripristina il database."
        belowHeader={
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFileSelected(e.dataTransfer.files[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? "var(--color-brand)" : "var(--color-gray-200)"}`,
              borderRadius: "12px",
              padding: "28px",
              textAlign: "center",
              cursor: "pointer",
              background: dragOver ? "rgba(var(--color-brand-rgb, 99,102,241),0.04)" : "var(--color-gray-50)",
              transition: "border-color 0.15s, background 0.15s",
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".db"
              style={{ display: "none" }}
              onChange={(e) => handleFileSelected(e.target.files?.[0])}
            />
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-600)", marginBottom: "4px" }}>
              Importa backup da file
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>
              Trascina un file .db qui oppure clicca per selezionarlo
            </div>
          </div>
        }
        rows={backups}
        rowKey={(b) => b.id}
        loading={loading}
        emptyMessage="Nessun backup disponibile. Crea il primo backup cliccando il pulsante sopra."
        columns={[
          {
            key: "file",
            header: "File",
            render: (b) => <span style={{ fontFamily: "monospace", fontSize: "var(--text-xs)", color: "var(--color-gray-600)" }}>{b.filename}</span>,
          },
          { key: "date", header: "Data", render: (b) => formatDate(b.createdAt) },
          { key: "size", header: "Dimensione", render: (b) => formatBytes(b.size) },
          {
            key: "sha256",
            header: "SHA256",
            render: (b) => (
              <span style={{ fontFamily: "monospace", fontSize: "var(--text-xs)", color: "var(--color-gray-500)", letterSpacing: "0.02em" }}>
                {b.sha256.slice(0, 16)}…
              </span>
            ),
          },
        ]}
        rowActions={(b) => (
          <div style={{ display: "flex", justifyContent: "flex-end", whiteSpace: "nowrap" }}>
            <a
              href={adminApi.backups.downloadUrl(b.id)}
              download={b.filename}
              style={{
                display: "inline-flex", alignItems: "center",
                padding: "6px 12px", borderRadius: "8px",
                background: "var(--color-gray-100)", color: "var(--color-gray-700)",
                fontSize: "var(--text-xs)", fontWeight: 600,
                textDecoration: "none", marginRight: "6px",
              }}
            >
              Scarica
            </a>
            <button
              onClick={() => setConfirm({ type: "restore", backup: b })}
              style={{
                padding: "6px 12px", borderRadius: "8px", border: "none",
                background: "rgba(99,102,241,0.10)", color: "var(--color-brand)",
                fontSize: "var(--text-xs)", fontWeight: 600, fontFamily: "var(--font)",
                cursor: "pointer", marginRight: "6px",
              }}
            >
              Ripristina
            </button>
            <button
              onClick={() => setConfirm({ type: "delete", backup: b })}
              style={{
                padding: "6px 12px", borderRadius: "8px", border: "none",
                background: "rgba(239,68,68,0.08)", color: "var(--color-danger)",
                fontSize: "var(--text-xs)", fontWeight: 600, fontFamily: "var(--font)",
                cursor: "pointer",
              }}
            >
              Elimina
            </button>
          </div>
        )}
        extraHeaderActions={
          <Button size="sm" loading={creating} onClick={() => void handleCreate()}>
            Crea backup
          </Button>
        }
      />

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.type === "delete" ? "Elimina backup" : "Ripristina database"}
      >
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-600)", lineHeight: 1.6, marginBottom: "20px" }}>
          {confirm?.type === "delete" && (
            <>Stai per eliminare <strong>{confirm.backup.filename}</strong>. L'operazione è irreversibile.</>
          )}
          {confirm?.type === "restore" && (
            <>Stai per ripristinare il database da <strong>{confirm.backup.filename}</strong>.
            {" "}Tutti i dati correnti verranno sostituiti. Il server si riavvierà automaticamente.</>
          )}
          {confirm?.type === "upload" && (
            <>Stai per importare e ripristinare il file <strong>{confirm.file.name}</strong> ({formatBytes(confirm.file.size)}).
            {" "}Tutti i dati correnti verranno sostituiti. Il server si riavvierà automaticamente.</>
          )}
        </p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>Annulla</Button>
          <Button variant={confirm?.type === "delete" ? "danger" : "primary"} size="sm" onClick={handleConfirm}>
            {confirm?.type === "delete" ? "Elimina" : "Ripristina"}
          </Button>
        </div>
      </Modal>
    </>
  );
}