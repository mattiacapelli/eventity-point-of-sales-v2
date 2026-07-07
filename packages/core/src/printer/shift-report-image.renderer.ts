import { createCanvas, loadImage } from "canvas";
import { existsSync } from "node:fs";
import type { ShiftReportBlock } from "@pos/shared-types";
import { ensureFontsRegistered, resolveFont, ctxAlign, xForAlign, CANVAS_PADDING as PADDING, CANVAS_LINE_GAP as LINE_GAP } from "./canvas-helpers.js";

export interface ShiftReportRenderData {
  blocks: ShiftReportBlock[];
  canvasWidth: number;
  logoPath?: string | null;
  restaurantName: string;
  restaurantAddress: string;
  restaurantCity: string;
  restaurantVat: string;
  restaurantPhone: string;
  shift: { openedAt: string; closedAt: string | null; openingCash: number; closingCash: number | null };
  kpis: { totalSales: number; totalOrders: number; avgTicket: number; cancelledOrders: number; refundTotal: number; netSales: number };
  byHour: { hour: number; orders: number; amount: number }[];
  byCategory: { categoryName: string; quantity: number; amount: number }[];
  byProductionCenter: { centerName: string; quantity: number; amount: number }[];
  byPaymentMethod: { method: string; count: number; amount: number; excludeFromTotal?: boolean }[];
  topProducts: { name: string; quantity: number; amount: number }[];
}

function fmtEur(n: number): string {
  return `€${n.toFixed(2)}`;
}

function fmtDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("it-IT") : "-";
}

// Fixed rows for shift-period / kpi-summary blocks (label, value)
function shiftPeriodRows(data: ShiftReportRenderData): [string, string][] {
  return [
    ["Apertura", fmtDateTime(data.shift.openedAt)],
    ["Chiusura", fmtDateTime(data.shift.closedAt)],
    ["Fondo apertura", fmtEur(data.shift.openingCash)],
    ["Fondo chiusura", data.shift.closingCash !== null ? fmtEur(data.shift.closingCash) : "-"],
  ];
}

function kpiSummaryRows(data: ShiftReportRenderData): [string, string][] {
  const k = data.kpis;
  return [
    ["Vendite totali", fmtEur(k.totalSales)],
    ["Ordini", String(k.totalOrders)],
    ["Scontrino medio", fmtEur(k.avgTicket)],
    ["Ordini annullati", String(k.cancelledOrders)],
    ["Storni", fmtEur(k.refundTotal)],
    ["Netto", fmtEur(k.netSales)],
  ];
}

function byHourRows(data: ShiftReportRenderData): [string, string][] {
  return data.byHour.map((h) => [`${String(h.hour).padStart(2, "0")}:00`, `${h.orders} ord. — ${fmtEur(h.amount)}`]);
}

function byCategoryRows(data: ShiftReportRenderData): [string, string][] {
  return data.byCategory.map((c) => [`${c.categoryName} x${c.quantity}`, fmtEur(c.amount)]);
}

function byProductionCenterRows(data: ShiftReportRenderData): [string, string][] {
  return data.byProductionCenter.map((c) => [`${c.centerName} x${c.quantity}`, fmtEur(c.amount)]);
}

function byPaymentMethodRows(data: ShiftReportRenderData): [string, string][] {
  const included = data.byPaymentMethod.filter((p) => !p.excludeFromTotal);
  const excluded = data.byPaymentMethod.filter((p) => p.excludeFromTotal);
  const rows: [string, string][] = included.map((p) => [`${p.method} x${p.count}`, fmtEur(p.amount)]);
  if (excluded.length > 0) {
    rows.push(["METODI ESCLUSI DAL TOTALE", ""]);
    for (const p of excluded) rows.push([`${p.method} x${p.count}`, fmtEur(p.amount)]);
    const excludedSubtotal = excluded.reduce((s, p) => s + p.amount, 0);
    rows.push(["Subtotale esclusi", fmtEur(excludedSubtotal)]);
  }
  return rows;
}

function topProductsRows(data: ShiftReportRenderData): [string, string][] {
  return data.topProducts.map((p) => [`${p.name} x${p.quantity}`, fmtEur(p.amount)]);
}

function tableRows(block: ShiftReportBlock, data: ShiftReportRenderData): [string, string][] {
  switch (block.type) {
    case "shift-period": return shiftPeriodRows(data);
    case "kpi-summary": return kpiSummaryRows(data);
    case "by-hour": return byHourRows(data);
    case "by-category": return byCategoryRows(data);
    case "by-production-center": return byProductionCenterRows(data);
    case "by-payment-method": return byPaymentMethodRows(data);
    case "top-products": return topProductsRows(data);
    default: return [];
  }
}

export async function renderShiftReportImage(data: ShiftReportRenderData): Promise<Buffer> {
  ensureFontsRegistered();

  const width = data.canvasWidth;
  const visibleBlocks = data.blocks.filter((b) => b.visible);

  let logoImage: Awaited<ReturnType<typeof loadImage>> | null = null;
  if (data.logoPath && existsSync(data.logoPath)) {
    try { logoImage = await loadImage(data.logoPath); } catch { /* skip */ }
  }

  function logoDrawWidth(block: ShiftReportBlock): number {
    const maxW = width - PADDING * 2;
    if (block.logoWidth && block.logoWidth > 0 && block.logoWidth <= 100) {
      return Math.round((block.logoWidth / 100) * (width - PADDING * 2));
    }
    return logoImage ? Math.min(logoImage.width, maxW) : maxW;
  }

  function logoDrawHeight(block: ShiftReportBlock): number {
    if (!logoImage) return 80;
    const imgW = logoDrawWidth(block);
    return (logoImage.height / logoImage.width) * imgW;
  }

  // --- First pass: compute heights ---
  const scratch = createCanvas(width, 100);
  const sctx = scratch.getContext("2d");

  const heights: number[] = [];

  for (const block of visibleBlocks) {
    sctx.font = resolveFont(block.bold, block.fontSize, block.fontFamily);
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
      case "restaurant-address":
        h += lineH;
        break;
      case "restaurant-phone":
        h += data.restaurantPhone ? lineH : 0;
        break;
      case "restaurant-vat":
        h += data.restaurantVat ? lineH : 0;
        break;
      case "text":
      case "footer":
        h += lineH;
        break;
      case "shift-period":
      case "kpi-summary":
      case "by-hour":
      case "by-category":
      case "by-production-center":
      case "by-payment-method":
      case "top-products":
        h += tableRows(block, data).length * lineH;
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

  for (const block of visibleBlocks) {
    y += block.paddingTop;

    ctx.font = resolveFont(block.bold, block.fontSize, block.fontFamily);
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
      case "text":
      case "footer":
        ctx.fillText(block.content ?? "", x, y);
        y += lineH;
        break;
      case "shift-period":
      case "kpi-summary":
      case "by-hour":
      case "by-category":
      case "by-production-center":
      case "by-payment-method":
      case "top-products": {
        const rightX = width - PADDING;
        for (const [label, value] of tableRows(block, data)) {
          ctx.textAlign = "left";
          ctx.fillText(label, PADDING, y);
          ctx.textAlign = "right";
          ctx.fillText(value, rightX, y);
          y += lineH;
        }
        ctx.textAlign = ctxAlign(block.align);
        break;
      }
    }
  }

  return canvas.toBuffer("image/png");
}
