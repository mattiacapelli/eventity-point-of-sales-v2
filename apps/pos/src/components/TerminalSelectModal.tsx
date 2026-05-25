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
  const { setTerminal } = useTerminalStore();

  useEffect(() => {
    adminApi.terminals.list()
      .then((list) => setTerminals(list.filter((t) => t.active)))
      .catch(() => setTerminals([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleConfirm() {
    if (!selected) return;
    const terminal = terminals.find((t) => t.id === selected);
    if (!terminal) return;
    setSaving(true);
    try {
      await adminApi.terminals.heartbeat(selected);
    } catch {
      // non-blocking
    }
    setTerminal(terminal.id, terminal.name);
    setSaving(false);
    onSelected();
  }

  const now = Date.now();
  const isOnline = (t: Terminal) => t.lastSeenAt !== null && now - t.lastSeenAt < 5 * 60 * 1000;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "var(--color-surface)",
        borderRadius: 12,
        padding: "2rem",
        minWidth: 340,
        maxWidth: 480,
        width: "90vw",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
      }}>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "var(--text-xl)", color: "var(--color-text)" }}>
          Seleziona terminale
        </h2>
        <p style={{ margin: "0 0 1.5rem", color: "var(--color-text-secondary)", fontSize: "var(--text-sm)" }}>
          Scegli la cassa da cui stai operando.
        </p>

        {loading ? (
          <p style={{ color: "var(--color-text-secondary)" }}>Caricamento...</p>
        ) : terminals.length === 0 ? (
          <p style={{ color: "var(--color-text-secondary)" }}>
            Nessun terminale attivo. Creane uno dalla sezione Admin → Terminali.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem" }}>
            {terminals.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.75rem 1rem",
                  borderRadius: 8,
                  border: `2px solid ${selected === t.id ? "var(--color-accent)" : "var(--color-border)"}`,
                  background: selected === t.id ? "var(--color-accent-muted, rgba(var(--accent-rgb),0.1))" : "var(--color-surface-raised)",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--color-text)", fontSize: "var(--text-md)" }}>
                  {t.name}
                </span>
                <span style={{
                  fontSize: "var(--text-xs)",
                  color: isOnline(t) ? "#22c55e" : "var(--color-text-secondary)",
                  fontWeight: 500,
                }}>
                  {isOnline(t) ? "● online" : "○ offline"}
                </span>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={!selected || saving}
          style={{
            width: "100%",
            padding: "0.75rem",
            borderRadius: 8,
            border: "none",
            background: selected ? "var(--color-accent)" : "var(--color-border)",
            color: selected ? "#fff" : "var(--color-text-secondary)",
            fontWeight: 700,
            fontSize: "var(--text-md)",
            cursor: selected ? "pointer" : "not-allowed",
          }}
        >
          {saving ? "Salvataggio..." : "Usa questo terminale"}
        </button>
      </div>
    </div>
  );
}
