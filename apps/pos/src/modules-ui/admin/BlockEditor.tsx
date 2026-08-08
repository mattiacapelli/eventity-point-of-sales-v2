import React, { useState } from "react";
import { Toggle } from "./shared.js";
import { inputStyle } from "./shared.js";
import { PlusIcon } from "../../components/ui/icons.js";

export const BUNDLED_FONTS = ["DejaVu Sans", "DejaVu Sans Mono", "Oswald Bold"];

interface BaseBlock {
  id: string;
  type: string;
  align: "left" | "center" | "right";
  fontSize: number;
  fontFamily: string;
  bold: boolean;
  paddingTop: number;
  visible: boolean;
  content?: string;
  logoWidth?: number;
  invertColors?: boolean;
  showItemPrice?: boolean;
}

const labelStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  color: "var(--color-gray-400)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "4px",
  display: "block",
};

interface GenericBlockEditorProps<T extends BaseBlock> {
  blocks: T[];
  onChange: (b: T[]) => void;
  availableFonts: string[];
  typeLabels: Record<string, string>;
  defaultBlock: (type: string) => T;
  supportsLogo?: boolean;
  showLogoAddButton?: boolean;
  logoWidthStep?: number;
  logoWidthDefault?: number;
  hasTextContent?: (type: string) => boolean;
  hidesFontControls?: (type: string) => boolean;
  hidesPaddingControl?: (type: string) => boolean;
  maxFontSize?: number;
}

export function GenericBlockEditor<T extends BaseBlock>({
  blocks, onChange, availableFonts, typeLabels, defaultBlock,
  supportsLogo = false, showLogoAddButton,
  logoWidthStep = 1, logoWidthDefault = 100,
  hasTextContent = (type) => type === "text" || type === "footer",
  hidesFontControls = (type) => type === "logo" || type === "divider",
  hidesPaddingControl = (type) => type === "logo",
  maxFontSize = 48,
}: GenericBlockEditorProps<T>) {
  const showLogoButton = showLogoAddButton ?? supportsLogo;
  const allFonts = [...new Set([...BUNDLED_FONTS, ...availableFonts])];
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [draggableIdx, setDraggableIdx] = useState<number | null>(null);

  function update(idx: number, patch: Partial<T>) {
    onChange(blocks.map((b, i) => i === idx ? { ...b, ...patch } : b));
  }
  function remove(idx: number) { onChange(blocks.filter((_, i) => i !== idx)); }
  function addBlock(type: string = "text") {
    onChange([...blocks, defaultBlock(type)]);
  }
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
            background: block.invertColors ? "#1a1a1a" : "var(--color-white)",
            borderRadius: "var(--radius-lg)",
            border: overIdx === idx ? "2px solid var(--color-brand)" : "1.5px solid var(--color-gray-200)",
            padding: "14px", opacity: dragIdx === idx ? 0.4 : 1, cursor: "default",
            display: "flex", flexDirection: "column", gap: "12px",
          }}
        >
          {/* Header: drag handle, type selector, visibility, delete */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingBottom: "10px", borderBottom: `1px solid ${block.invertColors ? "rgba(255,255,255,0.15)" : "var(--color-gray-100)"}` }}>
            <span onMouseDown={() => setDraggableIdx(idx)} onMouseUp={() => setDraggableIdx(null)}
              style={{ color: block.invertColors ? "rgba(255,255,255,0.5)" : "var(--color-gray-400)", fontSize: "18px", cursor: "grab", userSelect: "none" }}>⠿</span>
            <select value={block.type}
              onChange={(e) => update(idx, { type: e.target.value } as Partial<T>)}
              style={{ ...inputStyle, width: "auto", height: "34px", fontSize: "var(--text-sm)", padding: "0 8px", fontWeight: 700 }}>
              {Object.entries(typeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
              <Toggle value={block.visible} onChange={(v) => update(idx, { visible: v } as Partial<T>)} />
              <button type="button" onClick={() => remove(idx)}
                style={{ padding: "4px 8px", borderRadius: "var(--radius-md)", border: "1.5px solid #FECACA", background: "#FEF2F2", color: "#DC2626", cursor: "pointer", fontSize: "var(--text-xs)" }}>
                ✕
              </button>
            </div>
          </div>

          {/* Style row: alignment, font, size, bold, invert colors */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
            <div>
              <span style={labelStyle}>Allineamento</span>
              <div style={{ display: "flex", gap: "4px" }}>
                {(["left", "center", "right"] as const).map((a) => (
                  <button key={a} type="button" onClick={() => update(idx, { align: a } as Partial<T>)}
                    style={{ padding: "4px 10px", borderRadius: "var(--radius-md)", border: "1.5px solid var(--color-gray-200)", background: block.align === a ? "var(--color-brand)" : "var(--color-white)", color: block.align === a ? "#fff" : "var(--color-gray-600)", cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600 }}>
                    {a === "left" ? "←" : a === "center" ? "↔" : "→"}
                  </button>
                ))}
              </div>
            </div>
            {!hidesFontControls(block.type) && (<>
              <div>
                <span style={labelStyle}>Font</span>
                <select value={block.fontFamily} onChange={(e) => update(idx, { fontFamily: e.target.value } as Partial<T>)}
                  style={{ ...inputStyle, width: "auto", height: "34px", fontSize: "var(--text-sm)", padding: "0 8px" }}>
                  {allFonts.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <span style={labelStyle}>Dimensione</span>
                <input type="number" min={8} max={maxFontSize} value={block.fontSize}
                  onChange={(e) => update(idx, { fontSize: Number(e.target.value) } as Partial<T>)}
                  style={{ ...inputStyle, width: "62px", height: "34px", fontSize: "var(--text-sm)", padding: "0 8px" }} />
              </div>
              <div>
                <span style={labelStyle}>Grassetto</span>
                <button type="button" onClick={() => update(idx, { bold: !block.bold } as Partial<T>)}
                  style={{ padding: "4px 12px", height: "34px", borderRadius: "var(--radius-md)", border: "1.5px solid var(--color-gray-200)", background: block.bold ? "var(--color-brand)" : "var(--color-white)", color: block.bold ? "#fff" : "var(--color-gray-600)", cursor: "pointer", fontWeight: 700, fontSize: "var(--text-sm)" }}>
                  B
                </button>
              </div>
            </>)}
            <div>
              <span style={labelStyle}>Sfondo invertito</span>
              <Toggle value={block.invertColors ?? false} onChange={(v) => update(idx, { invertColors: v } as Partial<T>)} />
            </div>
          </div>

          {hasTextContent(block.type) && (
            <div>
              <span style={labelStyle}>Testo</span>
              <input type="text" value={block.content ?? ""} placeholder="Testo..."
                onChange={(e) => update(idx, { content: e.target.value } as Partial<T>)}
                style={{ ...inputStyle, height: "34px", fontSize: "var(--text-sm)" }} />
            </div>
          )}
          {!hidesPaddingControl(block.type) && (
            <div>
              <span style={labelStyle}>Spazio sopra (px)</span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input type="number" min={0} max={80} value={block.paddingTop}
                  onChange={(e) => update(idx, { paddingTop: Number(e.target.value) } as Partial<T>)}
                  style={{ ...inputStyle, width: "70px", height: "30px", fontSize: "var(--text-xs)", padding: "0 6px" }} />
              </div>
            </div>
          )}
          {block.type === "items" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-gray-400)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Mostra prezzi</span>
              <Toggle value={block.showItemPrice !== false} onChange={(v) => update(idx, { showItemPrice: v } as Partial<T>)} />
            </div>
          )}
          {supportsLogo && block.type === "logo" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={labelStyle}>Dimensione logo</span>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input type="range" min={10} max={100} step={logoWidthStep} value={block.logoWidth ?? logoWidthDefault}
                  onChange={(e) => update(idx, { logoWidth: Number(e.target.value) } as Partial<T>)}
                  style={{ flex: 1, accentColor: "var(--color-brand)" }}
                />
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gray-600)", fontWeight: 600, minWidth: "36px" }}>{block.logoWidth ?? logoWidthDefault}%</span>
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
        {showLogoButton && !blocks.some((b) => b.type === "logo") && (
          <button type="button" onClick={() => addBlock("logo")}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "10px 14px", borderRadius: "var(--radius-lg)", border: "2px dashed var(--color-brand)", background: "transparent", color: "var(--color-brand)", cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: 600, whiteSpace: "nowrap" }}>
            <PlusIcon style={{ width: "16px", height: "16px" }} /> Logo
          </button>
        )}
      </div>
    </div>
  );
}
