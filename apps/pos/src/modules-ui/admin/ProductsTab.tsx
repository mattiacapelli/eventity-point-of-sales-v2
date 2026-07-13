import React, { useEffect, useState } from "react";
import { adminApi } from "../../core/admin-api.js";
import type { InventoryItemRecord, ProductIngredientRecord } from "../../core/admin-api.js";
import { useAdminStore } from "../../state/admin-store.js";
import { useToastStore } from "../../components/ui/Toast.js";
import { Button } from "../../components/ui/Button.js";
import { Modal } from "../../components/ui/Modal.js";
import type { Product, OptionGroupWithOptions, Option } from "@pos/shared-types";
import { CubeIcon, PlusIcon, PencilSquareIcon, TrashIcon, XMarkIcon, CircleStackIcon } from "../../components/ui/icons.js";
import { inputStyle, labelStyle, tableHeaderStyle, tableCellStyle } from "./shared.js";
import { ColorField } from "./ColorField.js";

// ─── Option Groups Panel ──────────────────────────────────────────────────────

const GROUP_TYPE_LABELS: Record<string, string> = {
  single: "Scelta singola",
  multi: "Multipla",
  removal: "Rimozione",
};
const GROUP_TYPE_COLORS: Record<string, string> = {
  single: "#3b82f6",
  multi: "#8b5cf6",
  removal: "#ef4444",
};

function OptionGroupsPanel({ product }: { product: Product }) {
  const { optionGroupsByProduct, setOptionGroups, upsertOptionGroup, removeOptionGroup, upsertOption, removeOption } = useAdminStore();
  const groups: OptionGroupWithOptions[] = optionGroupsByProduct[product.id] ?? [];
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Modal: create/edit group
  const [groupModal, setGroupModal] = useState(false);
  const [editGroup, setEditGroup] = useState<OptionGroupWithOptions | null>(null);
  const [groupForm, setGroupForm] = useState({ name: "", type: "single" as "single" | "multi" | "removal", required: false, maxSel: 1 });
  const [savingGroup, setSavingGroup] = useState(false);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);

  // Modal: create/edit option
  const [optionModal, setOptionModal] = useState<{ groupId: string } | null>(null);
  const [editOption, setEditOption] = useState<Option | null>(null);
  const [optionForm, setOptionForm] = useState({ name: "", priceDelta: "0", prefix: "+" as "+" | "-" | ">>" });
  const [savingOption, setSavingOption] = useState(false);
  const [deleteOption_, setDeleteOption_] = useState<{ groupId: string; optionId: string } | null>(null);

  useEffect(() => {
    if (loadedFor === product.id) return;
    adminApi.optionGroups.list(product.id).then((gs) => {
      setOptionGroups(product.id, gs);
      setLoadedFor(product.id);
    }).catch(console.error);
  }, [product.id]);

  function openCreateGroup() {
    setEditGroup(null);
    setGroupForm({ name: "", type: "single", required: false, maxSel: 1 });
    setGroupModal(true);
  }
  function openEditGroup(g: OptionGroupWithOptions) {
    setEditGroup(g);
    setGroupForm({ name: g.name, type: g.type, required: g.required, maxSel: g.maxSel });
    setGroupModal(true);
  }
  async function handleSaveGroup() {
    setSavingGroup(true);
    try {
      if (editGroup) {
        const updated = await adminApi.optionGroups.update(editGroup.id, {
          name: groupForm.name,
          type: groupForm.type,
          required: groupForm.required,
          maxSel: groupForm.maxSel,
        });
        upsertOptionGroup(product.id, updated);
      } else {
        const created = await adminApi.optionGroups.create({
          productId: product.id,
          name: groupForm.name,
          type: groupForm.type,
          required: groupForm.required,
          maxSel: groupForm.maxSel,
        });
        upsertOptionGroup(product.id, created);
      }
      setGroupModal(false);
    } finally { setSavingGroup(false); }
  }
  async function handleDeleteGroup(id: string) {
    await adminApi.optionGroups.delete(id);
    removeOptionGroup(product.id, id);
    setDeleteGroupId(null);
  }

  function openCreateOption(groupId: string) {
    setEditOption(null);
    setOptionForm({ name: "", priceDelta: "0", prefix: "+" });
    setOptionModal({ groupId });
  }
  function openEditOption(groupId: string, o: Option) {
    setEditOption(o);
    setOptionForm({ name: o.name, priceDelta: String(o.priceDelta), prefix: o.prefix ?? "+" });
    setOptionModal({ groupId });
  }
  async function handleSaveOption() {
    if (!optionModal) return;
    setSavingOption(true);
    try {
      const delta = parseFloat(optionForm.priceDelta) || 0;
      if (editOption) {
        const updated = await adminApi.optionGroups.updateOption(editOption.id, { name: optionForm.name, priceDelta: delta, prefix: optionForm.prefix });
        upsertOption(product.id, optionModal.groupId, updated);
      } else {
        const created = await adminApi.optionGroups.createOption(optionModal.groupId, { name: optionForm.name, priceDelta: delta, prefix: optionForm.prefix });
        upsertOption(product.id, optionModal.groupId, created);
      }
      setOptionModal(null);
    } finally { setSavingOption(false); }
  }
  async function handleDeleteOption(groupId: string, optionId: string) {
    await adminApi.optionGroups.deleteOption(optionId);
    removeOption(product.id, groupId, optionId);
    setDeleteOption_(null);
  }

  return (
    <div style={{
      background: "var(--color-gray-50)",
      borderTop: "1px solid var(--color-gray-100)",
      padding: "16px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-gray-500)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Gruppi opzioni
        </span>
        <Button size="sm" variant="secondary" onClick={openCreateGroup} icon={<PlusIcon style={{ width: "13px", height: "13px" }} />}>
          Aggiungi gruppo
        </Button>
      </div>

      {groups.length === 0 && (
        <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-400)", padding: "8px 0" }}>
          Nessun gruppo — il prodotto verrà aggiunto al carrello direttamente.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {groups.map((g) => (
          <div key={g.id} style={{
            background: "var(--color-white)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-gray-200)",
            overflow: "hidden",
          }}>
            {/* Group header */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px" }}>
              <span style={{
                fontSize: "var(--text-xs)",
                fontWeight: 700,
                color: GROUP_TYPE_COLORS[g.type],
                background: `${GROUP_TYPE_COLORS[g.type]}18`,
                padding: "2px 8px",
                borderRadius: "999px",
                flexShrink: 0,
              }}>
                {GROUP_TYPE_LABELS[g.type]}
              </span>
              <span style={{ flex: 1, fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-gray-800)" }}>
                {g.name}
              </span>
              {g.required && (
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-danger)", fontWeight: 600 }}>Obbligatorio</span>
              )}
              <button onClick={() => openEditGroup(g)} style={{ padding: "4px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-gray-200)", background: "var(--color-white)", cursor: "pointer", color: "var(--color-gray-500)", display: "flex" }}>
                <PencilSquareIcon style={{ width: "13px", height: "13px" }} />
              </button>
              <button onClick={() => setDeleteGroupId(g.id)} style={{ padding: "4px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-danger)", background: "var(--color-white)", cursor: "pointer", color: "var(--color-danger)", display: "flex" }}>
                <TrashIcon style={{ width: "13px", height: "13px" }} />
              </button>
            </div>
            {/* Options */}
            <div style={{ padding: "0 14px 12px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {g.options.map((o) => (
                <div key={o.id} style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "5px 10px",
                  borderRadius: "999px",
                  background: "var(--color-gray-50)",
                  border: "1px solid var(--color-gray-200)",
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  color: "var(--color-gray-700)",
                }}>
                  <span style={{
                    fontWeight: 700,
                    color: o.prefix === "-" ? "var(--color-danger)" : o.prefix === ">>" ? "var(--color-gray-500)" : "var(--color-brand)",
                    marginRight: "2px",
                  }}>{o.prefix ?? "+"}</span>
                  <span>{o.name}</span>
                  {o.priceDelta !== 0 && (
                    <span style={{ color: o.priceDelta > 0 ? "var(--color-brand)" : "var(--color-danger)" }}>
                      {o.priceDelta > 0 ? "+" : ""}€{o.priceDelta.toFixed(2)}
                    </span>
                  )}
                  <button onClick={() => openEditOption(g.id, o)} style={{ display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: "0 2px", color: "var(--color-gray-400)" }}>
                    <PencilSquareIcon style={{ width: "11px", height: "11px" }} />
                  </button>
                  <button onClick={() => setDeleteOption_({ groupId: g.id, optionId: o.id })} style={{ display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: "0 2px", color: "var(--color-danger)", opacity: 0.6 }}>
                    <XMarkIcon style={{ width: "11px", height: "11px" }} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => openCreateOption(g.id)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "4px",
                  padding: "5px 10px", borderRadius: "999px",
                  background: "transparent", border: "1.5px dashed var(--color-gray-300)",
                  cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-gray-400)",
                  fontFamily: "var(--font)",
                }}
              >
                <PlusIcon style={{ width: "11px", height: "11px" }} />
                Aggiungi opzione
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Group modal */}
      <Modal open={groupModal} onClose={() => setGroupModal(false)} title={editGroup ? "Modifica gruppo" : "Nuovo gruppo opzioni"}>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={labelStyle}>Nome</label>
            <input style={inputStyle} value={groupForm.name} onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))} placeholder="Es. Cottura, Extras, Rimuovi..." autoFocus />
          </div>
          <div>
            <label style={labelStyle}>Tipo</label>
            <div style={{ display: "flex", gap: "8px" }}>
              {(["single", "multi", "removal"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setGroupForm((f) => ({ ...f, type: t }))}
                  style={{
                    flex: 1, padding: "10px 8px", borderRadius: "var(--radius-md)", fontFamily: "var(--font)",
                    border: `2px solid ${groupForm.type === t ? GROUP_TYPE_COLORS[t] : "var(--color-gray-200)"}`,
                    background: groupForm.type === t ? `${GROUP_TYPE_COLORS[t]}12` : "var(--color-white)",
                    color: groupForm.type === t ? GROUP_TYPE_COLORS[t] : "var(--color-gray-600)",
                    fontSize: "var(--text-xs)", fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
                  }}>
                  {GROUP_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
          {groupForm.type === "multi" && (
            <div>
              <label style={labelStyle}>Max selezioni</label>
              <input style={{ ...inputStyle, width: "100px" }} type="number" min="1" value={groupForm.maxSel}
                onChange={(e) => setGroupForm((f) => ({ ...f, maxSel: parseInt(e.target.value) || 1 }))} />
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button type="button" onClick={() => setGroupForm((f) => ({ ...f, required: !f.required }))}
              style={{ width: "40px", height: "22px", borderRadius: "11px", border: "none", background: groupForm.required ? "var(--color-brand)" : "var(--color-gray-300)", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
              <span style={{ position: "absolute", top: "2px", left: groupForm.required ? "19px" : "2px", width: "18px", height: "18px", borderRadius: "50%", background: "var(--color-white)", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
            </button>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-700)" }}>Obbligatorio</span>
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Button variant="ghost" size="sm" onClick={() => setGroupModal(false)}>Annulla</Button>
            <Button size="sm" loading={savingGroup} disabled={!groupForm.name.trim()} onClick={() => void handleSaveGroup()}>
              {editGroup ? "Salva" : "Crea"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete group confirm */}
      <Modal open={deleteGroupId !== null} onClose={() => setDeleteGroupId(null)} title="Elimina gruppo opzioni">
        <p style={{ color: "var(--color-gray-600)", fontSize: "var(--text-sm)", marginBottom: "20px" }}>
          Tutte le opzioni del gruppo verranno eliminate. Continuare?
        </p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <Button variant="ghost" size="sm" onClick={() => setDeleteGroupId(null)}>Annulla</Button>
          <Button variant="danger" size="sm" onClick={() => deleteGroupId && void handleDeleteGroup(deleteGroupId)}>Elimina</Button>
        </div>
      </Modal>

      {/* Option modal */}
      <Modal open={optionModal !== null} onClose={() => setOptionModal(null)} title={editOption ? "Modifica opzione" : "Nuova opzione"}>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={labelStyle}>Tipo</label>
            <div style={{ display: "flex", gap: "6px" }}>
              {(["+", "-", ">>"] as const).map((p) => {
                const labels: Record<string, string> = { "+": "+ Aggiunta", "-": "− Rimozione", ">>": ">> Nota" };
                const colors: Record<string, string> = { "+": "var(--color-brand)", "-": "var(--color-danger)", ">>": "var(--color-gray-500)" };
                const isActive = optionForm.prefix === p;
                return (
                  <button key={p} type="button" onClick={() => setOptionForm((f) => ({ ...f, prefix: p }))}
                    style={{
                      flex: 1, padding: "8px 6px", borderRadius: "var(--radius-md)", fontFamily: "var(--font)",
                      border: `2px solid ${isActive ? colors[p] : "var(--color-gray-200)"}`,
                      background: isActive ? `${colors[p]}12` : "var(--color-white)",
                      color: isActive ? colors[p] : "var(--color-gray-500)",
                      fontSize: "var(--text-xs)", fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
                    }}>
                    {labels[p]}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Nome</label>
            <input style={inputStyle} value={optionForm.name} onChange={(e) => setOptionForm((f) => ({ ...f, name: e.target.value }))} placeholder="Es. Bacon, Cipolla, Al sangue..." autoFocus />
          </div>
          <div>
            <label style={labelStyle}>Variazione prezzo (€)</label>
            <input style={{ ...inputStyle, width: "140px" }} type="number" step="0.01" value={optionForm.priceDelta}
              onChange={(e) => setOptionForm((f) => ({ ...f, priceDelta: e.target.value }))} placeholder="0.00" />
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", marginTop: "4px" }}>
              0 = gratuito · positivo = extra · negativo = sconto
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Button variant="ghost" size="sm" onClick={() => setOptionModal(null)}>Annulla</Button>
            <Button size="sm" loading={savingOption} disabled={!optionForm.name.trim()} onClick={() => void handleSaveOption()}>
              {editOption ? "Salva" : "Aggiungi"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete option confirm */}
      <Modal open={deleteOption_ !== null} onClose={() => setDeleteOption_(null)} title="Elimina opzione">
        <p style={{ color: "var(--color-gray-600)", fontSize: "var(--text-sm)", marginBottom: "20px" }}>
          Sei sicuro di voler eliminare questa opzione?
        </p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <Button variant="ghost" size="sm" onClick={() => setDeleteOption_(null)}>Annulla</Button>
          <Button variant="danger" size="sm" onClick={() => deleteOption_ && void handleDeleteOption(deleteOption_.groupId, deleteOption_.optionId)}>Elimina</Button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Products Tab ─────────────────────────────────────────────────────────────

interface ProductFormData {
  name: string;
  price: string;
  categoryId: string;
  productionCenterId: string;
  active: boolean;
  color: string;
  imageData: string | null;
  description: string;
  vatRate: string;
  receiptPrintMode: "inherit" | "included" | "separate";
}

function IngredientsModal({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const [items, setItems] = useState<InventoryItemRecord[]>([]);
  const [ingredients, setIngredients] = useState<ProductIngredientRecord[]>([]);
  const [loading_, setLoading_] = useState(false);
  const [adding, setAdding] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [qty, setQty] = useState("1");

  useEffect(() => {
    if (!product) return;
    setLoading_(true);
    Promise.all([adminApi.inventory.listItems(), adminApi.inventory.getIngredients(product.id)])
      .then(([its, ings]) => { setItems(its); setIngredients(ings); })
      .catch(() => {})
      .finally(() => setLoading_(false));
  }, [product?.id]);

  async function handleAdd() {
    if (!product || !selectedItemId) return;
    setAdding(true);
    try {
      const created = await adminApi.inventory.createIngredient({ productId: product.id, inventoryItemId: selectedItemId, quantity: parseFloat(qty) || 1 });
      setIngredients((prev) => [...prev, created]);
      setSelectedItemId(""); setQty("1");
    } finally { setAdding(false); }
  }

  async function handleDelete(id: string) {
    await adminApi.inventory.deleteIngredient(id);
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  }

  const usedItemIds = new Set(ingredients.map((i) => i.inventoryItemId));
  const availableItems = items.filter((it) => !usedItemIds.has(it.id));

  return (
    <Modal open={product !== null} onClose={onClose} title={`Ingredienti — ${product?.name ?? ""}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: "360px" }}>
        {loading_ ? (
          <div style={{ textAlign: "center", color: "var(--color-gray-400)", padding: "20px" }}>Caricamento...</div>
        ) : (
          <>
            {ingredients.length === 0 && (
              <div style={{ color: "var(--color-gray-400)", fontSize: "var(--text-sm)", textAlign: "center", padding: "8px" }}>
                Nessun ingrediente configurato. Lo stock non verrà decrementato automaticamente.
              </div>
            )}
            {ingredients.map((ing) => {
              const item = items.find((it) => it.id === ing.inventoryItemId);
              return (
                <div key={ing.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: "var(--color-gray-50)", borderRadius: "var(--radius-md)" }}>
                  <span style={{ flex: 1, fontSize: "var(--text-sm)", fontWeight: 600 }}>{item?.name ?? ing.inventoryItemId}</span>
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)" }}>{ing.quantity} {item?.unit ?? ""}</span>
                  <button onClick={() => void handleDelete(ing.id)} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--color-danger)", padding: "2px" }}>
                    <TrashIcon style={{ width: "15px", height: "15px" }} />
                  </button>
                </div>
              );
            })}
            {availableItems.length > 0 && (
              <div style={{ display: "flex", gap: "8px", alignItems: "center", paddingTop: "4px", borderTop: "1px solid var(--color-gray-100)" }}>
                <select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)}
                  style={{ flex: 1, height: "38px", padding: "0 10px", borderRadius: "var(--radius-md)", border: "1.5px solid var(--color-gray-200)", fontFamily: "var(--font)", fontSize: "var(--text-sm)" }}>
                  <option value="">Seleziona item...</option>
                  {availableItems.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.unit})</option>)}
                </select>
                <input type="number" min="0.01" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)}
                  style={{ width: "70px", height: "38px", padding: "0 8px", borderRadius: "var(--radius-md)", border: "1.5px solid var(--color-gray-200)", fontFamily: "var(--font)", fontSize: "var(--text-sm)" }} />
                <Button size="sm" loading={adding} onClick={() => void handleAdd()} disabled={!selectedItemId}>Aggiungi</Button>
              </div>
            )}
          </>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button size="sm" variant="ghost" onClick={onClose}>Chiudi</Button>
        </div>
      </div>
    </Modal>
  );
}

function GridDefaultsSection() {
  const [gridViewMode, setGridViewMode] = useState<"category" | "all" | "grouped_category" | "grouped_center" | "grouped_color">("category");
  const [gridShowPrice, setGridShowPrice] = useState(true);
  const [gridShowDescription, setGridShowDescription] = useState(true);
  const [gridSortBy, setGridSortBy] = useState<"custom" | "name" | "price" | "color" | "category">("custom");
  const [gridBaseCols, setGridBaseCols] = useState(5);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminApi.settings.get().then((s) => {
      setGridViewMode(s.gridViewMode);
      setGridShowPrice(s.gridShowPrice);
      setGridShowDescription(s.gridShowDescription);
      setGridSortBy(s.gridSortBy);
      setGridBaseCols(s.gridBaseCols);
    }).catch(() => {});
  }, []);

  return (
    <div style={{ marginTop: "32px", paddingTop: "32px", borderTop: "1px solid var(--color-gray-200)" }}>
      <div style={{ fontWeight: 700, fontSize: "var(--text-md)", color: "var(--color-gray-900)", marginBottom: "4px" }}>
        Griglia POS — impostazioni default
      </div>
      <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)", marginBottom: "18px", lineHeight: 1.5 }}>
        Definisci la visualizzazione predefinita del grid prodotti. Il cassiere può sovrascrivere temporaneamente dal POS.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label style={{ ...labelStyle, display: "block", marginBottom: "8px" }}>Vista predefinita</label>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {([
              ["category",         "Per categoria",             "Sidebar con categorie, mostra i prodotti della categoria selezionata"],
              ["center",           "Per centro di produzione",  "Sidebar con centri di produzione, mostra i prodotti del centro selezionato"],
              ["all",              "Tutti i prodotti",          "Griglia piatta con tutti i prodotti attivi"],
              ["grouped_category", "Raggruppati per categoria", "Sezioni separate per ogni categoria"],
              ["grouped_center",   "Raggruppati per centro",    "Sezioni separate per centro di produzione"],
              ["grouped_color",    "Raggruppati per colore",    "Sezioni separate per colore prodotto"],
            ] as const).map(([val, label, desc]) => (
              <label key={val} style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
                <input type="radio" name="gridViewModeSection" value={val} checked={gridViewMode === val}
                  onChange={() => setGridViewMode(val)}
                  style={{ marginTop: "3px", accentColor: "var(--color-brand)" }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--color-gray-800)" }}>{label}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>{desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--color-gray-100)", paddingTop: "16px" }}>
          <label style={{ ...labelStyle, display: "block", marginBottom: "8px" }}>Colonne ({gridBaseCols})</label>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <input type="range" min={2} max={10} value={gridBaseCols}
              onChange={(e) => setGridBaseCols(Number(e.target.value))}
              style={{ flex: 1, accentColor: "var(--color-brand)" }} />
            <div style={{ display: "flex", gap: "6px" }}>
              {[3, 4, 5, 6, 8].map((n) => (
                <button key={n} onClick={() => setGridBaseCols(n)} style={{
                  padding: "4px 10px", borderRadius: "var(--radius-md)", border: "1px solid",
                  borderColor: gridBaseCols === n ? "var(--color-brand)" : "var(--color-gray-200)",
                  background: gridBaseCols === n ? "var(--color-brand)" : "var(--color-white)",
                  color: gridBaseCols === n ? "var(--color-white)" : "var(--color-gray-600)",
                  fontSize: "var(--text-xs)", fontWeight: 600, cursor: "pointer",
                }}>{n}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--color-gray-100)", paddingTop: "16px" }}>
          <div style={{ ...labelStyle, marginBottom: "10px" }}>Campi visibili sulle card</div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {([
              ["Prezzo", gridShowPrice, () => setGridShowPrice((v) => !v)] as [string, boolean, () => void],
              ["Descrizione", gridShowDescription, () => setGridShowDescription((v) => !v)] as [string, boolean, () => void],
            ]).map(([label, active, toggle]) => (
              <button key={label as string} onClick={toggle as () => void} style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "8px 14px", borderRadius: "var(--radius-md)", border: "1px solid",
                borderColor: active ? "var(--color-brand)" : "var(--color-gray-200)",
                background: active ? "rgba(48,107,52,0.07)" : "var(--color-white)",
                color: active ? "var(--color-brand)" : "var(--color-gray-500)",
                cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: 600,
              }}>
                <span style={{
                  width: 16, height: 16, borderRadius: "50%", border: "1.5px solid",
                  borderColor: active ? "var(--color-brand)" : "var(--color-gray-300)",
                  background: active ? "var(--color-brand)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  {active && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-white)" }} />}
                </span>
                {label as string}
              </button>
            ))}
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--color-gray-100)", paddingTop: "16px" }}>
          <label style={{ ...labelStyle, display: "block", marginBottom: "8px" }}>Ordinamento predefinito</label>
          <select value={gridSortBy} onChange={(e) => setGridSortBy(e.target.value as typeof gridSortBy)}
            style={{ ...inputStyle, maxWidth: "240px", cursor: "pointer" }}>
            <option value="custom">Personalizzato (drag & drop)</option>
            <option value="name">Nome</option>
            <option value="price">Prezzo</option>
            <option value="color">Colore</option>
            <option value="category">Categoria</option>
          </select>
        </div>

      </div>

      <div style={{ marginTop: "20px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <Button loading={saving} onClick={async () => {
          setSaving(true);
          try {
            await adminApi.settings.update({ gridViewMode, gridShowPrice, gridShowDescription, gridSortBy, gridBaseCols });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
          } catch { /* ignore */ } finally { setSaving(false); }
        }}>Salva impostazioni griglia</Button>
        {saved && <span style={{ fontSize: "var(--text-xs)", color: "var(--color-success, #059669)", fontWeight: 600 }}>Salvato</span>}
        <a href="/pos?editLayout=1" style={{
          display: "inline-flex", alignItems: "center", gap: "6px",
          padding: "10px 18px", borderRadius: "var(--radius-md)",
          border: "1.5px solid var(--color-brand)", background: "transparent", color: "var(--color-brand)",
          fontSize: "var(--text-sm)", fontWeight: 700, fontFamily: "var(--font)",
          textDecoration: "none", cursor: "pointer",
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" />
          </svg>
          Modifica layout POS
        </a>
      </div>
    </div>
  );
}

export function ProductsTab() {
  const { products, categories, productionCenters, upsertProduct, removeProduct, setProducts } = useAdminStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormData>({ name: "", price: "", categoryId: "", productionCenterId: "", active: true, color: "", imageData: null, description: "", vatRate: "10", receiptPrintMode: "inherit" });
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [ingredientsProduct, setIngredientsProduct] = useState<Product | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("");

  function openCreate() {
    setEditTarget(null);
    setForm({ name: "", price: "", categoryId: "", productionCenterId: "", active: true, color: "", imageData: null, description: "", vatRate: "10", receiptPrintMode: "inherit" });
    setModalOpen(true);
  }

  function openEdit(p: Product) {
    setEditTarget(p);
    setForm({
      name: p.name,
      price: String(p.price),
      categoryId: p.categoryId ?? "",
      productionCenterId: p.productionCenterId ?? "",
      active: p.active,
      color: p.color ?? "",
      imageData: p.imageData ?? null,
      description: p.description ?? "",
      vatRate: String(p.vatRate ?? 10),
      receiptPrintMode: p.receiptPrintMode,
    });
    setModalOpen(true);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!editTarget) return;
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5_000_000) {
      useToastStore.getState().show("Immagine troppo grande (max 5 MB)");
      e.target.value = "";
      return;
    }
    setImageUploading(true);
    try {
      const result = await adminApi.products.uploadImage(editTarget.id, file);
      setForm((f) => ({ ...f, imageData: `${result.imagePath}?t=${Date.now()}` }));
      const updated = await adminApi.products.list();
      const refreshed = updated.find((p) => p.id === editTarget.id);
      if (refreshed) upsertProduct(refreshed);
    } catch (err) {
      useToastStore.getState().show(err instanceof Error ? err.message : "Errore upload immagine");
    } finally {
      setImageUploading(false);
      e.target.value = "";
    }
  }

  async function handleImageDelete() {
    if (!editTarget) return;
    setImageUploading(true);
    try {
      await adminApi.products.deleteImage(editTarget.id);
      setForm((f) => ({ ...f, imageData: null }));
      const updated = await adminApi.products.list();
      const refreshed = updated.find((p) => p.id === editTarget.id);
      if (refreshed) upsertProduct(refreshed);
    } catch (err) {
      useToastStore.getState().show(err instanceof Error ? err.message : "Errore rimozione immagine");
    } finally {
      setImageUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const price = parseFloat(form.price);
      if (isNaN(price)) return;
      const vatRate = parseInt(form.vatRate, 10) || 10;
      if (editTarget) {
        const updated = await adminApi.products.update(editTarget.id, {
          name: form.name,
          price,
          categoryId: form.categoryId === "" ? null : form.categoryId,
          productionCenterId: form.productionCenterId === "" ? null : form.productionCenterId,
          active: form.active,
          color: form.color === "" ? null : form.color,
          description: form.description === "" ? null : form.description,
          vatRate,
          receiptPrintMode: form.receiptPrintMode,
        });
        upsertProduct(updated);
      } else {
        const created = await adminApi.products.create({
          name: form.name,
          price,
          ...(form.categoryId !== "" ? { categoryId: form.categoryId } : {}),
          ...(form.productionCenterId !== "" ? { productionCenterId: form.productionCenterId } : {}),
          active: form.active,
          color: form.color === "" ? null : form.color,
          ...(form.description !== "" ? { description: form.description } : {}),
          vatRate,
          receiptPrintMode: form.receiptPrintMode,
        });
        upsertProduct(created);
      }
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await adminApi.products.delete(id);
    removeProduct(id);
    setDeleteId(null);
  }

  async function handleToggleActive(p: Product) {
    const updated = await adminApi.products.update(p.id, { active: !p.active });
    upsertProduct(updated);
  }

  return (
    <div style={{ padding: "var(--sp-lg)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-lg)" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-800)", margin: 0 }}>
          Prodotti
        </h2>
        <Button size="sm" onClick={openCreate} icon={<PlusIcon style={{ width: "16px", height: "16px" }} />}>
          Nuovo prodotto
        </Button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "var(--sp-md)" }}>
        <input
          type="search"
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
          placeholder="Cerca prodotto…"
          style={{ ...inputStyle, flex: 1, height: "38px" }}
        />
        <select
          value={productCategoryFilter}
          onChange={(e) => setProductCategoryFilter(e.target.value)}
          style={{ ...inputStyle, flex: "0 0 180px", height: "38px", paddingRight: "8px" }}
        >
          <option value="">Tutte le categorie</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: "var(--color-white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={tableHeaderStyle}>Nome</th>
              <th style={tableHeaderStyle}>Categoria</th>
              <th style={tableHeaderStyle}>Centro produzione</th>
              <th style={tableHeaderStyle}>Prezzo</th>
              <th style={{ ...tableHeaderStyle, textAlign: "center" }}>Attivo</th>
              <th style={{ ...tableHeaderStyle, textAlign: "right" }}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...tableCellStyle, textAlign: "center", color: "var(--color-gray-400)", padding: "32px" }}>
                  Nessun prodotto. Clicca "Nuovo prodotto" per aggiungerne uno.
                </td>
              </tr>
            )}
            {products.filter((p) => {
              if (productSearch && !p.name.toLowerCase().includes(productSearch.toLowerCase())) return false;
              if (productCategoryFilter && p.categoryId !== productCategoryFilter) return false;
              return true;
            }).map((p) => {
              const isExpanded = expandedProductId === p.id;
              return (
                <React.Fragment key={p.id}>
                  <tr style={{ transition: "background var(--transition)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "var(--color-gray-50)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = isExpanded ? "var(--color-gray-50)" : ""; }}
                  >
                    <td style={{ ...tableCellStyle, fontWeight: 600, color: "var(--color-gray-800)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {p.color && (
                          <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: p.color, flexShrink: 0, display: "inline-block" }} />
                        )}
                        {p.name}
                      </div>
                    </td>
                    <td style={tableCellStyle}>{p.categoryName ?? <span style={{ color: "var(--color-gray-400)" }}>—</span>}</td>
                    <td style={tableCellStyle}>{productionCenters.find((pc) => pc.id === p.productionCenterId)?.name ?? <span style={{ color: "var(--color-gray-400)" }}>—</span>}</td>
                    <td style={{ ...tableCellStyle, fontWeight: 600 }}>€{p.price.toFixed(2)}</td>
                    <td style={{ ...tableCellStyle, textAlign: "center" }}>
                      <button
                        onClick={() => void handleToggleActive(p)}
                        style={{
                          width: "42px", height: "24px", borderRadius: "12px", border: "none",
                          background: p.active ? "var(--color-brand)" : "var(--color-gray-300)",
                          cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0,
                        }}
                      >
                        <span style={{
                          position: "absolute", top: "3px", left: p.active ? "20px" : "3px",
                          width: "18px", height: "18px", borderRadius: "50%",
                          background: "var(--color-white)", transition: "left 0.2s",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        }} />
                      </button>
                    </td>
                    <td style={{ ...tableCellStyle, textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                        <button
                          onClick={() => setExpandedProductId(isExpanded ? null : p.id)}
                          title="Opzioni configurabili"
                          style={{
                            padding: "6px 10px", borderRadius: "var(--radius-md)",
                            border: isExpanded ? "1px solid var(--color-brand)" : "1px solid var(--color-gray-200)",
                            background: isExpanded ? "rgba(48,107,52,0.06)" : "var(--color-white)",
                            cursor: "pointer",
                            color: isExpanded ? "var(--color-brand)" : "var(--color-gray-500)",
                            display: "flex", alignItems: "center", gap: "4px",
                            fontSize: "var(--text-xs)", fontWeight: 600, fontFamily: "var(--font)",
                          }}
                        >
                          <CubeIcon style={{ width: "13px", height: "13px" }} />
                          Opzioni
                        </button>
                        <button
                          onClick={() => setIngredientsProduct(p)}
                          title="Ingredienti inventario"
                          style={{
                            padding: "6px 10px", borderRadius: "var(--radius-md)",
                            border: "1px solid var(--color-gray-200)",
                            background: "var(--color-white)", cursor: "pointer",
                            color: "var(--color-gray-500)",
                            display: "flex", alignItems: "center", gap: "4px",
                            fontSize: "var(--text-xs)", fontWeight: 600, fontFamily: "var(--font)",
                          }}
                        >
                          <CircleStackIcon style={{ width: "13px", height: "13px" }} />
                          Ingredienti
                        </button>
                        <button onClick={() => openEdit(p)} title="Modifica"
                          style={{ padding: "6px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-gray-200)", background: "var(--color-white)", cursor: "pointer", color: "var(--color-gray-600)", display: "flex", alignItems: "center" }}>
                          <PencilSquareIcon style={{ width: "16px", height: "16px" }} />
                        </button>
                        <button onClick={() => setDeleteId(p.id)} title="Elimina"
                          style={{ padding: "6px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-danger)", background: "var(--color-white)", cursor: "pointer", color: "var(--color-danger)", display: "flex", alignItems: "center" }}>
                          <TrashIcon style={{ width: "16px", height: "16px" }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={6} style={{ padding: 0, borderBottom: "1px solid var(--color-gray-200)" }}>
                        <OptionGroupsPanel product={p} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? "Modifica prodotto" : "Nuovo prodotto"}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Nome</label>
            <input
              style={inputStyle}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nome prodotto"
            />
          </div>
          <div>
            <label style={labelStyle}>Prezzo (€)</label>
            <input
              style={inputStyle}
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              placeholder="0.00"
            />
          </div>
          <div>
            <label style={labelStyle}>Aliquota IVA</label>
            <select
              style={{ ...inputStyle, cursor: "pointer" }}
              value={form.vatRate}
              onChange={(e) => setForm((f) => ({ ...f, vatRate: e.target.value }))}
            >
              <option value="4">4% — beni di prima necessità</option>
              <option value="5">5% — ridotta speciale</option>
              <option value="10">10% — ridotta (ristorazione)</option>
              <option value="22">22% — ordinaria</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Stampa scontrino</label>
            <select
              style={{ ...inputStyle, cursor: "pointer" }}
              value={form.receiptPrintMode}
              onChange={(e) => setForm((f) => ({ ...f, receiptPrintMode: e.target.value as "inherit" | "included" | "separate" }))}
            >
              <option value="inherit">Eredita dal centro di produzione</option>
              <option value="included">Incluso nello scontrino unico</option>
              <option value="separate">Scontrino separato (documento a parte)</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Descrizione</label>
            <textarea
              style={{ ...inputStyle, resize: "vertical", minHeight: "72px", lineHeight: 1.5 }}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Descrizione opzionale del prodotto"
            />
          </div>
          <div>
            <label style={labelStyle}>Categoria</label>
            <select
              style={{ ...inputStyle, cursor: "pointer" }}
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
            >
              <option value="">Nessuna categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Centro di produzione</label>
            <select
              style={{ ...inputStyle, cursor: "pointer" }}
              value={form.productionCenterId}
              onChange={(e) => setForm((f) => ({ ...f, productionCenterId: e.target.value }))}
            >
              <option value="">Nessun centro</option>
              {productionCenters.map((pc) => (
                <option key={pc.id} value={pc.id}>{pc.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
              style={{
                width: "42px",
                height: "24px",
                borderRadius: "12px",
                border: "none",
                background: form.active ? "var(--color-brand)" : "var(--color-gray-300)",
                cursor: "pointer",
                position: "relative",
                transition: "background 0.2s",
                flexShrink: 0,
              }}
            >
              <span style={{
                position: "absolute",
                top: "3px",
                left: form.active ? "20px" : "3px",
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                background: "var(--color-white)",
                transition: "left 0.2s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }} />
            </button>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-700)" }}>
              {form.active ? "Attivo" : "Non attivo"}
            </span>
          </div>
          <ColorField value={form.color} onChange={(v) => setForm((f) => ({ ...f, color: v }))} />

          {/* Image upload — only available in edit mode */}
          <div>
            <label style={labelStyle}>Immagine prodotto</label>
            {editTarget ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {form.imageData && (
                  <img
                    src={form.imageData.startsWith("/") ? form.imageData : `/api/static/${form.imageData}`}
                    alt="Anteprima"
                    style={{ width: "100%", maxHeight: "140px", objectFit: "cover", borderRadius: "var(--radius-md)", border: "1px solid var(--color-gray-200)" }}
                  />
                )}
                <div style={{ display: "flex", gap: "8px" }}>
                  <label style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-gray-300)",
                    background: "var(--color-gray-50)",
                    cursor: imageUploading ? "not-allowed" : "pointer",
                    fontSize: "var(--text-sm)",
                    fontWeight: 500,
                    color: "var(--color-gray-700)",
                    opacity: imageUploading ? 0.6 : 1,
                  }}>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      style={{ display: "none" }}
                      disabled={imageUploading}
                      onChange={(e) => void handleImageUpload(e)}
                    />
                    {imageUploading ? "Caricamento…" : form.imageData ? "Sostituisci" : "Carica immagine"}
                  </label>
                  {form.imageData && (
                    <button
                      onClick={() => void handleImageDelete()}
                      disabled={imageUploading}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid rgba(239,68,68,0.4)",
                        background: "rgba(239,68,68,0.08)",
                        color: "var(--color-danger)",
                        cursor: imageUploading ? "not-allowed" : "pointer",
                        fontSize: "var(--text-sm)",
                        fontWeight: 500,
                        fontFamily: "var(--font)",
                      }}
                    >
                      Rimuovi
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-400)", padding: "10px 0" }}>
                Salva il prodotto prima di caricare un'immagine.
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "4px" }}>
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>Annulla</Button>
            <Button size="sm" loading={saving} onClick={() => void handleSave()}>
              {editTarget ? "Salva modifiche" : "Crea prodotto"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm modal */}
      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Elimina prodotto">
        <p style={{ color: "var(--color-gray-600)", fontSize: "var(--text-sm)", marginBottom: "20px" }}>
          Sei sicuro di voler eliminare questo prodotto? L'azione non è reversibile.
        </p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <Button variant="ghost" size="sm" onClick={() => setDeleteId(null)}>Annulla</Button>
          <Button variant="danger" size="sm" onClick={() => deleteId && void handleDelete(deleteId)}>
            Elimina
          </Button>
        </div>
      </Modal>

      <IngredientsModal product={ingredientsProduct} onClose={() => setIngredientsProduct(null)} />

      <GridDefaultsSection />
    </div>
  );
}
