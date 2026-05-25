import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useShiftStore } from "../../state/shift-store.js";
import { Modal } from "../../components/ui/Modal.js";
import { Button } from "../../components/ui/Button.js";
import { adminApi } from "../../core/admin-api.js";
import { useAdminStore } from "../../state/admin-store.js";
import { useStore } from "../../state/global-store.js";
import type { Category, Product, ProductionCenter, OptionGroupWithOptions, Option, PaymentMethodRecord, Printer, ReceiptTemplate, ReceiptBlock, BlockType, KitchenTemplate, KitchenBlock, KitchenBlockType, Terminal } from "@pos/shared-types";
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
  CircleStackIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ArrowPathIcon,
} from "../../components/ui/icons.js";
import type { ModuleInfo, InventoryItemRecord, InventoryMovementRecord, ProductIngredientRecord, RestaurantInfo } from "../../core/admin-api.js";
import { apiClient } from "../../core/api-client.js";
import type { ZReport } from "../../core/api-client.js";
import { BackupTab } from "./BackupTab.js";

// ─── Tab types ───────────────────────────────────────────────────────────────

type Tab = "restaurant" | "products" | "categories" | "production-centers" | "payment-methods" | "printers" | "receipt-template" | "kitchen-template" | "shifts" | "backup" | "mode" | "modules" | "inventory" | "movements" | "terminals";

const TABS: { key: Tab; label: string; Icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }[] = [
  { key: "restaurant", label: "Ristorante", Icon: BuildingStorefrontIcon },
  { key: "products", label: "Prodotti", Icon: CubeIcon },
  { key: "categories", label: "Categorie", Icon: TagIcon },
  { key: "production-centers", label: "Centri di produzione", Icon: BuildingStorefrontIcon },
  { key: "payment-methods", label: "Metodi pagamento", Icon: BanknotesIcon },
  { key: "printers", label: "Stampanti", Icon: PrinterIcon },
  { key: "receipt-template", label: "Scontrino", Icon: DocumentTextIcon },
  { key: "kitchen-template", label: "Comanda", Icon: PrinterIcon },
  { key: "shifts", label: "Turni", Icon: ClockIcon },
  { key: "backup", label: "Backup", Icon: ArrowDownTrayIcon },
  { key: "mode", label: "Modalità", Icon: WrenchScrewdriverIcon },
  { key: "modules", label: "Moduli", Icon: Squares2X2Icon },
  { key: "inventory", label: "Inventario", Icon: CircleStackIcon },
  { key: "movements", label: "Movimenti", Icon: ListBulletIcon },
  { key: "terminals", label: "Terminali", Icon: WrenchScrewdriverIcon },
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
  productionCenterId: string;
  active: boolean;
  color: string;
  imageData: string | null;
  description: string;
}

// ─── Restaurant Tab ───────────────────────────────────────────────────────────

function RestaurantTab() {
  const [form, setForm] = useState<RestaurantInfo>({ name: "", address: "", city: "", vat: "", phone: "", website: "", logoPath: null });
  const [loading_, setLoading_] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoTs, setLogoTs] = useState(() => Date.now());

  useEffect(() => {
    adminApi.restaurant.get()
      .then((data) => setForm(data))
      .catch(() => {})
      .finally(() => setLoading_(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const { logoPath: _lp, ...formData } = form;
      const updated = await adminApi.restaurant.update(formData);
      setForm((prev) => ({ ...updated, logoPath: prev.logoPath }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const result = await adminApi.restaurant.uploadLogo(file);
      setForm((prev) => ({ ...prev, logoPath: result.logoPath }));
      setLogoTs(Date.now());
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore upload logo");
    } finally { setLogoUploading(false); }
  }

  async function handleLogoDelete() {
    try {
      await adminApi.restaurant.deleteLogo();
      setForm((prev) => ({ ...prev, logoPath: null }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore rimozione logo");
    }
  }

  const fields: { key: keyof Omit<RestaurantInfo, "logoPath">; label: string; placeholder: string; type?: string }[] = [
    { key: "name",    label: "Nome locale",   placeholder: "Es. Trattoria da Mario" },
    { key: "address", label: "Indirizzo",      placeholder: "Es. Via Roma 12" },
    { key: "city",    label: "Città / CAP",    placeholder: "Es. Milano, 20121" },
    { key: "vat",     label: "P.IVA / C.F.",   placeholder: "Es. IT01234567890" },
    { key: "phone",   label: "Telefono",        placeholder: "Es. +39 02 1234567" },
    { key: "website", label: "Sito web",        placeholder: "Es. www.trattoriadamario.it" },
  ];

  return (
    <div style={{ padding: "var(--sp-lg)", maxWidth: "560px" }}>
      <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-800)", marginTop: 0, marginBottom: "6px" }}>
        Informazioni ristorante
      </h2>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-400)", marginTop: 0, marginBottom: "var(--sp-lg)" }}>
        Questi dati appaiono sullo scontrino e nel Z-report.
      </p>

      {loading_ ? (
        <div style={{ color: "var(--color-gray-400)", padding: "40px", textAlign: "center" }}>Caricamento...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ background: "var(--color-white)", borderRadius: "var(--radius-xl)", padding: "28px", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: "18px" }}>
            {fields.map(({ key, label, placeholder }) => (
              <div key={key}>
                <label style={labelStyle}>{label}</label>
                <input
                  style={inputStyle}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                />
              </div>
            ))}
          </div>

          {/* Logo */}
          <div style={{ background: "var(--color-white)", borderRadius: "var(--radius-xl)", padding: "24px", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--color-gray-700)" }}>Logo ristorante</div>
            <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>
              Appare in cima allo scontrino immagine. Formato: PNG o JPG, max 5 MB.
            </p>
            {form.logoPath && (
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <img
                  src={`/api/static/${form.logoPath}?t=${logoTs}`}
                  alt="Logo ristorante"
                  style={{ height: "64px", objectFit: "contain", borderRadius: "var(--radius-md)", border: "1px solid var(--color-gray-200)", background: "var(--color-gray-50)", padding: "6px" }}
                />
                <button type="button" onClick={() => void handleLogoDelete()}
                  style={{ padding: "6px 10px", borderRadius: "var(--radius-md)", border: "1.5px solid #FECACA", background: "#FEF2F2", color: "#DC2626", cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: 600 }}>
                  Rimuovi
                </button>
              </div>
            )}
            <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "var(--radius-lg)", border: "1.5px solid var(--color-gray-200)", background: "var(--color-white)", cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-700)", width: "fit-content" }}>
              {logoUploading ? "Caricamento..." : form.logoPath ? "Cambia logo" : "Carica logo"}
              <input type="file" accept="image/png,image/jpeg" style={{ display: "none" }} onChange={(e) => void handleLogoUpload(e)} />
            </label>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Button size="sm" loading={saving} onClick={() => void handleSave()}>
              Salva
            </Button>
            {saved && (
              <span style={{ fontSize: "var(--text-sm)", color: "#16a34a", fontWeight: 600 }}>
                ✓ Salvato
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
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

function ProductsTab() {
  const { products, categories, productionCenters, upsertProduct, removeProduct, setProducts } = useAdminStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormData>({ name: "", price: "", categoryId: "", productionCenterId: "", active: true, color: "", imageData: null, description: "" });
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [ingredientsProduct, setIngredientsProduct] = useState<Product | null>(null);

  function openCreate() {
    setEditTarget(null);
    setForm({ name: "", price: "", categoryId: "", productionCenterId: "", active: true, color: "", imageData: null, description: "" });
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
    });
    setModalOpen(true);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!editTarget) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const result = await adminApi.products.uploadImage(editTarget.id, file);
      setForm((f) => ({ ...f, imageData: `${result.imagePath}?t=${Date.now()}` }));
      const updated = await adminApi.products.list();
      const refreshed = updated.find((p) => p.id === editTarget.id);
      if (refreshed) upsertProduct(refreshed);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore upload immagine");
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
      alert(err instanceof Error ? err.message : "Errore rimozione immagine");
    } finally {
      setImageUploading(false);
    }
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
          productionCenterId: form.productionCenterId === "" ? null : form.productionCenterId,
          active: form.active,
          color: form.color === "" ? null : form.color,
          description: form.description === "" ? null : form.description,
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

  // Per-center assigned printers
  const [centerPrinters, setCenterPrinters] = useState<Record<string, Array<Pick<Printer, "id" | "name" | "host" | "port" | "kitchenEnabled" | "active">>>>({});
  const [loadedPrinterCenters, setLoadedPrinterCenters] = useState<Set<string>>(new Set());
  const [allPrinters, setAllPrinters] = useState<Printer[]>([]);
  const [printerDropdown, setPrinterDropdown] = useState<string | null>(null);

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

  async function loadCenterPrinters(centerId: string) {
    if (loadedPrinterCenters.has(centerId)) return;
    const prs = await adminApi.productionCenters.getPrinters(centerId);
    setCenterPrinters((prev) => ({ ...prev, [centerId]: prs }));
    setLoadedPrinterCenters((prev) => new Set(prev).add(centerId));
  }

  useEffect(() => {
    productionCenters.forEach((pc) => {
      void loadCenterCategories(pc.id);
      void loadCenterPrinters(pc.id);
    });
    adminApi.printers.list().then(setAllPrinters).catch(() => {});
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

  async function handleAssignPrinter(centerId: string, printerId: string) {
    await adminApi.productionCenters.assignPrinter(centerId, printerId);
    const printer = allPrinters.find((p) => p.id === printerId);
    if (printer) {
      setCenterPrinters((prev) => ({
        ...prev,
        [centerId]: [...(prev[centerId] ?? []), printer],
      }));
    }
    setPrinterDropdown(null);
  }

  async function handleRemovePrinter(centerId: string, printerId: string) {
    await adminApi.productionCenters.removePrinter(centerId, printerId);
    setCenterPrinters((prev) => ({
      ...prev,
      [centerId]: (prev[centerId] ?? []).filter((p) => p.id !== printerId),
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

              {/* Stampanti assegnate */}
              {(() => {
                const assignedPrinters = centerPrinters[pc.id] ?? [];
                const unassignedPrinters = allPrinters.filter((p) => p.kitchenEnabled && !assignedPrinters.some((a) => a.id === p.id));
                const isPrinterDropdownOpen = printerDropdown === pc.id;
                return (
                  <div style={{ borderTop: "1px solid var(--color-gray-100)", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-500)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Stampanti cucina
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", minHeight: "24px" }}>
                      {assignedPrinters.map((p) => (
                        <span key={p.id} style={{
                          display: "inline-flex", alignItems: "center", gap: "5px",
                          padding: "3px 10px", borderRadius: "20px",
                          background: "rgba(99,102,241,0.1)", color: "#4f46e5",
                          fontSize: "var(--text-xs)", fontWeight: 600,
                        }}>
                          <PrinterIcon style={{ width: "11px", height: "11px" }} />
                          {p.name}
                          <button
                            onClick={() => void handleRemovePrinter(pc.id, p.id)}
                            style={{ display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: "0", color: "#4f46e5", opacity: 0.7 }}
                          >
                            <XMarkIcon style={{ width: "12px", height: "12px" }} />
                          </button>
                        </span>
                      ))}
                      {assignedPrinters.length === 0 && (
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>
                          Fallback su tutte le stampanti kitchen
                        </span>
                      )}
                    </div>
                    {unassignedPrinters.length > 0 && (
                      <div style={{ position: "relative" }}>
                        <button
                          onClick={() => setPrinterDropdown(isPrinterDropdownOpen ? null : pc.id)}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: "5px",
                            padding: "5px 12px", borderRadius: "20px",
                            border: "1.5px dashed var(--color-gray-300)", background: "transparent",
                            cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600,
                            color: "var(--color-gray-500)",
                          }}
                        >
                          <PlusIcon style={{ width: "12px", height: "12px" }} />
                          Assegna stampante
                        </button>
                        {isPrinterDropdownOpen && (
                          <div style={{
                            position: "absolute", top: "calc(100% + 6px)", left: 0,
                            background: "var(--color-white)", borderRadius: "var(--radius-lg)",
                            boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid var(--color-gray-200)",
                            minWidth: "200px", zIndex: 100, overflow: "hidden",
                          }}>
                            {unassignedPrinters.map((p, i) => (
                              <button key={p.id} onClick={() => void handleAssignPrinter(pc.id, p.id)}
                                style={{
                                  width: "100%", padding: "10px 14px", border: "none",
                                  borderBottom: i < unassignedPrinters.length - 1 ? "1px solid var(--color-gray-100)" : "none",
                                  background: "transparent", cursor: "pointer", textAlign: "left",
                                  fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-gray-700)", fontFamily: "var(--font)",
                                }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-gray-50)"; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = ""; }}
                              >
                                {p.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
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
  const [form, setForm] = useState({ name: "", host: "", port: "", receiptEnabled: false, kitchenEnabled: false, printMode: "text" as "text" | "image" });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  useEffect(() => {
    adminApi.printers.list().then(setPrinters).catch(console.error);
  }, []);

  function openCreate() {
    setEditTarget(null);
    setForm({ name: "", host: "", port: "", receiptEnabled: false, kitchenEnabled: false, printMode: "text" });
    setModalOpen(true);
  }
  function openEdit(p: Printer) {
    setEditTarget(p);
    setForm({ name: p.name, host: p.host ?? "", port: p.port ? String(p.port) : "", receiptEnabled: p.receiptEnabled, kitchenEnabled: p.kitchenEnabled, printMode: p.printMode ?? "text" });
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
          printMode: form.printMode,
        });
        upsertPrinter(updated);
      } else {
        const createData: Parameters<typeof adminApi.printers.create>[0] = {
          name: form.name,
          receiptEnabled: form.receiptEnabled,
          kitchenEnabled: form.kitchenEnabled,
          printMode: form.printMode,
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
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <Toggle value={form.receiptEnabled} onChange={(v) => setForm((f) => ({ ...f, receiptEnabled: v }))} />
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-700)" }}>Scontrini</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <Toggle value={form.kitchenEnabled} onChange={(v) => setForm((f) => ({ ...f, kitchenEnabled: v }))} />
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-700)" }}>Cucina</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-700)" }}>Modalità stampa:</span>
              <select value={form.printMode} onChange={(e) => setForm((f) => ({ ...f, printMode: e.target.value as "text" | "image" }))}
                style={{ ...inputStyle, width: "auto", height: "36px", fontSize: "var(--text-sm)", padding: "0 10px" }}>
                <option value="text">Testo ESC/POS</option>
                <option value="image">Immagine raster</option>
              </select>
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

const DEFAULT_RECEIPT_BLOCKS: ReceiptBlock[] = [
  { id: "d1", type: "logo", align: "center", fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 0, visible: true },
  { id: "d2", type: "restaurant-name", align: "center", fontSize: 18, fontFamily: "DejaVu Sans", bold: true, paddingTop: 8, visible: true },
  { id: "d3", type: "restaurant-address", align: "center", fontSize: 12, fontFamily: "DejaVu Sans", bold: false, paddingTop: 4, visible: true },
  { id: "d4", type: "restaurant-phone", align: "center", fontSize: 12, fontFamily: "DejaVu Sans", bold: false, paddingTop: 2, visible: true },
  { id: "d5", type: "divider", align: "left", fontSize: 12, fontFamily: "DejaVu Sans", bold: false, paddingTop: 8, visible: true },
  { id: "d6", type: "order-number", align: "left", fontSize: 13, fontFamily: "DejaVu Sans", bold: false, paddingTop: 4, visible: true },
  { id: "d7", type: "timestamp", align: "left", fontSize: 12, fontFamily: "DejaVu Sans", bold: false, paddingTop: 4, visible: true },
  { id: "d8", type: "divider", align: "left", fontSize: 12, fontFamily: "DejaVu Sans", bold: false, paddingTop: 8, visible: true },
  { id: "d9", type: "items", align: "left", fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 4, visible: true },
  { id: "d10", type: "divider", align: "left", fontSize: 12, fontFamily: "DejaVu Sans", bold: false, paddingTop: 8, visible: true },
  { id: "d11", type: "total", align: "left", fontSize: 16, fontFamily: "DejaVu Sans", bold: true, paddingTop: 4, visible: true },
  { id: "d12", type: "payment-method", align: "left", fontSize: 12, fontFamily: "DejaVu Sans", bold: false, paddingTop: 4, visible: true },
  { id: "d13", type: "divider", align: "left", fontSize: 12, fontFamily: "DejaVu Sans", bold: false, paddingTop: 8, visible: true },
  { id: "d14", type: "footer", align: "center", fontSize: 12, fontFamily: "DejaVu Sans", bold: false, paddingTop: 4, visible: true, content: "Grazie e arrivederci!" },
];

function makeLogoBlock(): ReceiptBlock {
  return { id: Math.random().toString(36).slice(2), type: "logo", align: "center", fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 0, visible: true };
}

const BLOCK_TYPE_LABELS: Record<string, string> = {
  logo: "Logo", text: "Testo libero",
  "restaurant-name": "Nome ristorante", "restaurant-address": "Indirizzo",
  "restaurant-phone": "Telefono", "restaurant-vat": "P.IVA",
  divider: "Linea separatrice",
  "order-number": "Numero ordine", timestamp: "Data/ora", items: "Prodotti", total: "Totale",
  "payment-method": "Metodo pagamento", footer: "Footer",
  "category-name": "Nome categoria",
};
const BUNDLED_FONTS = ["DejaVu Sans", "DejaVu Sans Mono", "Oswald Bold"];

function BlockEditor({ blocks, onChange, availableFonts }: {
  blocks: ReceiptBlock[];
  onChange: (b: ReceiptBlock[]) => void;
  availableFonts: string[];
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const allFonts = [...new Set([...BUNDLED_FONTS, ...availableFonts])];

  function updateBlock(idx: number, patch: Partial<ReceiptBlock>) {
    onChange(blocks.map((b, i) => i === idx ? { ...b, ...patch } : b));
  }
  function removeBlock(idx: number) { onChange(blocks.filter((_, i) => i !== idx)); }
  function addBlock(type: BlockType = "text") {
    const id = Math.random().toString(36).slice(2);
    const base = { id, align: "left" as const, fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 8, visible: true };
    if (type === "text" || type === "footer") {
      onChange([...blocks, { ...base, type, content: "" }]);
    } else if (type === "logo") {
      onChange([...blocks, { ...base, type: "logo", align: "center" as const }]);
    } else {
      onChange([...blocks, { ...base, type }]);
    }
  }

  const [draggableIdx, setDraggableIdx] = useState<number | null>(null);

  function handleDragStart(e: React.DragEvent, idx: number) {
    if (draggableIdx !== idx) { e.preventDefault(); return; }
    setDragIdx(idx);
  }
  function handleDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setOverIdx(idx); }
  function handleDrop(idx: number) {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setOverIdx(null); return; }
    const next = [...blocks];
    const [item] = next.splice(dragIdx, 1);
    next.splice(idx, 0, item!);
    onChange(next);
    setDragIdx(null); setOverIdx(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {blocks.map((block, idx) => (
        <div
          key={block.id}
          draggable
          onDragStart={(e) => handleDragStart(e, idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDrop={() => handleDrop(idx)}
          onDragEnd={() => { setDragIdx(null); setOverIdx(null); setDraggableIdx(null); }}
          style={{
            background: "var(--color-white)",
            borderRadius: "var(--radius-lg)",
            border: overIdx === idx ? "2px solid var(--color-brand)" : "1.5px solid var(--color-gray-200)",
            padding: "12px 14px",
            opacity: dragIdx === idx ? 0.4 : 1,
            cursor: "default",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {/* Drag handle — only this activates drag */}
            <span
              onMouseDown={() => setDraggableIdx(idx)}
              onMouseUp={() => setDraggableIdx(null)}
              style={{ color: "var(--color-gray-400)", fontSize: "18px", cursor: "grab", userSelect: "none" }}
            >⠿</span>
            {/* Type */}
            <select
              value={block.type}
              onChange={(e) => updateBlock(idx, { type: e.target.value as BlockType })}
              style={{ ...inputStyle, width: "auto", height: "34px", fontSize: "var(--text-sm)", padding: "0 8px" }}
            >
              {Object.entries(BLOCK_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {/* Align */}
            {(["left", "center", "right"] as const).map((a) => (
              <button key={a} type="button" onClick={() => updateBlock(idx, { align: a })}
                style={{ padding: "4px 10px", borderRadius: "var(--radius-md)", border: "1.5px solid var(--color-gray-200)", background: block.align === a ? "var(--color-brand)" : "var(--color-white)", color: block.align === a ? "#fff" : "var(--color-gray-600)", cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600 }}>
                {a === "left" ? "←" : a === "center" ? "↔" : "→"}
              </button>
            ))}
            {/* Font, Size, Bold — not relevant for logo or divider */}
            {block.type !== "logo" && block.type !== "divider" && (<>
              <select
                value={block.fontFamily}
                onChange={(e) => updateBlock(idx, { fontFamily: e.target.value })}
                style={{ ...inputStyle, width: "auto", height: "34px", fontSize: "var(--text-sm)", padding: "0 8px" }}
              >
                {allFonts.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <input type="number" min={8} max={48} value={block.fontSize}
                onChange={(e) => updateBlock(idx, { fontSize: Number(e.target.value) })}
                style={{ ...inputStyle, width: "62px", height: "34px", fontSize: "var(--text-sm)", padding: "0 8px" }}
              />
              <button type="button" onClick={() => updateBlock(idx, { bold: !block.bold })}
                style={{ padding: "4px 10px", borderRadius: "var(--radius-md)", border: "1.5px solid var(--color-gray-200)", background: block.bold ? "var(--color-brand)" : "var(--color-white)", color: block.bold ? "#fff" : "var(--color-gray-600)", cursor: "pointer", fontWeight: 700, fontSize: "var(--text-sm)" }}>
                B
              </button>
            </>)}
            {/* Visible */}
            <Toggle value={block.visible} onChange={(v) => updateBlock(idx, { visible: v })} />
            {/* Remove */}
            <button type="button" onClick={() => removeBlock(idx)}
              style={{ marginLeft: "auto", padding: "4px 8px", borderRadius: "var(--radius-md)", border: "1.5px solid #FECACA", background: "#FEF2F2", color: "#DC2626", cursor: "pointer", fontSize: "var(--text-xs)" }}>
              ✕
            </button>
          </div>
          {/* Content field for text/footer */}
          {(block.type === "text" || block.type === "footer") && (
            <input type="text" value={block.content ?? ""} placeholder="Testo..."
              onChange={(e) => updateBlock(idx, { content: e.target.value })}
              style={{ ...inputStyle, marginTop: "8px", height: "34px", fontSize: "var(--text-sm)" }}
            />
          )}
          {/* Padding top — not shown for logo */}
          {block.type !== "logo" && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>Spazio sopra:</span>
              <input type="number" min={0} max={80} value={block.paddingTop}
                onChange={(e) => updateBlock(idx, { paddingTop: Number(e.target.value) })}
                style={{ ...inputStyle, width: "62px", height: "28px", fontSize: "var(--text-xs)", padding: "0 6px" }}
              />
              <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>px</span>
            </div>
          )}
          {block.type === "logo" && (
            <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", whiteSpace: "nowrap" }}>Dimensione:</span>
                <input type="range" min={10} max={100} step={5} value={block.logoWidth ?? 100}
                  onChange={(e) => updateBlock(idx, { logoWidth: Number(e.target.value) })}
                  style={{ flex: 1, accentColor: "var(--color-brand)" }}
                />
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-600)", fontWeight: 600, minWidth: "36px" }}>{block.logoWidth ?? 100}%</span>
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>
                Immagine configurata nel tab Ristorante
              </div>
            </div>
          )}
        </div>
      ))}
      <div style={{ display: "flex", gap: "8px" }}>
        <button type="button" onClick={() => addBlock("text")}
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "10px", borderRadius: "var(--radius-lg)", border: "2px dashed var(--color-gray-300)", background: "transparent", color: "var(--color-gray-500)", cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: 600 }}>
          <PlusIcon style={{ width: "16px", height: "16px" }} /> Aggiungi blocco
        </button>
        {!blocks.some((b) => b.type === "logo") && (
          <button type="button" onClick={() => addBlock("logo")}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "10px 14px", borderRadius: "var(--radius-lg)", border: "2px dashed var(--color-brand)", background: "transparent", color: "var(--color-brand)", cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: 600, whiteSpace: "nowrap" }}>
            <PlusIcon style={{ width: "16px", height: "16px" }} /> Logo
          </button>
        )}
      </div>
    </div>
  );
}

type ImageTemplateForm = {
  canvasWidth: number;
  blocks: ReceiptBlock[];
  printMode: "text" | "image";
  headerText: string;
  footerText: string;
  showLogo: boolean;
  showOrderNumber: boolean;
  showTimestamp: boolean;
  showPaymentMethod: boolean;
  printMethod: "single" | "by_category" | "by_category_copy" | "per_item" | "per_item_copy";
  role: "master" | "sub" | "client_copy";
};

function ImageTemplateEditor({
  form, setForm, template, saving, onSave,
  availableFonts, fontUploading, onFontUpload, setReceiptTemplates,
}: {
  form: ImageTemplateForm;
  setForm: React.Dispatch<React.SetStateAction<ImageTemplateForm>>;
  template: ReceiptTemplate | null;
  saving: boolean;
  onSave: () => void;
  availableFonts: string[];
  fontUploading: boolean;
  onFontUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setReceiptTemplates: (ts: ReceiptTemplate[]) => void;
}) {
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch preview with debounce whenever blocks or canvasWidth change
  useEffect(() => {
    if (!template) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const token = useStore.getState().session?.token;
        const res = await fetch(adminApi.receiptTemplates.previewUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ blocks: form.blocks, canvasWidth: form.canvasWidth }),
        });
        if (!res.ok) return;
        const blob = await res.blob();
        setPreviewBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
      } catch { /* silent */ } finally { setPreviewLoading(false); }
    }, 800);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [form.blocks, form.canvasWidth, template?.id]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px", alignItems: "start" }}>
      {/* Left: controls */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Canvas width + font */}
        <div style={{ display: "flex", gap: "14px", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={labelStyle}>Larghezza (px)</label>
            <input type="number" min={200} max={800} value={form.canvasWidth}
              onChange={(e) => setForm((f) => ({ ...f, canvasWidth: Number(e.target.value) }))}
              style={{ ...inputStyle, width: "100px" }} />
          </div>
          <div>
            <label style={labelStyle}>Font (.ttf)</label>
            <label style={{ display: "inline-flex", alignItems: "center", padding: "8px 14px", borderRadius: "var(--radius-lg)", border: "1.5px solid var(--color-gray-200)", background: "var(--color-white)", cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-700)" }}>
              {fontUploading ? "Caricamento..." : "Carica font"}
              <input type="file" accept=".ttf" style={{ display: "none" }} onChange={onFontUpload} />
            </label>
          </div>
        </div>
        {/* Block editor */}
        <BlockEditor blocks={form.blocks} onChange={(b) => setForm((f) => ({ ...f, blocks: b }))} availableFonts={availableFonts} />
        <Button loading={saving} onClick={onSave}>Salva template</Button>
      </div>

      {/* Right: live preview */}
      <div style={{ position: "sticky", top: "20px" }}>
        <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-400)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
          Anteprima
          {previewLoading && <span style={{ fontWeight: 400, color: "var(--color-gray-400)" }}>Aggiornamento...</span>}
        </div>
        <div style={{
          background: "#fff",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-gray-200)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
          overflow: "hidden",
          minHeight: "200px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: previewLoading ? 0.6 : 1,
          transition: "opacity 0.2s",
        }}>
          {previewBlobUrl
            ? <img src={previewBlobUrl} alt="Anteprima" style={{ width: "100%", display: "block" }} />
            : <span style={{ color: "var(--color-gray-400)", fontSize: "var(--text-sm)" }}>
                {template ? "Salva per generare l'anteprima" : "Nessun template"}
              </span>
          }
        </div>
        {!previewBlobUrl && template && (
          <button type="button" onClick={async () => {
            setPreviewLoading(true);
            try {
              const token = useStore.getState().session?.token;
              const res = await fetch(adminApi.receiptTemplates.previewUrl(), {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ blocks: form.blocks, canvasWidth: form.canvasWidth }),
              });
              if (!res.ok) return;
              const blob = await res.blob();
              setPreviewBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
            } catch { /* silent */ } finally { setPreviewLoading(false); }
          }} style={{ marginTop: "8px", width: "100%", padding: "8px", borderRadius: "var(--radius-lg)", border: "1.5px solid var(--color-gray-200)", background: "var(--color-white)", cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-600)", fontFamily: "var(--font)" }}>
            Genera anteprima
          </button>
        )}
      </div>
    </div>
  );
}

function ReceiptTemplateTab() {
  const { receiptTemplates, setReceiptTemplates, upsertReceiptTemplate } = useAdminStore();
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false); // used by text mode modal only
  const [availableFonts, setAvailableFonts] = useState<string[]>([]);
  const [fontUploading, setFontUploading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const template: ReceiptTemplate | null = (
    selectedTemplateId
      ? receiptTemplates.find((t) => t.id === selectedTemplateId)
      : receiptTemplates.find((t) => t.active && t.role === "master") ?? receiptTemplates.find((t) => t.active) ?? receiptTemplates[0]
  ) ?? null;

  const [form, setForm] = useState({
    headerText: "",
    footerText: "",
    showLogo: true,
    showOrderNumber: true,
    showTimestamp: true,
    showPaymentMethod: true,
    printMode: "text" as "text" | "image",
    canvasWidth: 576,
    blocks: DEFAULT_RECEIPT_BLOCKS,
    printMethod: "single" as "single" | "by_category" | "by_category_copy" | "per_item" | "per_item_copy",
    role: "master" as "master" | "sub" | "client_copy",
  });

  useEffect(() => {
    adminApi.receiptTemplates.list().then((ts) => setReceiptTemplates(ts)).catch(console.error);
    adminApi.receiptTemplates.listFonts().then(setAvailableFonts).catch(() => {});
  }, []);

  useEffect(() => {
    if (template) {
      const rawBlocks: ReceiptBlock[] = typeof template.blocks === "string"
        ? (JSON.parse(template.blocks) as ReceiptBlock[])
        : (template.blocks ?? []);
      // Always ensure a logo block exists so the user can toggle its visibility
      const hasLogo = rawBlocks.some((b) => b.type === "logo");
      const blocks = rawBlocks.length === 0
        ? DEFAULT_RECEIPT_BLOCKS
        : hasLogo ? rawBlocks : [makeLogoBlock(), ...rawBlocks];
      setForm({
        headerText: template.headerText ?? "",
        footerText: template.footerText ?? "",
        showLogo: template.showLogo,
        showOrderNumber: template.showOrderNumber,
        showTimestamp: template.showTimestamp,
        showPaymentMethod: template.showPaymentMethod,
        printMode: template.printMode ?? "text",
        canvasWidth: template.canvasWidth ?? 576,
        blocks,
        printMethod: (template.printMethod ?? "single") as "single" | "by_category" | "by_category_copy" | "per_item" | "per_item_copy",
        role: (template.role ?? "master") as "master" | "sub" | "client_copy",
      });
    }
  }, [template?.id]);

  async function handleSave() {
    setSaving(true);
    try {
      const showLogoEffective = form.printMode === "image"
        ? form.blocks.some((b) => b.type === "logo" && b.visible)
        : form.showLogo;
      const baseData = {
        headerText: form.headerText === "" ? null : form.headerText,
        footerText: form.footerText === "" ? null : form.footerText,
        showLogo: showLogoEffective,
        showOrderNumber: form.showOrderNumber,
        showTimestamp: form.showTimestamp,
        showPaymentMethod: form.showPaymentMethod,
        printMode: form.printMode,
        canvasWidth: form.canvasWidth,
        blocks: form.printMode === "image" ? form.blocks : null,
        active: true,
        printMethod: form.printMethod,
        role: form.role,
      };
      if (template) {
        const updated = await adminApi.receiptTemplates.update(template.id, baseData);
        upsertReceiptTemplate(updated);
      } else {
        const createPayload: Parameters<typeof adminApi.receiptTemplates.create>[0] = {
          name: "Template principale",
          showLogo: form.showLogo,
          showOrderNumber: form.showOrderNumber,
          showTimestamp: form.showTimestamp,
          showPaymentMethod: form.showPaymentMethod,
          printMode: form.printMode,
          canvasWidth: form.canvasWidth,
          active: true,
          printMethod: form.printMethod,
          role: form.role,
        };
        if (form.headerText !== "") createPayload.headerText = form.headerText;
        if (form.footerText !== "") createPayload.footerText = form.footerText;
        if (form.printMode === "image" && form.blocks.length > 0) createPayload.blocks = form.blocks;
        const created = await adminApi.receiptTemplates.create(createPayload);
        upsertReceiptTemplate(created);
      }
    } finally { setSaving(false); }
  }

  async function handleFontUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFontUploading(true);
    try {
      await adminApi.receiptTemplates.uploadFont(file);
      const fonts = await adminApi.receiptTemplates.listFonts();
      setAvailableFonts(fonts);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore upload font");
    } finally { setFontUploading(false); }
  }

  const textPreviewLines = [
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

  const ROLE_LABELS: Record<string, string> = {
    master: "Master (scontrino principale)",
    sub: "Sub-scontrino (per categoria / per prodotto)",
    client_copy: "Copia cliente (riepilogativo finale)",
  };
  const PRINT_METHOD_LABELS: Record<string, string> = {
    single: "Classico — un unico scontrino",
    by_category: "Per categoria",
    by_category_copy: "Per categoria + copia cliente",
    per_item: "1 per prodotto",
    per_item_copy: "1 per prodotto + copia cliente",
  };
  const ROLE_HINTS: Record<string, string> = {
    sub: "Questo template viene stampato per ogni categoria o prodotto, in base al metodo del template Master attivo.",
    client_copy: "Questo template viene stampato come riepilogativo finale nelle modalità 'con copia cliente'.",
  };

  return (
    <div style={{ padding: "var(--sp-lg)" }}>
      {/* Template selector */}
      {receiptTemplates.length > 0 && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
          {receiptTemplates.map((t) => (
            <button key={t.id} type="button"
              onClick={() => { setSelectedTemplateId(t.id); }}
              style={{ padding: "6px 14px", borderRadius: "var(--radius-lg)", border: `1.5px solid ${template?.id === t.id ? "var(--color-brand)" : "var(--color-gray-200)"}`, background: template?.id === t.id ? "var(--color-brand)" : "var(--color-white)", color: template?.id === t.id ? "#fff" : "var(--color-gray-700)", cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: 600, fontFamily: "var(--font)" }}>
              {t.name}
              {t.active && <span style={{ marginLeft: "6px", fontSize: "10px", opacity: 0.8 }}>●</span>}
            </button>
          ))}
          <button type="button"
            onClick={async () => {
              const created = await adminApi.receiptTemplates.create({ name: "Nuovo template", active: false, printMethod: "single", role: "master" });
              setReceiptTemplates([...receiptTemplates, created]);
              setSelectedTemplateId(created.id);
            }}
            style={{ padding: "6px 14px", borderRadius: "var(--radius-lg)", border: "2px dashed var(--color-gray-300)", background: "transparent", color: "var(--color-gray-500)", cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: 600, fontFamily: "var(--font)", display: "flex", alignItems: "center", gap: "4px" }}>
            <PlusIcon style={{ width: "14px", height: "14px" }} /> Nuovo
          </button>
        </div>
      )}
      {/* Role banner */}
      {form.role !== "master" && (
        <div style={{ marginBottom: "16px", padding: "12px 16px", borderRadius: "var(--radius-lg)", background: form.role === "client_copy" ? "#EFF6FF" : "#F0FDF4", border: `1.5px solid ${form.role === "client_copy" ? "#BFDBFE" : "#BBF7D0"}`, color: form.role === "client_copy" ? "#1D4ED8" : "#15803D", fontSize: "var(--text-sm)", fontWeight: 600 }}>
          {ROLE_HINTS[form.role]}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--sp-lg)", flexWrap: "wrap", gap: "10px" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-800)", margin: 0 }}>Template scontrino</h2>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          {/* Role select */}
          <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as "master" | "sub" | "client_copy" }))}
            style={{ ...inputStyle, height: "36px", width: "auto", fontSize: "var(--text-sm)", padding: "0 10px" }}>
            {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {/* Print method select — only for master */}
          {form.role === "master" && (
            <select value={form.printMethod} onChange={(e) => setForm((f) => ({ ...f, printMethod: e.target.value as typeof form.printMethod }))}
              style={{ ...inputStyle, height: "36px", width: "auto", fontSize: "var(--text-sm)", padding: "0 10px" }}>
              {Object.entries(PRINT_METHOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          )}
          {/* Mode toggle */}
          <div style={{ display: "flex", borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1.5px solid var(--color-gray-200)" }}>
            {(["text", "image"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setForm((f) => ({ ...f, printMode: m }))}
                style={{ padding: "8px 18px", border: "none", background: form.printMode === m ? "var(--color-brand)" : "var(--color-white)", color: form.printMode === m ? "#fff" : "var(--color-gray-600)", cursor: "pointer", fontWeight: 600, fontSize: "var(--text-sm)", fontFamily: "var(--font)" }}>
                {m === "text" ? "Testo" : "Immagine"}
              </button>
            ))}
          </div>
          {template && (
            <button type="button" disabled={previewLoading} onClick={async () => {
              if (!template) return;
              setPreviewLoading(true);
              try {
                const token = useStore.getState().session?.token;
                const res = await fetch(adminApi.receiptTemplates.previewUrl(), {
                  method: "POST",
                  headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                  body: JSON.stringify({ blocks: form.blocks, canvasWidth: form.canvasWidth }),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const blob = await res.blob();
                if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
                setPreviewBlobUrl(URL.createObjectURL(blob));
                setPreviewOpen(true);
              } catch (e) {
                alert(e instanceof Error ? e.message : "Errore anteprima");
              } finally { setPreviewLoading(false); }
            }}
              style={{ padding: "8px 16px", borderRadius: "var(--radius-lg)", border: "1.5px solid var(--color-gray-200)", background: "var(--color-white)", color: "var(--color-gray-700)", cursor: "pointer", fontWeight: 600, fontSize: "var(--text-sm)", fontFamily: "var(--font)", opacity: previewLoading ? 0.6 : 1 }}>
              {previewLoading ? "Generazione..." : "🖼 Anteprima"}
            </button>
          )}
        </div>
      </div>

      {form.printMode === "text" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
          <div style={{ background: "var(--color-white)", borderRadius: "var(--radius-xl)", padding: "24px", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: "18px" }}>
            <div>
              <label style={labelStyle}>Intestazione</label>
              <textarea style={{ ...inputStyle, height: "72px", resize: "vertical", paddingTop: "10px", lineHeight: 1.5 }}
                value={form.headerText} onChange={(e) => setForm((f) => ({ ...f, headerText: e.target.value }))} placeholder="Nome locale, indirizzo, P.IVA..." />
            </div>
            <div>
              <label style={labelStyle}>Piè di pagina</label>
              <textarea style={{ ...inputStyle, height: "56px", resize: "vertical", paddingTop: "10px", lineHeight: 1.5 }}
                value={form.footerText} onChange={(e) => setForm((f) => ({ ...f, footerText: e.target.value }))} placeholder="Grazie e arrivederci!" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {([
                { key: "showOrderNumber" as const, label: "Mostra numero ordine" },
                { key: "showTimestamp" as const, label: "Mostra data/ora" },
                { key: "showPaymentMethod" as const, label: "Mostra metodo pagamento" },
              ]).map(({ key, label }) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                  <Toggle value={form[key]} onChange={(v) => setForm((f) => ({ ...f, [key]: v }))} />
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-700)" }}>{label}</span>
                </label>
              ))}
            </div>
            <Button fullWidth loading={saving} onClick={() => void handleSave()}>Salva template</Button>
          </div>
          <div>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-gray-500)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px" }}>Anteprima</div>
            <div style={{ background: "#fff", borderRadius: "var(--radius-lg)", padding: "16px 20px", fontFamily: "'Courier New', Courier, monospace", fontSize: "12px", lineHeight: "1.6", color: "#1a1a1a", boxShadow: "0 4px 20px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)", whiteSpace: "pre", overflowX: "auto" }}>
              {textPreviewLines.join("\n")}
            </div>
          </div>
        </div>
      ) : (
        <ImageTemplateEditor
          form={form}
          setForm={setForm}
          template={template}
          saving={saving}
          onSave={() => void handleSave()}
          availableFonts={availableFonts}
          fontUploading={fontUploading}
          onFontUpload={(e) => void handleFontUpload(e)}
          setReceiptTemplates={setReceiptTemplates}
        />
      )}

      {/* Preview modal */}
      <Modal open={previewOpen} title="Anteprima scontrino" onClose={() => setPreviewOpen(false)}>
        <div style={{ textAlign: "center" }}>
          {previewBlobUrl && (
            <img
              src={previewBlobUrl}
              alt="Anteprima scontrino"
              style={{ maxWidth: "100%", border: "1px solid var(--color-gray-200)", borderRadius: "var(--radius-lg)" }}
            />
          )}
        </div>
      </Modal>
    </div>
  );
}

// ─── Kitchen Template Tab ────────────────────────────────────────────────────

const KITCHEN_BLOCK_TYPE_LABELS: Record<KitchenBlockType, string> = {
  "center-name":  "Nome centro",
  "order-number": "Numero ordine",
  "table-number": "Numero tavolo",
  "timestamp":    "Ora",
  "items":        "Articoli",
  "divider":      "Separatore",
  "text":         "Testo libero",
};

const DEFAULT_KITCHEN_BLOCKS: KitchenBlock[] = [
  { id: "1", type: "center-name",  align: "center", fontSize: 24, fontFamily: "DejaVu Sans", bold: true,  paddingTop: 0,  visible: true },
  { id: "2", type: "order-number", align: "center", fontSize: 20, fontFamily: "DejaVu Sans", bold: true,  paddingTop: 8,  visible: true },
  { id: "3", type: "table-number", align: "center", fontSize: 16, fontFamily: "DejaVu Sans", bold: false, paddingTop: 4,  visible: true },
  { id: "4", type: "timestamp",    align: "center", fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 4,  visible: true },
  { id: "5", type: "divider",      align: "left",   fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 8,  visible: true },
  { id: "6", type: "items",        align: "left",   fontSize: 16, fontFamily: "DejaVu Sans", bold: false, paddingTop: 8,  visible: true },
  { id: "7", type: "divider",      align: "left",   fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 8,  visible: true },
];

function KitchenTemplateTab() {
  const [templates, setTemplates] = useState<KitchenTemplate[]>([]);
  const [selected, setSelected] = useState<KitchenTemplate | null>(null);
  const [blocks, setBlocks] = useState<KitchenBlock[]>(DEFAULT_KITCHEN_BLOCKS);
  const [printMode, setPrintMode] = useState<"text" | "image">("text");
  const [canvasWidth, setCanvasWidth] = useState(576);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  function showToast(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    adminApi.kitchenTemplates.list().then((ts) => {
      setTemplates(ts);
      const first = ts[0] ?? null;
      if (first) selectTemplate(first);
    }).catch(console.error);
  }, []);

  function selectTemplate(t: KitchenTemplate) {
    setSelected(t);
    const parsed = t.blocks ? (typeof t.blocks === "string" ? JSON.parse(t.blocks) : t.blocks) as KitchenBlock[] : DEFAULT_KITCHEN_BLOCKS;
    setBlocks(parsed);
    setPrintMode((t.printMode as "text" | "image") ?? "text");
    setCanvasWidth(t.canvasWidth ?? 576);
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await adminApi.kitchenTemplates.update(selected.id, {
        blocks,
        printMode,
        canvasWidth,
      });
      setTemplates((prev) => prev.map((t) => t.id === updated.id ? updated : t));
      setSelected(updated);
      showToast("Template salvato", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Errore", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await adminApi.kitchenTemplates.create({ name: newName.trim() });
      setTemplates((prev) => [...prev, created]);
      setNewName("");
      selectTemplate(created);
      showToast("Template creato", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Errore", "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    await adminApi.kitchenTemplates.delete(id);
    const remaining = templates.filter((t) => t.id !== id);
    setTemplates(remaining);
    if (selected?.id === id) {
      const next = remaining[0] ?? null;
      if (next) selectTemplate(next); else { setSelected(null); setBlocks(DEFAULT_KITCHEN_BLOCKS); }
    }
  }

  async function handlePreview() {
    if (!selected) return;
    try {
      await handleSave();
      const url = adminApi.kitchenTemplates.previewUrl(selected.id) + `?t=${Date.now()}`;
      const token = (window as unknown as { __posToken?: string }).__posToken;
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      setPreviewUrl(URL.createObjectURL(blob));
      setPreviewOpen(true);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Errore anteprima", "error");
    }
  }

  function updateBlock(idx: number, patch: Partial<KitchenBlock>) {
    setBlocks((prev) => prev.map((b, i) => i === idx ? { ...b, ...patch } : b));
  }

  function moveBlock(idx: number, dir: -1 | 1) {
    setBlocks((prev) => {
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap]!, next[idx]!];
      return next;
    });
  }

  return (
    <div style={{ padding: "var(--sp-lg)", display: "flex", flexDirection: "column", gap: "var(--sp-lg)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-800)", margin: 0 }}>
          Template comanda
        </h2>
      </div>

      {/* Template selector + create */}
      <div style={{ display: "flex", gap: "var(--sp-sm)", alignItems: "center", flexWrap: "wrap" }}>
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => selectTemplate(t)}
            style={{
              padding: "6px 16px", borderRadius: "var(--radius-md)",
              border: selected?.id === t.id ? "2px solid var(--color-brand)" : "2px solid var(--color-gray-200)",
              background: selected?.id === t.id ? "rgba(48,107,52,0.08)" : "var(--color-white)",
              color: selected?.id === t.id ? "var(--color-brand)" : "var(--color-gray-700)",
              fontWeight: 600, fontSize: "var(--text-sm)", cursor: "pointer", fontFamily: "var(--font)",
            }}
          >
            {t.name}
          </button>
        ))}
        <div style={{ display: "flex", gap: "var(--sp-xs)" }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
            placeholder="Nuovo template..."
            style={{ ...inputStyle, width: "180px", height: "36px" }}
          />
          <Button size="sm" loading={creating} disabled={!newName.trim()} onClick={() => void handleCreate()}>
            Crea
          </Button>
        </div>
      </div>

      {selected && (
        <>
          {/* Mode toggle */}
          <div style={{ display: "flex", gap: "var(--sp-md)", alignItems: "center" }}>
            <label style={labelStyle}>Modalità:</label>
            {(["text", "image"] as const).map((mode) => (
              <label key={mode} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "var(--text-sm)" }}>
                <input type="radio" checked={printMode === mode} onChange={() => setPrintMode(mode)} />
                {mode === "text" ? "Testo ESC/POS" : "Immagine PNG"}
              </label>
            ))}
          </div>

          {printMode === "image" && (
            <div style={{ display: "flex", gap: "var(--sp-md)", alignItems: "center" }}>
              <label style={labelStyle}>Larghezza canvas:</label>
              <input
                type="number"
                value={canvasWidth}
                onChange={(e) => setCanvasWidth(Number(e.target.value))}
                min={200}
                max={832}
                step={2}
                style={{ ...inputStyle, width: "100px" }}
              />
              <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>px (tipico: 576 = 80mm)</span>
            </div>
          )}

          {/* Block editor (only for image mode) */}
          {printMode === "image" && (
            <div style={{ background: "var(--color-white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-gray-100)", fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--color-gray-700)" }}>
                Blocchi
              </div>
              {blocks.map((block, idx) => (
                <div key={block.id} style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "12px 20px",
                  borderBottom: idx < blocks.length - 1 ? "1px solid var(--color-gray-100)" : "none",
                  background: block.visible ? "transparent" : "var(--color-gray-50)",
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <button onClick={() => moveBlock(idx, -1)} disabled={idx === 0}
                      style={{ border: "none", background: "none", cursor: "pointer", padding: "2px", color: "var(--color-gray-400)", fontSize: "10px" }}>▲</button>
                    <button onClick={() => moveBlock(idx, 1)} disabled={idx === blocks.length - 1}
                      style={{ border: "none", background: "none", cursor: "pointer", padding: "2px", color: "var(--color-gray-400)", fontSize: "10px" }}>▼</button>
                  </div>
                  <Toggle value={block.visible} onChange={(v) => updateBlock(idx, { visible: v })} />
                  <span style={{ minWidth: "110px", fontWeight: 600, fontSize: "var(--text-xs)", color: "var(--color-gray-600)" }}>
                    {KITCHEN_BLOCK_TYPE_LABELS[block.type]}
                  </span>
                  <select value={block.align} onChange={(e) => updateBlock(idx, { align: e.target.value as KitchenBlock["align"] })}
                    style={{ height: "30px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-gray-200)", fontSize: "var(--text-xs)", padding: "0 6px" }}>
                    <option value="left">Sinistra</option>
                    <option value="center">Centro</option>
                    <option value="right">Destra</option>
                  </select>
                  <input type="number" value={block.fontSize} min={8} max={72}
                    onChange={(e) => updateBlock(idx, { fontSize: Number(e.target.value) })}
                    style={{ width: "56px", height: "30px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-gray-200)", fontSize: "var(--text-xs)", textAlign: "center", padding: "0 4px" }}
                    title="Font size"
                  />
                  <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "var(--text-xs)", color: "var(--color-gray-600)" }}>
                    <input type="checkbox" checked={block.bold} onChange={(e) => updateBlock(idx, { bold: e.target.checked })} />
                    Bold
                  </label>
                  {block.type === "text" && (
                    <input
                      value={block.content ?? ""}
                      onChange={(e) => updateBlock(idx, { content: e.target.value })}
                      placeholder="Testo..."
                      style={{ flex: 1, height: "30px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-gray-200)", fontSize: "var(--text-xs)", padding: "0 8px" }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: "var(--sp-sm)", flexWrap: "wrap" }}>
            <Button onClick={() => void handleSave()} loading={saving}>Salva</Button>
            {printMode === "image" && (
              <Button variant="ghost" onClick={() => void handlePreview()}>Anteprima</Button>
            )}
            <Button variant="danger" size="sm" onClick={() => void handleDelete(selected.id)}
              style={{ marginLeft: "auto" }}>
              Elimina
            </Button>
          </div>
        </>
      )}

      {templates.length === 0 && (
        <div style={{ textAlign: "center", padding: "var(--sp-xl)", color: "var(--color-gray-400)", fontSize: "var(--text-sm)" }}>
          Nessun template. Crea il primo usando il campo sopra.
        </div>
      )}

      {/* Preview modal */}
      <Modal open={previewOpen} onClose={() => { setPreviewOpen(false); if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }} title="Anteprima comanda">
        {previewUrl && (
          <div style={{ display: "flex", justifyContent: "center", padding: "var(--sp-md)" }}>
            <img src={previewUrl} alt="Anteprima comanda" style={{ maxWidth: "100%", border: "1px solid var(--color-gray-200)", borderRadius: "var(--radius-md)" }} />
          </div>
        )}
      </Modal>

      {toast && (
        <div style={{
          position: "fixed", bottom: "var(--sp-lg)", left: "50%", transform: "translateX(-50%)",
          background: toast.type === "success" ? "#065f46" : "var(--color-danger)",
          color: "white", padding: "12px 24px", borderRadius: "var(--radius-lg)",
          fontWeight: 600, fontSize: "var(--text-sm)", boxShadow: "var(--shadow-lg)", zIndex: 9999,
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─── Mode Tab ────────────────────────────────────────────────────────────────

function ModeTab() {
  const [expressMode, setExpressMode] = useState<boolean | null>(null);
  const [receiptMode, setReceiptMode] = useState<"default" | "global" | "shift">("default");
  const [receiptPrefix, setReceiptPrefix] = useState("");
  const [receiptPadding, setReceiptPadding] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  // Grid settings
  const [gridViewMode, setGridViewMode] = useState<"category" | "all" | "grouped_category" | "grouped_center" | "grouped_color">("category");
  const [gridShowPrice, setGridShowPrice] = useState(true);
  const [gridShowDescription, setGridShowDescription] = useState(true);
  const [gridSortBy, setGridSortBy] = useState<"custom" | "name" | "price" | "color" | "category">("custom");
  const [gridBaseCols, setGridBaseCols] = useState(5);
  const [savingGrid, setSavingGrid] = useState(false);
  const [gridSaved, setGridSaved] = useState(false);

  // Multi-terminal
  const [multiTerminalEnabled, setMultiTerminalEnabled] = useState(false);
  const [savingMultiTerminal, setSavingMultiTerminal] = useState(false);

  useEffect(() => {
    adminApi.settings.get().then((s) => {
      setExpressMode(s.expressMode);
      setReceiptMode(s.receiptNumberMode);
      setReceiptPrefix(s.receiptNumberPrefix);
      setReceiptPadding(s.receiptNumberPadding);
      setGridViewMode(s.gridViewMode);
      setGridShowPrice(s.gridShowPrice);
      setGridShowDescription(s.gridShowDescription);
      setGridSortBy(s.gridSortBy);
      setGridBaseCols(s.gridBaseCols);
      setMultiTerminalEnabled(s.multiTerminalEnabled);
    }).catch(() => {});
  }, []);

  async function handleExpressToggle() {
    if (expressMode === null) return;
    const next = !expressMode;
    setSaving(true);
    try {
      await adminApi.settings.update({ expressMode: next });
      setExpressMode(next);
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  }

  async function handleReceiptSave() {
    setSavingReceipt(true);
    try {
      await adminApi.settings.update({ receiptNumberMode: receiptMode, receiptNumberPrefix: receiptPrefix, receiptNumberPadding: receiptPadding });
    } catch { /* ignore */ } finally {
      setSavingReceipt(false);
    }
  }

  async function handleReset() {
    await adminApi.settings.resetReceiptCounter("global");
    setResetConfirm(false);
    setResetDone(true);
    setTimeout(() => setResetDone(false), 3000);
  }

  async function handleGridSave() {
    setSavingGrid(true);
    try {
      await adminApi.settings.update({ gridViewMode, gridShowPrice, gridShowDescription, gridSortBy, gridBaseCols });
      setGridSaved(true);
      setTimeout(() => setGridSaved(false), 2500);
    } catch { /* ignore */ } finally {
      setSavingGrid(false);
    }
  }

  const previewNum = receiptMode === "default"
    ? "A3F9C1"
    : (receiptPadding > 0 ? `${receiptPrefix}${"42".padStart(receiptPadding, "0")}` : `${receiptPrefix}42`);

  const cardStyle: React.CSSProperties = {
    background: "var(--color-white)",
    border: "1px solid var(--color-gray-100)",
    borderRadius: "var(--radius-xl)",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    padding: "24px",
  };

  if (expressMode === null) {
    return (
      <div style={{ color: "var(--color-gray-400)", fontSize: "var(--text-sm)", padding: "var(--sp-lg)" }}>
        Caricamento...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-lg)", maxWidth: "560px" }}>
      {/* Express mode toggle */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--sp-md)" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "var(--text-md)", color: "var(--color-gray-900)", marginBottom: "6px" }}>
              Modalità Express
            </div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)", lineHeight: 1.5 }}>
              Salta il workflow cucina — l'ordine viene completato direttamente al pagamento senza passare per i stati confermato / in preparazione / pronto.
            </div>
            <div style={{ marginTop: "12px", fontSize: "var(--text-xs)", fontWeight: 600,
              color: expressMode ? "var(--color-success, #059669)" : "var(--color-gray-400)",
            }}>
              {expressMode ? "Attiva — gli ordini vengono completati al pagamento" : "Disattiva — gli ordini seguono il flusso cucina"}
            </div>
          </div>
          <button
            role="switch"
            aria-checked={expressMode}
            disabled={saving}
            onClick={handleExpressToggle}
            style={{
              width: "52px",
              height: "28px",
              borderRadius: "14px",
              background: expressMode ? "var(--color-brand)" : "var(--color-gray-200)",
              border: "none",
              cursor: saving ? "not-allowed" : "pointer",
              position: "relative",
              transition: "background 0.2s",
              flexShrink: 0,
              opacity: saving ? 0.6 : 1,
            }}
          >
            <span style={{
              position: "absolute",
              top: "3px",
              left: expressMode ? "27px" : "3px",
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              background: "var(--color-white)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              transition: "left 0.2s",
            }} />
          </button>
        </div>
      </div>

      {/* Receipt numbering */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, fontSize: "var(--text-md)", color: "var(--color-gray-900)", marginBottom: "4px" }}>
          Numerazione scontrini
        </div>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)", marginBottom: "18px" }}>
          Scegli come vengono numerati gli scontrini.
        </div>

        {/* Mode radios */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "18px" }}>
          {([
            ["default", "Default (UUID)", "Ultimi 6 caratteri dell'ID ordine — es. #A3F9C1"],
            ["global", "Incrementale globale", "1, 2, 3… — contatore che non si azzera mai"],
            ["shift", "Incrementale per turno", "Si azzera ad ogni nuovo turno di cassa"],
          ] as const).map(([val, label, desc]) => (
            <label key={val} style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
              <input type="radio" name="receiptMode" value={val} checked={receiptMode === val}
                onChange={() => setReceiptMode(val)}
                style={{ marginTop: "3px", accentColor: "var(--color-brand)" }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--color-gray-800)" }}>{label}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>{desc}</div>
              </div>
            </label>
          ))}
        </div>

        {/* Prefix + padding (only for non-default) */}
        {receiptMode !== "default" && (
          <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginBottom: "14px" }}>
            <div>
              <label style={labelStyle}>Prefisso</label>
              <input type="text" value={receiptPrefix} onChange={(e) => setReceiptPrefix(e.target.value)}
                placeholder="es. ORD-" style={{ ...inputStyle, width: "120px" }} />
            </div>
            <div>
              <label style={labelStyle}>Cifre (zero-padding)</label>
              <input type="number" min={0} max={8} value={receiptPadding}
                onChange={(e) => setReceiptPadding(Math.max(0, Math.min(8, Number(e.target.value))))}
                style={{ ...inputStyle, width: "80px" }} />
            </div>
          </div>
        )}

        {/* Live preview */}
        <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)", marginBottom: "16px" }}>
          Anteprima: <strong style={{ color: "var(--color-gray-800)" }}>#{previewNum}</strong>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <Button loading={savingReceipt} onClick={handleReceiptSave}>Salva numerazione</Button>

          {receiptMode !== "default" && (
            resetConfirm ? (
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-500)" }}>Confermi il reset a 0?</span>
                <button onClick={handleReset} style={{ padding: "6px 12px", borderRadius: "var(--radius-md)", background: "#DC2626", color: "#fff", border: "none", cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600 }}>Sì, resetta</button>
                <button onClick={() => setResetConfirm(false)} style={{ padding: "6px 12px", borderRadius: "var(--radius-md)", background: "var(--color-gray-100)", color: "var(--color-gray-600)", border: "none", cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600 }}>Annulla</button>
              </div>
            ) : (
              <button onClick={() => setResetConfirm(true)}
                style={{ padding: "8px 14px", borderRadius: "var(--radius-lg)", border: "1.5px solid #FECACA", background: "#FEF2F2", color: "#DC2626", cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: 600 }}>
                Reset contatore
              </button>
            )
          )}
          {resetDone && <span style={{ fontSize: "var(--text-xs)", color: "var(--color-success, #059669)", fontWeight: 600 }}>Contatore azzerato</span>}
        </div>
      </div>

      {/* Grid POS defaults */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, fontSize: "var(--text-md)", color: "var(--color-gray-900)", marginBottom: "4px" }}>
          Griglia POS — impostazioni default
        </div>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)", marginBottom: "18px", lineHeight: 1.5 }}>
          Definisci la visualizzazione predefinita del grid prodotti. Il cassiere può sovrascrivere queste impostazioni temporaneamente dal POS.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Vista default */}
          <div>
            <label style={{ ...labelStyle, display: "block", marginBottom: "8px" }}>Vista predefinita</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {([
                ["category",         "Per categoria",              "Sidebar con categorie, mostra i prodotti della categoria selezionata"],
                ["all",              "Tutti i prodotti",           "Griglia piatta con tutti i prodotti attivi"],
                ["grouped_category", "Raggruppati per categoria",  "Sezioni separate per ogni categoria"],
                ["grouped_center",   "Raggruppati per centro",     "Sezioni separate per centro di produzione"],
                ["grouped_color",    "Raggruppati per colore",     "Sezioni separate per colore prodotto"],
              ] as const).map(([val, label, desc]) => (
                <label key={val} style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
                  <input type="radio" name="gridViewMode" value={val} checked={gridViewMode === val}
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

          {/* Colonne base */}
          <div style={{ borderTop: "1px solid var(--color-gray-100)", paddingTop: "16px" }}>
            <label style={{ ...labelStyle, display: "block", marginBottom: "8px" }}>Colonne ({gridBaseCols})</label>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <input
                type="range" min={2} max={10} value={gridBaseCols}
                onChange={(e) => setGridBaseCols(Number(e.target.value))}
                style={{ flex: 1, accentColor: "var(--color-brand)" }}
              />
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

          {/* Campi visibili */}
          <div style={{ borderTop: "1px solid var(--color-gray-100)", paddingTop: "16px" }}>
            <div style={{ ...labelStyle, marginBottom: "10px" }}>Campi visibili sulle card</div>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {([
                ["Prezzo", gridShowPrice, () => setGridShowPrice(!gridShowPrice)] as [string, boolean, () => void],
                ["Descrizione", gridShowDescription, () => setGridShowDescription(!gridShowDescription)] as [string, boolean, () => void],
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

          {/* Ordinamento default */}
          <div style={{ borderTop: "1px solid var(--color-gray-100)", paddingTop: "16px" }}>
            <label style={{ ...labelStyle, display: "block", marginBottom: "8px" }}>Ordinamento predefinito</label>
            <select
              value={gridSortBy}
              onChange={(e) => setGridSortBy(e.target.value as typeof gridSortBy)}
              style={{ ...inputStyle, maxWidth: "240px", cursor: "pointer" }}
            >
              <option value="custom">Personalizzato (drag & drop)</option>
              <option value="name">Nome</option>
              <option value="price">Prezzo</option>
              <option value="color">Colore</option>
              <option value="category">Categoria</option>
            </select>
          </div>

        </div>

        <div style={{ marginTop: "20px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <Button loading={savingGrid} onClick={handleGridSave}>Salva impostazioni griglia</Button>
          {gridSaved && <span style={{ fontSize: "var(--text-xs)", color: "var(--color-success, #059669)", fontWeight: 600 }}>Salvato</span>}
          <a
            href="/pos?editLayout=1"
            style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              padding: "10px 18px", borderRadius: "var(--radius-md)",
              border: "1.5px solid var(--color-brand)",
              background: "transparent", color: "var(--color-brand)",
              fontSize: "var(--text-sm)", fontWeight: 700, fontFamily: "var(--font)",
              textDecoration: "none", cursor: "pointer",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" />
            </svg>
            Modifica layout POS
          </a>
        </div>
      </div>

      {/* Multi-terminal */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--sp-md)" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "var(--text-md)", color: "var(--color-gray-900)", marginBottom: "6px" }}>
              Multi-terminale
            </div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)", maxWidth: "380px", lineHeight: 1.5 }}>
              Abilita la gestione di più casse fisiche. Ogni terminale può avere stampanti dedicate.
              Una volta attivato, configura i terminali nel tab <strong>Terminali</strong>.
            </div>
          </div>
          <button
            onClick={async () => {
              setSavingMultiTerminal(true);
              const next = !multiTerminalEnabled;
              try {
                await adminApi.settings.update({ multiTerminalEnabled: next });
                setMultiTerminalEnabled(next);
              } catch { /* ignore */ } finally {
                setSavingMultiTerminal(false);
              }
            }}
            disabled={savingMultiTerminal}
            style={{
              flexShrink: 0,
              width: "52px", height: "28px",
              borderRadius: "999px",
              border: "none",
              background: multiTerminalEnabled ? "var(--color-brand)" : "var(--color-gray-300)",
              position: "relative",
              cursor: "pointer",
              transition: "background 0.2s",
            }}
          >
            <span style={{
              position: "absolute",
              top: "3px",
              left: multiTerminalEnabled ? "26px" : "3px",
              width: "22px", height: "22px",
              borderRadius: "50%",
              background: "white",
              transition: "left 0.2s",
            }} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shifts Tab ───────────────────────────────────────────────────────────────

function ZReportModal({ shiftId, onClose }: { shiftId: string | null; onClose: () => void }) {
  const [report, setReport] = useState<ZReport | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [loading_, setLoading_] = useState(false);

  useEffect(() => {
    if (!shiftId) { setReport(null); return; }
    setLoading_(true);
    Promise.all([
      apiClient.stats.zreport(shiftId),
      adminApi.restaurant.get(),
    ]).then(([r, rest]) => { setReport(r); setRestaurant(rest); })
      .catch(() => {})
      .finally(() => setLoading_(false));
  }, [shiftId]);

  const METHOD_LABELS: Record<string, string> = { cash: "Contanti", card: "Carta", digital_wallet: "Wallet", tab: "Conto" };

  return (
    <Modal open={shiftId !== null} onClose={onClose} title="Z-Report — Fine turno">
      <div style={{ minWidth: "460px", maxWidth: "560px" }}>
        {loading_ || !report ? (
          <div style={{ textAlign: "center", padding: "32px", color: "var(--color-gray-400)" }}>
            {loading_ ? "Caricamento..." : "Nessun dato"}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Restaurant header */}
            {restaurant?.name && (
              <div style={{ textAlign: "center", paddingBottom: "12px", borderBottom: "1px solid var(--color-gray-100)" }}>
                <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--color-gray-800)" }}>{restaurant.name}</div>
                {(restaurant.address || restaurant.city) && (
                  <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)" }}>
                    {[restaurant.address, restaurant.city].filter(Boolean).join(" — ")}
                  </div>
                )}
                {restaurant.vat && (
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>P.IVA {restaurant.vat}</div>
                )}
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", marginTop: "4px" }}>
                  {report && `Turno: ${new Date(report.shift.openedAt).toLocaleDateString("it-IT")} ${new Date(report.shift.openedAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}${report.shift.closedAt ? ` → ${new Date(report.shift.closedAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}` : " (in corso)"}`}
                </div>
              </div>
            )}

            {/* Summary grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
              {[
                { label: "Vendite nette", value: `€${report.summary.netSales.toFixed(2)}`, highlight: true },
                { label: "Ordini completati", value: String(report.summary.totalOrders) },
                { label: "Scontrino medio", value: `€${report.summary.avgTicket.toFixed(2)}` },
                { label: "Totale lordo", value: `€${report.summary.totalSales.toFixed(2)}` },
                { label: "Rimborsi", value: `€${report.summary.refundTotal.toFixed(2)}` },
                { label: "Annullati", value: String(report.summary.cancelledOrders) },
              ].map(({ label, value, highlight }) => (
                <div key={label} style={{ background: "var(--color-gray-50)", borderRadius: "var(--radius-md)", padding: "12px" }}>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)", fontWeight: 600, marginBottom: "4px" }}>{label}</div>
                  <div style={{ fontSize: highlight ? "var(--text-lg)" : "var(--text-md)", fontWeight: 700, color: highlight ? "var(--color-brand)" : "var(--color-gray-800)" }}>{value}</div>
                </div>
              ))}
            </div>

            {/* By payment method */}
            {report.byPaymentMethod.length > 0 && (
              <div>
                <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-400)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Per metodo di pagamento</div>
                <div style={{ background: "var(--color-white)", border: "1px solid var(--color-gray-100)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                  {report.byPaymentMethod.map((m, i) => (
                    <div key={m.method} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: i < report.byPaymentMethod.length - 1 ? "1px solid var(--color-gray-100)" : "none" }}>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-700)" }}>{METHOD_LABELS[m.method] ?? m.method} ({m.count})</span>
                      <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-gray-800)" }}>€{m.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* By category */}
            {report.byCategory.length > 0 && (
              <div>
                <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-400)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Per categoria</div>
                <div style={{ background: "var(--color-white)", border: "1px solid var(--color-gray-100)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                  {report.byCategory.sort((a, b) => b.amount - a.amount).map((c, i) => (
                    <div key={c.categoryName} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: i < report.byCategory.length - 1 ? "1px solid var(--color-gray-100)" : "none" }}>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-700)" }}>{c.categoryName} ({c.quantity} pz)</span>
                      <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-gray-800)" }}>€{c.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top products */}
            {report.topProducts.length > 0 && (
              <div>
                <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-400)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Top prodotti</div>
                <div style={{ background: "var(--color-white)", border: "1px solid var(--color-gray-100)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                  {report.topProducts.map((p, i) => (
                    <div key={p.name + i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: i < report.topProducts.length - 1 ? "1px solid var(--color-gray-100)" : "none" }}>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-700)" }}>{i + 1}. {p.name} ({p.quantity} pz)</span>
                      <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-gray-800)" }}>€{p.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button size="sm" variant="ghost" onClick={onClose}>Chiudi</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function ShiftsTab() {
  const [history, setHistory] = useState<Array<{
    id: string; userId: string; openedAt: number; closedAt: number | null;
    openingCash: number; closingCash: number | null; totalSales: number; totalOrders: number; notes: string | null;
  }>>([]);
  const { currentShift, setCurrentShift } = useShiftStore();
  const [loading_, setLoading_] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [openingCash, setOpeningCash] = useState("0");
  const [closingCash, setClosingCash] = useState("0");
  const [saving, setSaving] = useState(false);
  const [zReportShiftId, setZReportShiftId] = useState<string | null>(null);
  const { session } = useStore();

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
      const userId = session?.userId ?? "admin";
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
                      <th style={tableHeaderStyle}></th>
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
                        <td style={tableCellStyle}>
                          <button
                            onClick={() => setZReportShiftId(s.id)}
                            style={{ padding: "5px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-gray-200)", background: "var(--color-white)", cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600, fontFamily: "var(--font)", color: "var(--color-gray-600)" }}
                          >
                            Z-Report
                          </button>
                        </td>
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

      <ZReportModal shiftId={zReportShiftId} onClose={() => setZReportShiftId(null)} />
    </div>
  );
}

// ─── Modules Tab ─────────────────────────────────────────────────────────────

function ModulesTab({ onToggle }: { onToggle?: () => void }) {
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [loading_, setLoading_] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error_, setError_] = useState<string | null>(null);

  async function loadModules() {
    setLoading_(true);
    try {
      const data = await adminApi.modules.list();
      setModules(data);
    } catch (e) {
      setError_(e instanceof Error ? e.message : "Errore");
    } finally {
      setLoading_(false);
    }
  }

  useEffect(() => { void loadModules(); }, []);

  async function handleToggle(name: string) {
    setToggling(name);
    setError_(null);
    try {
      const updated = await adminApi.modules.toggle(name);
      setModules((prev) => prev.map((m) => m.name === name ? { ...m, enabled: updated.enabled } : m));
      onToggle?.();
    } catch (e) {
      setError_(e instanceof Error ? e.message : "Errore");
    } finally {
      setToggling(null);
    }
  }

  if (loading_) {
    return <div style={{ color: "var(--color-gray-400)", fontSize: "var(--text-sm)", padding: "var(--sp-lg)" }}>Caricamento...</div>;
  }

  return (
    <div style={{ padding: "var(--sp-lg)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--sp-lg)" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-800)", margin: 0 }}>Moduli</h2>
        <button onClick={() => void loadModules()} style={{ padding: "6px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-gray-200)", background: "var(--color-white)", cursor: "pointer", display: "flex", color: "var(--color-gray-500)" }}>
          <ArrowPathIcon style={{ width: "16px", height: "16px" }} />
        </button>
      </div>
      {error_ && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "var(--radius-md)", padding: "12px 16px", marginBottom: "16px", fontSize: "var(--text-sm)", color: "#DC2626" }}>
          {error_}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {modules.map((mod) => (
          <div key={mod.name} style={{ background: "var(--color-white)", borderRadius: "var(--radius-xl)", padding: "20px 24px", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <span style={{ fontWeight: 700, fontSize: "var(--text-md)", color: "var(--color-gray-800)" }}>{mod.name}</span>
                  <span style={{
                    fontSize: "var(--text-xs)", fontWeight: 600, padding: "2px 8px", borderRadius: "999px",
                    background: mod.enabled ? "rgba(34,197,94,0.12)" : "var(--color-gray-100)",
                    color: mod.enabled ? "#15803D" : "var(--color-gray-400)",
                  }}>
                    {mod.enabled ? "attivo" : "disabilitato"}
                  </span>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>v{mod.version}</span>
                </div>
                {mod.dependencies.length > 0 && (
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>
                    Dipende da: {mod.dependencies.join(", ")}
                  </div>
                )}
                {mod.dependencyErrors.length > 0 && (
                  <div style={{ marginTop: "6px", fontSize: "var(--text-xs)", color: "#DC2626", fontWeight: 600 }}>
                    {mod.dependencyErrors[0]}
                  </div>
                )}
              </div>
              <button
                role="switch"
                aria-checked={mod.enabled}
                disabled={toggling === mod.name}
                onClick={() => void handleToggle(mod.name)}
                style={{
                  width: "48px", height: "26px", borderRadius: "13px",
                  background: mod.enabled ? "var(--color-brand)" : "var(--color-gray-200)",
                  border: "none", cursor: toggling === mod.name ? "not-allowed" : "pointer",
                  position: "relative", transition: "background 0.2s", flexShrink: 0,
                  opacity: toggling === mod.name ? 0.6 : 1,
                }}
              >
                <span style={{
                  position: "absolute", top: "3px",
                  left: mod.enabled ? "25px" : "3px",
                  width: "20px", height: "20px", borderRadius: "50%",
                  background: "var(--color-white)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  transition: "left 0.2s",
                }} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Inventory Tab ────────────────────────────────────────────────────────────

function InventoryTab() {
  const [items, setItems] = useState<InventoryItemRecord[]>([]);
  const [loading_, setLoading_] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InventoryItemRecord | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<InventoryItemRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", sku: "", unit: "pz", currentStock: "0", minStock: "0" });
  const [adjustQty, setAdjustQty] = useState("0");
  const [adjustReason, setAdjustReason] = useState("");

  async function load() {
    setLoading_(true);
    try { setItems(await adminApi.inventory.listItems()); } catch { /* ignore */ } finally { setLoading_(false); }
  }

  useEffect(() => { void load(); }, []);

  function openCreate() {
    setEditTarget(null);
    setForm({ name: "", sku: "", unit: "pz", currentStock: "0", minStock: "0" });
    setModalOpen(true);
  }

  function openEdit(item: InventoryItemRecord) {
    setEditTarget(item);
    setForm({ name: item.name, sku: item.sku ?? "", unit: item.unit, currentStock: String(item.currentStock), minStock: String(item.minStock) });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editTarget) {
        const updated = await adminApi.inventory.updateItem(editTarget.id, {
          name: form.name,
          sku: form.sku === "" ? null : form.sku,
          unit: form.unit,
          minStock: Number(form.minStock),
        });
        setItems((prev) => prev.map((i) => i.id === editTarget.id ? updated : i));
      } else {
        const created = await adminApi.inventory.createItem({
          name: form.name,
          ...(form.sku !== "" ? { sku: form.sku } : {}),
          unit: form.unit,
          currentStock: Number(form.currentStock),
          minStock: Number(form.minStock),
        });
        setItems((prev) => [...prev, created]);
      }
      setModalOpen(false);
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    await adminApi.inventory.deleteItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setDeleteId(null);
  }

  async function handleAdjust() {
    if (!adjustTarget) return;
    setSaving(true);
    try {
      const updated = await adminApi.inventory.adjustStock(adjustTarget.id, Number(adjustQty), adjustReason || undefined);
      setItems((prev) => prev.map((i) => i.id === adjustTarget.id ? updated : i));
      setAdjustTarget(null);
    } finally { setSaving(false); }
  }

  return (
    <div style={{ padding: "var(--sp-lg)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-lg)" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-800)", margin: 0 }}>Inventario</h2>
        <Button size="sm" onClick={openCreate} icon={<PlusIcon style={{ width: "16px", height: "16px" }} />}>Nuovo item</Button>
      </div>
      <div style={{ background: "var(--color-white)", borderRadius: "var(--radius-xl)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        {loading_ ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--color-gray-400)", fontSize: "var(--text-sm)" }}>Caricamento...</div>
        ) : items.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--color-gray-400)", fontSize: "var(--text-sm)" }}>Nessun item inventario.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>Nome</th>
                <th style={tableHeaderStyle}>SKU</th>
                <th style={tableHeaderStyle}>Unità</th>
                <th style={{ ...tableHeaderStyle, textAlign: "right" }}>Stock</th>
                <th style={{ ...tableHeaderStyle, textAlign: "right" }}>Min</th>
                <th style={{ ...tableHeaderStyle, textAlign: "center" }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isLow = item.minStock > 0 && item.currentStock <= item.minStock;
                return (
                  <tr key={item.id} style={{ background: isLow ? "rgba(239,68,68,0.04)" : undefined }}>
                    <td style={tableCellStyle}>
                      <span style={{ fontWeight: 600, color: "var(--color-gray-800)" }}>{item.name}</span>
                      {isLow && <span style={{ marginLeft: "8px", fontSize: "var(--text-xs)", color: "#DC2626", fontWeight: 700 }}>SCORTA BASSA</span>}
                    </td>
                    <td style={tableCellStyle}>{item.sku ?? "—"}</td>
                    <td style={tableCellStyle}>{item.unit}</td>
                    <td style={{ ...tableCellStyle, textAlign: "right", fontWeight: 600, color: isLow ? "#DC2626" : "var(--color-gray-800)" }}>{item.currentStock}</td>
                    <td style={{ ...tableCellStyle, textAlign: "right" }}>{item.minStock}</td>
                    <td style={{ ...tableCellStyle, textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                        <button onClick={() => { setAdjustTarget(item); setAdjustQty("0"); setAdjustReason(""); }} style={{ padding: "5px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-gray-200)", background: "var(--color-white)", cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-gray-600)", fontFamily: "var(--font)" }}>Rettifica</button>
                        <button onClick={() => openEdit(item)} style={{ padding: "6px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-gray-200)", background: "var(--color-white)", cursor: "pointer", color: "var(--color-gray-600)", display: "flex" }}><PencilSquareIcon style={{ width: "14px", height: "14px" }} /></button>
                        <button onClick={() => setDeleteId(item.id)} style={{ padding: "6px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-danger)", background: "var(--color-white)", cursor: "pointer", color: "var(--color-danger)", display: "flex" }}><TrashIcon style={{ width: "14px", height: "14px" }} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? "Modifica item" : "Nuovo item inventario"}>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={labelStyle}>Nome</label>
            <input style={inputStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Es. Birra, Pane, ecc." autoFocus />
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>SKU</label>
              <input style={inputStyle} value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} placeholder="Codice opzionale" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Unità</label>
              <input style={inputStyle} value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="pz, kg, lt..." />
            </div>
          </div>
          {!editTarget && (
            <div>
              <label style={labelStyle}>Stock iniziale</label>
              <input style={inputStyle} type="number" value={form.currentStock} onChange={(e) => setForm((f) => ({ ...f, currentStock: e.target.value }))} />
            </div>
          )}
          <div>
            <label style={labelStyle}>Stock minimo (soglia alert)</label>
            <input style={inputStyle} type="number" value={form.minStock} onChange={(e) => setForm((f) => ({ ...f, minStock: e.target.value }))} />
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>Annulla</Button>
            <Button size="sm" loading={saving} disabled={!form.name.trim()} onClick={() => void handleSave()}>{editTarget ? "Salva" : "Aggiungi"}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={adjustTarget !== null} onClose={() => setAdjustTarget(null)} title={`Rettifica stock — ${adjustTarget?.name ?? ""}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={labelStyle}>Quantità (positivo = aggiunta, negativo = consumo)</label>
            <input style={inputStyle} type="number" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} autoFocus />
          </div>
          <div>
            <label style={labelStyle}>Motivo (opzionale)</label>
            <input style={inputStyle} value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Inventario fisico, scarico, ecc." />
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Button variant="ghost" size="sm" onClick={() => setAdjustTarget(null)}>Annulla</Button>
            <Button size="sm" loading={saving} onClick={() => void handleAdjust()}>Applica</Button>
          </div>
        </div>
      </Modal>

      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Elimina item">
        <p style={{ color: "var(--color-gray-600)", fontSize: "var(--text-sm)", marginBottom: "20px" }}>Eliminare questo item inventario?</p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <Button variant="ghost" size="sm" onClick={() => setDeleteId(null)}>Annulla</Button>
          <Button variant="danger" size="sm" onClick={() => deleteId && void handleDelete(deleteId)}>Elimina</Button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Movements Tab ────────────────────────────────────────────────────────────

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  sale: "Vendita",
  restock: "Rifornimento",
  manual: "Manuale",
  waste: "Scarto",
};

function MovementsTab() {
  const [movements, setMovements] = useState<InventoryMovementRecord[]>([]);
  const [loading_, setLoading_] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("");

  async function load(type?: string) {
    setLoading_(true);
    try {
      const data = await adminApi.inventory.listMovements(type ? { type } : undefined);
      setMovements(data);
    } catch { /* ignore */ } finally { setLoading_(false); }
  }

  useEffect(() => { void load(typeFilter || undefined); }, [typeFilter]);

  return (
    <div style={{ padding: "var(--sp-lg)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "var(--sp-lg)" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-800)", margin: 0 }}>Movimenti inventario</h2>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{ ...inputStyle, width: "160px", height: "38px", fontSize: "var(--text-sm)" }}
        >
          <option value="">Tutti i tipi</option>
          <option value="sale">Vendita</option>
          <option value="restock">Rifornimento</option>
          <option value="manual">Manuale</option>
          <option value="waste">Scarto</option>
        </select>
      </div>
      <div style={{ background: "var(--color-white)", borderRadius: "var(--radius-xl)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        {loading_ ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--color-gray-400)", fontSize: "var(--text-sm)" }}>Caricamento...</div>
        ) : movements.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--color-gray-400)", fontSize: "var(--text-sm)" }}>Nessun movimento registrato.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>Data</th>
                <th style={tableHeaderStyle}>Tipo</th>
                <th style={{ ...tableHeaderStyle, textAlign: "right" }}>Quantità</th>
                <th style={tableHeaderStyle}>Motivo / Ordine</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td style={tableCellStyle}>{new Date(m.createdAt * 1000).toLocaleString("it-IT")}</td>
                  <td style={tableCellStyle}>
                    <span style={{
                      fontSize: "var(--text-xs)", fontWeight: 600, padding: "2px 8px", borderRadius: "999px",
                      background: m.type === "sale" ? "rgba(239,68,68,0.1)" : m.type === "restock" ? "rgba(34,197,94,0.1)" : "var(--color-gray-100)",
                      color: m.type === "sale" ? "#DC2626" : m.type === "restock" ? "#15803D" : "var(--color-gray-600)",
                    }}>
                      {MOVEMENT_TYPE_LABELS[m.type] ?? m.type}
                    </span>
                  </td>
                  <td style={{ ...tableCellStyle, textAlign: "right", fontWeight: 600, color: m.quantity < 0 ? "#DC2626" : "#15803D" }}>
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </td>
                  <td style={{ ...tableCellStyle, color: "var(--color-gray-500)" }}>
                    {m.reason ?? (m.orderId ? `Ordine #${m.orderId.slice(-6).toUpperCase()}` : "—")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Terminals Tab ────────────────────────────────────────────────────────────

function TerminalsTab(_props: { onMultiTerminalChange?: (v: boolean) => void }) {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading_, setLoading_] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingNew, setSavingNew] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [terminalPrinters, setTerminalPrinters] = useState<Record<string, string[]>>({});

  const now = Date.now();
  const isOnline = (t: Terminal) => t.lastSeenAt !== null && now - t.lastSeenAt < 5 * 60 * 1000;

  useEffect(() => {
    Promise.all([
      adminApi.terminals.list(),
      adminApi.printers.list(),
    ]).then(([tList, pList]) => {
      setTerminals(tList);
      setPrinters(pList);
    }).catch(() => {}).finally(() => setLoading_(false));
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
        setTerminalPrinters((prev) => ({ ...prev, [terminalId]: current.filter((id) => id !== printerId) }));
      } else {
        await adminApi.terminals.assignPrinter(terminalId, printerId);
        setTerminalPrinters((prev) => ({ ...prev, [terminalId]: [...current, printerId] }));
      }
    } catch { /* ignore */ }
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
                  title="Stampanti"
                  onClick={() => {
                    if (!expanded) loadTerminalPrinters(t.id);
                    setExpandedId(expanded ? null : t.id);
                  }}
                  style={{ background: "none", border: "1px solid var(--color-gray-200)", borderRadius: "var(--radius-md)", padding: "5px 10px", cursor: "pointer", fontSize: "var(--text-xs)", color: "var(--color-gray-600)" }}
                >
                  Stampanti
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
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── AdminScreen ──────────────────────────────────────────────────────────────

// Which tabs require a module to be enabled (module name → tab keys)
const MODULE_TAB_MAP: Record<string, Tab[]> = {
  inventory: ["inventory", "movements"],
};

export function AdminScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("restaurant");
  const { setCategories, setProducts, setProductionCenters, setLoading, loading } = useAdminStore();
  const navigate = useNavigate();
  const [lowStockCount, setLowStockCount] = useState(0);
  const [enabledModules, setEnabledModules] = useState<Set<string>>(new Set());
  const [multiTerminalEnabled, setMultiTerminalEnabled] = useState(false);

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

    adminApi.modules.list()
      .then((mods) => setEnabledModules(new Set(mods.filter((m) => m.enabled).map((m) => m.name))))
      .catch(() => setEnabledModules(new Set()));

    adminApi.inventory.getAlerts().then((alerts) => setLowStockCount(alerts.length)).catch(() => {});
    adminApi.settings.get().then((s) => setMultiTerminalEnabled(s.multiTerminalEnabled)).catch(() => {});
  }, []);

  // Re-fetch enabled modules when a module is toggled (ModulesTab calls this via callback)
  function refreshEnabledModules() {
    adminApi.modules.list()
      .then((mods) => setEnabledModules(new Set(mods.filter((m) => m.enabled).map((m) => m.name))))
      .catch(() => {});
  }

  function isTabVisible(key: Tab): boolean {
    if (key === "terminals" && !multiTerminalEnabled) return false;
    for (const [moduleName, tabs] of Object.entries(MODULE_TAB_MAP)) {
      if (tabs.includes(key) && !enabledModules.has(moduleName)) return false;
    }
    return true;
  }

  const visibleTabs = TABS.filter((t) => isTabVisible(t.key));

  // If current tab became hidden (module disabled), fall back to first visible tab
  const resolvedActiveTab = isTabVisible(activeTab) ? activeTab : (visibleTabs[0]?.key ?? "restaurant");
  const activeTab_ = visibleTabs.find((t) => t.key === resolvedActiveTab) ?? visibleTabs[0]!

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
          {lowStockCount > 0 && (
            <button
              onClick={() => setActiveTab("inventory")}
              title={`${lowStockCount} prodott${lowStockCount === 1 ? "o" : "i"} sotto scorta`}
              style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px", padding: "5px 12px", borderRadius: "999px", background: "#fef2f2", border: "1px solid #fca5a5", cursor: "pointer", color: "#dc2626", fontSize: "var(--text-xs)", fontWeight: 700 }}
            >
              ⚠ {lowStockCount} sotto scorta
            </button>
          )}
        </div>

        {/* Nav pills */}
        <div style={{
          display: "flex",
          gap: "6px",
          padding: "0 32px 14px",
          overflowX: "auto",
          scrollbarWidth: "none",
        }}>
          {visibleTabs.map(({ key, label, Icon }) => {
            const active = resolvedActiveTab === key;
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
                  flexShrink: 0,
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
            {resolvedActiveTab === "restaurant" && <RestaurantTab />}
            {resolvedActiveTab === "products" && <ProductsTab />}
            {resolvedActiveTab === "categories" && <CategoriesTab />}
            {resolvedActiveTab === "production-centers" && <ProductionCentersTab />}
            {resolvedActiveTab === "payment-methods" && <PaymentMethodsTab />}
            {resolvedActiveTab === "printers" && <PrintersTab />}
            {resolvedActiveTab === "receipt-template" && <ReceiptTemplateTab />}
            {resolvedActiveTab === "kitchen-template" && <KitchenTemplateTab />}
            {resolvedActiveTab === "shifts" && <ShiftsTab />}
            {resolvedActiveTab === "backup" && <BackupTab />}
            {resolvedActiveTab === "mode" && <ModeTab />}
            {resolvedActiveTab === "modules" && <ModulesTab onToggle={refreshEnabledModules} />}
            {resolvedActiveTab === "inventory" && <InventoryTab />}
            {resolvedActiveTab === "movements" && <MovementsTab />}
            {resolvedActiveTab === "terminals" && <TerminalsTab onMultiTerminalChange={setMultiTerminalEnabled} />}
          </div>
        )}
      </div>
    </div>
  );
}
