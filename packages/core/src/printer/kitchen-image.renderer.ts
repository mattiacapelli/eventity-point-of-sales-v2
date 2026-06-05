import { createCanvas, loadImage, registerFont } from "canvas";
import { existsSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import type { KitchenBlock, KitchenBlockType } from "@pos/shared-types";

export interface KitchenRenderItem {
  name: string;
  quantity: number;
  options?: { optionName: string; priceDelta: number }[];
  notes?: string;
}

export interface KitchenRenderData {
  blocks: KitchenBlock[];
  canvasWidth: number;
  logoPath?: string | null;
  centerName: string;
  orderId: string;
  receiptDisplay?: string | undefined;
  tableId?: string | null;
  orderNotes?: string | null;
  pax?: number | null;
  timestamp: Date;
  items: KitchenRenderItem[];
}

const BUNDLED_FONTS_DIR = new URL("../../assets/fonts", import.meta.url).pathname;
const CUSTOM_FONTS_DIR = "/data/fonts";

let fontsRegistered = false;

function ensureFontsRegistered(): void {
  if (fontsRegistered) return;
  fontsRegistered = true;
  const dirs = [BUNDLED_FONTS_DIR, CUSTOM_FONTS_DIR].filter(existsSync);
  for (const dir of dirs) {
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".ttf"))) {
      try {
        const family = basename(file, ".ttf").replace(/-Bold$/, "").replace(/-/g, " ");
        const weight = file.includes("Bold") ? "bold" : "normal";
        registerFont(join(dir, file), { family, weight });
      } catch { /* skip */ }
    }
  }
}

function resolveFont(block: KitchenBlock): string {
  return `${block.bold ? "bold" : "normal"} ${block.fontSize}px "${block.fontFamily}"`;
}

function ctxAlign(align: KitchenBlock["align"]): "center" | "right" | "left" {
  return align === "center" ? "center" : align === "right" ? "right" : "left";
}

function xForAlign(align: KitchenBlock["align"], width: number, padding: number): number {
  if (align === "center") return width / 2;
  if (align === "right") return width - padding;
  return padding;
}

const PADDING = 20;
const LINE_GAP = 4;
const OPTION_INDENT = 30;

export async function renderKitchenImage(data: KitchenRenderData): Promise<Buffer> {
  ensureFontsRegistered();

  const width = data.canvasWidth;
  const visibleBlocks = data.blocks.filter((b) => b.visible);

  const scratch = createCanvas(width, 100);
  const sctx = scratch.getContext("2d");

  const heights: number[] = [];

  for (const block of visibleBlocks) {
    sctx.font = resolveFont(block);
    const lineH = block.fontSize + LINE_GAP;
    let h = block.paddingTop;

    switch (block.type as KitchenBlockType) {
      case "center-name":
        h += lineH;
        break;
      case "order-number":
        h += lineH;
        break;
      case "table-number":
        h += data.tableId ? lineH : 0;
        break;
      case "timestamp":
        h += lineH;
        break;
      case "divider":
        h += 12;
        break;
      case "items": {
        for (const item of data.items) {
          h += lineH;
          h += (item.options?.length ?? 0) * lineH;
          if (item.notes) h += lineH;
        }
        break;
      }
      case "text":
        h += lineH;
        break;
    }
    heights.push(h);
  }

  const totalHeight = heights.reduce((a, b) => a + b, 0) + PADDING * 2;

  const canvas = createCanvas(width, totalHeight);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, totalHeight);

  let y = PADDING;

  for (const block of visibleBlocks) {
    y += block.paddingTop;

    ctx.font = resolveFont(block);
    ctx.fillStyle = "#000000";
    ctx.textAlign = ctxAlign(block.align);
    ctx.textBaseline = "top";
    const x = xForAlign(block.align, width, PADDING);
    const lineH = block.fontSize + LINE_GAP;

    switch (block.type as KitchenBlockType) {
      case "center-name":
        ctx.fillText(data.centerName.toUpperCase(), x, y);
        y += lineH;
        break;
      case "order-number":
        ctx.fillText(`#${data.receiptDisplay ?? data.orderId.slice(-6).toUpperCase()}`, x, y);
        y += lineH;
        break;
      case "table-number":
        if (data.tableId) {
          ctx.fillText(`Tavolo ${data.tableId}`, x, y);
          y += lineH;
        }
        break;
      case "timestamp":
        ctx.fillText(new Date(data.timestamp).toLocaleString("it-IT"), x, y);
        y += lineH;
        break;
      case "divider": {
        const dy = y + 6;
        ctx.beginPath();
        ctx.moveTo(PADDING, dy);
        ctx.lineTo(width - PADDING, dy);
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1;
        ctx.stroke();
        y += 12;
        break;
      }
      case "items": {
        for (const item of data.items) {
          ctx.textAlign = "left";
          ctx.fillText(`${item.quantity}x  ${item.name}`, PADDING, y);
          y += lineH;
          for (const opt of item.options ?? []) {
            ctx.fillStyle = "#333333";
            ctx.fillText(`+ ${opt.optionName}`, PADDING + OPTION_INDENT, y);
            ctx.fillStyle = "#000000";
            y += lineH;
          }
          if (item.notes) {
            ctx.fillStyle = "#555555";
            ctx.fillText(`>> ${item.notes}`, PADDING + OPTION_INDENT, y);
            ctx.fillStyle = "#000000";
            y += lineH;
          }
        }
        ctx.textAlign = ctxAlign(block.align);
        break;
      }
      case "text":
        ctx.fillText(block.content ?? "", x, y);
        y += lineH;
        break;
    }
  }

  return canvas.toBuffer("image/png");
}
