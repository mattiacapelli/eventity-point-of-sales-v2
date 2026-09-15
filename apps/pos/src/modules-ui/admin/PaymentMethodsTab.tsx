import { useEffect, useState } from "react";
import { adminApi } from "../../core/admin-api.js";
import { useAdminStore } from "../../state/admin-store.js";
import { Button } from "../../components/ui/Button.js";
import { Modal } from "../../components/ui/Modal.js";
import type { PaymentMethodRecord } from "@pos/shared-types";
import { inputStyle, labelStyle, Toggle, AdminTablePage, EditDeleteActions, DeleteConfirmModal } from "./shared.js";

export function PaymentMethodsTab() {
  const { paymentMethods, setPaymentMethods, upsertPaymentMethod, removePaymentMethod } = useAdminStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PaymentMethodRecord | null>(null);
  const [form, setForm] = useState({ name: "", type: "cash", icon: "", excludeFromTotal: false });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("");

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

  const typeOptions = Array.from(new Set(paymentMethods.map((m) => m.type))).sort().map((t) => ({ value: t, label: t }));

  return (
    <>
      <AdminTablePage
        title="Metodi di pagamento"
        rows={paymentMethods}
        rowKey={(m) => m.id}
        emptyMessage="Nessun metodo di pagamento. Aggiungine uno."
        searchPlaceholder="Cerca metodo..."
        searchPredicate={(m, q) => m.name.toLowerCase().includes(q.toLowerCase())}
        filters={[
          {
            key: "type",
            label: "Tutti i tipi",
            options: typeOptions,
            value: typeFilter,
            onChange: setTypeFilter,
            predicate: (m, v) => m.type === v,
          },
        ]}
        columns={[
          {
            key: "name",
            header: "Nome",
            render: (m) => (
              <>
                <span style={{ fontWeight: 600, color: "var(--color-gray-800)" }}>{m.name}</span>
                {m.excludeFromTotal && (
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", marginTop: "2px" }}>
                    Escluso dal totale generale
                  </div>
                )}
              </>
            ),
          },
          {
            key: "type",
            header: "Tipo",
            render: (m) => <span style={{ color: "var(--color-gray-500)" }}>{m.type}</span>,
          },
          {
            key: "active",
            header: "Attivo",
            align: "center",
            render: (m) => <Toggle value={m.active} onChange={() => void handleToggleActive(m)} />,
          },
        ]}
        rowActions={(m) => <EditDeleteActions onEdit={() => openEdit(m)} onDelete={() => setDeleteId(m.id)} />}
        createLabel="Nuovo metodo"
        onCreateClick={openCreate}
      />

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

      <DeleteConfirmModal
        open={deleteId !== null}
        title="Elimina metodo di pagamento"
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && void handleDelete(deleteId)}
      />
    </>
  );
}
