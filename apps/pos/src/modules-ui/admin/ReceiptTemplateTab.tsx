import React, { useEffect, useRef, useState } from "react";
import { adminApi } from "../../core/admin-api.js";
import { useAdminStore } from "../../state/admin-store.js";
import { useStore } from "../../state/global-store.js";
import { useToastStore } from "../../components/ui/Toast.js";
import { Button } from "../../components/ui/Button.js";
import { Modal } from "../../components/ui/Modal.js";
import { GenericBlockEditor } from "./BlockEditor.js";
import type { ReceiptTemplate, ReceiptBlock } from "@pos/shared-types";
import { PlusIcon } from "../../components/ui/icons.js";
import { inputStyle, labelStyle, Toggle } from "./shared.js";

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
  "terminal-name": "Cassa (terminale)",
  "table-name": "Tavolo",
  "customer-name": "Nome cliente",
};
function BlockEditor({ blocks, onChange, availableFonts }: {
  blocks: ReceiptBlock[];
  onChange: (b: ReceiptBlock[]) => void;
  availableFonts: string[];
}) {
  return (
    <GenericBlockEditor<ReceiptBlock>
      blocks={blocks}
      onChange={onChange}
      availableFonts={availableFonts}
      typeLabels={BLOCK_TYPE_LABELS}
      supportsLogo
      defaultBlock={(type) => {
        const id = Math.random().toString(36).slice(2);
        const base = { id, align: "left" as const, fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 8, visible: true };
        if (type === "text" || type === "footer") return { ...base, type, content: "" } as ReceiptBlock;
        if (type === "logo") return { ...base, type: "logo", align: "center" as const } as ReceiptBlock;
        return { ...base, type } as ReceiptBlock;
      }}
    />
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
  showItemCategory: boolean;
  printMethod: "single" | "by_category" | "by_category_copy" | "by_center" | "by_center_copy" | "per_item" | "per_item_copy";
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
          body: JSON.stringify({ blocks: form.blocks, canvasWidth: form.canvasWidth, showItemCategory: form.showItemCategory }),
        });
        if (!res.ok) return;
        const blob = await res.blob();
        setPreviewBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
      } catch { /* silent */ } finally { setPreviewLoading(false); }
    }, 800);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [form.blocks, form.canvasWidth, form.showItemCategory, template?.id]);

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
                body: JSON.stringify({ blocks: form.blocks, canvasWidth: form.canvasWidth, showItemCategory: form.showItemCategory }),
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

// ─── Receipt Numbering Section (shared, used inside ReceiptTemplateTab) ──────

function ReceiptNumberingSection() {
  const [receiptMode, setReceiptMode] = useState<"default" | "global" | "shift">("shift");
  const [receiptPrefix, setReceiptPrefix] = useState("");
  const [receiptPadding, setReceiptPadding] = useState(0);
  const [saving, setSaving] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    adminApi.settings.get().then((s) => {
      setReceiptMode(s.receiptNumberMode);
      setReceiptPrefix(s.receiptNumberPrefix);
      setReceiptPadding(s.receiptNumberPadding);
    }).catch(() => {});
  }, []);

  const previewNum = receiptMode === "default"
    ? "A3F9C1"
    : (receiptPadding > 0 ? `${receiptPrefix}${"42".padStart(receiptPadding, "0")}` : `${receiptPrefix}42`);

  return (
    <div style={{ marginTop: "32px", paddingTop: "32px", borderTop: "1px solid var(--color-gray-200)" }}>
      <div style={{ fontWeight: 700, fontSize: "var(--text-md)", color: "var(--color-gray-900)", marginBottom: "4px" }}>
        Numerazione scontrini
      </div>
      <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)", marginBottom: "18px" }}>
        Scegli come vengono numerati gli scontrini.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "18px" }}>
        {([
          ["default", "Default (UUID)", "Ultimi 6 caratteri dell'ID ordine — es. #A3F9C1"],
          ["global",  "Incrementale globale", "1, 2, 3… — contatore che non si azzera mai"],
          ["shift",   "Incrementale per turno", "Si azzera ad ogni nuovo turno di cassa"],
        ] as const).map(([val, label, desc]) => (
          <label key={val} style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
            <input type="radio" name="receiptModeSection" value={val} checked={receiptMode === val}
              onChange={() => setReceiptMode(val)}
              style={{ marginTop: "3px", accentColor: "var(--color-brand)" }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--color-gray-800)" }}>{label}</div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>{desc}</div>
            </div>
          </label>
        ))}
      </div>

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

      <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gray-500)", marginBottom: "16px" }}>
        Anteprima: <strong style={{ color: "var(--color-gray-800)" }}>#{previewNum}</strong>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <Button loading={saving} onClick={async () => {
          setSaving(true);
          try { await adminApi.settings.update({ receiptNumberMode: receiptMode, receiptNumberPrefix: receiptPrefix, receiptNumberPadding: receiptPadding }); }
          catch { /* ignore */ } finally { setSaving(false); }
        }}>Salva numerazione</Button>

        {receiptMode === "global" && (
          resetConfirm ? (
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-500)" }}>Confermi il reset a 0?</span>
              <button onClick={async () => {
                await adminApi.settings.resetReceiptCounter("global");
                setResetConfirm(false);
                setResetDone(true);
                setTimeout(() => setResetDone(false), 3000);
              }} style={{ padding: "6px 12px", borderRadius: "var(--radius-md)", background: "#DC2626", color: "#fff", border: "none", cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600 }}>Sì, resetta</button>
              <button onClick={() => setResetConfirm(false)} style={{ padding: "6px 12px", borderRadius: "var(--radius-md)", background: "var(--color-gray-100)", color: "var(--color-gray-600)", border: "none", cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600 }}>Annulla</button>
            </div>
          ) : (
            <button onClick={() => setResetConfirm(true)}
              style={{ padding: "8px 14px", borderRadius: "var(--radius-lg)", border: "1.5px solid #FECACA", background: "#FEF2F2", color: "#DC2626", cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: 600 }}>
              Reset contatore
            </button>
          )
        )}
        {receiptMode === "shift" && (
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-400)" }}>
            Si azzera automaticamente ad ogni nuovo turno — nessun reset manuale necessario.
          </span>
        )}
        {resetDone && <span style={{ fontSize: "var(--text-xs)", color: "var(--color-success, #059669)", fontWeight: 600 }}>Contatore azzerato</span>}
      </div>
    </div>
  );
}

export function ReceiptTemplateTab() {
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
    showItemCategory: false,
    printMode: "text" as "text" | "image",
    canvasWidth: 576,
    blocks: DEFAULT_RECEIPT_BLOCKS,
    printMethod: "single" as "single" | "by_category" | "by_category_copy" | "by_center" | "by_center_copy" | "per_item" | "per_item_copy",
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
        showItemCategory: template.showItemCategory,
        printMode: template.printMode ?? "text",
        canvasWidth: template.canvasWidth ?? 576,
        blocks,
        printMethod: (template.printMethod ?? "single") as "single" | "by_category" | "by_category_copy" | "by_center" | "by_center_copy" | "per_item" | "per_item_copy",
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
        showItemCategory: form.showItemCategory,
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
          showItemCategory: form.showItemCategory,
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
      useToastStore.getState().show(err instanceof Error ? err.message : "Errore upload font");
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
    ...(form.showItemCategory ? ["  Panini"] : []),
    "1x Fries        €3.00",
    ...(form.showItemCategory ? ["  Contorni"] : []),
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
    by_center: "Per centro di produzione",
    by_center_copy: "Per centro di produzione + copia cliente",
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
                  body: JSON.stringify({ blocks: form.blocks, canvasWidth: form.canvasWidth, showItemCategory: form.showItemCategory }),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const blob = await res.blob();
                if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
                setPreviewBlobUrl(URL.createObjectURL(blob));
                setPreviewOpen(true);
              } catch (e) {
                useToastStore.getState().show(e instanceof Error ? e.message : "Errore anteprima");
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
                { key: "showItemCategory" as const, label: "Mostra categoria nella riga prodotto" },
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

      <ReceiptNumberingSection />
    </div>
  );
}
