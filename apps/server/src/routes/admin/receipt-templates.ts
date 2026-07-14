import "@fastify/swagger";
import type { FastifyPluginAsync } from "fastify";
import { eq, inArray, appSettings } from "@pos/db";
import { receiptTemplates } from "@pos/db";
import { requireRole, AuthError, renderReceiptImage } from "@pos/core";
import { mkdirSync, unlinkSync, existsSync, readdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ReceiptBlock } from "@pos/shared-types";

const BUNDLED_FONTS_DIR = new URL("../../assets/fonts", import.meta.url).pathname;

function ensureDir(dir: string): void {
  try { mkdirSync(dir, { recursive: true }); } catch { /* already exists */ }
}

const RESTAURANT_KEYS = ["restaurant_name", "restaurant_address", "restaurant_city", "restaurant_vat", "restaurant_phone", "restaurant_logo_path"] as const;

const receiptTemplatesRoutes: FastifyPluginAsync = async (fastify) => {
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

  fastify.get("/receipt-templates", {
    schema: { tags: ["receipt-templates"], summary: "List receipt templates" },
  }, async (_request, reply) => {
    const rows = await fastify.ctx.db.select().from(receiptTemplates);
    return reply.send(rows);
  });

  fastify.get("/receipt-templates/active", {
    schema: { tags: ["receipt-templates"], summary: "Get the active receipt template" },
  }, async (_request, reply) => {
    const [row] = await fastify.ctx.db
      .select()
      .from(receiptTemplates)
      .where(eq(receiptTemplates.active, true));
    if (!row) return reply.status(404).send({ error: "No active template" });
    return reply.send(row);
  });

  fastify.post("/receipt-templates", {
    schema: { tags: ["receipt-templates"], summary: "Create a receipt template" },
  }, async (request, reply) => {
    const body = request.body as {
      name: string;
      headerText?: string;
      footerText?: string;
      showLogo?: boolean;
      showOrderNumber?: boolean;
      showTimestamp?: boolean;
      showPaymentMethod?: boolean;
      showItemCategory?: boolean;
      active?: boolean;
      printMode?: "text" | "image";
      canvasWidth?: number;
      blocks?: ReceiptBlock[];
      printMethod?: string;
      role?: string;
    };
    const [row] = await fastify.ctx.db.insert(receiptTemplates).values({
      name:              body.name,
      headerText:        body.headerText ?? null,
      footerText:        body.footerText ?? null,
      showLogo:          body.showLogo ?? false,
      showOrderNumber:   body.showOrderNumber ?? true,
      showTimestamp:     body.showTimestamp ?? true,
      showPaymentMethod: body.showPaymentMethod ?? true,
      showItemCategory:  body.showItemCategory ?? false,
      active:            body.active ?? false,
      printMode:         body.printMode ?? "text",
      canvasWidth:       body.canvasWidth ?? 576,
      blocks:            body.blocks ? JSON.stringify(body.blocks) : null,
      logoPath:          null,
      printMethod:       body.printMethod ?? "single",
      role:              body.role ?? "master",
    }).returning();
    return reply.status(201).send(row);
  });

  fastify.patch("/receipt-templates/:id", {
    schema: { tags: ["receipt-templates"], summary: "Update a receipt template" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    const body = request.body as Partial<{
      name: string;
      headerText: string | null;
      footerText: string | null;
      showLogo: boolean;
      showOrderNumber: boolean;
      showTimestamp: boolean;
      showPaymentMethod: boolean;
      showItemCategory: boolean;
      active: boolean;
      printMode: "text" | "image";
      canvasWidth: number;
      blocks: ReceiptBlock[] | null;
      printMethod: string;
      role: string;
    }>;

    const [existing] = await fastify.ctx.db.select().from(receiptTemplates).where(eq(receiptTemplates.id, numId));
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const update: {
      name?: string;
      headerText?: string | null;
      footerText?: string | null;
      showLogo?: boolean;
      showOrderNumber?: boolean;
      showTimestamp?: boolean;
      showPaymentMethod?: boolean;
      showItemCategory?: boolean;
      active?: boolean;
      printMode?: string;
      canvasWidth?: number;
      blocks?: string | null;
      printMethod?: string;
      role?: string;
    } = {};
    if (body.name !== undefined) update.name = body.name;
    if ("headerText" in body) update.headerText = body.headerText ?? null;
    if ("footerText" in body) update.footerText = body.footerText ?? null;
    if (body.showLogo !== undefined) update.showLogo = body.showLogo;
    if (body.showOrderNumber !== undefined) update.showOrderNumber = body.showOrderNumber;
    if (body.showTimestamp !== undefined) update.showTimestamp = body.showTimestamp;
    if (body.showPaymentMethod !== undefined) update.showPaymentMethod = body.showPaymentMethod;
    if (body.showItemCategory !== undefined) update.showItemCategory = body.showItemCategory;
    if (body.active !== undefined) update.active = body.active;
    if (body.printMode !== undefined) update.printMode = body.printMode;
    if (body.canvasWidth !== undefined) update.canvasWidth = body.canvasWidth;
    if ("blocks" in body) update.blocks = body.blocks ? JSON.stringify(body.blocks) : null;
    if (body.printMethod !== undefined) update.printMethod = body.printMethod;
    if (body.role !== undefined) update.role = body.role;

    if (Object.keys(update).length > 0) {
      await fastify.ctx.db.update(receiptTemplates).set(update).where(eq(receiptTemplates.id, numId));
    }
    const [row] = await fastify.ctx.db.select().from(receiptTemplates).where(eq(receiptTemplates.id, numId));
    return reply.send(row);
  });

  // --- Preview (POST so the frontend sends current blocks without saving first) ---
  fastify.post("/receipt-templates/preview", async (request, reply) => {
    const body = request.body as { blocks: ReceiptBlock[]; canvasWidth: number; showItemCategory?: boolean };

    const restRows = await fastify.ctx.db.select().from(appSettings).where(inArray(appSettings.key, [...RESTAURANT_KEYS]));
    const rMap = Object.fromEntries(restRows.map((r) => [r.key, r.value]));

    const rawLogo = rMap["restaurant_logo_path"];
    const absLogo = rawLogo ? resolve(join(fastify.ctx.config.dataDir, rawLogo)) : null;
    const logoPath = (absLogo && existsSync(absLogo)) ? absLogo : null;

    const pngBuffer = await renderReceiptImage({
      blocks: body.blocks,
      canvasWidth: body.canvasWidth ?? 576,
      logoPath,
      orderId: 1,
      items: [
        { name: "Esempio prodotto 1", quantity: 2, unitPrice: 5.50, category: "Bevande" },
        { name: "Esempio prodotto 2", quantity: 1, unitPrice: 12.00, category: "Primi Piatti" },
      ],
      showItemCategory: body.showItemCategory ?? false,
      total: 23.00,
      paymentMethod: "Contanti",
      currency: "EUR",
      paidAt: new Date(),
      restaurantName: rMap["restaurant_name"] ?? "Il Mio Ristorante",
      restaurantAddress: rMap["restaurant_address"] ?? "Via Roma 1",
      restaurantCity: rMap["restaurant_city"] ?? "Milano",
      restaurantVat: rMap["restaurant_vat"] ?? "IT12345678901",
      restaurantPhone: rMap["restaurant_phone"] ?? "+39 02 1234567",
      terminalName: "Cassa 1",
      tableId: "12",
      customerName: "Mario Rossi",
    });

    return reply.type("image/png").send(pngBuffer);
  });

  // --- Font list ---
  fastify.get("/admin/fonts", async (_request, reply) => {
    const FONTS_DIR = `${fastify.ctx.config.dataDir}/fonts`;
    const fonts: string[] = [];
    const dirs = [BUNDLED_FONTS_DIR, FONTS_DIR].filter(existsSync);
    for (const dir of dirs) {
      for (const file of readdirSync(dir).filter((f) => f.endsWith(".ttf"))) {
        const name = file.replace(".ttf", "");
        if (!fonts.includes(name)) fonts.push(name);
      }
    }
    return reply.send(fonts);
  });

  // --- Font upload ---
  fastify.post("/admin/fonts", async (request, reply) => {
    const FONTS_DIR = `${fastify.ctx.config.dataDir}/fonts`;
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: "No file" });
    if (!data.filename.endsWith(".ttf")) return reply.status(400).send({ error: "Only .ttf files allowed" });

    const safeName = data.filename.replace(/[^a-zA-Z0-9_.-]/g, "_");
    ensureDir(FONTS_DIR);
    const destPath = join(FONTS_DIR, safeName);
    const chunks: Buffer[] = [];
    for await (const chunk of data.file) chunks.push(chunk as Buffer);
    await writeFile(destPath, Buffer.concat(chunks));

    return reply.status(201).send({ name: safeName.replace(".ttf", "") });
  });

  // --- Font delete ---
  fastify.delete("/admin/fonts/:name", async (request, reply) => {
    const FONTS_DIR = `${fastify.ctx.config.dataDir}/fonts`;
    const { name } = request.params as { name: string };
    const filePath = join(FONTS_DIR, `${name}.ttf`);
    if (!existsSync(filePath)) return reply.status(404).send({ error: "Font not found" });
    try { unlinkSync(filePath); } catch { /* ok */ }
    return reply.status(204).send();
  });
};

export default receiptTemplatesRoutes;
