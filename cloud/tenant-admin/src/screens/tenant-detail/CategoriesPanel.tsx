import { useEffect, useState } from "react";
import { ArrowUpIcon, ArrowDownIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import type { CategoryRecord } from "../../core/types.js";
import { listCategories, listProducts, reorderCategories, updateCategoryEmoji, createCategory, renameCategory, deleteCategory } from "../../core/api-client.js";
import { Button } from "../../components/Button.js";
import { Input } from "../../components/Input.js";
import { ConfirmDialog } from "../../components/ConfirmDialog.js";
import { ErrorRetry } from "../../components/ErrorRetry.js";
import { EmptyState } from "../../components/EmptyState.js";
import { Table, TableHead, Th, Tr, Td } from "../../components/Table.js";
import { IconButton } from "../../components/IconButton.js";
import { useToast } from "../../components/Toast.js";

export function CategoriesPanel({ tenantId }: { tenantId: string }) {
  const { showToast } = useToast();
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [productCountByCategory, setProductCountByCategory] = useState<Record<number, number>>({});
  const [reordering, setReordering] = useState(false);
  const [editingEmojiId, setEditingEmojiId] = useState<number | null>(null);
  const [editingEmojiValue, setEditingEmojiValue] = useState("");
  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  const [savingNameId, setSavingNameId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CategoryRecord | null>(null);

  function loadCategories() {
    setCategoriesError(null);
    listCategories(tenantId)
      .then((rows) => {
        const sorted = rows.slice().sort((a, b) => a.sortOrder - b.sortOrder);
        setCategories(sorted);
      })
      .catch((err) => setCategoriesError(err instanceof Error ? err.message : "Impossibile caricare le categorie"));
  }

  useEffect(loadCategories, [tenantId]);

  useEffect(() => {
    listProducts(tenantId)
      .then((rows) => {
        const counts: Record<number, number> = {};
        for (const p of rows) counts[p.categoryId] = (counts[p.categoryId] ?? 0) + 1;
        setProductCountByCategory(counts);
      })
      .catch(() => setProductCountByCategory({}));
  }, [tenantId]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await createCategory(tenantId, newName.trim());
      setCategories((prev) => [...prev, created]);
      setNewName("");
      showToast(`Categoria "${created.name}" creata`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossibile creare la categoria", "error");
    } finally {
      setCreating(false);
    }
  }

  function startEditingEmoji(category: CategoryRecord) {
    setEditingEmojiId(category.id);
    setEditingEmojiValue(category.emoji ?? "");
  }

  async function saveEmoji(category: CategoryRecord) {
    const trimmed = editingEmojiValue.trim();
    const nextEmoji = trimmed || null;
    setEditingEmojiId(null);
    if (nextEmoji === category.emoji) return;
    try {
      const updated = await updateCategoryEmoji(tenantId, category.id, nextEmoji);
      setCategories((prev) => prev.map((c) => (c.id === category.id ? updated : c)));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossibile aggiornare l'emoji", "error");
    }
  }

  function startEditingName(category: CategoryRecord) {
    setEditingNameId(category.id);
    setEditingNameValue(category.name);
  }

  async function saveName(category: CategoryRecord) {
    const trimmed = editingNameValue.trim();
    if (!trimmed || trimmed === category.name) {
      setEditingNameId(null);
      return;
    }
    setSavingNameId(category.id);
    try {
      const updated = await renameCategory(tenantId, category.id, trimmed);
      setCategories((prev) => prev.map((c) => (c.id === category.id ? updated : c)));
      showToast("Categoria rinominata");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossibile rinominare la categoria", "error");
    } finally {
      setSavingNameId(null);
      setEditingNameId(null);
    }
  }

  async function handleDelete(category: CategoryRecord) {
    await deleteCategory(tenantId, category.id);
    setCategories((prev) => prev.filter((c) => c.id !== category.id));
    showToast(`Categoria "${category.name}" eliminata`);
  }

  async function moveCategory(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const reordered = categories.slice();
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex]!, reordered[index]!];
    const previous = categories;
    setCategories(reordered);
    setReordering(true);
    try {
      await reorderCategories(tenantId, reordered.map((c) => c.id));
    } catch (err) {
      setCategories(previous);
      showToast(err instanceof Error ? err.message : "Impossibile riordinare le categorie", "error");
    } finally {
      setReordering(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-md)" }}>
      <div style={{ display: "flex", gap: "8px" }}>
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
          placeholder="Nome nuova categoria..."
          style={{ flex: 1 }}
        />
        <Button onClick={() => void handleCreate()} loading={creating} disabled={!newName.trim()}>
          Crea
        </Button>
      </div>

      {categoriesError ? (
        <ErrorRetry message={categoriesError} onRetry={loadCategories} />
      ) : categories.length === 0 ? (
        <EmptyState>Nessuna categoria</EmptyState>
      ) : (
        <Table>
          <TableHead>
            <Th width="56px" align="center">#</Th>
            <Th width="56px" align="center">Emoji</Th>
            <Th>Nome</Th>
            <Th width="90px" align="right">Prodotti</Th>
            <Th width="110px" align="right">Ordine</Th>
            <Th width="50px" align="right"></Th>
          </TableHead>
          <tbody>
            {categories.map((c, index) => (
              <Tr key={c.id}>
                <Td align="center">
                  <span style={{ color: "var(--color-gray-400)", fontVariantNumeric: "tabular-nums" }}>{index + 1}</span>
                </Td>
                <Td align="center">
                  {editingEmojiId === c.id ? (
                    <input
                      value={editingEmojiValue}
                      onChange={(e) => setEditingEmojiValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void saveEmoji(c);
                        if (e.key === "Escape") setEditingEmojiId(null);
                      }}
                      onBlur={() => void saveEmoji(c)}
                      placeholder="🍕"
                      maxLength={8}
                      autoFocus
                      style={{ width: "40px", textAlign: "center", padding: "4px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-gray-200)", fontSize: "var(--text-md)" }}
                    />
                  ) : (
                    <button
                      onClick={() => startEditingEmoji(c)}
                      aria-label="Imposta emoji"
                      style={{ width: "28px", height: "28px", borderRadius: "var(--radius-sm)", border: "1px dashed var(--color-gray-300)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "var(--text-md)", flexShrink: 0 }}
                    >
                      {c.emoji ?? "＋"}
                    </button>
                  )}
                </Td>
                <Td>
                  {editingNameId === c.id ? (
                    <Input
                      value={editingNameValue}
                      onChange={(e) => setEditingNameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void saveName(c);
                        if (e.key === "Escape") setEditingNameId(null);
                      }}
                      onBlur={() => void saveName(c)}
                      autoFocus
                      disabled={savingNameId === c.id}
                    />
                  ) : (
                    <button
                      onClick={() => startEditingName(c)}
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px", textAlign: "left" }}
                    >
                      <span style={{ fontWeight: 600 }}>{c.name}</span>
                      <PencilSquareIcon width={14} height={14} color="var(--color-gray-400)" />
                    </button>
                  )}
                </Td>
                <Td align="right">
                  <span style={{ color: "var(--color-gray-500)" }}>{productCountByCategory[c.id] ?? 0}</span>
                </Td>
                <Td align="right">
                  <div style={{ display: "inline-flex", gap: "4px" }}>
                    <IconButton
                      variant="outline"
                      onClick={() => void moveCategory(index, -1)}
                      disabled={index === 0 || reordering}
                      aria-label="Sposta su"
                      style={{ width: "28px", height: "28px" }}
                    >
                      <ArrowUpIcon width={14} height={14} />
                    </IconButton>
                    <IconButton
                      variant="outline"
                      onClick={() => void moveCategory(index, 1)}
                      disabled={index === categories.length - 1 || reordering}
                      aria-label="Sposta giù"
                      style={{ width: "28px", height: "28px" }}
                    >
                      <ArrowDownIcon width={14} height={14} />
                    </IconButton>
                  </div>
                </Td>
                <Td align="right">
                  <IconButton
                    variant="danger"
                    onClick={() => setDeleteTarget(c)}
                    aria-label="Elimina categoria"
                    style={{ width: "28px", height: "28px" }}
                  >
                    <TrashIcon width={16} height={16} />
                  </IconButton>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Elimina categoria"
          description={
            (productCountByCategory[deleteTarget.id] ?? 0) > 0
              ? `Confermi l'eliminazione di "${deleteTarget.name}"? Verranno eliminati anche i ${productCountByCategory[deleteTarget.id]} prodotti al suo interno. L'operazione non è reversibile.`
              : `Confermi l'eliminazione di "${deleteTarget.name}"? L'operazione non è reversibile.`
          }
          confirmLabel="Elimina"
          onConfirm={async () => { await handleDelete(deleteTarget); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
