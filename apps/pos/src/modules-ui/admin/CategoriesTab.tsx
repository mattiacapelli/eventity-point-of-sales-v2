import { useState } from "react";
import { adminApi } from "../../core/admin-api.js";
import { useAdminStore } from "../../state/admin-store.js";
import { Button } from "../../components/ui/Button.js";
import { Modal } from "../../components/ui/Modal.js";
import type { Category } from "@pos/shared-types";
import { TagIcon } from "../../components/ui/icons.js";
import { inputStyle, labelStyle, AdminTablePage, EditDeleteActions, DeleteConfirmModal } from "./shared.js";
import { ColorField } from "./ColorField.js";

export function CategoriesTab() {
  const { categories, upsertCategory, removeCategory, setCategories } = useAdminStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: "", color: "", perItem: false });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  function openCreate() {
    setEditTarget(null);
    setForm({ name: "", color: "", perItem: false });
    setModalOpen(true);
  }

  function openEdit(c: Category) {
    setEditTarget(c);
    setForm({ name: c.name, color: c.color ?? "", perItem: c.receiptPrintMode === "per_item" });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editTarget) {
        const updated = await adminApi.categories.update(editTarget.id, {
          name: form.name.trim(),
          color: form.color === "" ? null : form.color,
          receiptPrintMode: form.perItem ? "per_item" : "inherit",
        });
        upsertCategory(updated);
      } else {
        const created = await adminApi.categories.create({
          name: form.name.trim(),
          color: form.color === "" ? null : form.color,
        });
        const final = form.perItem
          ? await adminApi.categories.update(created.id, { receiptPrintMode: "per_item" })
          : created;
        upsertCategory(final);
      }
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    await adminApi.categories.delete(id);
    removeCategory(id);
    setDeleteId(null);
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    const reordered = [...categories];
    const tmp = reordered[index]!;
    reordered[index] = reordered[target]!;
    reordered[target] = tmp;
    setCategories(reordered);
    await adminApi.categories.reorder(reordered.map((c) => c.id));
  }

  return (
    <>
      <AdminTablePage
        title="Categorie"
        rows={categories}
        rowKey={(c) => c.id}
        emptyMessage="Nessuna categoria. Aggiungine una."
        searchPlaceholder="Cerca categoria..."
        searchPredicate={(c, q) => c.name.toLowerCase().includes(q.toLowerCase())}
        reorderable
        onReorderUp={(_c, index) => void move(index, -1)}
        onReorderDown={(_c, index) => void move(index, 1)}
        columns={[
          {
            key: "name",
            header: "Nome",
            render: (c) => (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <TagIcon style={{ width: "16px", height: "16px", color: c.color ?? "var(--color-brand)", flexShrink: 0 }} />
                <span style={{ fontWeight: 600, color: "var(--color-gray-800)" }}>{c.name}</span>
                {c.receiptPrintMode === "per_item" && (
                  <span style={{
                    fontSize: "var(--text-xs)", fontWeight: 600, padding: "2px 7px",
                    borderRadius: "999px", background: "#dbeafe", color: "#1d4ed8",
                  }}>
                    1 per unità
                  </span>
                )}
              </div>
            ),
          },
        ]}
        rowActions={(c) => <EditDeleteActions onEdit={() => openEdit(c)} onDelete={() => setDeleteId(c.id)} />}
        createLabel="Nuova categoria"
        onCreateClick={openCreate}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? "Modifica categoria" : "Nuova categoria"}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Nome</label>
            <input
              style={inputStyle}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); }}
              placeholder="Nome categoria"
              autoFocus
            />
          </div>
          <ColorField value={form.color} onChange={(color) => setForm((f) => ({ ...f, color }))} />
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 14px", borderRadius: "var(--radius-lg)",
            background: "var(--color-gray-50)", border: "1px solid var(--color-gray-200)",
            gap: "12px",
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--color-gray-800)" }}>
                Stampa uno scontrino per unità
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-500)", marginTop: "2px" }}>
                Ogni prodotto di questa categoria genera uno scontrino separato per ogni unità ordinata
              </div>
            </div>
            <button
              onClick={() => setForm((f) => ({ ...f, perItem: !f.perItem }))}
              style={{
                width: "52px", height: "28px", borderRadius: "14px",
                background: form.perItem ? "var(--color-brand)" : "var(--color-gray-200)",
                border: "none", cursor: "pointer",
                position: "relative", transition: "background 0.2s", flexShrink: 0,
              }}
            >
              <span style={{
                position: "absolute", top: "3px",
                left: form.perItem ? "27px" : "3px",
                width: "22px", height: "22px", borderRadius: "50%",
                background: "var(--color-white)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                transition: "left 0.2s",
              }} />
            </button>
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>Annulla</Button>
            <Button size="sm" loading={saving} disabled={!form.name.trim()} onClick={() => void handleSave()}>
              {editTarget ? "Salva" : "Crea"}
            </Button>
          </div>
        </div>
      </Modal>

      <DeleteConfirmModal
        open={deleteId !== null}
        title="Elimina categoria"
        message="Sei sicuro di voler eliminare questa categoria? I prodotti associati perderanno il riferimento."
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && void handleDelete(deleteId)}
      />
    </>
  );
}
