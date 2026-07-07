import { useRef, useState } from "react";
import { adminApi } from "../../core/admin-api.js";
import { useAdminStore } from "../../state/admin-store.js";
import { Button } from "../../components/ui/Button.js";
import { Modal } from "../../components/ui/Modal.js";
import type { Category } from "@pos/shared-types";
import { TagIcon, PlusIcon, PencilSquareIcon, TrashIcon } from "../../components/ui/icons.js";
import { inputStyle, labelStyle } from "./shared.js";
import { ColorField } from "./ColorField.js";

export function CategoriesTab() {
  const { categories, upsertCategory, removeCategory } = useAdminStore();
  const [newName, setNewName] = useState("");
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [addedName, setAddedName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleAdd() {
    if (!newName.trim()) return;
    setAdding(true);
    const name = newName.trim();
    try {
      const created = await adminApi.categories.create({ name });
      upsertCategory(created);
      setNewName("");
      setAddedName(name);
      setTimeout(() => setAddedName(null), 3000);
    } finally {
      setAdding(false);
    }
  }

  function startEdit(c: Category) {
    setEditTarget(c);
    setEditName(c.name);
    setEditColor(c.color ?? "");
  }

  async function handleEditSave() {
    if (!editTarget || !editName.trim()) return;
    setSaving(true);
    try {
      const updated = await adminApi.categories.update(editTarget.id, {
        name: editName.trim(),
        color: editColor === "" ? null : editColor,
      });
      upsertCategory(updated);
      setEditTarget(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await adminApi.categories.delete(id);
    removeCategory(id);
    setDeleteId(null);
  }

  return (
    <div style={{ padding: "var(--sp-lg)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-lg)" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-800)", margin: 0 }}>
          Categorie
        </h2>
      </div>

      {/* Add input */}
      <div style={{
        display: "flex",
        gap: "10px",
        marginBottom: "var(--sp-lg)",
        background: "var(--color-white)",
        borderRadius: "var(--radius-xl)",
        padding: "var(--sp-md)",
        boxShadow: "var(--shadow-sm)",
      }}>
        <input
          ref={inputRef}
          style={{ ...inputStyle, flex: 1 }}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); }}
          placeholder="Nuova categoria — premi Invio per aggiungere"
        />
        <Button
          size="md"
          loading={adding}
          disabled={!newName.trim()}
          icon={<PlusIcon style={{ width: "16px", height: "16px" }} />}
          onClick={() => void handleAdd()}
        >
          Aggiungi
        </Button>
      </div>

      {addedName && (
        <div style={{
          marginBottom: "var(--sp-md)",
          padding: "10px 16px",
          borderRadius: "var(--radius-lg)",
          background: "#d1fae5",
          color: "#065f46",
          fontSize: "var(--text-sm)",
          fontWeight: 600,
        }}>
          Categoria &quot;{addedName}&quot; aggiunta.
        </div>
      )}

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {categories.length === 0 && (
          <div style={{
            background: "var(--color-white)",
            borderRadius: "var(--radius-xl)",
            padding: "32px",
            textAlign: "center",
            color: "var(--color-gray-400)",
            fontSize: "var(--text-sm)",
            boxShadow: "var(--shadow-sm)",
          }}>
            Nessuna categoria. Aggiungine una sopra.
          </div>
        )}
        {categories.map((c) => (
          <div
            key={c.id}
            style={{
              background: "var(--color-white)",
              borderRadius: "var(--radius-lg)",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              boxShadow: "var(--shadow-sm)",
              gap: "12px",
            }}
          >
            <TagIcon style={{ width: "18px", height: "18px", color: c.color ?? "var(--color-brand)", flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: "var(--text-md)", fontWeight: 600, color: "var(--color-gray-800)" }}>
              {c.name}
            </span>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                onClick={() => startEdit(c)}
                title="Modifica"
                style={{
                  padding: "6px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-gray-200)",
                  background: "var(--color-white)",
                  cursor: "pointer",
                  color: "var(--color-gray-600)",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <PencilSquareIcon style={{ width: "16px", height: "16px" }} />
              </button>
              <button
                onClick={() => setDeleteId(c.id)}
                title="Elimina"
                style={{
                  padding: "6px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-danger)",
                  background: "var(--color-white)",
                  cursor: "pointer",
                  color: "var(--color-danger)",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <TrashIcon style={{ width: "16px", height: "16px" }} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      <Modal open={editTarget !== null} onClose={() => setEditTarget(null)} title="Modifica categoria">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Nome</label>
            <input
              style={inputStyle}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleEditSave(); }}
              placeholder="Nome categoria"
              autoFocus
            />
          </div>
          <ColorField value={editColor} onChange={setEditColor} />
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Button variant="ghost" size="sm" onClick={() => setEditTarget(null)}>Annulla</Button>
            <Button size="sm" loading={saving} onClick={() => void handleEditSave()}>Salva</Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm modal */}
      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Elimina categoria">
        <p style={{ color: "var(--color-gray-600)", fontSize: "var(--text-sm)", marginBottom: "20px" }}>
          Sei sicuro di voler eliminare questa categoria? I prodotti associati perderanno il riferimento.
        </p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <Button variant="ghost" size="sm" onClick={() => setDeleteId(null)}>Annulla</Button>
          <Button variant="danger" size="sm" onClick={() => deleteId && void handleDelete(deleteId)}>
            Elimina
          </Button>
        </div>
      </Modal>
    </div>
  );
}
