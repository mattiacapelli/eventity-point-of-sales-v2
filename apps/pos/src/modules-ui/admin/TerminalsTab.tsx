import React, { useEffect, useState } from "react";
import { adminApi } from "../../core/admin-api.js";
import { useAdminStore } from "../../state/admin-store.js";
import { useToastStore } from "../../components/ui/Toast.js";
import { Button } from "../../components/ui/Button.js";
import type { Terminal, Printer, Category } from "@pos/shared-types";
import { PlusIcon, TrashIcon } from "../../components/ui/icons.js";
import { inputStyle } from "./shared.js";
import { wsClient } from "../../core/ws-client.js";

const VIEW_MODE_LABELS: Record<string, string> = {
  "": "Nessuna preferenza",
  category: "Per categoria",
  all: "Tutti i prodotti",
  grouped_category: "Raggruppa per categoria",
  grouped_center: "Raggruppa per centro",
  grouped_color: "Raggruppa per colore",
};

export function TerminalsTab(_props: { onMultiTerminalChange?: (v: boolean) => void }) {
  const { categories } = useAdminStore();
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading_, setLoading_] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingNew, setSavingNew] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [terminalPrinters, setTerminalPrinters] = useState<Record<string, string[]>>({});
  const [terminalCategories, setTerminalCategories] = useState<Record<string, Category[]>>({});
  const [categoryDropdownId, setCategoryDropdownId] = useState<string | null>(null);

  const now = Date.now();
  const isOnline = (t: Terminal) => t.lastSeenAt !== null && now - t.lastSeenAt < 5 * 60 * 1000;

  function refetchTerminals() {
    adminApi.terminals.list().then(setTerminals).catch(() => {});
  }

  useEffect(() => {
    Promise.all([
      adminApi.terminals.list(),
      adminApi.printers.list(),
    ]).then(([tList, pList]) => {
      setTerminals(tList);
      setPrinters(pList);
    }).catch(() => {}).finally(() => setLoading_(false));
  }, []);

  useEffect(() => {
    const unsubs = [
      wsClient.on("TERMINAL_CREATED", refetchTerminals),
      wsClient.on("TERMINAL_UPDATED", refetchTerminals),
      wsClient.on("TERMINAL_DELETED", refetchTerminals),
    ];
    return () => { for (const unsub of unsubs) unsub(); };
  }, []);

  async function loadTerminalPrinters(terminalId: string) {
    try {
      const list = await adminApi.terminals.getPrinters(terminalId);
      setTerminalPrinters((prev) => ({ ...prev, [terminalId]: list.map((p) => p.id) }));
    } catch { /* ignore */ }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setSavingNew(true);
    try {
      const t = await adminApi.terminals.create({ name: newName.trim() });
      setTerminals((prev) => [...prev, t]);
      setNewName("");
      setCreating(false);
    } catch { /* ignore */ } finally {
      setSavingNew(false);
    }
  }

  async function handleToggleActive(t: Terminal) {
    try {
      const updated = await adminApi.terminals.update(t.id, { active: !t.active });
      setTerminals((prev) => prev.map((x) => x.id === updated.id ? updated : x));
    } catch { /* ignore */ }
  }

  async function handleDelete(id: string) {
    try {
      await adminApi.terminals.delete(id);
      setTerminals((prev) => prev.filter((t) => t.id !== id));
    } catch { /* ignore */ }
  }

  async function handleTogglePrinter(terminalId: string, printerId: string) {
    const current = terminalPrinters[terminalId] ?? [];
    const has = current.includes(printerId);
    try {
      if (has) {
        await adminApi.terminals.removePrinter(terminalId, printerId);
      } else {
        await adminApi.terminals.assignPrinter(terminalId, printerId);
      }
      await loadTerminalPrinters(terminalId);
    } catch { /* ignore */ }
  }

  async function loadTerminalCategories(terminalId: string) {
    try {
      const list = await adminApi.terminals.getCategories(terminalId);
      setTerminalCategories((prev) => ({ ...prev, [terminalId]: list }));
    } catch { /* ignore */ }
  }

  async function handleAssignCategory(terminalId: string, categoryId: string) {
    try {
      await adminApi.terminals.assignCategory(terminalId, categoryId);
      await loadTerminalCategories(terminalId);
      setCategoryDropdownId(null);
    } catch (err) {
      useToastStore.getState().show(err instanceof Error ? err.message : "Errore nell'assegnazione categoria");
    }
  }

  async function handleRemoveCategory(terminalId: string, categoryId: string) {
    try {
      await adminApi.terminals.removeCategory(terminalId, categoryId);
      await loadTerminalCategories(terminalId);
    } catch (err) {
      useToastStore.getState().show(err instanceof Error ? err.message : "Errore nella rimozione categoria");
    }
  }

  async function handleMoveCategory(terminalId: string, index: number, direction: -1 | 1) {
    const list = terminalCategories[terminalId] ?? [];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= list.length) return;
    const reordered = [...list];
    const [item] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, item!);
    setTerminalCategories((prev) => ({ ...prev, [terminalId]: reordered }));
    try {
      await adminApi.terminals.reorderCategories(terminalId, reordered.map((c) => c.id));
    } catch (err) {
      useToastStore.getState().show(err instanceof Error ? err.message : "Errore nel riordino categorie");
      await loadTerminalCategories(terminalId);
    }
  }

  async function handleDefaultViewModeChange(t: Terminal, value: string) {
    try {
      const updated = await adminApi.terminals.update(t.id, { defaultViewMode: value === "" ? null : value });
      setTerminals((prev) => prev.map((x) => x.id === updated.id ? updated : x));
    } catch (err) {
      useToastStore.getState().show(err instanceof Error ? err.message : "Errore nell'aggiornamento vista predefinita");
    }
  }

  const cardStyle: React.CSSProperties = {
    background: "var(--color-white)",
    border: "1px solid var(--color-gray-200)",
    borderRadius: "var(--radius-lg)",
    padding: "16px 20px",
    marginBottom: "10px",
  };

  if (loading_) return <div style={{ color: "var(--color-gray-400)", padding: "24px" }}>Caricamento...</div>;

  return (
    <div style={{ maxWidth: "640px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "var(--text-lg)", color: "var(--color-gray-900)" }}>Terminali</div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)" }}>Gestisci le casse fisiche e le loro stampanti dedicate.</div>
        </div>
        <Button onClick={() => setCreating(true)}>
          <PlusIcon style={{ width: "15px", height: "15px" }} />
          Nuovo terminale
        </Button>
      </div>

      {creating && (
        <div style={{ ...cardStyle, border: "2px solid var(--color-brand)", marginBottom: "16px" }}>
          <div style={{ fontWeight: 600, marginBottom: "10px", color: "var(--color-gray-800)" }}>Nuovo terminale</div>
          <div style={{ display: "flex", gap: "10px" }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Es: Cassa 1, Cassa Bar..."
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
              autoFocus
              style={{ ...inputStyle, flex: 1 }}
            />
            <Button loading={savingNew} onClick={handleCreate}>Crea</Button>
            <Button onClick={() => setCreating(false)}>Annulla</Button>
          </div>
        </div>
      )}

      {terminals.length === 0 ? (
        <div style={{ color: "var(--color-gray-400)", fontSize: "var(--text-sm)", padding: "24px", textAlign: "center" }}>
          Nessun terminale. Crea il primo con il pulsante in alto.
        </div>
      ) : (
        terminals.map((t) => {
          const expanded = expandedId === t.id;
          return (
            <div key={t.id} style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "var(--text-md)", color: "var(--color-gray-800)" }}>
                    {t.name}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: isOnline(t) ? "#22c55e" : "var(--color-gray-400)", fontWeight: 500, marginTop: "2px" }}>
                    {isOnline(t) ? "● online" : "○ offline"}
                    {t.lastSeenAt ? ` — visto ${new Date(t.lastSeenAt).toLocaleString("it-IT")}` : " — mai connesso"}
                  </div>
                </div>
                <span style={{
                  fontSize: "var(--text-xs)", fontWeight: 700, padding: "2px 8px", borderRadius: "999px",
                  background: t.active ? "#dcfce7" : "var(--color-gray-100)",
                  color: t.active ? "#15803d" : "var(--color-gray-400)",
                }}>
                  {t.active ? "Attivo" : "Disattivo"}
                </span>
                <button
                  title="Configura"
                  onClick={() => {
                    if (!expanded) { loadTerminalPrinters(t.id); loadTerminalCategories(t.id); }
                    setExpandedId(expanded ? null : t.id);
                  }}
                  style={{ background: "none", border: "1px solid var(--color-gray-200)", borderRadius: "var(--radius-md)", padding: "5px 10px", cursor: "pointer", fontSize: "var(--text-xs)", color: "var(--color-gray-600)" }}
                >
                  Configura
                </button>
                <button
                  onClick={() => handleToggleActive(t)}
                  style={{ background: "none", border: "1px solid var(--color-gray-200)", borderRadius: "var(--radius-md)", padding: "5px 10px", cursor: "pointer", fontSize: "var(--text-xs)", color: "var(--color-gray-600)" }}
                >
                  {t.active ? "Disattiva" : "Attiva"}
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-gray-400)", padding: "4px" }}
                  title="Elimina"
                >
                  <TrashIcon style={{ width: "16px", height: "16px" }} />
                </button>
              </div>
              {expanded && (
                <div style={{ marginTop: "14px", borderTop: "1px solid var(--color-gray-100)", paddingTop: "14px" }}>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-600)", marginBottom: "10px" }}>
                    Stampanti assegnate
                  </div>
                  {printers.length === 0 ? (
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>Nessuna stampante configurata.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {printers.map((p) => {
                        const assigned = (terminalPrinters[t.id] ?? []).includes(p.id);
                        return (
                          <label key={p.id} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "var(--text-sm)" }}>
                            <input
                              type="checkbox"
                              checked={assigned}
                              onChange={() => handleTogglePrinter(t.id, p.id)}
                            />
                            <span style={{ fontWeight: 500, color: "var(--color-gray-800)" }}>{p.name}</span>
                            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>
                              {p.receiptEnabled ? "scontrino" : ""}{p.receiptEnabled && p.kitchenEnabled ? " + " : ""}{p.kitchenEnabled ? "comanda" : ""}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-600)", margin: "18px 0 10px" }}>
                    Categorie visibili
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", marginBottom: "10px" }}>
                    Se non ne assegni nessuna, questo terminale mostra tutte le categorie.
                  </div>
                  {(() => {
                    const assignedCategories = terminalCategories[t.id] ?? [];
                    const unassignedCategories = categories.filter((c) => !assignedCategories.some((a) => a.id === c.id));
                    const isCategoryDropdownOpen = categoryDropdownId === t.id;
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                        {assignedCategories.length === 0 ? (
                          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>Nessuna categoria assegnata (mostra tutte).</div>
                        ) : (
                          assignedCategories.map((c, idx) => (
                            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "var(--text-sm)" }}>
                              <button onClick={() => handleMoveCategory(t.id, idx, -1)} disabled={idx === 0}
                                style={{ background: "none", border: "1px solid var(--color-gray-200)", borderRadius: "var(--radius-sm)", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.3 : 1, padding: "2px 6px", fontSize: "var(--text-xs)" }}>
                                ↑
                              </button>
                              <button onClick={() => handleMoveCategory(t.id, idx, 1)} disabled={idx === assignedCategories.length - 1}
                                style={{ background: "none", border: "1px solid var(--color-gray-200)", borderRadius: "var(--radius-sm)", cursor: idx === assignedCategories.length - 1 ? "default" : "pointer", opacity: idx === assignedCategories.length - 1 ? 0.3 : 1, padding: "2px 6px", fontSize: "var(--text-xs)" }}>
                                ↓
                              </button>
                              <span style={{ flex: 1, fontWeight: 500, color: "var(--color-gray-800)" }}>{c.name}</span>
                              <button onClick={() => handleRemoveCategory(t.id, c.id)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-gray-400)", padding: "2px" }}>
                                <TrashIcon style={{ width: "14px", height: "14px" }} />
                              </button>
                            </div>
                          ))
                        )}
                        {unassignedCategories.length > 0 && (
                          <div style={{ position: "relative", marginTop: "4px" }}>
                            <button onClick={() => setCategoryDropdownId(isCategoryDropdownOpen ? null : t.id)}
                              style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "5px 12px", borderRadius: "20px", border: "1.5px dashed var(--color-gray-300)", background: "transparent", cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-gray-500)" }}>
                              <PlusIcon style={{ width: "12px", height: "12px" }} /> Aggiungi categoria
                            </button>
                            {isCategoryDropdownOpen && (
                              <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, background: "var(--color-white)", borderRadius: "var(--radius-lg)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid var(--color-gray-200)", minWidth: "200px", zIndex: 100, overflow: "hidden" }}>
                                {unassignedCategories.map((c, i) => (
                                  <button key={c.id} onClick={() => handleAssignCategory(t.id, c.id)}
                                    style={{ width: "100%", padding: "10px 14px", border: "none", borderBottom: i < unassignedCategories.length - 1 ? "1px solid var(--color-gray-100)" : "none", background: "transparent", cursor: "pointer", textAlign: "left", fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-gray-700)", fontFamily: "var(--font)" }}>
                                    {c.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-600)", marginBottom: "8px" }}>
                    Vista predefinita
                  </div>
                  <select
                    value={t.defaultViewMode ?? ""}
                    onChange={(e) => handleDefaultViewModeChange(t, e.target.value)}
                    style={{ ...inputStyle, width: "auto", height: "34px", fontSize: "var(--text-sm)", padding: "0 10px" }}
                  >
                    {Object.entries(VIEW_MODE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
