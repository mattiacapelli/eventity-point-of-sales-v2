import React, { useEffect, useState } from "react";
import { adminApi } from "../../core/admin-api.js";
import { useToastStore } from "../../components/ui/Toast.js";
import { Button } from "../../components/ui/Button.js";
import type { User, UserRole } from "@pos/shared-types";
import { PlusIcon } from "../../components/ui/icons.js";
import { inputStyle } from "./shared.js";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  cashier: "Cassiere",
  kitchen: "Cucina",
  waiter: "Cameriere",
  viewer: "Solo lettura",
};

export function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading_, setLoading_] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("cashier");
  const [newPin, setNewPin] = useState("");
  const [savingNew, setSavingNew] = useState(false);
  const [resetPinId, setResetPinId] = useState<number | null>(null);
  const [resetPinValue, setResetPinValue] = useState("");

  useEffect(() => {
    adminApi.users.list().then(setUsers).catch(() => {}).finally(() => setLoading_(false));
  }, []);

  async function handleCreate() {
    if (!newName.trim() || !newUsername.trim() || !newPin.trim()) return;
    setSavingNew(true);
    try {
      await adminApi.users.create({ name: newName.trim(), username: newUsername.trim(), role: newRole, pin: newPin.trim() });
      const list = await adminApi.users.list();
      setUsers(list);
      setNewName(""); setNewUsername(""); setNewPin(""); setNewRole("cashier");
      setCreating(false);
    } catch (err) {
      useToastStore.getState().show(err instanceof Error ? err.message : "Errore nella creazione utente");
    } finally {
      setSavingNew(false);
    }
  }

  async function handleToggleActive(u: User) {
    try {
      await adminApi.users.update(u.id, { active: !u.active });
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, active: !u.active } : x));
    } catch (err) {
      useToastStore.getState().show(err instanceof Error ? err.message : "Errore nell'aggiornamento utente");
    }
  }

  async function handleRoleChange(u: User, role: UserRole) {
    try {
      await adminApi.users.update(u.id, { role });
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, role } : x));
    } catch (err) {
      useToastStore.getState().show(err instanceof Error ? err.message : "Errore nell'aggiornamento ruolo");
    }
  }

  async function handleResetPin(id: number) {
    if (!resetPinValue.trim()) return;
    try {
      await adminApi.users.resetPin(id, resetPinValue.trim());
      useToastStore.getState().show("PIN reimpostato", "success");
      setResetPinId(null);
      setResetPinValue("");
    } catch (err) {
      useToastStore.getState().show(err instanceof Error ? err.message : "Errore nel reset del PIN");
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
          <div style={{ fontWeight: 700, fontSize: "var(--text-lg)", color: "var(--color-gray-900)" }}>Utenti</div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)" }}>Gestisci gli account che accedono al POS.</div>
        </div>
        <Button onClick={() => setCreating(true)}>
          <PlusIcon style={{ width: "15px", height: "15px" }} />
          Nuovo utente
        </Button>
      </div>

      {creating && (
        <div style={{ ...cardStyle, border: "2px solid var(--color-brand)", marginBottom: "16px" }}>
          <div style={{ fontWeight: 600, marginBottom: "10px", color: "var(--color-gray-800)" }}>Nuovo utente</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome" style={inputStyle} autoFocus />
            <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="Username" style={inputStyle} />
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)} style={inputStyle}>
              {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <input value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder="PIN (4-8 cifre)" type="password" style={inputStyle} />
            <div style={{ display: "flex", gap: "10px" }}>
              <Button loading={savingNew} onClick={handleCreate}>Crea</Button>
              <Button onClick={() => setCreating(false)}>Annulla</Button>
            </div>
          </div>
        </div>
      )}

      {users.length === 0 ? (
        <div style={{ color: "var(--color-gray-400)", fontSize: "var(--text-sm)", padding: "24px", textAlign: "center" }}>
          Nessun utente. Crea il primo con il pulsante in alto.
        </div>
      ) : (
        users.map((u) => (
          <div key={u.id} style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "var(--text-md)", color: "var(--color-gray-800)" }}>
                  {u.name}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>
                  @{u.username}
                </div>
              </div>
              <select value={u.role} onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                style={{ ...inputStyle, width: "auto", height: "32px", fontSize: "var(--text-xs)", padding: "0 8px" }}>
                {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
              <span style={{
                fontSize: "var(--text-xs)", fontWeight: 700, padding: "2px 8px", borderRadius: "999px",
                background: u.active ? "#dcfce7" : "var(--color-gray-100)",
                color: u.active ? "#15803d" : "var(--color-gray-400)",
              }}>
                {u.active ? "Attivo" : "Disattivo"}
              </span>
              <button
                onClick={() => { setResetPinId(resetPinId === u.id ? null : u.id); setResetPinValue(""); }}
                style={{ background: "none", border: "1px solid var(--color-gray-200)", borderRadius: "var(--radius-md)", padding: "5px 10px", cursor: "pointer", fontSize: "var(--text-xs)", color: "var(--color-gray-600)" }}
              >
                Reimposta PIN
              </button>
              <button
                onClick={() => handleToggleActive(u)}
                style={{ background: "none", border: "1px solid var(--color-gray-200)", borderRadius: "var(--radius-md)", padding: "5px 10px", cursor: "pointer", fontSize: "var(--text-xs)", color: "var(--color-gray-600)" }}
              >
                {u.active ? "Disattiva" : "Attiva"}
              </button>
            </div>
            {resetPinId === u.id && (
              <div style={{ marginTop: "12px", borderTop: "1px solid var(--color-gray-100)", paddingTop: "12px", display: "flex", gap: "10px" }}>
                <input value={resetPinValue} onChange={(e) => setResetPinValue(e.target.value)} placeholder="Nuovo PIN (4-8 cifre)" type="password"
                  style={{ ...inputStyle, flex: 1 }} />
                <Button onClick={() => handleResetPin(u.id)}>Salva</Button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
