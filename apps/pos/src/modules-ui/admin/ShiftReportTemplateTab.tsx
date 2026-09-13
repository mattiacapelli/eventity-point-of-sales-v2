import React, { useEffect, useRef, useState } from "react";
import { adminApi } from "../../core/admin-api.js";
import { useStore } from "../../state/global-store.js";
import { useToastStore } from "../../components/ui/Toast.js";
import { Button } from "../../components/ui/Button.js";
import { Modal } from "../../components/ui/Modal.js";
import { GenericBlockEditor } from "./BlockEditor.js";
import type { ShiftReportTemplate, ShiftReportBlock, ShiftReportBlockType } from "@pos/shared-types";
import { inputStyle, labelStyle } from "./shared.js";

const SHIFT_REPORT_BLOCK_TYPE_LABELS: Record<ShiftReportBlockType, string> = {
  "logo":                  "Logo",
  "restaurant-name":       "Nome ristorante",
  "restaurant-address":    "Indirizzo",
  "restaurant-phone":      "Telefono",
  "restaurant-vat":        "P.IVA",
  "text":                  "Testo libero",
  "divider":               "Separatore",
  "shift-period":          "Periodo turno",
  "kpi-summary":           "Riepilogo KPI",
  "by-hour":               "Per fascia oraria",
  "by-category":           "Per categoria",
  "by-production-center":  "Per centro di produzione",
  "by-payment-method":     "Per metodo di pagamento",
  "by-terminal":           "Per terminale",
  "top-products":          "Top prodotti",
  "footer":                "Footer",
};

const DEFAULT_SHIFT_REPORT_BLOCKS: ShiftReportBlock[] = [
  { id: "s1", type: "restaurant-name", align: "center", fontSize: 20, fontFamily: "DejaVu Sans", bold: true,  paddingTop: 0, visible: true },
  { id: "s2", type: "text",            align: "center", fontSize: 16, fontFamily: "DejaVu Sans", bold: true,  paddingTop: 8, visible: true, content: "REPORT TURNO" },
  { id: "s3", type: "divider",         align: "left",   fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 8, visible: true },
  { id: "s4", type: "shift-period",    align: "left",   fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 0, visible: true },
  { id: "s5", type: "divider",         align: "left",   fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 8, visible: true },
  { id: "s6", type: "text",            align: "left",   fontSize: 14, fontFamily: "DejaVu Sans", bold: true,  paddingTop: 0, visible: true, content: "RIEPILOGO" },
  { id: "s7", type: "kpi-summary",     align: "left",   fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 4, visible: true },
];

function ShiftReportBlockEditor({ blocks, onChange, availableFonts }: {
  blocks: ShiftReportBlock[];
  onChange: (b: ShiftReportBlock[]) => void;
  availableFonts: string[];
}) {
  return (
    <GenericBlockEditor<ShiftReportBlock>
      blocks={blocks}
      onChange={onChange}
      availableFonts={availableFonts}
      typeLabels={SHIFT_REPORT_BLOCK_TYPE_LABELS}
      supportsLogo
      showLogoAddButton={false}
      maxFontSize={72}
      logoWidthDefault={60}
      defaultBlock={(type) => {
        const id = Math.random().toString(36).slice(2);
        const base: ShiftReportBlock = { id, type: type as ShiftReportBlockType, align: type === "logo" ? "center" : "left", fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 8, visible: true };
        if (type === "text" || type === "footer") base.content = "";
        return base;
      }}
    />
  );
}

export function ShiftReportTemplateTab() {
  const [templates, setTemplates] = useState<ShiftReportTemplate[]>([]);
  const [selected, setSelected] = useState<ShiftReportTemplate | null>(null);
  const [blocks, setBlocks] = useState<ShiftReportBlock[]>(DEFAULT_SHIFT_REPORT_BLOCKS);
  const [canvasWidth, setCanvasWidth] = useState(576);
  const [saving, setSaving] = useState(false);
  const [availableFonts, setAvailableFonts] = useState<string[]>([]);
  const [fontUploading, setFontUploading] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    adminApi.shiftReportTemplates.list().then((ts) => {
      setTemplates(ts);
      if (ts[0]) selectTemplate(ts[0]);
    }).catch(console.error);
    adminApi.receiptTemplates.listFonts().then(setAvailableFonts).catch(() => {});
  }, []);

  // Live image preview with debounce
  useEffect(() => {
    if (!selected) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const token = useStore.getState().session?.token;
        const res = await fetch(adminApi.shiftReportTemplates.previewUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ blocks, canvasWidth }),
        });
        if (!res.ok) return;
        const blob = await res.blob();
        setPreviewBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
      } catch { /* silent */ } finally { setPreviewLoading(false); }
    }, 800);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [blocks, canvasWidth, selected?.id]);

  function selectTemplate(t: ShiftReportTemplate) {
    setSelected(t);
    const parsed = t.blocks ? (typeof t.blocks === "string" ? JSON.parse(t.blocks) : t.blocks) as ShiftReportBlock[] : DEFAULT_SHIFT_REPORT_BLOCKS;
    setBlocks(parsed);
    setCanvasWidth(t.canvasWidth ?? 576);
    setPreviewBlobUrl(null);
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await adminApi.shiftReportTemplates.update(selected.id, { blocks, canvasWidth });
      setTemplates((prev) => prev.map((t) => t.id === updated.id ? updated : t));
      setSelected(updated);
    } finally { setSaving(false); }
  }

  async function handleSetActive(id: string) {
    const updated = await adminApi.shiftReportTemplates.update(id, { active: true });
    setTemplates((prev) => prev.map((t) => t.id === updated.id ? updated : { ...t, active: false }));
    if (selected?.id === id) setSelected(updated);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await adminApi.shiftReportTemplates.create({ name: newName.trim() });
      setTemplates((prev) => [...prev, created]);
      setNewName("");
      selectTemplate(created);
    } finally { setCreating(false); }
  }

  async function handleDelete(id: string) {
    await adminApi.shiftReportTemplates.delete(id);
    const remaining = templates.filter((t) => t.id !== id);
    setTemplates(remaining);
    setDeleteConfirmId(null);
    if (selected?.id === id) {
      const next = remaining[0] ?? null;
      if (next) selectTemplate(next); else { setSelected(null); setBlocks(DEFAULT_SHIFT_REPORT_BLOCKS); }
    }
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
      useToastStore.getState().show(err instanceof Error ? err.message : "Errore upload font");
    } finally { setFontUploading(false); }
  }

  return (
    <div style={{ padding: "var(--sp-lg)" }}>
      {/* Template selector + new */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
        {templates.map((t) => (
          <button key={t.id} type="button" onClick={() => selectTemplate(t)}
            style={{ padding: "6px 14px", borderRadius: "var(--radius-lg)", border: `1.5px solid ${selected?.id === t.id ? "var(--color-brand)" : "var(--color-gray-200)"}`, background: selected?.id === t.id ? "var(--color-brand)" : "var(--color-white)", color: selected?.id === t.id ? "#fff" : "var(--color-gray-700)", cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: 600, fontFamily: "var(--font)" }}>
            {t.name}
            {t.active && <span style={{ marginLeft: "6px", fontSize: "10px", opacity: 0.8 }}>●</span>}
          </button>
        ))}
        <div style={{ display: "flex", gap: "6px" }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
            placeholder="Nuovo template..." style={{ ...inputStyle, width: "180px", height: "36px" }} />
          <Button size="sm" loading={creating} disabled={!newName.trim()} onClick={() => void handleCreate()}>Crea</Button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--sp-lg)", flexWrap: "wrap", gap: "10px" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-800)", margin: 0 }}>Template report turno</h2>
        {selected && (
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            {!selected.active && (
              <Button size="sm" variant="ghost" onClick={() => void handleSetActive(selected.id)}>Attiva</Button>
            )}
            <Button loading={saving} onClick={() => void handleSave()}>Salva</Button>
            <Button variant="danger" size="sm" onClick={() => setDeleteConfirmId(selected.id)}>Elimina</Button>
          </div>
        )}
      </div>

      {templates.length === 0 && (
        <div style={{ textAlign: "center", padding: "var(--sp-xl)", color: "var(--color-gray-400)", fontSize: "var(--text-sm)" }}>
          Nessun template. Crea il primo usando il campo sopra.
        </div>
      )}

      {selected && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px", alignItems: "start" }}>
          {/* Left: controls */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", gap: "14px", alignItems: "flex-end", flexWrap: "wrap" }}>
              <div>
                <label style={labelStyle}>Larghezza (px)</label>
                <input type="number" min={200} max={800} value={canvasWidth}
                  onChange={(e) => setCanvasWidth(Number(e.target.value))}
                  style={{ ...inputStyle, width: "100px" }} />
              </div>
              <div>
                <label style={labelStyle}>Font (.ttf)</label>
                <label style={{ display: "inline-flex", alignItems: "center", padding: "8px 14px", borderRadius: "var(--radius-lg)", border: "1.5px solid var(--color-gray-200)", background: "var(--color-white)", cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-700)" }}>
                  {fontUploading ? "Caricamento..." : "Carica font"}
                  <input type="file" accept=".ttf" style={{ display: "none" }} onChange={(e) => void handleFontUpload(e)} />
                </label>
              </div>
            </div>
            <ShiftReportBlockEditor blocks={blocks} onChange={setBlocks} availableFonts={availableFonts} />
            <Button loading={saving} onClick={() => void handleSave()}>Salva template</Button>
          </div>

          {/* Right: live preview */}
          <div style={{ position: "sticky", top: "20px" }}>
            <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-400)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
              Anteprima
              {previewLoading && <span style={{ fontWeight: 400 }}>Aggiornamento...</span>}
            </div>
            <div style={{ background: "#fff", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-gray-200)", boxShadow: "0 4px 20px rgba(0,0,0,0.10)", overflow: "hidden", minHeight: "200px", display: "flex", alignItems: "center", justifyContent: "center", opacity: previewLoading ? 0.6 : 1, transition: "opacity 0.2s" }}>
              {previewBlobUrl
                ? <img src={previewBlobUrl} alt="Anteprima" style={{ width: "100%", display: "block" }} />
                : <span style={{ color: "var(--color-gray-400)", fontSize: "var(--text-sm)" }}>Generazione anteprima...</span>
              }
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      <Modal open={deleteConfirmId !== null} onClose={() => setDeleteConfirmId(null)} title="Elimina template">
        <p style={{ color: "var(--color-gray-600)", fontSize: "var(--text-sm)", marginBottom: "20px" }}>Eliminare questo template report turno?</p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(null)}>Annulla</Button>
          <Button variant="danger" size="sm" onClick={() => deleteConfirmId && void handleDelete(deleteConfirmId)}>Elimina</Button>
        </div>
      </Modal>
    </div>
  );
}
