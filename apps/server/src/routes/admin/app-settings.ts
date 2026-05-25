import "@fastify/swagger";
import type { FastifyPluginAsync } from "fastify";
import { eq, inArray, appSettings, receiptCounters } from "@pos/db";
import { requireRole, AuthError } from "@pos/core";

const RECEIPT_NUM_KEYS = ["receipt_number_mode", "receipt_number_prefix", "receipt_number_padding"] as const;
const GRID_KEYS = ["grid_view_mode", "grid_show_price", "grid_show_description", "grid_sort_by", "grid_base_cols"] as const;

const appSettingsRoutes: FastifyPluginAsync = async (fastify) => {
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

  // GET /admin/settings
  fastify.get("/admin/settings", {
    schema: { tags: ["admin"], summary: "Get app settings" },
  }, async (_request, reply) => {
    const db = fastify.ctx.db;
    const keys = ["express_mode", ...RECEIPT_NUM_KEYS, ...GRID_KEYS];
    const rows = await db.select().from(appSettings).where(inArray(appSettings.key, keys));
    const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    return reply.send({
      expressMode: m["express_mode"] === "true",
      receiptNumberMode: (m["receipt_number_mode"] ?? "default") as "default" | "global" | "shift",
      receiptNumberPrefix: m["receipt_number_prefix"] ?? "",
      receiptNumberPadding: parseInt(m["receipt_number_padding"] ?? "0", 10),
      gridViewMode: (m["grid_view_mode"] ?? "category") as "category" | "all" | "grouped_category" | "grouped_center" | "grouped_color",
      gridShowPrice: m["grid_show_price"] !== "false",
      gridShowDescription: m["grid_show_description"] !== "false",
      gridSortBy: (m["grid_sort_by"] ?? "custom") as "custom" | "name" | "price" | "color" | "category",
      gridBaseCols: parseInt(m["grid_base_cols"] ?? "5", 10),
    });
  });

  // PATCH /admin/settings
  fastify.patch("/admin/settings", {
    schema: { tags: ["admin"], summary: "Update app settings" },
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

    for (const { key, value } of upserts) {
      await db.update(appSettings).set({ value }).where(eq(appSettings.key, key));
    }

    // Re-read and return current state
    const keys = ["express_mode", ...RECEIPT_NUM_KEYS, ...GRID_KEYS];
    const rows = await db.select().from(appSettings).where(inArray(appSettings.key, keys));
    const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    return reply.send({
      expressMode: m["express_mode"] === "true",
      receiptNumberMode: (m["receipt_number_mode"] ?? "default") as "default" | "global" | "shift",
      receiptNumberPrefix: m["receipt_number_prefix"] ?? "",
      receiptNumberPadding: parseInt(m["receipt_number_padding"] ?? "0", 10),
      gridViewMode: (m["grid_view_mode"] ?? "category") as "category" | "all" | "grouped_category" | "grouped_center" | "grouped_color",
      gridShowPrice: m["grid_show_price"] !== "false",
      gridShowDescription: m["grid_show_description"] !== "false",
      gridSortBy: (m["grid_sort_by"] ?? "custom") as "custom" | "name" | "price" | "color" | "category",
      gridBaseCols: parseInt(m["grid_base_cols"] ?? "5", 10),
    });
  });

  // POST /admin/settings/reset-receipt-counter
  fastify.post("/admin/settings/reset-receipt-counter", {
    schema: { tags: ["admin"], summary: "Reset receipt counter to 0 (or custom start value)" },
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
