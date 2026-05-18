import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "../../components/ui/Modal.js";
import { Button } from "../../components/ui/Button.js";
import { adminApi } from "../../core/admin-api.js";
import { useAdminStore } from "../../state/admin-store.js";
import type { Category, Product, ProductionCenter, OptionGroupWithOptions, Option, PaymentMethodRecord, Printer, ReceiptTemplate } from "@pos/shared-types";
import {
  CubeIcon,
  TagIcon,
  BuildingStorefrontIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  ArrowLeftIcon,
  WrenchScrewdriverIcon,
  BanknotesIcon,
  PrinterIcon,
  DocumentTextIcon,
  ClockIcon,
  ArrowDownTrayIcon,
} from "../../components/ui/icons.js";
import { BackupTab } from "./BackupTab.js";

// ─── Tab types ───────────────────────────────────────────────────────────────

type Tab = "products" | "categories" | "production-centers" | "payment-methods" | "printers" | "receipt-template" | "shifts" | "backup";

const TABS: { key: Tab; label: string; Icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }[] = [
  { key: "products", label: "Prodotti", Icon: CubeIcon },
  { key: "categories", label: "Categorie", Icon: TagIcon },
  { key: "production-centers", label: "Centri di produzione", Icon: BuildingStorefrontIcon },
  { key: "payment-methods", label: "Metodi pagamento", Icon: BanknotesIcon },
  { key: "printers", label: "Stampanti", Icon: PrinterIcon },
  { key: "receipt-template", label: "Scontrino", Icon: DocumentTextIcon },
  { key: "shifts", label: "Turni", Icon: ClockIcon },
  { key: "backup", label: "Backup", Icon: ArrowDownTrayIcon },
];

// ─── Styles helpers ───────────────────────────────────────────────────────────

const tableHeaderStyle: React.CSSProperties = {
  padding: "10px 16px",
  textAlign: "left",
  fontSize: "var(--text-xs)",
  fontWeight: 700,
  color: "var(--color-gray-500)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  borderBottom: "1px solid var(--color-gray-200)",
  background: "var(--color-gray-50)",
};

const tableCellStyle: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: "var(--text-sm)",
  color: "var(--color-gray-700)",
  borderBottom: "1px solid var(--color-gray-100)",
  verticalAlign: "middle",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: "44px",
  padding: "0 14px",
  borderRadius: "var(--radius-lg)",
  border: "2px solid var(--color-gray-200)",
  fontSize: "var(--text-md)",
  fontFamily: "var(--font)",
  color: "var(--color-gray-800)",
  background: "var(--color-white)",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "var(--text-sm)",
  fontWeight: 600,
  color: "var(--color-gray-600)",
  marginBottom: "6px",
};

// ─── Color Field ─────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280", "#1e293b",
];

function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={labelStyle}>Colore</label>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(value === c ? "" : c)}
            title={c}
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: c,
              border: value === c ? "3px solid var(--color-gray-800)" : "2px solid transparent",
              outline: value === c ? "2px solid var(--color-white)" : "none",
              outlineOffset: value === c ? "-4px" : "0",
              cursor: "pointer",
              flexShrink: 0,
              transition: "border 0.15s",
            }}
          />
        ))}
        <input
          type="color"
          value={value || "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          title="Colore personalizzato"
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "50%",
            border: "2px solid var(--color-gray-300)",
            padding: 0,
            cursor: "pointer",
            background: "none",
          }}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-gray-400)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              textDecoration: "underline",
            }}
          >
            Rimuovi
          </button>
        )}
      </div>
    </div>
  );
}

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
  const [optionForm, setOptionForm] = useState({ name: "", priceDelta: "0" });
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
    setOptionForm({ name: "", priceDelta: "0" });
    setOptionModal({ groupId });
  }
  function openEditOption(groupId: string, o: Option) {
    setEditOption(o);
    setOptionForm({ name: o.name, priceDelta: String(o.priceDelta) });
    setOptionModal({ groupId });
  }
  async function handleSaveOption() {
    if (!optionModal) return;
    setSavingOption(true);
    try {
      const delta = parseFloat(optionForm.priceDelta) || 0;
      if (editOption) {
        const updated = await adminApi.optionGroups.updateOption(editOption.id, { name: optionForm.name, priceDelta: delta });
        upsertOption(product.id, optionModal.groupId, updated);
      } else {
        const created = await adminApi.optionGroups.createOption(optionModal.groupId, { name: optionForm.name, priceDelta: delta });
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
  active: boolean;
  color: string;
}

function ProductsTab() {
  const { products, categories, upsertProduct, removeProduct, setProducts } = useAdminStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormData>({ name: "", price: "", categoryId: "", active: true, color: "" });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  function openCreate() {
    setEditTarget(null);
    setForm({ name: "", price: "", categoryId: "", active: true, color: "" });
    setModalOpen(true);
  }

  function openEdit(p: Product) {
    setEditTarget(p);
    setForm({
      name: p.name,
      price: String(p.price),
      categoryId: p.categoryId ?? "",
      active: p.active,
      color: p.color ?? "",
    });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const price = parseFloat(form.price);
      if (isNaN(price)) return;
      if (editTarget) {
        const updated = await adminApi.products.update(editTarget.id, {
          name: form.name,
          price,
          categoryId: form.categoryId === "" ? null : form.categoryId,
          active: form.active,
          color: form.color === "" ? null : form.color,
        });
        upsertProduct(updated);
      } else {
        const created = await adminApi.products.create({
          name: form.name,
          price,
          ...(form.categoryId !== "" ? { categoryId: form.categoryId } : {}),
          active: form.active,
          color: form.color === "" ? null : form.color,
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

      {/* Table */}
      <div style={{ background: "var(--color-white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={tableHeaderStyle}>Nome</th>
              <th style={tableHeaderStyle}>Categoria</th>
              <th style={tableHeaderStyle}>Prezzo</th>
              <th style={{ ...tableHeaderStyle, textAlign: "center" }}>Attivo</th>
              <th style={{ ...tableHeaderStyle, textAlign: "right" }}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan={5} style={{ ...tableCellStyle, textAlign: "center", color: "var(--color-gray-400)", padding: "32px" }}>
                  Nessun prodotto. Clicca "Nuovo prodotto" per aggiungerne uno.
                </td>
              </tr>
            )}
            {products.map((p) => {
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
                      <td colSpan={5} style={{ padding: 0, borderBottom: "1px solid var(--color-gray-200)" }}>
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
    </div>
  );
}

// ─── Categories Tab ───────────────────────────────────────────────────────────

function CategoriesTab() {
  const { categories, upsertCategory, removeCategory } = useAdminStore();
  const [newName, setNewName] = useState("");
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleAdd() {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const created = await adminApi.categories.create({ name: newName.trim() });
      upsertCategory(created);
      setNewName("");
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

// ─── Production Centers Tab ───────────────────────────────────────────────────

function ProductionCentersTab() {
  const { productionCenters, categories, upsertProductionCenter, removeProductionCenter } = useAdminStore();

  // Per-center assigned categories (loaded lazily)
  const [centerCategories, setCenterCategories] = useState<Record<string, Category[]>>({});
  const [loadedCenters, setLoadedCenters] = useState<Set<string>>(new Set());

  // Modal: new center
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newCenterName, setNewCenterName] = useState("");
  const [newCenterColor, setNewCenterColor] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit center
  const [editTarget, setEditTarget] = useState<ProductionCenter | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Delete center
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Dropdown for adding category to a center
  const [addDropdown, setAddDropdown] = useState<string | null>(null);

  async function loadCenterCategories(centerId: string) {
    if (loadedCenters.has(centerId)) return;
    const cats = await adminApi.productionCenters.getCategories(centerId);
    setCenterCategories((prev) => ({ ...prev, [centerId]: cats }));
    setLoadedCenters((prev) => new Set(prev).add(centerId));
  }

  useEffect(() => {
    productionCenters.forEach((pc) => void loadCenterCategories(pc.id));
  }, [productionCenters]);

  async function handleCreate() {
    if (!newCenterName.trim()) return;
    setCreating(true);
    try {
      const created = await adminApi.productionCenters.create({
        name: newCenterName.trim(),
        color: newCenterColor === "" ? null : newCenterColor,
      });
      upsertProductionCenter(created);
      setCenterCategories((prev) => ({ ...prev, [created.id]: [] }));
      setLoadedCenters((prev) => new Set(prev).add(created.id));
      setNewCenterName("");
      setNewCenterColor("");
      setCreateModalOpen(false);
    } finally {
      setCreating(false);
    }
  }

  function startEdit(pc: ProductionCenter) {
    setEditTarget(pc);
    setEditName(pc.name);
    setEditColor(pc.color ?? "");
  }

  async function handleEditSave() {
    if (!editTarget || !editName.trim()) return;
    setEditSaving(true);
    try {
      const updated = await adminApi.productionCenters.update(editTarget.id, {
        name: editName.trim(),
        color: editColor === "" ? null : editColor,
      });
      upsertProductionCenter(updated);
      setEditTarget(null);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await adminApi.productionCenters.delete(id);
    removeProductionCenter(id);
    setCenterCategories((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setDeleteId(null);
  }

  async function handleAssignCategory(centerId: string, categoryId: string) {
    await adminApi.productionCenters.assignCategory(centerId, categoryId);
    const cat = categories.find((c) => c.id === categoryId);
    if (cat) {
      setCenterCategories((prev) => ({
        ...prev,
        [centerId]: [...(prev[centerId] ?? []), cat],
      }));
    }
    setAddDropdown(null);
  }

  async function handleRemoveCategory(centerId: string, categoryId: string) {
    await adminApi.productionCenters.removeCategory(centerId, categoryId);
    setCenterCategories((prev) => ({
      ...prev,
      [centerId]: (prev[centerId] ?? []).filter((c) => c.id !== categoryId),
    }));
  }

  return (
    <div style={{ padding: "var(--sp-lg)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-lg)" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-800)", margin: 0 }}>
          Centri di produzione
        </h2>
        <Button
          size="sm"
          onClick={() => setCreateModalOpen(true)}
          icon={<PlusIcon style={{ width: "16px", height: "16px" }} />}
        >
          Nuovo centro
        </Button>
      </div>

      {productionCenters.length === 0 && (
        <div style={{
          background: "var(--color-white)",
          borderRadius: "var(--radius-xl)",
          padding: "32px",
          textAlign: "center",
          color: "var(--color-gray-400)",
          fontSize: "var(--text-sm)",
          boxShadow: "var(--shadow-sm)",
        }}>
          Nessun centro di produzione. Clicca "Nuovo centro" per aggiungerne uno.
        </div>
      )}

      {/* Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        gap: "16px",
      }}>
        {productionCenters.map((pc) => {
          const assigned = centerCategories[pc.id] ?? [];
          const unassigned = categories.filter((c) => !assigned.some((a) => a.id === c.id));
          const isDropdownOpen = addDropdown === pc.id;

          return (
            <div
              key={pc.id}
              style={{
                background: "var(--color-white)",
                borderRadius: "var(--radius-xl)",
                boxShadow: "var(--shadow-sm)",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <BuildingStorefrontIcon style={{ width: "20px", height: "20px", color: pc.color ?? "var(--color-brand)", flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: "var(--text-md)", fontWeight: 700, color: "var(--color-gray-800)" }}>
                  {pc.name}
                </span>
                <button
                  onClick={() => startEdit(pc)}
                  title="Modifica"
                  style={{
                    padding: "5px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-gray-200)",
                    background: "var(--color-white)",
                    cursor: "pointer",
                    color: "var(--color-gray-500)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <PencilSquareIcon style={{ width: "14px", height: "14px" }} />
                </button>
                <button
                  onClick={() => setDeleteId(pc.id)}
                  title="Elimina"
                  style={{
                    padding: "5px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-danger)",
                    background: "var(--color-white)",
                    cursor: "pointer",
                    color: "var(--color-danger)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <TrashIcon style={{ width: "14px", height: "14px" }} />
                </button>
              </div>

              {/* Assigned categories as tags */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", minHeight: "28px" }}>
                {assigned.map((cat) => (
                  <span
                    key={cat.id}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "3px 10px 3px 10px",
                      borderRadius: "20px",
                      background: "rgba(48,107,52,0.1)",
                      color: "var(--color-brand)",
                      fontSize: "var(--text-xs)",
                      fontWeight: 600,
                    }}
                  >
                    {cat.name}
                    <button
                      onClick={() => void handleRemoveCategory(pc.id, cat.id)}
                      title="Rimuovi"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "0",
                        color: "var(--color-brand)",
                        opacity: 0.7,
                      }}
                    >
                      <XMarkIcon style={{ width: "12px", height: "12px" }} />
                    </button>
                  </span>
                ))}
                {assigned.length === 0 && (
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", alignSelf: "center" }}>
                    Nessuna categoria assegnata
                  </span>
                )}
              </div>

              {/* Add category */}
              {unassigned.length > 0 && (
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setAddDropdown(isDropdownOpen ? null : pc.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "5px 12px",
                      borderRadius: "20px",
                      border: "1.5px dashed var(--color-gray-300)",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: "var(--text-xs)",
                      fontWeight: 600,
                      color: "var(--color-gray-500)",
                      transition: "border-color var(--transition), color var(--transition)",
                    }}
                  >
                    <PlusIcon style={{ width: "12px", height: "12px" }} />
                    Aggiungi categoria
                  </button>

                  {isDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        left: 0,
                        background: "var(--color-white)",
                        borderRadius: "var(--radius-lg)",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
                        border: "1px solid var(--color-gray-200)",
                        minWidth: "200px",
                        zIndex: 100,
                        overflow: "hidden",
                      }}
                    >
                      {unassigned.map((cat, i) => (
                        <button
                          key={cat.id}
                          onClick={() => void handleAssignCategory(pc.id, cat.id)}
                          style={{
                            width: "100%",
                            padding: "10px 14px",
                            border: "none",
                            borderBottom: i < unassigned.length - 1 ? "1px solid var(--color-gray-100)" : "none",
                            background: "transparent",
                            cursor: "pointer",
                            textAlign: "left",
                            fontSize: "var(--text-sm)",
                            fontWeight: 500,
                            color: "var(--color-gray-700)",
                            fontFamily: "var(--font)",
                            transition: "background var(--transition)",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-gray-50)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = ""; }}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create Modal */}
      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Nuovo centro di produzione">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Nome</label>
            <input
              style={inputStyle}
              value={newCenterName}
              onChange={(e) => setNewCenterName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
              placeholder="Es. Cucina, Bar, Pizzeria..."
              autoFocus
            />
          </div>
          <ColorField value={newCenterColor} onChange={setNewCenterColor} />
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Button variant="ghost" size="sm" onClick={() => setCreateModalOpen(false)}>Annulla</Button>
            <Button size="sm" loading={creating} disabled={!newCenterName.trim()} onClick={() => void handleCreate()}>
              Crea
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={editTarget !== null} onClose={() => setEditTarget(null)} title="Modifica centro">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Nome</label>
            <input
              style={inputStyle}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleEditSave(); }}
              placeholder="Nome centro"
              autoFocus
            />
          </div>
          <ColorField value={editColor} onChange={setEditColor} />
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Button variant="ghost" size="sm" onClick={() => setEditTarget(null)}>Annulla</Button>
            <Button size="sm" loading={editSaving} onClick={() => void handleEditSave()}>Salva</Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm modal */}
      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Elimina centro di produzione">
        <p style={{ color: "var(--color-gray-600)", fontSize: "var(--text-sm)", marginBottom: "20px" }}>
          Sei sicuro di voler eliminare questo centro? Tutte le associazioni con le categorie verranno rimosse.
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

// ─── Toggle helper ───────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        width: "42px", height: "24px", borderRadius: "12px", border: "none",
        background: value ? "var(--color-brand)" : "var(--color-gray-300)",
        cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: "3px", left: value ? "20px" : "3px",
        width: "18px", height: "18px", borderRadius: "50%",
        background: "var(--color-white)", transition: "left 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </button>
  );
}

// ─── Payment Methods Tab ──────────────────────────────────────────────────────

function PaymentMethodsTab() {
  const { paymentMethods, setPaymentMethods, upsertPaymentMethod, removePaymentMethod } = useAdminStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PaymentMethodRecord | null>(null);
  const [form, setForm] = useState({ name: "", type: "cash", icon: "" });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    adminApi.paymentMethods.list().then(setPaymentMethods).catch(console.error);
  }, []);

  function openCreate() {
    setEditTarget(null);
    setForm({ name: "", type: "cash", icon: "" });
    setModalOpen(true);
  }
  function openEdit(m: PaymentMethodRecord) {
    setEditTarget(m);
    setForm({ name: m.name, type: m.type, icon: m.icon ?? "" });
    setModalOpen(true);
  }
  async function handleSave() {
    setSaving(true);
    try {
      if (editTarget) {
        const updated = await adminApi.paymentMethods.update(editTarget.id, {
          name: form.name, type: form.type, icon: form.icon === "" ? null : form.icon,
        });
        upsertPaymentMethod(updated);
      } else {
        const created = await adminApi.paymentMethods.create({
          name: form.name, type: form.type, icon: form.icon === "" ? null : form.icon,
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
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>{m.type}</div>
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

// ─── Printers Tab ─────────────────────────────────────────────────────────────

function PrintersTab() {
  const { printers, setPrinters, upsertPrinter, removePrinter } = useAdminStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Printer | null>(null);
  const [form, setForm] = useState({ name: "", host: "", port: "", receiptEnabled: false, kitchenEnabled: false });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  useEffect(() => {
    adminApi.printers.list().then(setPrinters).catch(console.error);
  }, []);

  function openCreate() {
    setEditTarget(null);
    setForm({ name: "", host: "", port: "", receiptEnabled: false, kitchenEnabled: false });
    setModalOpen(true);
  }
  function openEdit(p: Printer) {
    setEditTarget(p);
    setForm({ name: p.name, host: p.host ?? "", port: p.port ? String(p.port) : "", receiptEnabled: p.receiptEnabled, kitchenEnabled: p.kitchenEnabled });
    setModalOpen(true);
  }
  async function handleSave() {
    setSaving(true);
    try {
      if (editTarget) {
        const updated = await adminApi.printers.update(editTarget.id, {
          name: form.name,
          host: form.host === "" ? null : form.host,
          port: form.port === "" ? null : parseInt(form.port),
          receiptEnabled: form.receiptEnabled,
          kitchenEnabled: form.kitchenEnabled,
        });
        upsertPrinter(updated);
      } else {
        const createData: Parameters<typeof adminApi.printers.create>[0] = {
          name: form.name,
          receiptEnabled: form.receiptEnabled,
          kitchenEnabled: form.kitchenEnabled,
        };
        if (form.host !== "") createData.host = form.host;
        if (form.port !== "") createData.port = parseInt(form.port);
        const created = await adminApi.printers.create(createData);
        upsertPrinter(created);
      }
      setModalOpen(false);
    } finally { setSaving(false); }
  }
  async function handleDelete(id: string) {
    await adminApi.printers.delete(id);
    removePrinter(id);
    setDeleteId(null);
  }
  async function handleTestPrint(id: string) {
    setTestingId(id);
    try {
      const result = await adminApi.printers.testPrint(id);
      setTestResult((prev) => ({ ...prev, [id]: result.message }));
    } catch (e) {
      setTestResult((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : "Errore" }));
    } finally { setTestingId(null); }
  }

  return (
    <div style={{ padding: "var(--sp-lg)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-lg)" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-800)", margin: 0 }}>Stampanti</h2>
        <Button size="sm" onClick={openCreate} icon={<PlusIcon style={{ width: "16px", height: "16px" }} />}>Nuova stampante</Button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {printers.length === 0 && (
          <div style={{ background: "var(--color-white)", borderRadius: "var(--radius-xl)", padding: "32px", textAlign: "center", color: "var(--color-gray-400)", fontSize: "var(--text-sm)", boxShadow: "var(--shadow-sm)" }}>
            Nessuna stampante configurata.
          </div>
        )}
        {printers.map((p) => (
          <div key={p.id} style={{ background: "var(--color-white)", borderRadius: "var(--radius-lg)", padding: "14px 16px", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <PrinterIcon style={{ width: "18px", height: "18px", color: "var(--color-brand)", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--color-gray-800)" }}>{p.name}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>
                  {p.host ? `${p.host}${p.port ? `:${p.port}` : ""}` : "Locale"}
                  {p.receiptEnabled && " · Scontrini"}
                  {p.kitchenEnabled && " · Cucina"}
                </div>
              </div>
              <Button size="sm" variant="secondary" loading={testingId === p.id} onClick={() => void handleTestPrint(p.id)}>
                Test
              </Button>
              <button onClick={() => openEdit(p)} style={{ padding: "6px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-gray-200)", background: "var(--color-white)", cursor: "pointer", color: "var(--color-gray-600)", display: "flex" }}>
                <PencilSquareIcon style={{ width: "16px", height: "16px" }} />
              </button>
              <button onClick={() => setDeleteId(p.id)} style={{ padding: "6px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-danger)", background: "var(--color-white)", cursor: "pointer", color: "var(--color-danger)", display: "flex" }}>
                <TrashIcon style={{ width: "16px", height: "16px" }} />
              </button>
            </div>
            {testResult[p.id] && (
              <div style={{ marginTop: "8px", padding: "8px 12px", background: "var(--color-gray-50)", borderRadius: "var(--radius-md)", fontSize: "var(--text-xs)", color: "var(--color-gray-600)" }}>
                {testResult[p.id]}
              </div>
            )}
          </div>
        ))}
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? "Modifica stampante" : "Nuova stampante"}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Nome</label>
            <input style={inputStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Es. Cassa, Cucina, Bar..." autoFocus />
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>Host / IP</label>
              <input style={inputStyle} value={form.host} onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} placeholder="192.168.1.x" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Porta</label>
              <input style={inputStyle} type="number" value={form.port} onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))} placeholder="9100" />
            </div>
          </div>
          <div style={{ display: "flex", gap: "20px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <Toggle value={form.receiptEnabled} onChange={(v) => setForm((f) => ({ ...f, receiptEnabled: v }))} />
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-700)" }}>Scontrini</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <Toggle value={form.kitchenEnabled} onChange={(v) => setForm((f) => ({ ...f, kitchenEnabled: v }))} />
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-700)" }}>Cucina</span>
            </label>
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>Annulla</Button>
            <Button size="sm" loading={saving} disabled={!form.name.trim()} onClick={() => void handleSave()}>{editTarget ? "Salva" : "Aggiungi"}</Button>
          </div>
        </div>
      </Modal>
      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Elimina stampante">
        <p style={{ color: "var(--color-gray-600)", fontSize: "var(--text-sm)", marginBottom: "20px" }}>Eliminare questa stampante?</p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <Button variant="ghost" size="sm" onClick={() => setDeleteId(null)}>Annulla</Button>
          <Button variant="danger" size="sm" onClick={() => deleteId && void handleDelete(deleteId)}>Elimina</Button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Receipt Template Tab ─────────────────────────────────────────────────────

function ReceiptTemplateTab() {
  const { receiptTemplates, setReceiptTemplates, upsertReceiptTemplate } = useAdminStore();
  const [saving, setSaving] = useState(false);

  // Use the first active template or the first template overall
  const template: ReceiptTemplate | null = receiptTemplates.find((t) => t.active) ?? receiptTemplates[0] ?? null;

  const [form, setForm] = useState({
    headerText: "",
    footerText: "",
    showLogo: false,
    showOrderNumber: true,
    showTimestamp: true,
    showPaymentMethod: true,
  });

  useEffect(() => {
    adminApi.receiptTemplates.list().then((ts) => {
      setReceiptTemplates(ts);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (template) {
      setForm({
        headerText: template.headerText ?? "",
        footerText: template.footerText ?? "",
        showLogo: template.showLogo,
        showOrderNumber: template.showOrderNumber,
        showTimestamp: template.showTimestamp,
        showPaymentMethod: template.showPaymentMethod,
      });
    }
  }, [template?.id]);

  async function handleSave() {
    setSaving(true);
    try {
      if (template) {
        const updated = await adminApi.receiptTemplates.update(template.id, {
          headerText: form.headerText === "" ? null : form.headerText,
          footerText: form.footerText === "" ? null : form.footerText,
          showLogo: form.showLogo,
          showOrderNumber: form.showOrderNumber,
          showTimestamp: form.showTimestamp,
          showPaymentMethod: form.showPaymentMethod,
          active: true,
        });
        upsertReceiptTemplate(updated);
      } else {
        const createData: Parameters<typeof adminApi.receiptTemplates.create>[0] = {
          name: "Template principale",
          showLogo: form.showLogo,
          showOrderNumber: form.showOrderNumber,
          showTimestamp: form.showTimestamp,
          showPaymentMethod: form.showPaymentMethod,
          active: true,
        };
        if (form.headerText !== "") createData.headerText = form.headerText;
        if (form.footerText !== "") createData.footerText = form.footerText;
        const created = await adminApi.receiptTemplates.create(createData);
        upsertReceiptTemplate(created);
      }
    } finally { setSaving(false); }
  }

  const previewLines = [
    "================================",
    (form.headerText || "Il tuo locale").toUpperCase().padStart(Math.floor((32 + (form.headerText || "Il tuo locale").length) / 2)),
    "================================",
    ...(form.showTimestamp ? ["17/05/2026 20:30"] : []),
    ...(form.showOrderNumber ? ["Ordine #42"] : []),
    "--------------------------------",
    "1x Burger       €8.00",
    "1x Fries        €3.00",
    "--------------------------------",
    "TOTALE          €11.00",
    ...(form.showPaymentMethod ? ["Pagamento: Contanti"] : []),
    "--------------------------------",
    ...(form.footerText ? [form.footerText, ""] : ["Grazie e arrivederci!", ""]),
  ];

  return (
    <div style={{ padding: "var(--sp-lg)" }}>
      <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-800)", marginBottom: "var(--sp-lg)", marginTop: 0 }}>Template scontrino</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
        {/* Form */}
        <div style={{ background: "var(--color-white)", borderRadius: "var(--radius-xl)", padding: "24px", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: "18px" }}>
          <div>
            <label style={labelStyle}>Intestazione</label>
            <textarea
              style={{ ...inputStyle, height: "72px", resize: "vertical", paddingTop: "10px", lineHeight: 1.5 }}
              value={form.headerText}
              onChange={(e) => setForm((f) => ({ ...f, headerText: e.target.value }))}
              placeholder="Nome locale, indirizzo, P.IVA..."
            />
          </div>
          <div>
            <label style={labelStyle}>Piè di pagina</label>
            <textarea
              style={{ ...inputStyle, height: "56px", resize: "vertical", paddingTop: "10px", lineHeight: 1.5 }}
              value={form.footerText}
              onChange={(e) => setForm((f) => ({ ...f, footerText: e.target.value }))}
              placeholder="Grazie e arrivederci!"
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              { key: "showOrderNumber" as const, label: "Mostra numero ordine" },
              { key: "showTimestamp" as const, label: "Mostra data/ora" },
              { key: "showPaymentMethod" as const, label: "Mostra metodo pagamento" },
            ].map(({ key, label }) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                <Toggle value={form[key]} onChange={(v) => setForm((f) => ({ ...f, [key]: v }))} />
                <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-700)" }}>{label}</span>
              </label>
            ))}
          </div>
          <Button fullWidth loading={saving} onClick={() => void handleSave()}>Salva template</Button>
        </div>

        {/* Preview */}
        <div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-gray-500)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px" }}>
            Anteprima
          </div>
          <div style={{
            background: "#fff",
            borderRadius: "var(--radius-lg)",
            padding: "16px 20px",
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: "12px",
            lineHeight: "1.6",
            color: "#1a1a1a",
            boxShadow: "0 4px 20px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)",
            whiteSpace: "pre",
            overflowX: "auto",
          }}>
            {previewLines.join("\n")}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shifts Tab ───────────────────────────────────────────────────────────────

function ShiftsTab() {
  const [history, setHistory] = useState<Array<{
    id: string; userId: string; openedAt: number; closedAt: number | null;
    openingCash: number; closingCash: number | null; totalSales: number; totalOrders: number; notes: string | null;
  }>>([]);
  const [currentShift, setCurrentShift] = useState<typeof history[0] | null>(null);
  const [loading_, setLoading_] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [openingCash, setOpeningCash] = useState("0");
  const [closingCash, setClosingCash] = useState("0");
  const [saving, setSaving] = useState(false);
  const store = useAdminStore();

  async function loadShifts() {
    setLoading_(true);
    try {
      const [hist, current] = await Promise.allSettled([
        adminApi.shifts.history(),
        adminApi.shifts.current(),
      ]);
      if (hist.status === "fulfilled") setHistory(hist.value);
      if (current.status === "fulfilled") setCurrentShift(current.value);
      else setCurrentShift(null);
    } finally { setLoading_(false); }
  }

  useEffect(() => { void loadShifts(); }, []);

  async function handleOpen() {
    setSaving(true);
    try {
      const userId = "admin"; // placeholder — in real use, get from session store
      const shift = await adminApi.shifts.open({ userId, openingCash: parseFloat(openingCash) || 0 });
      setCurrentShift(shift);
      setOpenModal(false);
    } finally { setSaving(false); }
  }

  async function handleClose() {
    if (!currentShift) return;
    setSaving(true);
    try {
      await adminApi.shifts.close(currentShift.id, { closingCash: parseFloat(closingCash) || 0 });
      setCurrentShift(null);
      void loadShifts();
      setCloseModal(false);
    } finally { setSaving(false); }
  }

  function formatDuration(from: number, to?: number | null) {
    const ms = (to ?? Date.now()) - from;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
  }

  return (
    <div style={{ padding: "var(--sp-lg)" }}>
      <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-800)", marginBottom: "var(--sp-lg)", marginTop: 0 }}>Turni</h2>

      {loading_ ? (
        <div style={{ textAlign: "center", color: "var(--color-gray-400)", padding: "40px" }}>Caricamento...</div>
      ) : (
        <>
          {/* Current shift card */}
          <div style={{ background: "var(--color-white)", borderRadius: "var(--radius-xl)", padding: "24px", boxShadow: "var(--shadow-sm)", marginBottom: "24px" }}>
            {currentShift ? (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#22c55e", flexShrink: 0, display: "inline-block" }} />
                  <span style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--color-gray-800)" }}>Turno in corso</span>
                  <span style={{ marginLeft: "auto", fontSize: "var(--text-sm)", color: "var(--color-gray-500)" }}>
                    {formatDuration(currentShift.openedAt)}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "20px" }}>
                  {[
                    { label: "Aperto alle", value: formatDate(currentShift.openedAt) },
                    { label: "Vendite", value: `€${currentShift.totalSales.toFixed(2)}` },
                    { label: "Ordini", value: String(currentShift.totalOrders) },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ background: "var(--color-gray-50)", borderRadius: "var(--radius-md)", padding: "12px 16px" }}>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", fontWeight: 600, marginBottom: "4px" }}>{label}</div>
                      <div style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--color-gray-800)" }}>{value}</div>
                    </div>
                  ))}
                </div>
                <Button variant="danger" size="sm" onClick={() => { setClosingCash(String(currentShift.openingCash)); setCloseModal(true); }}>
                  Chiudi turno
                </Button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--color-gray-700)", marginBottom: "4px" }}>Nessun turno aperto</div>
                  <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-400)" }}>Apri un nuovo turno per iniziare a registrare le vendite.</div>
                </div>
                <Button size="sm" onClick={() => { setOpeningCash("0"); setOpenModal(true); }}>Apri turno</Button>
              </div>
            )}
          </div>

          {/* History */}
          {history.filter((s) => s.closedAt !== null).length > 0 && (
            <div>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-gray-500)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>
                Storico
              </div>
              <div style={{ background: "var(--color-white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={tableHeaderStyle}>Apertura</th>
                      <th style={tableHeaderStyle}>Chiusura</th>
                      <th style={tableHeaderStyle}>Durata</th>
                      <th style={tableHeaderStyle}>Vendite</th>
                      <th style={tableHeaderStyle}>Ordini</th>
                      <th style={tableHeaderStyle}>Fondo cassa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.filter((s) => s.closedAt !== null).map((s) => (
                      <tr key={s.id}>
                        <td style={tableCellStyle}>{formatDate(s.openedAt)}</td>
                        <td style={tableCellStyle}>{s.closedAt ? formatDate(s.closedAt) : "—"}</td>
                        <td style={tableCellStyle}>{formatDuration(s.openedAt, s.closedAt)}</td>
                        <td style={{ ...tableCellStyle, fontWeight: 600, color: "var(--color-brand)" }}>€{s.totalSales.toFixed(2)}</td>
                        <td style={tableCellStyle}>{s.totalOrders}</td>
                        <td style={tableCellStyle}>{s.closingCash !== null ? `€${s.closingCash.toFixed(2)}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={openModal} onClose={() => setOpenModal(false)} title="Apri turno">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Fondo cassa iniziale (€)</label>
            <input style={inputStyle} type="number" min="0" step="0.01" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} autoFocus />
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Button variant="ghost" size="sm" onClick={() => setOpenModal(false)}>Annulla</Button>
            <Button size="sm" loading={saving} onClick={() => void handleOpen()}>Apri turno</Button>
          </div>
        </div>
      </Modal>

      <Modal open={closeModal} onClose={() => setCloseModal(false)} title="Chiudi turno">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Fondo cassa finale (€)</label>
            <input style={inputStyle} type="number" min="0" step="0.01" value={closingCash} onChange={(e) => setClosingCash(e.target.value)} autoFocus />
          </div>
          {currentShift && (
            <div style={{ background: "var(--color-gray-50)", borderRadius: "var(--radius-md)", padding: "12px 16px", fontSize: "var(--text-sm)", color: "var(--color-gray-600)" }}>
              Vendite registrate: <strong>€{currentShift.totalSales.toFixed(2)}</strong>
            </div>
          )}
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Button variant="ghost" size="sm" onClick={() => setCloseModal(false)}>Annulla</Button>
            <Button variant="danger" size="sm" loading={saving} onClick={() => void handleClose()}>Chiudi turno</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── AdminScreen ──────────────────────────────────────────────────────────────

export function AdminScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("products");
  const { setCategories, setProducts, setProductionCenters, setLoading, loading } = useAdminStore();
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      adminApi.categories.list(),
      adminApi.products.list(),
      adminApi.productionCenters.list(),
    ])
      .then(([cats, prods, pcs]) => {
        setCategories(cats);
        setProducts(prods);
        setProductionCenters(pcs);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const activeTab_ = TABS.find((t) => t.key === activeTab) ?? TABS[0]!

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "var(--color-gray-50)", overflow: "hidden" }}>

      {/* ── Top header ── */}
      <div style={{
        background: "var(--color-white)",
        borderBottom: "1px solid var(--color-gray-200)",
        flexShrink: 0,
      }}>
        {/* Title row */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "0 32px",
          height: "60px",
        }}>
          <button
            onClick={() => navigate("/pos")}
            title="Torna al POS"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "34px",
              height: "34px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-gray-200)",
              background: "var(--color-white)",
              cursor: "pointer",
              color: "var(--color-gray-500)",
              flexShrink: 0,
            }}
          >
            <ArrowLeftIcon style={{ width: "16px", height: "16px" }} />
          </button>
          <div style={{ width: "1px", height: "20px", background: "var(--color-gray-200)" }} />
          <WrenchScrewdriverIcon style={{ width: "18px", height: "18px", color: "var(--color-brand)", flexShrink: 0 }} />
          <span style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--color-gray-800)" }}>
            Amministrazione
          </span>
          <span style={{ color: "var(--color-gray-300)", fontSize: "var(--text-sm)" }}>/</span>
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-500)" }}>
            {activeTab_.label}
          </span>
        </div>

        {/* Nav pills */}
        <div style={{
          display: "flex",
          gap: "6px",
          padding: "0 32px 14px",
        }}>
          {TABS.map(({ key, label, Icon }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "8px 16px",
                  borderRadius: "999px",
                  border: active ? "none" : "1.5px solid var(--color-gray-200)",
                  background: active ? "var(--color-brand)" : "var(--color-white)",
                  cursor: "pointer",
                  fontSize: "var(--text-sm)",
                  fontWeight: 600,
                  color: active ? "var(--color-white)" : "var(--color-gray-500)",
                  fontFamily: "var(--font)",
                  transition: "background var(--transition), color var(--transition), border-color var(--transition)",
                  boxShadow: active ? "0 2px 8px rgba(48,107,52,0.25)" : "none",
                }}
              >
                <Icon style={{ width: "15px", height: "15px" }} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="scrollable" style={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px" }}>
            <span style={{ color: "var(--color-gray-400)", fontSize: "var(--text-sm)" }}>Caricamento...</span>
          </div>
        ) : (
          <div style={{ maxWidth: "960px", margin: "0 auto", padding: "32px 24px" }}>
            {activeTab === "products" && <ProductsTab />}
            {activeTab === "categories" && <CategoriesTab />}
            {activeTab === "production-centers" && <ProductionCentersTab />}
            {activeTab === "payment-methods" && <PaymentMethodsTab />}
            {activeTab === "printers" && <PrintersTab />}
            {activeTab === "receipt-template" && <ReceiptTemplateTab />}
            {activeTab === "shifts" && <ShiftsTab />}
            {activeTab === "backup" && <BackupTab />}
          </div>
        )}
      </div>
    </div>
  );
}
