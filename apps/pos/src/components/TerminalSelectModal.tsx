import React, { useEffect, useState } from "react";
import type { Terminal } from "@pos/shared-types";
import { adminApi } from "../core/admin-api.js";
import { useTerminalStore } from "../state/terminal-store.js";

interface Props {
  onSelected: () => void;
}

export function TerminalSelectModal({ onSelected }: Props) {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const { setTerminal, clearTerminal } = useTerminalStore();

  useEffect(() => {
    adminApi.terminals.list()
      .then((list) => {
        const active = list.filter((t) => t.active);
        setTerminals(active);
        // If only one terminal exists, pre-select it
        if (active.length === 1) setSelected(active[0]!.id);
      })
      .catch(() => setTerminals([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleConfirm() {
    if (!selected) return;
    const terminal = terminals.find((t) => t.id === selected);
    if (!terminal) return;
    setSaving(true);
    try { await adminApi.terminals.heartbeat(selected); } catch { /* non-blocking */ }
    setTerminal(terminal.id, terminal.name);
    setSaving(false);
    onSelected();
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const terminal = await adminApi.terminals.create({ name });
      setTerminals((prev) => [...prev, terminal]);
      setSelected(terminal.id);
      setShowCreate(false);
      setNewName("");
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  }

  function handleSkip() {
    // Disable multi-terminal and proceed without selecting a terminal
    adminApi.settings.update({ multiTerminalEnabled: false }).catch(() => {});
    clearTerminal();
    onSelected();
  }

  const now = Date.now();
  const isOnline = (t: Terminal) => t.lastSeenAt !== null && now - t.lastSeenAt < 5 * 60 * 1000;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "var(--color-white)",
        borderRadius: "var(--radius-xl)",
        padding: "28px 28px 24px",
        width: "min(420px, 90vw)",
        boxShadow: "0 16px 48px rgba(0,0,0,0.22)",
      }}>
        {/* Header */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "var(--text-xl)", fontWeight: 800, color: "var(--color-gray-900)", marginBottom: "4px" }}>
            Seleziona terminale
          </div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)" }}>
            Scegli la cassa da cui stai operando.
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ color: "var(--color-gray-400)", fontSize: "var(--text-sm)", padding: "12px 0" }}>
            Caricamento...
          </div>
        ) : terminals.length === 0 && !showCreate ? (
          <div style={{
            background: "#fef9ec",
            border: "1px solid #fde68a",
            borderRadius: "var(--radius-md)",
            padding: "14px",
            fontSize: "var(--text-sm)",
            color: "#92400e",
            marginBottom: "16px",
            lineHeight: 1.5,
          }}>
            Nessun terminale configurato. Creane uno adesso oppure disabilita il multi-terminale per continuare.
          </div>
        ) : !showCreate ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
            {terminals.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 14px",
                  borderRadius: "var(--radius-md)",
                  border: `2px solid ${selected === t.id ? "var(--color-brand)" : "var(--color-gray-200)"}`,
                  background: selected === t.id ? "rgba(48,107,52,0.06)" : "var(--color-white)",
                  cursor: "pointer", textAlign: "left", width: "100%",
                  transition: "border-color 0.15s",
                }}
              >
                <span style={{ fontWeight: 700, color: "var(--color-gray-900)", fontSize: "var(--text-sm)" }}>
                  {t.name}
                </span>
                <span style={{ fontSize: "11px", color: isOnline(t) ? "#22c55e" : "var(--color-gray-400)", fontWeight: 600 }}>
                  {isOnline(t) ? "● online" : "○ offline"}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {/* Inline create form */}
        {showCreate && (
          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-700)", marginBottom: "8px" }}>
              Nome del terminale
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                autoFocus
                type="text"
                placeholder="Es. Cassa 1"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
                style={{
                  flex: 1, height: "40px", padding: "0 12px",
                  border: "1.5px solid var(--color-gray-200)",
                  borderRadius: "var(--radius-md)",
                  fontFamily: "var(--font)", fontSize: "var(--text-sm)",
                  outline: "none",
                }}
              />
              <button
                onClick={() => void handleCreate()}
                disabled={!newName.trim() || creating}
                style={{
                  padding: "0 16px", height: "40px",
                  borderRadius: "var(--radius-md)", border: "none",
                  background: newName.trim() ? "var(--color-brand)" : "var(--color-gray-200)",
                  color: newName.trim() ? "white" : "var(--color-gray-400)",
                  fontFamily: "var(--font)", fontWeight: 700, fontSize: "var(--text-sm)",
                  cursor: newName.trim() ? "pointer" : "not-allowed",
                  whiteSpace: "nowrap",
                }}
              >
                {creating ? "..." : "Crea"}
              </button>
              <button
                onClick={() => { setShowCreate(false); setNewName(""); }}
                style={{
                  padding: "0 12px", height: "40px",
                  borderRadius: "var(--radius-md)",
                  border: "1.5px solid var(--color-gray-200)",
                  background: "white", color: "var(--color-gray-500)",
                  fontFamily: "var(--font)", fontWeight: 600, fontSize: "var(--text-sm)",
                  cursor: "pointer",
                }}
              >
                Annulla
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {!showCreate && (
            <button
              onClick={() => void handleConfirm()}
              disabled={!selected || saving}
              style={{
                width: "100%", padding: "12px",
                borderRadius: "var(--radius-md)", border: "none",
                background: selected ? "var(--color-brand)" : "var(--color-gray-200)",
                color: selected ? "white" : "var(--color-gray-400)",
                fontFamily: "var(--font)", fontWeight: 700, fontSize: "var(--text-md)",
                cursor: selected ? "pointer" : "not-allowed",
              }}
            >
              {saving ? "Salvataggio..." : "Usa questo terminale"}
            </button>
          )}

          {!showCreate && (
            <button
              onClick={() => setShowCreate(true)}
              style={{
                width: "100%", padding: "10px",
                borderRadius: "var(--radius-md)",
                border: "1.5px solid var(--color-gray-200)",
                background: "white", color: "var(--color-gray-600)",
                fontFamily: "var(--font)", fontWeight: 600, fontSize: "var(--text-sm)",
                cursor: "pointer",
              }}
            >
              + Crea nuovo terminale
            </button>
          )}

          <button
            onClick={handleSkip}
            style={{
              width: "100%", padding: "8px",
              borderRadius: "var(--radius-md)",
              border: "none", background: "none",
              color: "var(--color-gray-400)",
              fontFamily: "var(--font)", fontWeight: 500, fontSize: "var(--text-xs)",
              cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "2px",
            }}
          >
            Disabilita multi-terminale e continua
          </button>
        </div>
      </div>
    </div>
  );
}
