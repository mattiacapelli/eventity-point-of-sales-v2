import React, { useEffect, useRef, useState } from "react";
import { adminApi } from "../../core/admin-api.js";
import { useStore } from "../../state/global-store.js";
import { useToastStore } from "../../components/ui/Toast.js";
import { Button } from "../../components/ui/Button.js";
import { Modal } from "../../components/ui/Modal.js";
import { GenericBlockEditor } from "./BlockEditor.js";
import type { KitchenTemplate, KitchenBlock, KitchenBlockType } from "@pos/shared-types";
import { inputStyle, labelStyle } from "./shared.js";

const KITCHEN_BLOCK_TYPE_LABELS: Record<KitchenBlockType, string> = {
  "center-name":  "Nome centro",
  "order-number": "Numero ordine",
  "table-number": "Numero tavolo",
  "customer-name": "Nome cliente",
  "timestamp":    "Ora",
  "items":        "Articoli",
  "divider":      "Separatore",
  "text":         "Testo libero",
};

const DEFAULT_KITCHEN_BLOCKS: KitchenBlock[] = [
  { id: "k1", type: "center-name",  align: "center", fontSize: 24, fontFamily: "DejaVu Sans", bold: true,  paddingTop: 0,  visible: true },
  { id: "k2", type: "order-number", align: "center", fontSize: 20, fontFamily: "DejaVu Sans", bold: true,  paddingTop: 8,  visible: true },
  { id: "k3", type: "table-number", align: "center", fontSize: 16, fontFamily: "DejaVu Sans", bold: false, paddingTop: 4,  visible: true },
  { id: "k4", type: "timestamp",    align: "center", fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 4,  visible: true },
  { id: "k5", type: "divider",      align: "left",   fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 8,  visible: true },
  { id: "k6", type: "items",        align: "left",   fontSize: 16, fontFamily: "DejaVu Sans", bold: false, paddingTop: 8,  visible: true },
  { id: "k7", type: "divider",      align: "left",   fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 8,  visible: true },
];

function KitchenBlockEditor({ blocks, onChange, availableFonts }: {
  blocks: KitchenBlock[];
  onChange: (b: KitchenBlock[]) => void;
  availableFonts: string[];
}) {
  return (
    <GenericBlockEditor<KitchenBlock>
      blocks={blocks}
      onChange={onChange}
      availableFonts={availableFonts}
      typeLabels={KITCHEN_BLOCK_TYPE_LABELS}
      maxFontSize={72}
      hasTextContent={(type) => type === "text"}
      hidesFontControls={(type) => type === "divider"}
      hidesPaddingControl={(type) => type === "divider"}
      defaultBlock={(_type) => {
        const id = Math.random().toString(36).slice(2);
        return { id, type: "text", align: "left", fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 8, visible: true, content: "" } as KitchenBlock;
      }}
    />
  );
}

export function KitchenTemplateTab() {
  const [templates, setTemplates] = useState<KitchenTemplate[]>([]);
  const [selected, setSelected] = useState<KitchenTemplate | null>(null);
  const [blocks, setBlocks] = useState<KitchenBlock[]>(DEFAULT_KITCHEN_BLOCKS);
  const [printMode, setPrintMode] = useState<"text" | "image">("text");
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

  const textPreviewLines = [
    "================================",
    "       CUCINA — ORDINE #42      ",
    "================================",
    "17/05/2026 20:30",
    "--------------------------------",
    "1x Burger",
    "   senza cipolla",
    "1x Fries",
    "--------------------------------",
  ];

  useEffect(() => {
    adminApi.kitchenTemplates.list().then((ts) => {
      setTemplates(ts);
      if (ts[0]) selectTemplate(ts[0]);
    }).catch(console.error);
    adminApi.receiptTemplates.listFonts().then(setAvailableFonts).catch(() => {});
  }, []);

  // Live image preview with debounce — sends the CURRENT (possibly unsaved) editor blocks
  useEffect(() => {
    if (!selected || printMode !== "image") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const token = useStore.getState().session?.token;
        const res = await fetch(adminApi.kitchenTemplates.livePreviewUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ blocks, canvasWidth, logoPath: selected.logoPath ?? null }),
        });
        if (!res.ok) return;
        const blob = await res.blob();
        setPreviewBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
      } catch { /* silent */ } finally { setPreviewLoading(false); }
    }, 800);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [blocks, canvasWidth, selected?.id, printMode]);

  function selectTemplate(t: KitchenTemplate) {
    setSelected(t);
    const parsed = t.blocks ? (typeof t.blocks === "string" ? JSON.parse(t.blocks) : t.blocks) as KitchenBlock[] : DEFAULT_KITCHEN_BLOCKS;
    setBlocks(parsed);
    setPrintMode((t.printMode as "text" | "image") ?? "text");
    setCanvasWidth(t.canvasWidth ?? 576);
    setPreviewBlobUrl(null);
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await adminApi.kitchenTemplates.update(selected.id, { blocks, printMode, canvasWidth });
      setTemplates((prev) => prev.map((t) => t.id === updated.id ? updated : t));
      setSelected(updated);
    } finally { setSaving(false); }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await adminApi.kitchenTemplates.create({ name: newName.trim() });
      setTemplates((prev) => [...prev, created]);
      setNewName("");
      selectTemplate(created);
    } finally { setCreating(false); }
  }

  async function handleDelete(id: string) {
    await adminApi.kitchenTemplates.delete(id);
    const remaining = templates.filter((t) => t.id !== id);
    setTemplates(remaining);
    setDeleteConfirmId(null);
    if (selected?.id === id) {
      const next = remaining[0] ?? null;
      if (next) selectTemplate(next); else { setSelected(null); setBlocks(DEFAULT_KITCHEN_BLOCKS); }
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
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-gray-800)", margin: 0 }}>Template comanda</h2>
        {selected && (
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            {/* Mode toggle */}
            <div style={{ display: "flex", borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1.5px solid var(--color-gray-200)" }}>
              {(["text", "image"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setPrintMode(m)}
                  style={{ padding: "8px 18px", border: "none", background: printMode === m ? "var(--color-brand)" : "var(--color-white)", color: printMode === m ? "#fff" : "var(--color-gray-600)", cursor: "pointer", fontWeight: 600, fontSize: "var(--text-sm)", fontFamily: "var(--font)" }}>
                  {m === "text" ? "Testo" : "Immagine"}
                </button>
              ))}
            </div>
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

      {selected && printMode === "text" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
          <div style={{ background: "var(--color-white)", borderRadius: "var(--radius-xl)", padding: "24px", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: "18px" }}>
            <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--color-gray-500)", lineHeight: 1.5 }}>
              In modalità testo ESC/POS il layout è fisso. Passa a <strong>Immagine</strong> per personalizzare blocchi, font e dimensioni.
            </p>
            <Button fullWidth loading={saving} onClick={() => void handleSave()}>Salva template</Button>
          </div>
          <div>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-gray-500)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px" }}>Anteprima</div>
            <div style={{ background: "#fff", borderRadius: "var(--radius-lg)", padding: "16px 20px", fontFamily: "'Courier New', Courier, monospace", fontSize: "12px", lineHeight: "1.6", color: "#1a1a1a", boxShadow: "0 4px 20px rgba(0,0,0,0.12)", whiteSpace: "pre", overflowX: "auto" }}>
              {textPreviewLines.join("\n")}
            </div>
          </div>
        </div>
      )}

      {selected && printMode === "image" && (
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
            <KitchenBlockEditor blocks={blocks} onChange={setBlocks} availableFonts={availableFonts} />
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
                : <span style={{ color: "var(--color-gray-400)", fontSize: "var(--text-sm)" }}>Salva per generare l'anteprima</span>
              }
            </div>
            {!previewBlobUrl && (
              <button type="button" onClick={() => void handleSave()}
                style={{ marginTop: "8px", width: "100%", padding: "8px", borderRadius: "var(--radius-lg)", border: "1.5px solid var(--color-gray-200)", background: "var(--color-white)", cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gray-600)", fontFamily: "var(--font)" }}>
                Genera anteprima
              </button>
            )}
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      <Modal open={deleteConfirmId !== null} onClose={() => setDeleteConfirmId(null)} title="Elimina template">
        <p style={{ color: "var(--color-gray-600)", fontSize: "var(--text-sm)", marginBottom: "20px" }}>Eliminare questo template comanda?</p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(null)}>Annulla</Button>
          <Button variant="danger" size="sm" onClick={() => deleteConfirmId && void handleDelete(deleteConfirmId)}>Elimina</Button>
        </div>
      </Modal>
    </div>
  );
}
