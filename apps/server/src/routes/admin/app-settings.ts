import "@fastify/swagger";
import type { FastifyPluginAsync } from "fastify";
import { eq, inArray, appSettings, receiptCounters } from "@pos/db";
import { requireRole, AuthError } from "@pos/core";

const RECEIPT_NUM_KEYS = ["receipt_number_mode", "receipt_number_prefix", "receipt_number_padding"] as const;
const GRID_KEYS = ["grid_view_mode", "grid_show_price", "grid_show_description", "grid_sort_by", "grid_base_cols", "grid_show_category", "grid_show_image", "grid_card_text_size", "grid_card_row_height"] as const;
const TERMINAL_KEYS = ["multi_terminal_enabled"] as const;
const MODULE_KEYS = ["tables_enabled"] as const;
const CART_KEYS = ["cart_notes_enabled", "cart_pax_enabled", "cart_discount_enabled", "cart_text_size"] as const;

const appSettingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request) => {
    await fastify.authenticate(request);
  });

  // GET /admin/settings — readable by any authenticated user (needed e.g. to know if multi-terminal is on)
  fastify.get("/admin/settings", {
    schema: { tags: ["admin"], summary: "Get app settings" },
  }, async (_request, reply) => {
    const db = fastify.ctx.db;
    const keys = ["express_mode", ...RECEIPT_NUM_KEYS, ...GRID_KEYS, ...TERMINAL_KEYS, ...CART_KEYS, ...MODULE_KEYS];
    const rows = await db.select().from(appSettings).where(inArray(appSettings.key, keys));
    const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    return reply.send({
      expressMode: m["express_mode"] === "true",
      receiptNumberMode: (m["receipt_number_mode"] ?? "shift") as "default" | "global" | "shift",
      receiptNumberPrefix: m["receipt_number_prefix"] ?? "",
      receiptNumberPadding: parseInt(m["receipt_number_padding"] ?? "0", 10),
      gridViewMode: (m["grid_view_mode"] ?? "category") as "category" | "all" | "grouped_category" | "grouped_center" | "grouped_color",
      gridShowPrice: m["grid_show_price"] !== "false",
      gridShowDescription: m["grid_show_description"] !== "false",
      gridSortBy: (m["grid_sort_by"] ?? "custom") as "custom" | "name" | "price" | "color" | "category",
      gridBaseCols: parseInt(m["grid_base_cols"] ?? "5", 10),
      gridShowCategory: m["grid_show_category"] === "true",
      gridShowImage: m["grid_show_image"] !== "false",
      gridCardTextSize: parseInt(m["grid_card_text_size"] ?? "14", 10),
      gridCardRowHeight: parseInt(m["grid_card_row_height"] ?? "120", 10),
      multiTerminalEnabled: m["multi_terminal_enabled"] === "true",
      cartNotesEnabled: m["cart_notes_enabled"] !== "false",
      cartPaxEnabled: m["cart_pax_enabled"] !== "false",
      cartDiscountEnabled: m["cart_discount_enabled"] !== "false",
      cartTextSize: parseInt(m["cart_text_size"] ?? "14", 10),
      tablesEnabled: m["tables_enabled"] === "true",
    });
  });

  // PATCH /admin/settings
  fastify.patch("/admin/settings", {
    schema: { tags: ["admin"], summary: "Update app settings" },
    preHandler: async (request, reply) => {
      try {
        requireRole(request.session!, "admin");
      } catch (err) {
        if (err instanceof AuthError) return reply.status(403).send({ error: err.message });
        throw err;
      }
    },
  }, async (request, reply) => {
    const body = request.body as Partial<{
      expressMode: boolean;
      receiptNumberMode: "default" | "global" | "shift";
      receiptNumberPrefix: string;
      receiptNumberPadding: number;
      gridViewMode: "category" | "all" | "grouped_category" | "grouped_center" | "grouped_color";
      gridShowPrice: boolean;
      gridShowDescription: boolean;
      gridSortBy: "custom" | "name" | "price" | "color" | "category";
      gridBaseCols: number;
      gridShowCategory: boolean;
      gridShowImage: boolean;
      gridCardTextSize: number;
      gridCardRowHeight: number;
      multiTerminalEnabled: boolean;
      cartNotesEnabled: boolean;
      cartPaxEnabled: boolean;
      cartDiscountEnabled: boolean;
      cartTextSize: number;
      tablesEnabled: boolean;
    }>;
    const db = fastify.ctx.db;

    const upserts: { key: string; value: string }[] = [];
    if (body.expressMode !== undefined) upserts.push({ key: "express_mode", value: String(body.expressMode) });
    if (body.receiptNumberMode !== undefined) upserts.push({ key: "receipt_number_mode", value: body.receiptNumberMode });
    if (body.receiptNumberPrefix !== undefined) upserts.push({ key: "receipt_number_prefix", value: body.receiptNumberPrefix });
    if (body.receiptNumberPadding !== undefined) upserts.push({ key: "receipt_number_padding", value: String(body.receiptNumberPadding) });
    if (body.gridViewMode !== undefined) upserts.push({ key: "grid_view_mode", value: body.gridViewMode });
    if (body.gridShowPrice !== undefined) upserts.push({ key: "grid_show_price", value: String(body.gridShowPrice) });
    if (body.gridShowDescription !== undefined) upserts.push({ key: "grid_show_description", value: String(body.gridShowDescription) });
    if (body.gridSortBy !== undefined) upserts.push({ key: "grid_sort_by", value: body.gridSortBy });
    if (body.gridBaseCols !== undefined) upserts.push({ key: "grid_base_cols", value: String(body.gridBaseCols) });
    if (body.gridShowCategory !== undefined) upserts.push({ key: "grid_show_category", value: String(body.gridShowCategory) });
    if (body.gridShowImage !== undefined) upserts.push({ key: "grid_show_image", value: String(body.gridShowImage) });
    if (body.gridCardTextSize !== undefined) upserts.push({ key: "grid_card_text_size", value: String(body.gridCardTextSize) });
    if (body.gridCardRowHeight !== undefined) upserts.push({ key: "grid_card_row_height", value: String(body.gridCardRowHeight) });
    if (body.multiTerminalEnabled !== undefined) upserts.push({ key: "multi_terminal_enabled", value: String(body.multiTerminalEnabled) });
    if (body.cartNotesEnabled !== undefined) upserts.push({ key: "cart_notes_enabled", value: String(body.cartNotesEnabled) });
    if (body.cartPaxEnabled !== undefined) upserts.push({ key: "cart_pax_enabled", value: String(body.cartPaxEnabled) });
    if (body.cartDiscountEnabled !== undefined) upserts.push({ key: "cart_discount_enabled", value: String(body.cartDiscountEnabled) });
    if (body.cartTextSize !== undefined) upserts.push({ key: "cart_text_size", value: String(body.cartTextSize) });
    if (body.tablesEnabled !== undefined) upserts.push({ key: "tables_enabled", value: String(body.tablesEnabled) });

    for (const { key, value } of upserts) {
      await db.insert(appSettings).values({ key, value }).onConflictDoUpdate({ target: appSettings.key, set: { value } });
    }

    // Re-read and return current state
    const keys = ["express_mode", ...RECEIPT_NUM_KEYS, ...GRID_KEYS, ...TERMINAL_KEYS, ...CART_KEYS, ...MODULE_KEYS];
    const rows = await db.select().from(appSettings).where(inArray(appSettings.key, keys));
    const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    return reply.send({
      expressMode: m["express_mode"] === "true",
      receiptNumberMode: (m["receipt_number_mode"] ?? "shift") as "default" | "global" | "shift",
      receiptNumberPrefix: m["receipt_number_prefix"] ?? "",
      receiptNumberPadding: parseInt(m["receipt_number_padding"] ?? "0", 10),
      gridViewMode: (m["grid_view_mode"] ?? "category") as "category" | "all" | "grouped_category" | "grouped_center" | "grouped_color",
      gridShowPrice: m["grid_show_price"] !== "false",
      gridShowDescription: m["grid_show_description"] !== "false",
      gridSortBy: (m["grid_sort_by"] ?? "custom") as "custom" | "name" | "price" | "color" | "category",
      gridBaseCols: parseInt(m["grid_base_cols"] ?? "5", 10),
      gridShowCategory: m["grid_show_category"] === "true",
      gridShowImage: m["grid_show_image"] !== "false",
      gridCardTextSize: parseInt(m["grid_card_text_size"] ?? "14", 10),
      gridCardRowHeight: parseInt(m["grid_card_row_height"] ?? "120", 10),
      multiTerminalEnabled: m["multi_terminal_enabled"] === "true",
      cartNotesEnabled: m["cart_notes_enabled"] !== "false",
      cartPaxEnabled: m["cart_pax_enabled"] !== "false",
      cartDiscountEnabled: m["cart_discount_enabled"] !== "false",
      cartTextSize: parseInt(m["cart_text_size"] ?? "14", 10),
      tablesEnabled: m["tables_enabled"] === "true",
    });
  });

  // GET /admin/settings/raw?keys=key1,key2 — raw key/value access for misc settings (may include sensitive config)
  fastify.get("/admin/settings/raw", {
    schema: { tags: ["admin"], summary: "Get raw app_settings values by key list" },
    preHandler: async (request, reply) => {
      try {
        requireRole(request.session!, "admin");
      } catch (err) {
        if (err instanceof AuthError) return reply.status(403).send({ error: err.message });
        throw err;
      }
    },
  }, async (request, reply) => {
    const { keys: keysParam } = request.query as { keys?: string };
    if (!keysParam) return reply.send({});
    const keys = keysParam.split(",").map((k) => k.trim()).filter(Boolean);
    const rows = await fastify.ctx.db.select().from(appSettings).where(inArray(appSettings.key, keys));
    return reply.send(Object.fromEntries(rows.map((r) => [r.key, r.value])));
  });

  // PUT /admin/settings/raw/:key — upsert a single raw key
  fastify.put("/admin/settings/raw/:key", {
    schema: { tags: ["admin"], summary: "Upsert a single raw app_settings value" },
    preHandler: async (request, reply) => {
      try {
        requireRole(request.session!, "admin");
      } catch (err) {
        if (err instanceof AuthError) return reply.status(403).send({ error: err.message });
        throw err;
      }
    },
  }, async (request, reply) => {
    const { key } = request.params as { key: string };
    const { value } = request.body as { value: string };
    if (typeof value !== "string") return reply.status(400).send({ error: "value must be a string" });
    await fastify.ctx.db.insert(appSettings).values({ key, value })
      .onConflictDoUpdate({ target: appSettings.key, set: { value } });
    return reply.send({ key, value });
  });

  // POST /admin/settings/reset-receipt-counter
  fastify.post("/admin/settings/reset-receipt-counter", {
    schema: { tags: ["admin"], summary: "Reset receipt counter to 0 (or custom start value)" },
    preHandler: async (request, reply) => {
      try {
        requireRole(request.session!, "admin");
      } catch (err) {
        if (err instanceof AuthError) return reply.status(403).send({ error: err.message });
        throw err;
      }
    },
  }, async (request, reply) => {
    const body = request.body as { scope?: string; startFrom?: number } | undefined;
    const scope = (body as { scope?: string } | undefined)?.scope ?? "global";
    const startFrom = (body as { startFrom?: number } | undefined)?.startFrom ?? 0;

    await fastify.ctx.db
      .update(receiptCounters)
      .set({ lastValue: startFrom })
      .where(eq(receiptCounters.scope, scope));

    return reply.send({ scope, lastValue: startFrom });
  });
};

export default appSettingsRoutes;
