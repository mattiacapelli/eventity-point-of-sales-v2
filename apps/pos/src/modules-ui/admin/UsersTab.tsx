import { useEffect, useState } from "react";
import { adminApi } from "../../core/admin-api.js";
import { useToastStore } from "../../components/ui/Toast.js";
import { Button } from "../../components/ui/Button.js";
import { Modal } from "../../components/ui/Modal.js";
import type { User, UserRole } from "@pos/shared-types";
import { inputStyle, labelStyle, AdminTablePage, IconButton } from "./shared.js";
import { ArrowPathIcon, CheckIcon, XMarkIcon } from "../../components/ui/icons.js";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  cashier: "Cassiere",
  kitchen: "Cucina",
  waiter: "Cameriere",
  viewer: "Solo lettura",
};

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as UserRole[]).map((r) => ({ value: r, label: ROLE_LABELS[r] }));
const STATUS_OPTIONS = [
  { value: "active", label: "Attivo" },
  { value: "inactive", label: "Disattivo" },
];

export function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", role: "cashier" as UserRole, pin: "" });
  const [saving, setSaving] = useState(false);
  const [resetPinId, setResetPinId] = useState<number | null>(null);
  const [resetPinValue, setResetPinValue] = useState("");
  const [resettingPin, setResettingPin] = useState(false);
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    adminApi.users.list().then(setUsers).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setForm({ name: "", username: "", role: "cashier", pin: "" });
    setModalOpen(true);
  }

  async function handleCreate() {
    if (!form.name.trim() || !form.username.trim() || !form.pin.trim()) return;
    setSaving(true);
    try {
      await adminApi.users.create({ name: form.name.trim(), username: form.username.trim(), role: form.role, pin: form.pin.trim() });
      const list = await adminApi.users.list();
      setUsers(list);
      setModalOpen(false);
    } catch (err) {
      useToastStore.getState().show(err instanceof Error ? err.message : "Errore nella creazione utente");
    } finally {
      setSaving(false);
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

  function openResetPin(id: number) {
    setResetPinId(id);
    setResetPinValue("");
  }

  async function handleResetPin() {
    if (resetPinId === null || !resetPinValue.trim()) return;
    setResettingPin(true);
    try {
      await adminApi.users.resetPin(resetPinId, resetPinValue.trim());
      useToastStore.getState().show("PIN reimpostato", "success");
      setResetPinId(null);
      setResetPinValue("");
    } catch (err) {
      useToastStore.getState().show(err instanceof Error ? err.message : "Errore nel reset del PIN");
    } finally {
      setResettingPin(false);
    }
  }

  return (
    <>
      <AdminTablePage
        title="Utenti"
        subtitle="Gestisci gli account che accedono al POS."
        rows={users}
        rowKey={(u) => u.id}
        loading={loading}
        emptyMessage="Nessun utente. Crea il primo con il pulsante in alto."
        searchPlaceholder="Cerca utente..."
        searchPredicate={(u, q) => u.name.toLowerCase().includes(q.toLowerCase()) || u.username.toLowerCase().includes(q.toLowerCase())}
        filters={[
          { key: "role", label: "Tutti i ruoli", options: ROLE_OPTIONS, value: roleFilter, onChange: setRoleFilter, predicate: (u, v) => u.role === v },
          { key: "status", label: "Tutti gli stati", options: STATUS_OPTIONS, value: statusFilter, onChange: setStatusFilter, predicate: (u, v) => (v === "active" ? u.active : !u.active) },
        ]}
        columns={[
          {
            key: "name",
            header: "Nome",
            render: (u) => (
              <>
                <span style={{ fontWeight: 600, color: "var(--color-gray-800)" }}>{u.name}</span>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>@{u.username}</div>
              </>
            ),
          },
          {
            key: "role",
            header: "Ruolo",
            render: (u) => (
              <select value={u.role} onChange={(e) => void handleRoleChange(u, e.target.value as UserRole)}
                style={{ ...inputStyle, width: "auto", height: "32px", fontSize: "var(--text-xs)", padding: "0 8px" }}>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            ),
          },
          {
            key: "status",
            header: "Stato",
            align: "center",
            render: (u) => (
              <span style={{
                fontSize: "var(--text-xs)", fontWeight: 700, padding: "2px 8px", borderRadius: "999px",
                background: u.active ? "#dcfce7" : "var(--color-gray-100)",
                color: u.active ? "#15803d" : "var(--color-gray-400)",
              }}>
                {u.active ? "Attivo" : "Disattivo"}
              </span>
            ),
          },
        ]}
        rowActions={(u) => (
          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
            <IconButton icon={<ArrowPathIcon style={{ width: "16px", height: "16px" }} />} title="Reimposta PIN" onClick={() => openResetPin(u.id)} />
            <button
              onClick={() => void handleToggleActive(u)}
              style={{ background: "var(--color-white)", border: "1px solid var(--color-gray-200)", borderRadius: "var(--radius-md)", padding: "5px 10px", cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-gray-600)", fontFamily: "var(--font)" }}
            >
              {u.active ? "Disattiva" : "Attiva"}
            </button>
          </div>
        )}
        createLabel="Nuovo utente"
        onCreateClick={openCreate}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuovo utente">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Nome</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nome" style={inputStyle} autoFocus />
          </div>
          <div>
            <label style={labelStyle}>Username</label>
            <input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} placeholder="Username" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Ruolo</label>
            <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))} style={inputStyle}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>PIN (4-8 cifre)</label>
            <input value={form.pin} onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value }))} placeholder="PIN" type="password" style={inputStyle} />
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>Annulla</Button>
            <Button size="sm" loading={saving} disabled={!form.name.trim() || !form.username.trim() || !form.pin.trim()} onClick={() => void handleCreate()}>Crea</Button>
          </div>
        </div>
      </Modal>

      <Modal open={resetPinId !== null} onClose={() => setResetPinId(null)} title="Reimposta PIN">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Nuovo PIN (4-8 cifre)</label>
            <input
              value={resetPinValue}
              onChange={(e) => setResetPinValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleResetPin(); }}
              placeholder="Nuovo PIN"
              type="password"
              style={inputStyle}
              autoFocus
            />
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Button variant="ghost" size="sm" icon={<XMarkIcon style={{ width: "16px", height: "16px" }} />} onClick={() => setResetPinId(null)}>Annulla</Button>
            <Button size="sm" loading={resettingPin} disabled={!resetPinValue.trim()} icon={<CheckIcon style={{ width: "16px", height: "16px" }} />} onClick={() => void handleResetPin()}>Salva</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
