import React, { useEffect, useRef, useState } from "react";
import { adminApi, type BackupMeta } from "../../core/admin-api.js";

const cellStyle: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: "var(--text-sm)",
  color: "var(--color-gray-700)",
  borderBottom: "1px solid var(--color-gray-100)",
  verticalAlign: "middle",
};

const headerStyle: React.CSSProperties = {
  padding: "10px 16px",
  textAlign: "left",
  fontSize: "var(--text-xs)",
  fontWeight: 700,
  color: "var(--color-gray-500)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  borderBottom: "1px solid var(--color-gray-200)",
  background: "var(--color-gray-50)",
};

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
    <div>
      {/* Confirm dialog overlay */}
      {confirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "var(--color-white)", borderRadius: "16px",
            padding: "28px", maxWidth: "420px", width: "90%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--color-gray-800)", marginBottom: "8px" }}>
              {confirm.type === "delete" ? "Elimina backup" : "Ripristina database"}
            </div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-600)", lineHeight: 1.6, marginBottom: "24px" }}>
              {confirm.type === "delete" && (
                <>Stai per eliminare <strong>{confirm.backup.filename}</strong>. L'operazione è irreversibile.</>
              )}
              {confirm.type === "restore" && (
                <>Stai per ripristinare il database da <strong>{confirm.backup.filename}</strong>.
                {" "}Tutti i dati correnti verranno sostituiti. Il server si riavvierà automaticamente.</>
              )}
              {confirm.type === "upload" && (
                <>Stai per importare e ripristinare il file <strong>{confirm.file.name}</strong> ({formatBytes(confirm.file.size)}).
                {" "}Tutti i dati correnti verranno sostituiti. Il server si riavvierà automaticamente.</>
              )}
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setConfirm(null)}
                style={{
                  padding: "10px 18px", borderRadius: "10px", border: "none",
                  background: "var(--color-gray-100)", color: "var(--color-gray-700)",
                  fontSize: "var(--text-sm)", fontWeight: 600, fontFamily: "var(--font)",
                  cursor: "pointer",
                }}
              >
                Annulla
              </button>
              <button
                onClick={handleConfirm}
                style={{
                  padding: "10px 18px", borderRadius: "10px", border: "none",
                  background: confirm.type === "delete" ? "var(--color-danger)" : "var(--color-brand)",
                  color: "var(--color-white)",
                  fontSize: "var(--text-sm)", fontWeight: 700, fontFamily: "var(--font)",
                  cursor: "pointer",
                }}
              >
                {confirm.type === "delete" ? "Elimina" : "Ripristina"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--color-gray-800)" }}>Backup & Ripristino</div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)", marginTop: "2px" }}>
            Crea, esporta e ripristina il database.
          </div>
        </div>
        <button
          onClick={() => void handleCreate()}
          disabled={creating}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "10px 18px", borderRadius: "10px", border: "none",
            background: creating ? "var(--color-gray-200)" : "var(--color-brand)",
            color: creating ? "var(--color-gray-400)" : "var(--color-white)",
            fontSize: "var(--text-sm)", fontWeight: 700, fontFamily: "var(--font)",
            cursor: creating ? "not-allowed" : "pointer",
          }}
        >
          {creating ? "Creazione…" : "+ Crea backup"}
        </button>
      </div>

      {error && (
        <div style={{
          background: "rgba(239,68,68,0.08)", color: "var(--color-danger)",
          borderRadius: "10px", padding: "12px 14px",
          fontSize: "var(--text-sm)", fontWeight: 500, marginBottom: "16px",
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

      {/* Import from file */}
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
          marginBottom: "24px",
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

      {/* Backup list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "48px", color: "var(--color-gray-400)", fontSize: "var(--text-sm)" }}>
          Caricamento…
        </div>
      ) : backups.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "64px 24px",
          color: "var(--color-gray-400)", fontSize: "var(--text-sm)",
          background: "var(--color-gray-50)", borderRadius: "12px",
        }}>
          Nessun backup disponibile. Crea il primo backup cliccando il pulsante sopra.
        </div>
      ) : (
        <div style={{ borderRadius: "12px", border: "1px solid var(--color-gray-200)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={headerStyle}>File</th>
                <th style={headerStyle}>Data</th>
                <th style={headerStyle}>Dimensione</th>
                <th style={headerStyle}>SHA256</th>
                <th style={headerStyle} />
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.id}>
                  <td style={cellStyle}>
                    <span style={{ fontFamily: "monospace", fontSize: "var(--text-xs)", color: "var(--color-gray-600)" }}>
                      {b.filename}
                    </span>
                  </td>
                  <td style={cellStyle}>{formatDate(b.createdAt)}</td>
                  <td style={cellStyle}>{formatBytes(b.size)}</td>
                  <td style={cellStyle}>
                    <span style={{
                      fontFamily: "monospace", fontSize: "var(--text-xs)",
                      color: "var(--color-gray-500)", letterSpacing: "0.02em",
                    }}>
                      {b.sha256.slice(0, 16)}…
                    </span>
                  </td>
                  <td style={{ ...cellStyle, textAlign: "right", whiteSpace: "nowrap" }}>
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}