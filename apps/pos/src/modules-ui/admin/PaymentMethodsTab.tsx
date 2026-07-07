import { useEffect, useState } from "react";
import { adminApi } from "../../core/admin-api.js";
import { useAdminStore } from "../../state/admin-store.js";
import { Button } from "../../components/ui/Button.js";
import { Modal } from "../../components/ui/Modal.js";
import type { PaymentMethodRecord } from "@pos/shared-types";
import { PlusIcon, BanknotesIcon, PencilSquareIcon, TrashIcon } from "../../components/ui/icons.js";
import { inputStyle, labelStyle, Toggle } from "./shared.js";

export function PaymentMethodsTab() {
  const { paymentMethods, setPaymentMethods, upsertPaymentMethod, removePaymentMethod } = useAdminStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PaymentMethodRecord | null>(null);
  const [form, setForm] = useState({ name: "", type: "cash", icon: "", excludeFromTotal: false });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    adminApi.paymentMethods.list().then(setPaymentMethods).catch(console.error);
  }, []);

  function openCreate() {
    setEditTarget(null);
    setForm({ name: "", type: "cash", icon: "", excludeFromTotal: false });
    setModalOpen(true);
  }
  function openEdit(m: PaymentMethodRecord) {
    setEditTarget(m);
    setForm({ name: m.name, type: m.type, icon: m.icon ?? "", excludeFromTotal: m.excludeFromTotal });
    setModalOpen(true);
  }
  async function handleSave() {
    setSaving(true);
    try {
      if (editTarget) {
        const updated = await adminApi.paymentMethods.update(editTarget.id, {
          name: form.name, type: form.type, icon: form.icon === "" ? null : form.icon, excludeFromTotal: form.excludeFromTotal,
        });
        upsertPaymentMethod(updated);
      } else {
        const created = await adminApi.paymentMethods.create({
          name: form.name, type: form.type, icon: form.icon === "" ? null : form.icon, excludeFromTotal: form.excludeFromTotal,
        });
        upsertPaymentMethod(created);
      }
      setModalOpen(false);
    } finally { setSaving(false); }
  }
  async function handleDelete(id: string) {
    await adminApi.paymentMethods.delete(id);
    removePaymentMethod(id);
    setDeleteId(null);
  }
  async function handleToggleActive(m: PaymentMethodRecord) {
    const updated = await adminApi.paymentMethods.update(m.id, { active: !m.active });
    upsertPaymentMethod(updated);
  }

  return (
    <div style={{ padding: "var(--sp-lg)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-lg)" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-800)", margin: 0 }}>Metodi di pagamento</h2>
        <Button size="sm" onClick={openCreate} icon={<PlusIcon style={{ width: "16px", height: "16px" }} />}>Nuovo metodo</Button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {paymentMethods.length === 0 && (
          <div style={{ background: "var(--color-white)", borderRadius: "var(--radius-xl)", padding: "32px", textAlign: "center", color: "var(--color-gray-400)", fontSize: "var(--text-sm)", boxShadow: "var(--shadow-sm)" }}>
            Nessun metodo di pagamento. Aggiungine uno.
          </div>
        )}
        {paymentMethods.map((m) => (
          <div key={m.id} style={{ background: "var(--color-white)", borderRadius: "var(--radius-lg)", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px", boxShadow: "var(--shadow-sm)" }}>
            <BanknotesIcon style={{ width: "18px", height: "18px", color: "var(--color-brand)", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--color-gray-800)" }}>{m.name}</div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>
                {m.type}
                {m.excludeFromTotal && " · Escluso dal totale generale"}
              </div>
            </div>
            <Toggle value={m.active} onChange={() => void handleToggleActive(m)} />
            <button onClick={() => openEdit(m)} style={{ padding: "6px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-gray-200)", background: "var(--color-white)", cursor: "pointer", color: "var(--color-gray-600)", display: "flex" }}>
              <PencilSquareIcon style={{ width: "16px", height: "16px" }} />
            </button>
            <button onClick={() => setDeleteId(m.id)} style={{ padding: "6px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-danger)", background: "var(--color-white)", cursor: "pointer", color: "var(--color-danger)", display: "flex" }}>
              <TrashIcon style={{ width: "16px", height: "16px" }} />
            </button>
          </div>
        ))}
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? "Modifica metodo" : "Nuovo metodo di pagamento"}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Nome</label>
            <input style={inputStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Es. Contanti, Carta, Satispay..." autoFocus />
          </div>
          <div>
            <label style={labelStyle}>Tipo</label>
            <input style={inputStyle} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} placeholder="cash / card / digital_wallet / ..." />
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", marginTop: "4px" }}>Usato per l'icona nel POS: cash, card, digital_wallet</div>
          </div>
          <div>
            <label style={labelStyle}>Escludi dal totale generale</label>
            <Toggle value={form.excludeFromTotal} onChange={(v) => setForm((f) => ({ ...f, excludeFromTotal: v }))} />
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", marginTop: "4px" }}>
              Es. buoni pasto: l'importo non concorre al totale generale del report di chiusura turno.
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>Annulla</Button>
            <Button size="sm" loading={saving} disabled={!form.name.trim()} onClick={() => void handleSave()}>{editTarget ? "Salva" : "Crea"}</Button>
          </div>
        </div>
      </Modal>
      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Elimina metodo di pagamento">
        <p style={{ color: "var(--color-gray-600)", fontSize: "var(--text-sm)", marginBottom: "20px" }}>Sei sicuro?</p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <Button variant="ghost" size="sm" onClick={() => setDeleteId(null)}>Annulla</Button>
          <Button variant="danger" size="sm" onClick={() => deleteId && void handleDelete(deleteId)}>Elimina</Button>
        </div>
      </Modal>
    </div>
  );
}
