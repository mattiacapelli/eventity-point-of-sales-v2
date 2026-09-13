import "@fastify/swagger";
import type { FastifyPluginAsync } from "fastify";
import { eq, inArray, appSettings, shiftReportTemplates } from "@pos/db";
import { requireRole, AuthError, renderShiftReportImage } from "@pos/core";
import { mkdirSync, unlinkSync, existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ShiftReportBlock } from "@pos/shared-types";

const shiftReportLogosDir = (dataDir: string) => `${dataDir}/logos/shift-report`;

function ensureDir(dir: string): void {
  try { mkdirSync(dir, { recursive: true }); } catch { /* already exists */ }
}

const RESTAURANT_KEYS = ["restaurant_name", "restaurant_address", "restaurant_city", "restaurant_vat", "restaurant_phone", "restaurant_logo_path"] as const;

const DEFAULT_BLOCKS: ShiftReportBlock[] = [
  { id: "1", type: "restaurant-name", align: "center", fontSize: 20, fontFamily: "DejaVu Sans", bold: true,  paddingTop: 0,  visible: true },
  { id: "2", type: "text",            align: "center", fontSize: 16, fontFamily: "DejaVu Sans", bold: true,  paddingTop: 8,  visible: true, content: "REPORT TURNO" },
  { id: "3", type: "divider",         align: "left",   fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 8,  visible: true },
  { id: "4", type: "shift-period",    align: "left",   fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 0,  visible: true },
  { id: "5", type: "divider",         align: "left",   fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 8,  visible: true },
  { id: "6", type: "text",            align: "left",   fontSize: 14, fontFamily: "DejaVu Sans", bold: true,  paddingTop: 0,  visible: true, content: "RIEPILOGO" },
  { id: "7", type: "kpi-summary",     align: "left",   fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 4,  visible: true },
  { id: "8", type: "divider",         align: "left",   fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 8,  visible: true },
  { id: "9", type: "text",            align: "left",   fontSize: 14, fontFamily: "DejaVu Sans", bold: true,  paddingTop: 0,  visible: true, content: "PER FASCIA ORARIA" },
  { id: "10", type: "by-hour",         align: "left",   fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 4,  visible: true },
  { id: "11", type: "divider",         align: "left",   fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 8,  visible: true },
  { id: "12", type: "text",            align: "left",   fontSize: 14, fontFamily: "DejaVu Sans", bold: true,  paddingTop: 0,  visible: true, content: "PER CATEGORIA" },
  { id: "13", type: "by-category",     align: "left",   fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 4,  visible: true },
  { id: "14", type: "divider",         align: "left",   fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 8,  visible: true },
  { id: "15", type: "text",            align: "left",   fontSize: 14, fontFamily: "DejaVu Sans", bold: true,  paddingTop: 0,  visible: true, content: "PER CENTRO DI PRODUZIONE" },
  { id: "16", type: "by-production-center", align: "left", fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 4, visible: true },
  { id: "17", type: "divider",         align: "left",   fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 8,  visible: true },
  { id: "18", type: "text",            align: "left",   fontSize: 14, fontFamily: "DejaVu Sans", bold: true,  paddingTop: 0,  visible: true, content: "PER METODO DI PAGAMENTO" },
  { id: "19", type: "by-payment-method", align: "left",  fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 4, visible: true },
  { id: "20", type: "divider",         align: "left",   fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 8,  visible: true },
  { id: "21", type: "text",            align: "left",   fontSize: 14, fontFamily: "DejaVu Sans", bold: true,  paddingTop: 0,  visible: true, content: "TOP PRODOTTI" },
  { id: "22", type: "top-products",    align: "left",   fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 4,  visible: true },
];

const PREVIEW_DATA = {
  shift: { openedAt: new Date(Date.now() - 8 * 3600_000).toISOString(), closedAt: new Date().toISOString(), openingCash: 100, closingCash: 342.5 },
  kpis: { totalSales: 1234.56, totalOrders: 42, avgTicket: 29.4, cancelledOrders: 2, refundTotal: 15, netSales: 1219.56 },
  byHour: [
    { hour: 12, orders: 8, amount: 210.5 },
    { hour: 13, orders: 12, amount: 340.2 },
    { hour: 20, orders: 15, amount: 480.3 },
  ],
  byCategory: [
    { categoryName: "Primi", quantity: 20, amount: 400 },
    { categoryName: "Bevande", quantity: 30, amount: 150 },
  ],
  byProductionCenter: [
    { centerName: "Cucina", quantity: 35, amount: 700 },
    { centerName: "Bar", quantity: 30, amount: 150 },
  ],
  byPaymentMethod: [
    { method: "cash", count: 20, amount: 600 },
    { method: "card", count: 22, amount: 634.56 },
  ],
  topProducts: [
    { name: "Pizza Margherita", quantity: 15, amount: 150 },
    { name: "Acqua naturale", quantity: 25, amount: 50 },
  ],
};

const shiftReportTemplatesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request, reply) => {
    await fastify.authenticate(request);
    try {
      requireRole(request.session!, "admin");
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.status(403).send({ error: err.message });
      }
      throw err;
    }
  });

  fastify.get("/shift-report-templates", {
    schema: { tags: ["shift-report-templates"], summary: "List shift report templates" },
  }, async (_request, reply) => {
    const rows = await fastify.ctx.db.select().from(shiftReportTemplates);
    return reply.send(rows);
  });

  fastify.get("/shift-report-templates/active", {
    schema: { tags: ["shift-report-templates"], summary: "Get the active shift report template" },
  }, async (_request, reply) => {
    const [row] = await fastify.ctx.db.select().from(shiftReportTemplates).where(eq(shiftReportTemplates.active, true));
    if (!row) return reply.status(404).send({ error: "Not found" });
    return reply.send(row);
  });

  fastify.post("/shift-report-templates", {
    schema: { tags: ["shift-report-templates"], summary: "Create a shift report template" },
  }, async (request, reply) => {
    const body = request.body as {
      name: string;
      printMode?: "text" | "image";
      canvasWidth?: number;
      blocks?: ShiftReportBlock[];
    };
    const blocks = body.blocks ?? DEFAULT_BLOCKS;
    const [row] = await fastify.ctx.db.insert(shiftReportTemplates).values({
      name: body.name,
      active: true,
      printMode: body.printMode ?? "image",
      canvasWidth: body.canvasWidth ?? 576,
      blocks: JSON.stringify(blocks),
      logoPath: null,
    }).returning();
    return reply.status(201).send(row);
  });

  fastify.patch("/shift-report-templates/:id", {
    schema: { tags: ["shift-report-templates"], summary: "Update a shift report template" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    const body = request.body as Partial<{
      name: string;
      active: boolean;
      printMode: "text" | "image";
      canvasWidth: number;
      blocks: ShiftReportBlock[];
    }>;

    const [existing] = await fastify.ctx.db.select().from(shiftReportTemplates).where(eq(shiftReportTemplates.id, numId));
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const update: {
      name?: string;
      active?: boolean;
      printMode?: string;
      canvasWidth?: number;
      blocks?: string;
    } = {};
    if (body.name !== undefined) update.name = body.name;
    if (body.active !== undefined) update.active = body.active;
    if (body.printMode !== undefined) update.printMode = body.printMode;
    if (body.canvasWidth !== undefined) update.canvasWidth = body.canvasWidth;
    if (body.blocks !== undefined) update.blocks = JSON.stringify(body.blocks);

    if (Object.keys(update).length > 0) {
      await fastify.ctx.db.update(shiftReportTemplates).set(update).where(eq(shiftReportTemplates.id, numId));
    }
    const [row] = await fastify.ctx.db.select().from(shiftReportTemplates).where(eq(shiftReportTemplates.id, numId));
    return reply.send(row);
  });

  fastify.delete("/shift-report-templates/:id", {
    schema: { tags: ["shift-report-templates"], summary: "Delete a shift report template" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await fastify.ctx.db.delete(shiftReportTemplates).where(eq(shiftReportTemplates.id, parseInt(id, 10)));
    return reply.status(204).send();
  });

  fastify.post("/shift-report-templates/preview", {
    schema: { tags: ["shift-report-templates"], summary: "Get PNG preview of a shift report template" },
  }, async (request, reply) => {
    const body = request.body as { blocks: ShiftReportBlock[]; canvasWidth?: number };

    const restRows = await fastify.ctx.db.select().from(appSettings).where(inArray(appSettings.key, [...RESTAURANT_KEYS]));
    const rMap = Object.fromEntries(restRows.map((r) => [r.key, r.value]));

    const rawLogo = rMap["restaurant_logo_path"];
    const absLogo = rawLogo ? resolve(join(fastify.ctx.config.dataDir, rawLogo)) : null;
    const logoPath = (absLogo && existsSync(absLogo)) ? absLogo : null;

    const pngBuffer = await renderShiftReportImage({
      blocks: body.blocks,
      canvasWidth: body.canvasWidth ?? 576,
      logoPath,
      restaurantName: rMap["restaurant_name"] ?? "Il Mio Ristorante",
      restaurantAddress: rMap["restaurant_address"] ?? "Via Roma 1",
      restaurantCity: rMap["restaurant_city"] ?? "Milano",
      restaurantVat: rMap["restaurant_vat"] ?? "IT12345678901",
      restaurantPhone: rMap["restaurant_phone"] ?? "+39 02 1234567",
      ...PREVIEW_DATA,
    });

    return reply
      .header("Content-Type", "image/png")
      .header("Content-Length", pngBuffer.length)
      .send(pngBuffer);
  });

  fastify.post("/shift-report-templates/:id/logo", {
    schema: { tags: ["shift-report-templates"], summary: "Upload logo for a shift report template" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    const [existing] = await fastify.ctx.db.select().from(shiftReportTemplates).where(eq(shiftReportTemplates.id, numId));
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const data = await request.file();
    if (!data) return reply.status(400).send({ error: "No file uploaded" });

    const MIME_TO_EXT: Record<string, string> = {
      "image/png": ".png", "image/jpeg": ".jpg", "image/jpg": ".jpg",
      "image/webp": ".webp", "image/gif": ".gif",
    };
    const ext = MIME_TO_EXT[data.mimetype];
    if (!ext) return reply.status(400).send({ error: "Only PNG/JPG/WEBP/GIF allowed" });

    const LOGOS_DIR = resolve(shiftReportLogosDir(fastify.ctx.config.dataDir));
    ensureDir(LOGOS_DIR);
    const filename = `${numId}${ext}`;
    const relPath = `logos/shift-report/${filename}`;
    const absPath = join(LOGOS_DIR, filename);
    const buffer = await data.toBuffer();
    await writeFile(absPath, buffer);

    await fastify.ctx.db.update(shiftReportTemplates).set({ logoPath: relPath }).where(eq(shiftReportTemplates.id, numId));
    const [row] = await fastify.ctx.db.select().from(shiftReportTemplates).where(eq(shiftReportTemplates.id, numId));
    return reply.send(row);
  });

  fastify.delete("/shift-report-templates/:id/logo", {
    schema: { tags: ["shift-report-templates"], summary: "Remove logo from a shift report template" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const numId2 = parseInt(id, 10);
    const [existing] = await fastify.ctx.db.select().from(shiftReportTemplates).where(eq(shiftReportTemplates.id, numId2));
    if (!existing) return reply.status(404).send({ error: "Not found" });

    if (existing.logoPath) {
      const absPath = resolve(join(fastify.ctx.config.dataDir, existing.logoPath));
      if (existsSync(absPath)) { try { unlinkSync(absPath); } catch { /* ignore */ } }
    }
    await fastify.ctx.db.update(shiftReportTemplates).set({ logoPath: null }).where(eq(shiftReportTemplates.id, numId2));
    return reply.status(204).send();
  });
};

export default shiftReportTemplatesRoutes;
