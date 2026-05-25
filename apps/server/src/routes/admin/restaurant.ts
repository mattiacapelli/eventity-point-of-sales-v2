import "@fastify/swagger";
import type { FastifyPluginAsync } from "fastify";
import { inArray, eq, appSettings } from "@pos/db";
import { requireRole, AuthError } from "@pos/core";
import { mkdirSync, unlinkSync, existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const logosDir = (dataDir: string) => `${dataDir}/logos/restaurant`;

function ensureDir(dir: string): void {
  try { mkdirSync(dir, { recursive: true }); } catch { /* already exists */ }
}

const RESTAURANT_KEYS = [
  "restaurant_name",
  "restaurant_address",
  "restaurant_city",
  "restaurant_vat",
  "restaurant_phone",
  "restaurant_website",
] as const;

type RestaurantKey = typeof RESTAURANT_KEYS[number];

export interface RestaurantInfo {
  name: string;
  address: string;
  city: string;
  vat: string;
  phone: string;
  website: string;
  logoPath: string | null;
}

const restaurantRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request, reply) => {
    await fastify.authenticate(request);
    try {
      requireRole(request.session!, "admin");
    } catch (err) {
      if (err instanceof AuthError) return reply.status(403).send({ error: err.message });
      throw err;
    }
  });

  // GET /admin/restaurant
  fastify.get("/admin/restaurant", {
    schema: { tags: ["admin"], summary: "Get restaurant info" },
  }, async (_request, reply) => {
    const db = fastify.ctx.db;
    const allKeys = [...RESTAURANT_KEYS, "restaurant_logo_path"];
    const rows = await db.select().from(appSettings).where(inArray(appSettings.key, allKeys));
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const info: RestaurantInfo = {
      name:     map["restaurant_name"]    ?? "",
      address:  map["restaurant_address"] ?? "",
      city:     map["restaurant_city"]    ?? "",
      vat:      map["restaurant_vat"]     ?? "",
      phone:    map["restaurant_phone"]   ?? "",
      website:  map["restaurant_website"] ?? "",
      logoPath: map["restaurant_logo_path"] || null,
    };
    return reply.send(info);
  });

  // PATCH /admin/restaurant
  fastify.patch("/admin/restaurant", {
    schema: {
      tags: ["admin"],
      summary: "Update restaurant info",
      body: {
        type: "object",
        properties: {
          name:    { type: "string" },
          address: { type: "string" },
          city:    { type: "string" },
          vat:     { type: "string" },
          phone:   { type: "string" },
          website: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    const body = request.body as Partial<RestaurantInfo>;
    const db = fastify.ctx.db;

    const fieldToKey: Record<keyof Omit<RestaurantInfo, "logoPath">, RestaurantKey> = {
      name:    "restaurant_name",
      address: "restaurant_address",
      city:    "restaurant_city",
      vat:     "restaurant_vat",
      phone:   "restaurant_phone",
      website: "restaurant_website",
    };

    for (const [field, key] of Object.entries(fieldToKey) as [keyof RestaurantInfo, RestaurantKey][]) {
      if (body[field] !== undefined) {
        await db
          .insert(appSettings)
          .values({ key, value: body[field]! })
          .onConflictDoUpdate({ target: appSettings.key, set: { value: body[field]! } });
      }
    }

    const allKeys = [...RESTAURANT_KEYS, "restaurant_logo_path"];
    const rows = await db.select().from(appSettings).where(inArray(appSettings.key, allKeys));
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return reply.send({
      name:     map["restaurant_name"]    ?? "",
      address:  map["restaurant_address"] ?? "",
      city:     map["restaurant_city"]    ?? "",
      vat:      map["restaurant_vat"]     ?? "",
      phone:    map["restaurant_phone"]   ?? "",
      website:  map["restaurant_website"] ?? "",
      logoPath: map["restaurant_logo_path"] || null,
    });
  });

  // POST /admin/restaurant/logo
  fastify.post("/admin/restaurant/logo", {
    schema: { tags: ["admin"], summary: "Upload restaurant logo" },
  }, async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: "No file uploaded" });

    const allowed = ["image/png", "image/jpeg", "image/jpg"];
    if (!allowed.includes(data.mimetype)) {
      return reply.status(400).send({ error: "Only PNG/JPG allowed" });
    }

    const absDir = resolve(logosDir(fastify.ctx.config.dataDir));
    ensureDir(absDir);
    const ext = data.filename.split(".").pop() ?? "png";
    const relPath = `logos/restaurant/logo.${ext}`;
    const absPath = join(absDir, `logo.${ext}`);
    const chunks: Buffer[] = [];
    for await (const chunk of data.file) chunks.push(chunk as Buffer);
    await writeFile(absPath, Buffer.concat(chunks));

    const db = fastify.ctx.db;
    await db
      .insert(appSettings)
      .values({ key: "restaurant_logo_path", value: relPath })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: relPath } });

    return reply.send({ logoPath: relPath });
  });

  // DELETE /admin/restaurant/logo
  fastify.delete("/admin/restaurant/logo", {
    schema: { tags: ["admin"], summary: "Delete restaurant logo" },
  }, async (_request, reply) => {
    const db = fastify.ctx.db;
    const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, "restaurant_logo_path"));
    if (row?.value) {
      const absPath = resolve(join(fastify.ctx.config.dataDir, row.value));
      if (existsSync(absPath)) { try { unlinkSync(absPath); } catch { /* ok */ } }
    }
    await db
      .insert(appSettings)
      .values({ key: "restaurant_logo_path", value: "" })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: "" } });
    return reply.status(204).send();
  });
};

export default restaurantRoutes;
