import { useEffect, useState } from "react";
import { adminApi } from "../../core/admin-api.js";
import type { InventoryItemRecord } from "../../core/admin-api.js";
import { Button } from "../../components/ui/Button.js";
import { Modal } from "../../components/ui/Modal.js";
import { PlusIcon, PencilSquareIcon, TrashIcon } from "../../components/ui/icons.js";
import { inputStyle, labelStyle, tableHeaderStyle, tableCellStyle } from "./shared.js";
import type { Product } from "@pos/shared-types";

const toggleStyle = (on: boolean): React.CSSProperties => ({
  width: "44px", height: "24px", borderRadius: "12px",
  background: on ? "var(--color-brand)" : "var(--color-gray-200)",
  border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0,
});
const thumbStyle = (on: boolean): React.CSSProperties => ({
  position: "absolute", top: "2px", left: on ? "22px" : "2px",
  width: "20px", height: "20px", borderRadius: "50%",
  background: "var(--color-white)", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s",
});

export function InventoryTab() {
  const [items, setItems] = useState<InventoryItemRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading_, setLoading_] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InventoryItemRecord | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<InventoryItemRecord | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    sku: "",
    unit: "pz",
    currentStock: "0",
    minStock: "0",
    productId: "",
    resetOnShiftOpen: false,
  });

  const [adjustQty, setAdjustQty] = useState("0");
  const [adjustReason, setAdjustReason] = useState("");

  async function load() {
    setLoading_(true);
    try {
      const [inv, prods] = await Promise.all([
        adminApi.inventory.listItems(),
        adminApi.products.list(),
      ]);
      setItems(inv);
      setProducts(prods);
    } catch { /* ignore */ } finally { setLoading_(false); }
  }

  useEffect(() => { void load(); }, []);

  function openCreate() {
    setEditTarget(null);
    setForm({ name: "", sku: "", unit: "pz", currentStock: "0", minStock: "0", productId: "", resetOnShiftOpen: false });
    setModalOpen(true);
  }

  function openEdit(item: InventoryItemRecord) {
    setEditTarget(item);
    setForm({
      name: item.name,
      sku: item.sku ?? "",
      unit: item.unit,
      currentStock: String(item.currentStock),
      minStock: String(item.minStock),
      productId: item.productId !== null ? String(item.productId) : "",
      resetOnShiftOpen: item.resetOnShiftOpen === 1,
    });
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
          productId: form.productId === "" ? null : parseInt(form.productId, 10),
          resetOnShiftOpen: form.resetOnShiftOpen,
        });
        setItems((prev) => prev.map((i) => i.id === editTarget.id ? updated : i));
      } else {
        const created = await adminApi.inventory.createItem({
          name: form.name,
          ...(form.sku !== "" ? { sku: form.sku } : {}),
          unit: form.unit,
          currentStock: Number(form.currentStock),
          minStock: Number(form.minStock),
          productId: form.productId === "" ? null : parseInt(form.productId, 10),
          resetOnShiftOpen: form.resetOnShiftOpen,
        });
        setItems((prev) => [...prev, created]);
      }
      setModalOpen(false);
    } finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
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
      setAdjustQty("0");
      setAdjustReason("");
    } finally { setSaving(false); }
  }

  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

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
                <th style={tableHeaderStyle}>Nome / Prodotto</th>
                <th style={tableHeaderStyle}>SKU</th>
                <th style={tableHeaderStyle}>Unità</th>
                <th style={{ ...tableHeaderStyle, textAlign: "right" }}>Stock</th>
                <th style={{ ...tableHeaderStyle, textAlign: "right" }}>Min</th>
                <th style={{ ...tableHeaderStyle, textAlign: "center" }}>Carico turno</th>
                <th style={{ ...tableHeaderStyle, textAlign: "center" }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isLow = item.minStock > 0 && item.currentStock <= item.minStock;
                const linkedProduct = item.productId ? productMap[item.productId] : null;
                return (
                  <tr key={item.id} style={{ background: isLow ? "rgba(239,68,68,0.04)" : undefined }}>
                    <td style={tableCellStyle}>
                      <span style={{ fontWeight: 600, color: "var(--color-gray-800)" }}>{item.name}</span>
                      {isLow && <span style={{ marginLeft: "8px", fontSize: "var(--text-xs)", color: "#DC2626", fontWeight: 700 }}>SCORTA BASSA</span>}
                      {linkedProduct && (
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--color-brand)", marginTop: "2px" }}>
                          → {linkedProduct.name}
                        </div>
                      )}
                    </td>
                    <td style={tableCellStyle}>{item.sku ?? "—"}</td>
                    <td style={tableCellStyle}>{item.unit}</td>
                    <td style={{ ...tableCellStyle, textAlign: "right", fontWeight: 600, color: isLow ? "#DC2626" : "var(--color-gray-800)" }}>{item.currentStock}</td>
                    <td style={{ ...tableCellStyle, textAlign: "right" }}>{item.minStock}</td>
                    <td style={{ ...tableCellStyle, textAlign: "center" }}>
                      {item.resetOnShiftOpen === 1
                        ? <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-brand)" }}>Si</span>
                        : <span style={{ color: "var(--color-gray-300)", fontSize: "var(--text-xs)" }}>—</span>}
                    </td>
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

      {/* Create / edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? "Modifica item" : "Nuovo item inventario"}>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

          {/* Prodotto collegato */}
          <div>
            <label style={labelStyle}>Prodotto collegato (opzionale)</label>
            <select
              style={{ ...inputStyle, appearance: "auto" }}
              value={form.productId}
              onChange={(e) => {
                const pid = e.target.value;
                const prod = products.find((p) => String(p.id) === pid);
                setForm((f) => ({
                  ...f,
                  productId: pid,
                  name: f.name === "" && prod ? prod.name : f.name,
                }));
              }}
            >
              <option value="">— Nessuno —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.categoryName ? ` (${p.categoryName})` : ""}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Nome item inventario</label>
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

          {/* Carico turno */}
          <div style={{ background: "var(--color-gray-50)", borderRadius: "var(--radius-md)", padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--color-gray-800)" }}>Carico apertura turno</div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-500)", marginTop: "2px" }}>Mostra questo item nel modal di apertura turno per inserire la quantità iniziale.</div>
            </div>
            <button
              onClick={() => setForm((f) => ({ ...f, resetOnShiftOpen: !f.resetOnShiftOpen }))}
              style={toggleStyle(form.resetOnShiftOpen)}
            >
              <span style={thumbStyle(form.resetOnShiftOpen)} />
            </button>
          </div>

          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>Annulla</Button>
            <Button size="sm" loading={saving} disabled={!form.name.trim()} onClick={() => void handleSave()}>
              {editTarget ? "Salva" : "Aggiungi"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Adjust stock modal */}
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
