import React, { useEffect, useState } from "react";
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

export function BackupTab() {
  const [backups, setBackups] = useState<BackupMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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
      setDeleteConfirm(null);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--color-gray-800)" }}>Backup & Ripristino</div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)", marginTop: "2px" }}>
            Esporta una copia del database per backup o migrazione.
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
        </div>
      )}

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
                    {deleteConfirm === b.id ? (
                      <>
                        <button
                          onClick={() => void handleDelete(b.id)}
                          style={{
                            padding: "6px 12px", borderRadius: "8px", border: "none",
                            background: "var(--color-danger)", color: "var(--color-white)",
                            fontSize: "var(--text-xs)", fontWeight: 700, fontFamily: "var(--font)",
                            cursor: "pointer", marginRight: "4px",
                          }}
                        >
                          Conferma
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          style={{
                            padding: "6px 12px", borderRadius: "8px", border: "none",
                            background: "var(--color-gray-100)", color: "var(--color-gray-700)",
                            fontSize: "var(--text-xs)", fontWeight: 600, fontFamily: "var(--font)",
                            cursor: "pointer",
                          }}
                        >
                          Annulla
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(b.id)}
                        style={{
                          padding: "6px 12px", borderRadius: "8px", border: "none",
                          background: "rgba(239,68,68,0.08)", color: "var(--color-danger)",
                          fontSize: "var(--text-xs)", fontWeight: 600, fontFamily: "var(--font)",
                          cursor: "pointer",
                        }}
                      >
                        Elimina
                      </button>
                    )}
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
