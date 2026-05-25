import { createCanvas, loadImage, registerFont } from "canvas";
import { existsSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import type { ReceiptBlock } from "@pos/shared-types";

export interface ReceiptRenderData {
  blocks: ReceiptBlock[];
  canvasWidth: number;
  logoPath?: string | null;
  orderId: string;
  receiptDisplay?: string;
  items: { name: string; quantity: number; unitPrice: number }[];
  total: number;
  paymentMethod: string;
  currency: string;
  paidAt: Date;
  restaurantName: string;
  restaurantAddress: string;
  restaurantCity: string;
  restaurantVat: string;
  restaurantPhone: string;
  categoryName?: string;
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
      } catch {
        // skip unreadable font
      }
    }
  }
}

function resolveFont(block: ReceiptBlock): string {
  const weight = block.bold ? "bold" : "normal";
  return `${weight} ${block.fontSize}px "${block.fontFamily}"`;
}

function ctxAlign(align: ReceiptBlock["align"]): "center" | "right" | "left" {
  return align === "center" ? "center" : align === "right" ? "right" : "left";
}

function xForAlign(align: ReceiptBlock["align"], width: number, padding: number): number {
  if (align === "center") return width / 2;
  if (align === "right") return width - padding;
  return padding;
}

const PADDING = 20;
const LINE_GAP = 4;

export async function renderReceiptImage(data: ReceiptRenderData): Promise<Buffer> {
  ensureFontsRegistered();

  const width = data.canvasWidth;
  const visibleBlocks = data.blocks.filter((b) => b.visible);

  // Pre-load logo so both passes use the real dimensions
  let logoImage: Awaited<ReturnType<typeof loadImage>> | null = null;
  if (data.logoPath && existsSync(data.logoPath)) {
    try { logoImage = await loadImage(data.logoPath); } catch { /* skip */ }
  }

  function logoDrawWidth(block: ReceiptBlock): number {
    const maxW = width - PADDING * 2;
    if (block.logoWidth && block.logoWidth > 0 && block.logoWidth <= 100) {
      return Math.round((block.logoWidth / 100) * (width - PADDING * 2));
    }
    return logoImage ? Math.min(logoImage.width, maxW) : maxW;
  }

  function logoDrawHeight(block: ReceiptBlock): number {
    if (!logoImage) return 80;
    const imgW = logoDrawWidth(block);
    return (logoImage.height / logoImage.width) * imgW;
  }

  // --- First pass: compute heights ---
  const scratch = createCanvas(width, 100);
  const sctx = scratch.getContext("2d");

  const heights: number[] = [];

  for (const block of visibleBlocks) {
    sctx.font = resolveFont(block);
    const lineH = block.fontSize + LINE_GAP;
    let h = block.paddingTop;

    switch (block.type) {
      case "logo":
        h += logoDrawHeight(block);
        break;
      case "divider":
        h += 12;
        break;
      case "restaurant-name":
        h += lineH;
        break;
      case "restaurant-address":
        h += lineH;
        break;
      case "restaurant-phone":
        h += data.restaurantPhone ? lineH : 0;
        break;
      case "restaurant-vat":
        h += data.restaurantVat ? lineH : 0;
        break;
      case "items":
        h += data.items.length * lineH;
        break;
      case "text":
      case "footer":
        h += lineH;
        break;
      case "order-number":
      case "timestamp":
      case "total":
      case "payment-method":
        h += lineH;
        break;
      case "category-name":
        h += data.categoryName ? lineH : 0;
        break;
    }
    heights.push(h);
  }

  const totalHeight = heights.reduce((a, b) => a + b, 0) + PADDING * 2;

  // --- Second pass: draw ---
  const canvas = createCanvas(width, totalHeight);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, totalHeight);

  let y = PADDING;

  for (let i = 0; i < visibleBlocks.length; i++) {
    const block = visibleBlocks[i]!;
    y += block.paddingTop;

    ctx.font = resolveFont(block);
    ctx.fillStyle = "#000000";
    ctx.textAlign = ctxAlign(block.align);
    ctx.textBaseline = "top";
    const x = xForAlign(block.align, width, PADDING);
    const lineH = block.fontSize + LINE_GAP;

    switch (block.type) {
      case "logo": {
        if (logoImage) {
          const imgW = logoDrawWidth(block);
          const imgH = (logoImage.height / logoImage.width) * imgW;
          const imgX = block.align === "center"
            ? (width - imgW) / 2
            : block.align === "right" ? width - PADDING - imgW : PADDING;
          ctx.drawImage(logoImage, imgX, y, imgW, imgH);
          y += imgH;
        } else {
          y += 80;
        }
        break;
      }
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
      case "restaurant-name":
        ctx.fillText(data.restaurantName, x, y);
        y += lineH;
        break;
      case "restaurant-address": {
        const addr = [data.restaurantAddress, data.restaurantCity].filter(Boolean).join(", ");
        ctx.fillText(addr, x, y);
        y += lineH;
        break;
      }
      case "restaurant-phone":
        if (data.restaurantPhone) {
          ctx.fillText(`Tel: ${data.restaurantPhone}`, x, y);
          y += lineH;
        }
        break;
      case "restaurant-vat":
        if (data.restaurantVat) {
          ctx.fillText(`P.IVA ${data.restaurantVat}`, x, y);
          y += lineH;
        }
        break;
      case "order-number":
        ctx.fillText(`Ordine #${data.receiptDisplay ?? data.orderId.slice(-6).toUpperCase()}`, x, y);
        y += lineH;
        break;
      case "timestamp":
        ctx.fillText(new Date(data.paidAt).toLocaleString("it-IT"), x, y);
        y += lineH;
        break;
      case "items": {
        const rightX = width - PADDING;
        for (const item of data.items) {
          const label = `${item.quantity}x ${item.name}`;
          const price = `${data.currency === "EUR" ? "€" : data.currency}${(item.unitPrice * item.quantity).toFixed(2)}`;
          ctx.textAlign = "left";
          ctx.fillText(label, PADDING, y);
          ctx.textAlign = "right";
          ctx.fillText(price, rightX, y);
          y += lineH;
        }
        ctx.textAlign = ctxAlign(block.align);
        break;
      }
      case "total": {
        const sym = data.currency === "EUR" ? "€" : data.currency;
        ctx.textAlign = "left";
        ctx.fillText("TOTALE", PADDING, y);
        ctx.textAlign = "right";
        ctx.fillText(`${sym}${data.total.toFixed(2)}`, width - PADDING, y);
        ctx.textAlign = ctxAlign(block.align);
        y += lineH;
        break;
      }
      case "payment-method":
        ctx.fillText(`Pagamento: ${data.paymentMethod}`, x, y);
        y += lineH;
        break;
      case "text":
      case "footer":
        ctx.fillText(block.content ?? "", x, y);
        y += lineH;
        break;
      case "category-name":
        if (data.categoryName) {
          ctx.fillText(data.categoryName.toUpperCase(), x, y);
          y += lineH;
        }
        break;
    }
  }

  return canvas.toBuffer("image/png");
}
