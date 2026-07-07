import "@fastify/swagger";
import type { FastifyPluginAsync } from "fastify";
import { eq } from "@pos/db";
import { kitchenTemplates } from "@pos/db";
import { randomUUID } from "node:crypto";
import { requireRole, AuthError, renderKitchenImage, pngToEscposRaster } from "@pos/core";
import { mkdirSync, unlinkSync, existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { KitchenBlock } from "@pos/shared-types";

const kitchenLogosDir = (dataDir: string) => `${dataDir}/logos/kitchen`;

function ensureDir(dir: string): void {
  try { mkdirSync(dir, { recursive: true }); } catch { /* already exists */ }
}

const DEFAULT_BLOCKS: KitchenBlock[] = [
  { id: "1", type: "center-name",  align: "center", fontSize: 24, fontFamily: "DejaVu Sans", bold: true,  paddingTop: 0,  visible: true },
  { id: "2", type: "order-number", align: "center", fontSize: 20, fontFamily: "DejaVu Sans", bold: true,  paddingTop: 8,  visible: true },
  { id: "3", type: "table-number", align: "center", fontSize: 16, fontFamily: "DejaVu Sans", bold: false, paddingTop: 4,  visible: true },
  { id: "4", type: "timestamp",    align: "center", fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 4,  visible: true },
  { id: "5", type: "divider",      align: "left",   fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 8,  visible: true },
  { id: "6", type: "items",        align: "left",   fontSize: 16, fontFamily: "DejaVu Sans", bold: false, paddingTop: 8,  visible: true },
  { id: "7", type: "divider",      align: "left",   fontSize: 14, fontFamily: "DejaVu Sans", bold: false, paddingTop: 8,  visible: true },
];

const kitchenTemplatesRoutes: FastifyPluginAsync = async (fastify) => {
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

  fastify.get("/kitchen-templates", {
    schema: { tags: ["kitchen-templates"], summary: "List kitchen templates" },
  }, async (_request, reply) => {
    const rows = await fastify.ctx.db.select().from(kitchenTemplates);
    return reply.send(rows);
  });

  fastify.post("/kitchen-templates", {
    schema: { tags: ["kitchen-templates"], summary: "Create a kitchen template" },
  }, async (request, reply) => {
    const body = request.body as {
      name: string;
      productionCenterId?: string | null;
      printMode?: "text" | "image";
      canvasWidth?: number;
      blocks?: KitchenBlock[];
    };
    const id = randomUUID();
    const blocks = body.blocks ?? DEFAULT_BLOCKS;
    await fastify.ctx.db.insert(kitchenTemplates).values({
      id,
      name: body.name,
      productionCenterId: body.productionCenterId ?? null,
      active: true,
      printMode: body.printMode ?? "text",
      canvasWidth: body.canvasWidth ?? 576,
      blocks: JSON.stringify(blocks),
      logoPath: null,
    });
    const [row] = await fastify.ctx.db.select().from(kitchenTemplates).where(eq(kitchenTemplates.id, id));
    return reply.status(201).send(row);
  });

  fastify.patch("/kitchen-templates/:id", {
    schema: { tags: ["kitchen-templates"], summary: "Update a kitchen template" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      name: string;
      productionCenterId: string | null;
      active: boolean;
      printMode: "text" | "image";
      canvasWidth: number;
      blocks: KitchenBlock[];
    }>;

    const [existing] = await fastify.ctx.db.select().from(kitchenTemplates).where(eq(kitchenTemplates.id, id));
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const update: {
      name?: string;
      productionCenterId?: string | null;
      active?: boolean;
      printMode?: string;
      canvasWidth?: number;
      blocks?: string;
    } = {};
    if (body.name !== undefined) update.name = body.name;
    if ("productionCenterId" in body) update.productionCenterId = body.productionCenterId ?? null;
    if (body.active !== undefined) update.active = body.active;
    if (body.printMode !== undefined) update.printMode = body.printMode;
    if (body.canvasWidth !== undefined) update.canvasWidth = body.canvasWidth;
    if (body.blocks !== undefined) update.blocks = JSON.stringify(body.blocks);

    if (Object.keys(update).length > 0) {
      await fastify.ctx.db.update(kitchenTemplates).set(update).where(eq(kitchenTemplates.id, id));
    }
    const [row] = await fastify.ctx.db.select().from(kitchenTemplates).where(eq(kitchenTemplates.id, id));
    return reply.send(row);
  });

  fastify.delete("/kitchen-templates/:id", {
    schema: { tags: ["kitchen-templates"], summary: "Delete a kitchen template" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await fastify.ctx.db.delete(kitchenTemplates).where(eq(kitchenTemplates.id, id));
    return reply.status(204).send();
  });

  fastify.get("/kitchen-templates/:id/preview", {
    schema: { tags: ["kitchen-templates"], summary: "Get PNG preview of a kitchen template" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [template] = await fastify.ctx.db.select().from(kitchenTemplates).where(eq(kitchenTemplates.id, id));
    if (!template) return reply.status(404).send({ error: "Not found" });

    const blocks: KitchenBlock[] = template.blocks
      ? (typeof template.blocks === "string" ? JSON.parse(template.blocks) : template.blocks)
      : DEFAULT_BLOCKS;

    const pngBuffer = await renderKitchenImage({
      blocks,
      canvasWidth: template.canvasWidth ?? 576,
      logoPath: template.logoPath ?? null,
      centerName: "Cucina",
      orderId: "preview-order-id",
      receiptDisplay: "0001",
      tableId: "5",
      customerName: "Mario Rossi",
      timestamp: new Date(),
      items: [
        { name: "Hamburger", quantity: 2, options: [{ optionName: "Senza cipolla", priceDelta: 0 }] },
        { name: "Patatine fritte", quantity: 1, notes: "Croccanti" },
      ],
    });

    return reply
      .header("Content-Type", "image/png")
      .header("Content-Length", pngBuffer.length)
      .send(pngBuffer);
  });

  // POST /kitchen-templates/preview — live preview of unsaved blocks (frontend sends current editor state)
  fastify.post("/kitchen-templates/preview", async (request, reply) => {
    const body = request.body as { blocks: KitchenBlock[]; canvasWidth: number; logoPath?: string | null };

    const pngBuffer = await renderKitchenImage({
      blocks: body.blocks,
      canvasWidth: body.canvasWidth ?? 576,
      logoPath: body.logoPath ?? null,
      centerName: "Cucina",
      orderId: "preview-order-id",
      receiptDisplay: "0001",
      tableId: "5",
      customerName: "Mario Rossi",
      timestamp: new Date(),
      items: [
        { name: "Hamburger", quantity: 2, options: [{ optionName: "Senza cipolla", priceDelta: 0 }] },
        { name: "Patatine fritte", quantity: 1, notes: "Croccanti" },
      ],
    });

    return reply
      .header("Content-Type", "image/png")
      .header("Content-Length", pngBuffer.length)
      .send(pngBuffer);
  });

  fastify.post("/kitchen-templates/:id/logo", {
    schema: { tags: ["kitchen-templates"], summary: "Upload logo for a kitchen template" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [existing] = await fastify.ctx.db.select().from(kitchenTemplates).where(eq(kitchenTemplates.id, id));
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const data = await request.file();
    if (!data) return reply.status(400).send({ error: "No file uploaded" });

    const MIME_TO_EXT: Record<string, string> = {
      "image/png": ".png", "image/jpeg": ".jpg", "image/jpg": ".jpg",
      "image/webp": ".webp", "image/gif": ".gif",
    };
    const ext = MIME_TO_EXT[data.mimetype];
    if (!ext) return reply.status(400).send({ error: "Only PNG/JPG/WEBP/GIF allowed" });

    const LOGOS_DIR = resolve(kitchenLogosDir(fastify.ctx.config.dataDir));
    ensureDir(LOGOS_DIR);
    const filename = `${id}${ext}`;
    const relPath = `logos/kitchen/${filename}`;
    const absPath = join(LOGOS_DIR, filename);
    const buffer = await data.toBuffer();
    await writeFile(absPath, buffer);

    await fastify.ctx.db.update(kitchenTemplates).set({ logoPath: relPath }).where(eq(kitchenTemplates.id, id));
    const [row] = await fastify.ctx.db.select().from(kitchenTemplates).where(eq(kitchenTemplates.id, id));
    return reply.send(row);
  });

  fastify.delete("/kitchen-templates/:id/logo", {
    schema: { tags: ["kitchen-templates"], summary: "Remove logo from a kitchen template" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [existing] = await fastify.ctx.db.select().from(kitchenTemplates).where(eq(kitchenTemplates.id, id));
    if (!existing) return reply.status(404).send({ error: "Not found" });

    if (existing.logoPath) {
      const absPath = resolve(join(fastify.ctx.config.dataDir, existing.logoPath));
      if (existsSync(absPath)) { try { unlinkSync(absPath); } catch { /* ignore */ } }
    }
    await fastify.ctx.db.update(kitchenTemplates).set({ logoPath: null }).where(eq(kitchenTemplates.id, id));
    return reply.status(204).send();
  });
};

export default kitchenTemplatesRoutes;
