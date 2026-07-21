import type { FastifyPluginAsync } from "fastify";
import PDFDocument from "pdfkit";
import { and, eq, gte, inArray, lte, categories, orders, orderItems, payments, paymentMethods, products, productionCenters, productionCenterCategories, shifts, terminals, appSettings, type DbClient } from "@pos/db";

// ─── Palette ──────────────────────────────────────────────────────────────────

const BRAND   = "#4F46E5";
const GRAY900 = "#111827";
const GRAY600 = "#4B5563";
const GRAY400 = "#9CA3AF";
const GRAY100 = "#F3F4F6";
const WHITE   = "#FFFFFF";
const GREEN   = "#059669";
const RED     = "#DC2626";
const ACCENT  = "#F59E0B";

const PALETTE = [BRAND, ACCENT, GREEN, RED, "#3B82F6", "#EC4899", "#8B5CF6", "#06B6D4", "#84CC16", "#F97316"];

const PAID_STATUSES = ["confirmed", "completed"] as const;

// ─── Layout constants ─────────────────────────────────────────────────────────

const PAGE_W    = 595.28;
const PAGE_H    = 841.89;
const MARGIN    = 48;
const COL_W     = PAGE_W - MARGIN * 2;
const COL2_W    = (COL_W - 16) / 2;

// ─── Drawing helpers ──────────────────────────────────────────────────────────

type Doc = InstanceType<typeof PDFDocument>;

function hex(color: string): [number, number, number] {
  const n = parseInt(color.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function fillColor(doc: Doc, color: string) { doc.fillColor(hex(color)); }
function strokeColor(doc: Doc, color: string) { doc.strokeColor(hex(color)); }

function line(doc: Doc, x1: number, y1: number, x2: number, y2: number, color = GRAY100, width = 0.5) {
  strokeColor(doc, color);
  doc.lineWidth(width).moveTo(x1, y1).lineTo(x2, y2).stroke();
}

function rect(doc: Doc, x: number, y: number, w: number, h: number, color: string, radius = 0) {
  fillColor(doc, color);
  if (radius > 0) doc.roundedRect(x, y, w, h, radius).fill();
  else doc.rect(x, y, w, h).fill();
}

function text(doc: Doc, content: string, x: number, y: number, opts: {
  size?: number; color?: string; bold?: boolean; align?: "left" | "right" | "center"; width?: number;
} = {}) {
  const { size = 9, color = GRAY900, bold = false, align = "left", width } = opts;
  fillColor(doc, color);
  doc.fontSize(size).font(bold ? "Helvetica-Bold" : "Helvetica");
  const textOpts: PDFKit.Mixins.TextOptions = { align, lineBreak: false };
  if (width !== undefined) textOpts.width = width;
  doc.text(content, x, y, textOpts);
}

function fmt(n: number) { return `€${n.toFixed(2)}`; }
function pct(v: number, total: number) { return total > 0 ? `${Math.round((v / total) * 100)}%` : "0%"; }

// Barra orizzontale proporzionale
function barH(doc: Doc, x: number, y: number, w: number, h: number, ratio: number, color: string) {
  rect(doc, x, y, w, h, GRAY100);
  if (ratio > 0) rect(doc, x, y, Math.max(2, w * ratio), h, color);
}

// Controlla se serve nuova pagina; ritorna la y aggiornata
function checkPage(doc: Doc, y: number, needed = 60): number {
  if (y + needed > PAGE_H - MARGIN - 20) {
    doc.addPage();
    drawPageFrame(doc);
    return MARGIN + 20;
  }
  return y;
}

// Frame leggero: solo numero pagina in basso
function drawPageFrame(doc: Doc) {
  const pageNum = (doc as unknown as { _pageBuffer?: unknown[] })._pageBuffer?.length ?? doc.bufferedPageRange().count;
  fillColor(doc, GRAY400);
  doc.fontSize(8).font("Helvetica").text(`Pagina ${pageNum}`, MARGIN, PAGE_H - 28, { align: "left", lineBreak: false });
}

// ─── Sezioni riusabili ────────────────────────────────────────────────────────

// Titolo sezione con banda colorata
function sectionTitle(doc: Doc, y: number, label: string): number {
  y = checkPage(doc, y, 28);
  rect(doc, MARGIN, y, COL_W, 22, BRAND, 4);
  text(doc, label.toUpperCase(), MARGIN + 10, y + 6, { size: 8, color: WHITE, bold: true });
  return y + 30;
}

// KPI box orizzontale — array di { label, value, sub? }
function kpiRow(doc: Doc, y: number, kpis: { label: string; value: string; sub?: string | undefined; color?: string | undefined }[]): number {
  const n = kpis.length;
  const boxW = (COL_W - (n - 1) * 8) / n;
  let x = MARGIN;
  for (const kpi of kpis) {
    rect(doc, x, y, boxW, 56, GRAY100, 6);
    text(doc, kpi.label.toUpperCase(), x + 10, y + 8, { size: 7, color: GRAY400, bold: true, width: boxW - 20 });
    text(doc, kpi.value, x + 10, y + 20, { size: 16, color: kpi.color ?? BRAND, bold: true, width: boxW - 20 });
    if (kpi.sub) text(doc, kpi.sub, x + 10, y + 41, { size: 7, color: GRAY400, width: boxW - 20 });
    x += boxW + 8;
  }
  return y + 64;
}

// Tabella con header + righe
type TableCol = { label: string; key: string; width: number; align?: "left" | "right" | "center"; bold?: boolean; color?: string };

function table(
  doc: Doc,
  startY: number,
  cols: TableCol[],
  rows: Record<string, string>[],
  opts: { altRow?: boolean; footerRow?: Record<string, string> } = {},
): number {
  const { altRow = true, footerRow } = opts;
  const ROW_H = 18;
  const HEAD_H = 20;

  let y = checkPage(doc, startY, HEAD_H + ROW_H);

  // Header
  rect(doc, MARGIN, y, COL_W, HEAD_H, GRAY900, 4);
  let cx = MARGIN + 8;
  for (const col of cols) {
    text(doc, col.label.toUpperCase(), cx, y + 6, { size: 7, color: WHITE, bold: true, align: col.align ?? "left", width: col.width - 8 });
    cx += col.width;
  }
  y += HEAD_H;

  for (let ri = 0; ri < rows.length; ri++) {
    y = checkPage(doc, y, ROW_H);
    if (altRow && ri % 2 === 1) rect(doc, MARGIN, y, COL_W, ROW_H, GRAY100);
    cx = MARGIN + 8;
    const row = rows[ri]!;
    for (const col of cols) {
      const val = row[col.key] ?? "";
      text(doc, val, cx, y + 5, {
        size: 8,
        color: col.color ?? GRAY900,
        bold: col.bold ?? false,
        align: col.align ?? "left",
        width: col.width - 12,
      });
      cx += col.width;
    }
    y += ROW_H;
  }

  // Footer
  if (footerRow) {
    y = checkPage(doc, y, ROW_H + 2);
    line(doc, MARGIN, y, MARGIN + COL_W, y, GRAY600, 0.5);
    y += 1;
    rect(doc, MARGIN, y, COL_W, ROW_H, GRAY900);
    cx = MARGIN + 8;
    for (const col of cols) {
      const val = footerRow[col.key] ?? "";
      text(doc, val, cx, y + 5, { size: 8, color: WHITE, bold: true, align: col.align ?? "left", width: col.width - 12 });
      cx += col.width;
    }
    y += ROW_H;
  }

  return y + 8;
}

// Riga con barra inline — usata per metodi/categorie/prodotti
function barTable(
  doc: Doc,
  startY: number,
  rows: { label: string; value: number; count?: number; total: number; color: string }[],
): number {
  const BAR_W = 80;
  const ROW_H = 17;
  let y = startY;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    y = checkPage(doc, y, ROW_H);
    if (i % 2 === 1) rect(doc, MARGIN, y, COL_W, ROW_H, GRAY100);

    // Color dot
    fillColor(doc, r.color);
    doc.circle(MARGIN + 8, y + ROW_H / 2, 3).fill();

    // Label
    text(doc, r.label, MARGIN + 18, y + 5, { size: 8, color: GRAY900, width: COL_W - BAR_W - 120 });

    // Bar
    const bx = MARGIN + COL_W - BAR_W - 120;
    barH(doc, bx, y + 6, BAR_W, 5, r.total > 0 ? r.value / r.total : 0, r.color);

    // Count
    if (r.count !== undefined) {
      text(doc, `×${r.count}`, MARGIN + COL_W - 112, y + 5, { size: 8, color: GRAY400, align: "right", width: 36 });
    }
    // Pct
    text(doc, pct(r.value, r.total), MARGIN + COL_W - 72, y + 5, { size: 8, color: GRAY600, align: "right", width: 36 });
    // Amount
    text(doc, fmt(r.value), MARGIN + COL_W - 32, y + 5, { size: 8, color: GRAY900, bold: true, align: "right", width: 32 });

    y += ROW_H;
  }
  return y + 6;
}

// ─── Cover page ───────────────────────────────────────────────────────────────

function drawCover(
  doc: Doc,
  title: string,
  subtitle: string,
  restaurantName: string,
  generatedAt: Date,
) {
  // Header band
  rect(doc, 0, 0, PAGE_W, 200, BRAND);

  // Title
  fillColor(doc, WHITE);
  doc.fontSize(28).font("Helvetica-Bold").text(title, MARGIN, 70, { width: COL_W });

  fillColor(doc, WHITE);
  doc.fillOpacity(0.75).fontSize(13).font("Helvetica").text(subtitle, MARGIN, 108, { width: COL_W });
  doc.fillOpacity(1);

  // Restaurant name
  if (restaurantName) {
    fillColor(doc, WHITE);
    doc.fontSize(10).font("Helvetica").text(restaurantName.toUpperCase(), MARGIN, 150, { width: COL_W, characterSpacing: 1.5 });
  }

  // Decorative accent bar
  rect(doc, 0, 200, PAGE_W, 6, ACCENT);

  // Generated at
  text(doc, `Generato il ${generatedAt.toLocaleString("it-IT")}`, MARGIN, 225, { size: 8, color: GRAY400 });
  line(doc, MARGIN, 242, MARGIN + COL_W, 242, GRAY100, 0.5);
}

// ─── PDF shift report ─────────────────────────────────────────────────────────

type ShiftStats = NonNullable<Awaited<ReturnType<typeof buildShiftPdfData>>>;

async function buildShiftPdfData(db: DbClient, shiftId: number, terminalId?: number) {
  const [shift] = await db.select().from(shifts).where(eq(shifts.id, shiftId)).limit(1);
  if (!shift) return null;

  const shiftOrders = await db.select().from(orders).where(
    and(eq(orders.shiftId, shiftId), terminalId !== undefined ? eq(orders.terminalId, terminalId) : undefined)
  );

  const completedOrders = shiftOrders.filter((o) => PAID_STATUSES.includes(o.status as typeof PAID_STATUSES[number]));
  const cancelledOrders = shiftOrders.filter((o) => o.status === "cancelled").length;
  const orderIds = completedOrders.map((o) => o.id);

  const allMethodRows = await db.select({ id: paymentMethods.id, name: paymentMethods.name, excludeFromTotal: paymentMethods.excludeFromTotal }).from(paymentMethods);
  const excludedMethodIds = new Set(allMethodRows.filter((m) => m.excludeFromTotal).map((m) => m.id));
  const methodIdToName = Object.fromEntries(allMethodRows.map((m) => [m.id, m.name]));

  // Payment rows
  const pmtRows = orderIds.length > 0
    ? await db.select().from(payments).where(and(inArray(payments.orderId, orderIds), eq(payments.status, "completed")))
    : [];
  const orderMethodMap: Record<number, string> = {};
  for (const p of pmtRows) orderMethodMap[p.orderId] = p.method;

  const isExcluded = (orderId: number) => {
    const m = orderMethodMap[orderId];
    return m !== undefined && excludedMethodIds.has(m);
  };

  const totalSalesRaw = completedOrders.reduce((s, o) => s + o.totalAmount, 0);
  const totalSalesExcluded = completedOrders.filter((o) => isExcluded(o.id)).reduce((s, o) => s + o.totalAmount, 0);
  const totalSales = totalSalesRaw - totalSalesExcluded;
  const totalOrders = completedOrders.length;
  const refundRows = orderIds.length > 0 ? await db.select().from(payments).where(and(inArray(payments.orderId, orderIds), eq(payments.status, "refunded"))) : [];
  const refundTotal = refundRows.reduce((s, p) => s + p.amount, 0);

  // byPaymentMethod
  const pmtAgg: Record<string, { count: number; amount: number; excludeFromTotal: boolean }> = {};
  for (const p of pmtRows) {
    const name = methodIdToName[p.method] ?? p.method;
    const ex = excludedMethodIds.has(p.method);
    const e = pmtAgg[name] ?? { count: 0, amount: 0, excludeFromTotal: ex };
    e.count++; e.amount += p.amount;
    pmtAgg[name] = e;
  }
  const byPaymentMethod = Object.entries(pmtAgg).map(([method, v]) => ({ method, ...v }));

  // byHour
  const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0, amount: 0 }));
  for (const o of completedOrders) {
    const b = byHour[o.createdAt.getHours()]!;
    b.orders++; b.amount += o.totalAmount;
  }

  // Terminal breakdown
  const terminalIds = [...new Set(completedOrders.map((o) => o.terminalId).filter((id): id is number => id !== null))];
  let terminalNameMap: Record<number, string> = {};
  if (terminalIds.length > 0) {
    const tRows = await db.select().from(terminals).where(inArray(terminals.id, terminalIds));
    terminalNameMap = Object.fromEntries(tRows.map((t) => [t.id, t.name]));
  }
  const orderPmtMap = new Map(pmtRows.map((p) => [p.orderId, { method: methodIdToName[p.method] ?? p.method, amount: p.amount }]));

  const termAgg: Record<string, { count: number; amount: number; byMethod: Record<string, { count: number; amount: number }> }> = {};
  for (const o of completedOrders) {
    const name = o.terminalId !== null && o.terminalId !== undefined ? (terminalNameMap[o.terminalId] ?? "Senza cassa") : "Senza cassa";
    const e = termAgg[name] ?? { count: 0, amount: 0, byMethod: {} };
    e.count++; e.amount += o.totalAmount;
    const pmt = orderPmtMap.get(o.id);
    if (pmt) {
      const me = e.byMethod[pmt.method] ?? { count: 0, amount: 0 };
      me.count++; me.amount += pmt.amount;
      e.byMethod[pmt.method] = me;
    }
    termAgg[name] = e;
  }
  const byTerminal = Object.entries(termAgg).map(([terminalName, v]) => ({
    terminalName, count: v.count, amount: v.amount,
    byMethod: Object.entries(v.byMethod).map(([method, m]) => ({ method, ...m })),
  })).sort((a, b) => b.amount - a.amount);

  // Item breakdown
  const itemRows = orderIds.length > 0
    ? await db.select({
        productId: orderItems.productId,
        itemName: orderItems.name,
        categoryId: products.categoryId,
        categoryName: categories.name,
        productionCenterId: products.productionCenterId,
        unitPrice: orderItems.unitPrice,
        quantity: orderItems.quantity,
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(inArray(orderItems.orderId, orderIds))
    : [];

  // categoryId → first center
  const categoryIds = [...new Set(itemRows.map((i) => i.categoryId).filter((id): id is number => id !== null))];
  const categoryCenterMap: Record<number, number> = {};
  if (categoryIds.length > 0) {
    const pcRows = await db.select({ categoryId: productionCenterCategories.categoryId, productionCenterId: productionCenterCategories.productionCenterId })
      .from(productionCenterCategories).where(inArray(productionCenterCategories.categoryId, categoryIds));
    for (const r of pcRows) { if (!categoryCenterMap[r.categoryId]) categoryCenterMap[r.categoryId] = r.productionCenterId; }
  }
  const centerIds = [...new Set([...itemRows.map((i) => i.productionCenterId), ...Object.values(categoryCenterMap)].filter((id): id is number => id !== null))];
  let centerNameMap: Record<number, string> = {};
  if (centerIds.length > 0) {
    const cRows = await db.select().from(productionCenters).where(inArray(productionCenters.id, centerIds));
    centerNameMap = Object.fromEntries(cRows.map((c) => [c.id, c.name]));
  }

  const catAgg: Record<string, { quantity: number; amount: number }> = {};
  const prodAgg: Record<string, { name: string; quantity: number; amount: number }> = {};
  const centerAgg: Record<string, { quantity: number; amount: number }> = {};

  for (const item of itemRows) {
    const cat = item.categoryName ?? "Senza categoria";
    const ca = catAgg[cat] ?? { quantity: 0, amount: 0 };
    ca.quantity += item.quantity; ca.amount += item.unitPrice * item.quantity;
    catAgg[cat] = ca;

    const pid = String(item.productId);
    const pa = prodAgg[pid] ?? { name: item.itemName, quantity: 0, amount: 0 };
    pa.quantity += item.quantity; pa.amount += item.unitPrice * item.quantity;
    prodAgg[pid] = pa;

    const centerId = item.productionCenterId ?? (item.categoryId !== null && item.categoryId !== undefined ? categoryCenterMap[item.categoryId] : undefined);
    const centerName = centerId !== undefined ? (centerNameMap[centerId] ?? "Senza centro") : "Senza centro";
    const ce = centerAgg[centerName] ?? { quantity: 0, amount: 0 };
    ce.quantity += item.quantity; ce.amount += item.unitPrice * item.quantity;
    centerAgg[centerName] = ce;
  }

  // Restaurant info
  const settingRows = await db.select().from(appSettings).where(inArray(appSettings.key, ["restaurant_name", "restaurant_vat", "restaurant_address", "restaurant_city"]));
  const settings = Object.fromEntries(settingRows.map((r) => [r.key, r.value]));

  return {
    shift: { id: shift.id, openedAt: shift.openedAt, closedAt: shift.closedAt, openingCash: shift.openingCash, closingCash: shift.closingCash },
    summary: { totalSales, totalOrders, cancelledOrders, avgTicket: totalOrders > 0 ? totalSales / totalOrders : 0, refundTotal, netSales: totalSales - refundTotal, totalSalesExcluded },
    byPaymentMethod,
    byCategory: Object.entries(catAgg).map(([categoryName, v]) => ({ categoryName, ...v })).sort((a, b) => b.amount - a.amount),
    byProductionCenter: Object.entries(centerAgg).map(([centerName, v]) => ({ centerName, ...v })).sort((a, b) => b.amount - a.amount),
    byTerminal,
    byHour,
    topProducts: Object.values(prodAgg).sort((a, b) => b.amount - a.amount),
    restaurant: settings,
  };
}

function generateShiftPdf(stats: ShiftStats): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true, info: { Title: "Report Turno", Author: stats.restaurant["restaurant_name"] ?? "POS" } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const restaurant = stats.restaurant["restaurant_name"] ?? "";
    const shiftOpen = new Date(stats.shift.openedAt).toLocaleString("it-IT");
    const shiftClose = stats.shift.closedAt ? new Date(stats.shift.closedAt).toLocaleString("it-IT") : "Aperto";
    const subtitle = `Turno #${stats.shift.id}  ·  ${shiftOpen} → ${shiftClose}`;

    // ── Cover ──
    drawCover(doc, "Report Turno", subtitle, restaurant, new Date());
    let y = 260;

    // ── KPI headline ──
    y = sectionTitle(doc, y, "Riepilogo generale");
    y = kpiRow(doc, y, [
      { label: "Totale vendite", value: fmt(stats.summary.totalSales) },
      { label: "Ordini", value: String(stats.summary.totalOrders), sub: `${stats.summary.cancelledOrders} annullati` },
      { label: "Scontrino medio", value: fmt(stats.summary.avgTicket) },
      { label: "Netto", value: fmt(stats.summary.netSales), color: GREEN },
    ]);
    if (stats.summary.refundTotal > 0 || stats.summary.totalSalesExcluded > 0) {
      y = kpiRow(doc, y, [
        ...(stats.summary.refundTotal > 0 ? [{ label: "Storni", value: fmt(stats.summary.refundTotal), color: RED }] : []),
        ...(stats.summary.totalSalesExcluded > 0 ? [{ label: "Escluso da totale", value: fmt(stats.summary.totalSalesExcluded), color: GRAY600 }] : []),
      ]);
    }

    // Apertura / chiusura turno
    y = checkPage(doc, y, 60);
    rect(doc, MARGIN, y, COL_W, 44, GRAY100, 6);
    const fields = [
      ["Apertura turno", shiftOpen],
      ["Chiusura turno", shiftClose],
      ["Fondo apertura", fmt(stats.shift.openingCash)],
      ["Fondo chiusura", stats.shift.closingCash !== null ? fmt(stats.shift.closingCash) : "—"],
    ];
    const fw = COL_W / 4;
    fields.forEach(([lbl, val], i) => {
      const fx = MARGIN + i * fw + 10;
      text(doc, lbl!, fx, y + 8, { size: 7, color: GRAY400, bold: true });
      text(doc, val!, fx, y + 22, { size: 9, color: GRAY900, bold: true });
    });
    y += 52;

    // ── Metodi di pagamento ──
    if (stats.byPaymentMethod.length > 0) {
      y = sectionTitle(doc, y, "Metodi di pagamento");
      const included = stats.byPaymentMethod.filter((p) => !p.excludeFromTotal);
      const excluded = stats.byPaymentMethod.filter((p) => p.excludeFromTotal);
      const totalIncluded = included.reduce((s, p) => s + p.amount, 0);
      if (included.length > 0) {
        y = barTable(doc, y, included.map((p, i) => ({ label: p.method, value: p.amount, count: p.count, total: totalIncluded, color: PALETTE[i % PALETTE.length]! })));
      }
      if (excluded.length > 0) {
        y = checkPage(doc, y, 24);
        text(doc, "Esclusi dal totale generale", MARGIN, y, { size: 7, color: GRAY400, bold: true });
        y += 12;
        const totalEx = excluded.reduce((s, p) => s + p.amount, 0);
        y = barTable(doc, y, excluded.map((p, i) => ({ label: p.method, value: p.amount, count: p.count, total: totalEx, color: PALETTE[(i + 4) % PALETTE.length]! })));
      }
    }

    // ── Distribuzione oraria ──
    const activeHours = stats.byHour.filter((h) => h.orders > 0);
    if (activeHours.length > 0) {
      y = sectionTitle(doc, y, "Distribuzione oraria");
      const maxAmt = Math.max(...activeHours.map((h) => h.amount));
      const cellW = COL_W / 12;
      const cellH = 36;
      y = checkPage(doc, y, cellH * 2 + 16);
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 12; col++) {
          const h = stats.byHour[row * 12 + col]!;
          const cx = MARGIN + col * cellW;
          const intensity = maxAmt > 0 ? h.amount / maxAmt : 0;
          const [r, g, b] = hex(BRAND);
          const alpha = 0.08 + intensity * 0.92;
          doc.fillColor([r, g, b]).fillOpacity(alpha).roundedRect(cx + 1, y + 1, cellW - 2, cellH - 2, 3).fill();
          doc.fillOpacity(1);
          const tc: [number,number,number] = intensity > 0.5 ? [255,255,255] : hex(BRAND);
          doc.fillColor(tc).fontSize(7).font("Helvetica-Bold").text(`${String(h.hour).padStart(2,"0")}h`, cx + 1, y + 5, { width: cellW - 2, align: "center", lineBreak: false });
          if (h.orders > 0) {
            doc.fillColor(tc).fillOpacity(intensity > 0.5 ? 0.9 : 0.7).fontSize(6).font("Helvetica").text(fmt(h.amount), cx + 1, y + 15, { width: cellW - 2, align: "center", lineBreak: false });
            doc.fillOpacity(1);
          }
        }
        y += cellH;
      }
      y += 10;
    }

    // ── Casse ──
    if (stats.byTerminal.length > 0) {
      y = sectionTitle(doc, y, `Ripartizione per cassa (${stats.byTerminal.length})`);
      const grandTotal = stats.byTerminal.reduce((s, t) => s + t.amount, 0);

      // Tabella riepilogo casse
      y = table(doc, y, [
        { label: "Cassa", key: "name", width: 140 },
        { label: "Ordini", key: "orders", width: 60, align: "right" },
        { label: "Totale", key: "total", width: 80, align: "right", bold: true },
        { label: "Medio", key: "avg", width: 70, align: "right" },
        { label: "% su vendite", key: "share", width: 80, align: "right" },
        { label: "Metodi", key: "methods", width: COL_W - 430, align: "left" },
      ],
      stats.byTerminal.map((t, ti) => ({
        name: t.terminalName,
        orders: String(t.count),
        total: fmt(t.amount),
        avg: fmt(t.count > 0 ? t.amount / t.count : 0),
        share: pct(t.amount, grandTotal),
        methods: t.byMethod.sort((a,b) => b.amount - a.amount).map((m) => `${m.method} ${fmt(m.amount)}`).join("  ·  "),
      })),
      { footerRow: { name: "TOTALE", orders: String(stats.byTerminal.reduce((s,t)=>s+t.count,0)), total: fmt(grandTotal), avg: "", share: "100%", methods: "" } },
      );

      // Dettaglio per singola cassa (se più di 1)
      if (stats.byTerminal.length > 1) {
        for (const [ti, term] of stats.byTerminal.entries()) {
          y = checkPage(doc, y, 48 + term.byMethod.length * 18);
          const color = PALETTE[ti % PALETTE.length]!;
          rect(doc, MARGIN, y, COL_W, 26, color, 4);
          text(doc, term.terminalName, MARGIN + 10, y + 8, { size: 9, color: WHITE, bold: true });
          text(doc, `${fmt(term.amount)}  ·  ${term.count} ordini  ·  media ${fmt(term.count > 0 ? term.amount / term.count : 0)}  ·  ${pct(term.amount, grandTotal)} del totale`, MARGIN + COL_W - 290, y + 9, { size: 8, color: WHITE, align: "right", width: 280 });
          y += 30;
          y = barTable(doc, y, term.byMethod.sort((a,b)=>b.amount-a.amount).map((m, mi) => ({ label: m.method, value: m.amount, count: m.count, total: term.amount, color: PALETTE[(ti + mi + 2) % PALETTE.length]! })));
          y += 4;
        }
      }
    }

    // ── Categorie ──
    if (stats.byCategory.length > 0) {
      y = sectionTitle(doc, y, "Vendite per categoria");
      y = barTable(doc, y, stats.byCategory.map((c, i) => ({ label: c.categoryName, value: c.amount, count: c.quantity, total: stats.summary.totalSales, color: PALETTE[i % PALETTE.length]! })));
    }

    // ── Centri di produzione ──
    if (stats.byProductionCenter.length > 0) {
      y = sectionTitle(doc, y, "Vendite per centro di produzione");
      y = barTable(doc, y, stats.byProductionCenter.map((c, i) => ({ label: c.centerName, value: c.amount, count: c.quantity, total: stats.summary.totalSales, color: PALETTE[i % PALETTE.length]! })));
    }

    // ── Elenco completo prodotti ──
    if (stats.topProducts.length > 0) {
      y = sectionTitle(doc, y, `Elenco prodotti venduti (${stats.topProducts.length})`);
      const prodTotal = stats.topProducts.reduce((s, p) => s + p.amount, 0);
      y = table(doc, y,
        [
          { label: "#", key: "rank", width: 28, align: "right", color: GRAY400 },
          { label: "Prodotto", key: "name", width: COL_W - 28 - 56 - 80 - 72, align: "left" },
          { label: "Pz", key: "qty", width: 56, align: "right" },
          { label: "Totale", key: "amount", width: 80, align: "right", bold: true },
          { label: "% su vendite", key: "share", width: 72, align: "right", color: GRAY600 },
        ],
        stats.topProducts.map((p, i) => ({
          rank: `${i + 1}`,
          name: p.name,
          qty: String(p.quantity),
          amount: fmt(p.amount),
          share: pct(p.amount, prodTotal),
        })),
        { footerRow: { rank: "", name: `TOTALE  ${stats.topProducts.length} prodotti`, qty: String(stats.topProducts.reduce((s,p)=>s+p.quantity,0)), amount: fmt(prodTotal), share: "100%" } },
      );
    }

    // ── Pagina numeri ──
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      fillColor(doc, GRAY400);
      doc.fontSize(8).font("Helvetica").text(`${i + 1} / ${range.count}`, MARGIN, PAGE_H - 28, { align: "right", width: COL_W, lineBreak: false });
    }

    doc.end();
  });
}

// ─── PDF periodo ──────────────────────────────────────────────────────────────

async function buildPeriodPdfData(db: DbClient, from: number, to: number, terminalId?: number) {
  // Tutti gli ordini nel periodo (completed + cancelled per conteggio)
  const allOrders = await db.select().from(orders).where(
    and(
      gte(orders.createdAt, new Date(from)),
      lte(orders.createdAt, new Date(to)),
      terminalId !== undefined ? eq(orders.terminalId, terminalId) : undefined,
    )
  );

  const completedOrders = allOrders.filter((o) => PAID_STATUSES.includes(o.status as typeof PAID_STATUSES[number]));
  const cancelledOrders = allOrders.filter((o) => o.status === "cancelled").length;

  const orderIds = completedOrders.map((o) => o.id);
  const totalSalesRaw = completedOrders.reduce((s, o) => s + o.totalAmount, 0);

  const allMethodRows = await db.select({ id: paymentMethods.id, name: paymentMethods.name, excludeFromTotal: paymentMethods.excludeFromTotal }).from(paymentMethods);
  const methodIdToName = Object.fromEntries(allMethodRows.map((m) => [m.id, m.name]));
  const excludedMethodIds = new Set(allMethodRows.filter((m) => m.excludeFromTotal).map((m) => m.id));

  const pmtRows = orderIds.length > 0
    ? await db.select().from(payments).where(and(inArray(payments.orderId, orderIds), eq(payments.status, "completed")))
    : [];

  // Ordini esclusi dal totale
  const orderMethodMap: Record<number, string> = {};
  for (const p of pmtRows) orderMethodMap[p.orderId] = p.method;
  const isExcluded = (orderId: number) => {
    const m = orderMethodMap[orderId];
    return m !== undefined && excludedMethodIds.has(m);
  };
  const totalSalesExcluded = completedOrders.filter((o) => isExcluded(o.id)).reduce((s, o) => s + o.totalAmount, 0);
  const totalSales = totalSalesRaw - totalSalesExcluded;
  const totalOrders = completedOrders.length;

  // Storni
  const refundRows = orderIds.length > 0
    ? await db.select().from(payments).where(and(inArray(payments.orderId, orderIds), eq(payments.status, "refunded")))
    : [];
  const refundTotal = refundRows.reduce((s, p) => s + p.amount, 0);

  // Metodi di pagamento
  const pmtAgg: Record<string, { count: number; amount: number; excludeFromTotal: boolean }> = {};
  for (const p of pmtRows) {
    const name = methodIdToName[p.method] ?? p.method;
    const ex = excludedMethodIds.has(p.method);
    const e = pmtAgg[name] ?? { count: 0, amount: 0, excludeFromTotal: ex };
    e.count++; e.amount += p.amount;
    pmtAgg[name] = e;
  }

  // Articoli venduti
  const itemRows = orderIds.length > 0
    ? await db.select({
        productId: orderItems.productId,
        itemName: orderItems.name,
        categoryId: products.categoryId,
        categoryName: categories.name,
        productionCenterId: products.productionCenterId,
        unitPrice: orderItems.unitPrice,
        quantity: orderItems.quantity,
      })
        .from(orderItems)
        .leftJoin(products, eq(orderItems.productId, products.id))
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(inArray(orderItems.orderId, orderIds))
    : [];

  // Centro di produzione per categoria
  const categoryIds = [...new Set(itemRows.map((i) => i.categoryId).filter((id): id is number => id !== null))];
  const categoryCenterMap: Record<number, number> = {};
  if (categoryIds.length > 0) {
    const pcRows = await db.select({ categoryId: productionCenterCategories.categoryId, productionCenterId: productionCenterCategories.productionCenterId })
      .from(productionCenterCategories).where(inArray(productionCenterCategories.categoryId, categoryIds));
    for (const r of pcRows) { if (!categoryCenterMap[r.categoryId]) categoryCenterMap[r.categoryId] = r.productionCenterId; }
  }
  const centerIds = [...new Set([...itemRows.map((i) => i.productionCenterId), ...Object.values(categoryCenterMap)].filter((id): id is number => id !== null))];
  let centerNameMap: Record<number, string> = {};
  if (centerIds.length > 0) {
    const cRows = await db.select().from(productionCenters).where(inArray(productionCenters.id, centerIds));
    centerNameMap = Object.fromEntries(cRows.map((c) => [c.id, c.name]));
  }

  const catAgg: Record<string, { quantity: number; amount: number }> = {};
  const prodAgg: Record<string, { name: string; quantity: number; amount: number }> = {};
  const centerAgg: Record<string, { quantity: number; amount: number }> = {};
  const dayAgg: Record<string, number> = {};

  for (const item of itemRows) {
    const cat = item.categoryName ?? "Senza categoria";
    const ca = catAgg[cat] ?? { quantity: 0, amount: 0 };
    ca.quantity += item.quantity; ca.amount += item.unitPrice * item.quantity;
    catAgg[cat] = ca;

    const pid = String(item.productId);
    const pa = prodAgg[pid] ?? { name: item.itemName, quantity: 0, amount: 0 };
    pa.quantity += item.quantity; pa.amount += item.unitPrice * item.quantity;
    prodAgg[pid] = pa;

    const centerId = item.productionCenterId ?? (item.categoryId !== null && item.categoryId !== undefined ? categoryCenterMap[item.categoryId] : undefined);
    const centerName = centerId !== undefined ? (centerNameMap[centerId] ?? "Senza centro") : "Senza centro";
    const ce = centerAgg[centerName] ?? { quantity: 0, amount: 0 };
    ce.quantity += item.quantity; ce.amount += item.unitPrice * item.quantity;
    centerAgg[centerName] = ce;
  }

  const dayOrdersAgg: Record<string, number> = {};
  for (const o of completedOrders) {
    const day = o.createdAt.toISOString().slice(0, 10);
    dayAgg[day] = (dayAgg[day] ?? 0) + o.totalAmount;
    dayOrdersAgg[day] = (dayOrdersAgg[day] ?? 0) + 1;
  }

  // Distribuzione oraria
  const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0, amount: 0 }));
  for (const o of completedOrders) {
    const b = byHour[o.createdAt.getHours()]!;
    b.orders++; b.amount += o.totalAmount;
  }

  // Terminal breakdown
  const terminalIds = [...new Set(completedOrders.map((o) => o.terminalId).filter((id): id is number => id !== null))];
  let terminalNameMap: Record<number, string> = {};
  if (terminalIds.length > 0) {
    const tRows = await db.select().from(terminals).where(inArray(terminals.id, terminalIds));
    terminalNameMap = Object.fromEntries(tRows.map((t) => [t.id, t.name]));
  }
  const orderPmtMap = new Map(pmtRows.map((p) => [p.orderId, { method: methodIdToName[p.method] ?? p.method, amount: p.amount }]));
  const termAgg: Record<string, { count: number; amount: number; byMethod: Record<string, { count: number; amount: number }> }> = {};
  for (const o of completedOrders) {
    const name = o.terminalId !== null && o.terminalId !== undefined ? (terminalNameMap[o.terminalId] ?? "Senza cassa") : "Senza cassa";
    const e = termAgg[name] ?? { count: 0, amount: 0, byMethod: {} };
    e.count++; e.amount += o.totalAmount;
    const pmt = orderPmtMap.get(o.id);
    if (pmt) { const me = e.byMethod[pmt.method] ?? { count: 0, amount: 0 }; me.count++; me.amount += pmt.amount; e.byMethod[pmt.method] = me; }
    termAgg[name] = e;
  }
  const byTerminal = Object.entries(termAgg).map(([terminalName, v]) => ({
    terminalName, count: v.count, amount: v.amount,
    byMethod: Object.entries(v.byMethod).map(([method, m]) => ({ method, ...m })).sort((a, b) => b.amount - a.amount),
  })).sort((a, b) => b.amount - a.amount);

  const settingRows = await db.select().from(appSettings).where(inArray(appSettings.key, ["restaurant_name", "restaurant_vat", "restaurant_address", "restaurant_city"]));
  const restaurant = Object.fromEntries(settingRows.map((r) => [r.key, r.value]));

  return {
    summary: {
      totalSales, totalOrders, cancelledOrders,
      avgTicket: totalOrders > 0 ? totalSales / totalOrders : 0,
      refundTotal, netSales: totalSales - refundTotal, totalSalesExcluded,
    },
    byPaymentMethod: Object.entries(pmtAgg).map(([method, v]) => ({ method, ...v })).sort((a, b) => b.amount - a.amount),
    byCategory: Object.entries(catAgg).map(([categoryName, v]) => ({ categoryName, ...v })).sort((a, b) => b.amount - a.amount),
    byProductionCenter: Object.entries(centerAgg).map(([centerName, v]) => ({ centerName, ...v })).sort((a, b) => b.amount - a.amount),
    byTerminal,
    byHour,
    byDay: Object.entries(dayAgg).sort(([a], [b]) => a.localeCompare(b)).map(([date, sales]) => ({ date, sales, orders: dayOrdersAgg[date] ?? 0 })),
    topProducts: Object.values(prodAgg).sort((a, b) => b.amount - a.amount),
    restaurant,
    from: new Date(from),
    to: new Date(to),
  };
}

type PeriodData = NonNullable<Awaited<ReturnType<typeof buildPeriodPdfData>>>;

function generatePeriodPdf(data: PeriodData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true, info: { Title: "Report Periodo", Author: data.restaurant["restaurant_name"] ?? "POS" } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const fromStr = data.from.toLocaleDateString("it-IT");
    const toStr = data.to.toLocaleDateString("it-IT");
    const subtitle = fromStr === toStr ? fromStr : `${fromStr} → ${toStr}`;

    drawCover(doc, "Report Periodo", subtitle, data.restaurant["restaurant_name"] ?? "", new Date());
    let y = 260;

    // ── Riepilogo ──
    y = sectionTitle(doc, y, "Riepilogo generale");
    y = kpiRow(doc, y, [
      { label: "Totale vendite", value: fmt(data.summary.totalSales) },
      { label: "Ordini", value: String(data.summary.totalOrders), sub: data.summary.cancelledOrders > 0 ? `${data.summary.cancelledOrders} annullati` : undefined },
      { label: "Scontrino medio", value: fmt(data.summary.avgTicket) },
      { label: "Netto", value: fmt(data.summary.netSales), color: GREEN },
    ]);
    if (data.summary.refundTotal > 0 || data.summary.totalSalesExcluded > 0) {
      y = kpiRow(doc, y, [
        ...(data.summary.refundTotal > 0 ? [{ label: "Storni", value: fmt(data.summary.refundTotal), color: RED }] : []),
        ...(data.summary.totalSalesExcluded > 0 ? [{ label: "Escluso da totale", value: fmt(data.summary.totalSalesExcluded), color: GRAY600 }] : []),
      ]);
    }

    // Box riepilogo periodo
    y = checkPage(doc, y, 44);
    rect(doc, MARGIN, y, COL_W, 36, GRAY100, 6);
    const periodFields = [
      ["Inizio periodo", data.from.toLocaleString("it-IT")],
      ["Fine periodo", data.to.toLocaleString("it-IT")],
      ["Giorni", String(data.byDay.length)],
      ["Media giornaliera", fmt(data.byDay.length > 0 ? data.summary.totalSales / data.byDay.length : 0)],
    ];
    const pfw = COL_W / 4;
    periodFields.forEach(([lbl, val], i) => {
      const fx = MARGIN + i * pfw + 10;
      text(doc, lbl!, fx, y + 6, { size: 7, color: GRAY400, bold: true });
      text(doc, val!, fx, y + 18, { size: 9, color: GRAY900, bold: true });
    });
    y += 44;

    // ── Metodi di pagamento ──
    if (data.byPaymentMethod.length > 0) {
      y = sectionTitle(doc, y, "Metodi di pagamento");
      const included = data.byPaymentMethod.filter((p) => !p.excludeFromTotal);
      const excluded = data.byPaymentMethod.filter((p) => p.excludeFromTotal);
      const totalI = included.reduce((s, p) => s + p.amount, 0);
      if (included.length > 0) {
        y = barTable(doc, y, included.map((p, i) => ({ label: p.method, value: p.amount, count: p.count, total: totalI, color: PALETTE[i % PALETTE.length]! })));
      }
      if (excluded.length > 0) {
        y = checkPage(doc, y, 24);
        text(doc, "Esclusi dal totale generale", MARGIN, y, { size: 7, color: GRAY400, bold: true });
        y += 12;
        const totalE = excluded.reduce((s, p) => s + p.amount, 0);
        y = barTable(doc, y, excluded.map((p, i) => ({ label: p.method, value: p.amount, count: p.count, total: totalE, color: PALETTE[(i + 4) % PALETTE.length]! })));
      }
    }

    // ── Distribuzione oraria ──
    const activeHours = data.byHour.filter((h) => h.orders > 0);
    if (activeHours.length > 0) {
      y = sectionTitle(doc, y, "Distribuzione oraria (aggregata)");
      const maxAmt = Math.max(...activeHours.map((h) => h.amount));
      const cellW = COL_W / 12;
      const cellH = 36;
      y = checkPage(doc, y, cellH * 2 + 16);
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 12; col++) {
          const h = data.byHour[row * 12 + col]!;
          const cx = MARGIN + col * cellW;
          const intensity = maxAmt > 0 ? h.amount / maxAmt : 0;
          const [r, g, b] = hex(BRAND);
          const alpha = 0.08 + intensity * 0.92;
          doc.fillColor([r, g, b]).fillOpacity(alpha).roundedRect(cx + 1, y + 1, cellW - 2, cellH - 2, 3).fill();
          doc.fillOpacity(1);
          const tc: [number, number, number] = intensity > 0.5 ? [255, 255, 255] : hex(BRAND);
          doc.fillColor(tc).fontSize(7).font("Helvetica-Bold").text(`${String(h.hour).padStart(2, "0")}h`, cx + 1, y + 5, { width: cellW - 2, align: "center", lineBreak: false });
          if (h.orders > 0) {
            doc.fillColor(tc).fillOpacity(intensity > 0.5 ? 0.9 : 0.7).fontSize(6).font("Helvetica").text(fmt(h.amount), cx + 1, y + 15, { width: cellW - 2, align: "center", lineBreak: false });
            doc.fillOpacity(1);
          }
        }
        y += cellH;
      }
      y += 10;
    }

    // ── Ripartizione per cassa ──
    if (data.byTerminal.length > 0) {
      y = sectionTitle(doc, y, `Ripartizione per cassa (${data.byTerminal.length})`);
      const grandTotal = data.byTerminal.reduce((s, t) => s + t.amount, 0);

      // Tabella riepilogo
      y = table(doc, y, [
        { label: "Cassa", key: "name", width: 140 },
        { label: "Ordini", key: "orders", width: 60, align: "right" },
        { label: "Totale", key: "total", width: 80, align: "right", bold: true },
        { label: "Medio", key: "avg", width: 70, align: "right" },
        { label: "% su vendite", key: "share", width: 80, align: "right" },
        { label: "Metodi", key: "methods", width: COL_W - 430, align: "left" },
      ],
      data.byTerminal.map((t) => ({
        name: t.terminalName,
        orders: String(t.count),
        total: fmt(t.amount),
        avg: fmt(t.count > 0 ? t.amount / t.count : 0),
        share: pct(t.amount, grandTotal),
        methods: t.byMethod.map((m) => `${m.method} ${fmt(m.amount)}`).join("  ·  "),
      })),
      { footerRow: { name: "TOTALE", orders: String(data.byTerminal.reduce((s, t) => s + t.count, 0)), total: fmt(grandTotal), avg: "", share: "100%", methods: "" } },
      );

      // Card dettaglio per ogni cassa
      for (const [ti, term] of data.byTerminal.entries()) {
        y = checkPage(doc, y, 48 + term.byMethod.length * 18);
        const color = PALETTE[ti % PALETTE.length]!;
        rect(doc, MARGIN, y, COL_W, 26, color, 4);
        text(doc, term.terminalName, MARGIN + 10, y + 8, { size: 9, color: WHITE, bold: true });
        text(doc, `${fmt(term.amount)}  ·  ${term.count} ordini  ·  media ${fmt(term.count > 0 ? term.amount / term.count : 0)}  ·  ${pct(term.amount, grandTotal)} del totale`,
          MARGIN + COL_W - 290, y + 9, { size: 8, color: WHITE, align: "right", width: 280 });
        y += 30;
        if (term.byMethod.length > 0) {
          y = barTable(doc, y, term.byMethod.map((m, mi) => ({
            label: m.method, value: m.amount, count: m.count, total: term.amount,
            color: PALETTE[(ti + mi + 2) % PALETTE.length]!,
          })));
        }
        y += 4;
      }
    }

    // ── Categorie ──
    if (data.byCategory.length > 0) {
      y = sectionTitle(doc, y, "Vendite per categoria");
      y = barTable(doc, y, data.byCategory.map((c, i) => ({
        label: c.categoryName, value: c.amount, count: c.quantity,
        total: data.summary.totalSales, color: PALETTE[i % PALETTE.length]!,
      })));
    }

    // ── Centri di produzione ──
    if (data.byProductionCenter.length > 0) {
      y = sectionTitle(doc, y, "Vendite per centro di produzione");
      y = barTable(doc, y, data.byProductionCenter.map((c, i) => ({
        label: c.centerName, value: c.amount, count: c.quantity,
        total: data.summary.totalSales, color: PALETTE[i % PALETTE.length]!,
      })));
    }

    // ── Vendite per giorno ──
    if (data.byDay.length > 0) {
      y = sectionTitle(doc, y, "Vendite per giorno");
      const maxDay = Math.max(...data.byDay.map((d) => d.sales));
      y = table(doc, y,
        [
          { label: "Data", key: "date", width: 90 },
          { label: "Giorno", key: "dow", width: 70, color: GRAY600 },
          { label: "Vendite", key: "sales", width: 90, align: "right", bold: true },
          { label: "Ordini", key: "orders", width: 60, align: "right", color: GRAY600 },
          { label: "% su periodo", key: "share", width: 80, align: "right", color: GRAY600 },
          { label: "Trend", key: "bar", width: COL_W - 390, align: "left", color: BRAND },
        ],
        data.byDay.map((d) => {
          const dt = new Date(d.date);
          const dow = dt.toLocaleDateString("it-IT", { weekday: "short" });
          return {
            date: dt.toLocaleDateString("it-IT"),
            dow,
            sales: fmt(d.sales),
            orders: String(d.orders),
            share: pct(d.sales, data.summary.totalSales),
            bar: "█".repeat(Math.round((d.sales / maxDay) * 24)),
          };
        }),
        { footerRow: { date: "TOTALE", dow: "", sales: fmt(data.summary.totalSales), orders: String(data.summary.totalOrders), share: "100%", bar: "" } },
      );
    }

    // ── Elenco prodotti ──
    if (data.topProducts.length > 0) {
      y = sectionTitle(doc, y, `Elenco prodotti venduti (${data.topProducts.length})`);
      const prodTotal = data.topProducts.reduce((s, p) => s + p.amount, 0);
      y = table(doc, y,
        [
          { label: "#", key: "rank", width: 28, align: "right", color: GRAY400 },
          { label: "Prodotto", key: "name", width: COL_W - 28 - 56 - 80 - 72 },
          { label: "Pz", key: "qty", width: 56, align: "right" },
          { label: "Totale", key: "amount", width: 80, align: "right", bold: true },
          { label: "%", key: "share", width: 72, align: "right", color: GRAY600 },
        ],
        data.topProducts.map((p, i) => ({
          rank: `${i + 1}`,
          name: p.name,
          qty: String(p.quantity),
          amount: fmt(p.amount),
          share: pct(p.amount, prodTotal),
        })),
        { footerRow: { rank: "", name: `TOTALE  ${data.topProducts.length} prodotti`, qty: String(data.topProducts.reduce((s, p) => s + p.quantity, 0)), amount: fmt(prodTotal), share: "100%" } },
      );
    }

    // Numerazione pagine
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      fillColor(doc, GRAY400);
      doc.fontSize(8).font("Helvetica").text(`${i + 1} / ${range.count}`, MARGIN, PAGE_H - 28, { align: "right", width: COL_W, lineBreak: false });
    }

    doc.end();
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

const statsPdfRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request) => { await fastify.authenticate(request); });

  // GET /api/stats/shift/:shiftId/pdf[?terminalId=]
  fastify.get("/stats/shift/:shiftId/pdf", {
    schema: {
      tags: ["stats"],
      summary: "Export shift stats as PDF",
      params: { type: "object", properties: { shiftId: { type: "string" } } },
      querystring: { type: "object", properties: { terminalId: { type: "number" } } },
    },
  }, async (request, reply) => {
    const { shiftId } = request.params as { shiftId: string };
    const { terminalId } = request.query as { terminalId?: number };
    const data = await buildShiftPdfData(fastify.ctx.db, parseInt(shiftId, 10), terminalId);
    if (!data) return reply.status(404).send({ error: "Shift not found" });
    const pdf = await generateShiftPdf(data);
    return reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `attachment; filename="report-turno-${shiftId}.pdf"`)
      .header("Content-Length", pdf.length)
      .send(pdf);
  });

  // GET /api/stats/period/pdf?from=&to=[&terminalId=]
  fastify.get("/stats/period/pdf", {
    schema: {
      tags: ["stats"],
      summary: "Export period stats as PDF",
      querystring: {
        type: "object",
        required: ["from", "to"],
        properties: { from: { type: "number" }, to: { type: "number" }, terminalId: { type: "number" } },
      },
    },
  }, async (request, reply) => {
    const { from, to, terminalId } = request.query as { from: number; to: number; terminalId?: number };
    const data = await buildPeriodPdfData(fastify.ctx.db, from, to, terminalId);
    const pdf = await generatePeriodPdf(data);
    const dateStr = new Date(from).toISOString().slice(0, 10);
    return reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `attachment; filename="report-periodo-${dateStr}.pdf"`)
      .header("Content-Length", pdf.length)
      .send(pdf);
  });
};

export default statsPdfRoutes;
