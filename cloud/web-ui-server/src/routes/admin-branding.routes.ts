import type { FastifyPluginAsync } from "fastify";
import { existsSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { eq } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import { tenants } from "../db/client.js";
import { requireAuth, requireTenantRole, writeAuditLog } from "../auth/authorize.js";

const MIME_TO_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
};
const IMAGE_EXTS = [".png", ".jpg", ".webp"];

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color like #306B34");
const brandingBodySchema = z.object({
  colorBrand: hexColor.optional(),
  colorAccent: hexColor.optional(),
});

const adminBrandingRoutes: FastifyPluginAsync<{ db: DbClient; dataDir: string }> = async (fastify, opts) => {
  const { db, dataDir } = opts;

  fastify.addHook("onRequest", requireAuth(db));

  fastify.post(
    "/admin/tenants/:id/logo",
    { onRequest: [requireTenantRole(db, "owner")] },
    async (request, reply) => {
      const { id: tenantId } = request.params as { id: string };
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      if (!tenant) return reply.status(404).send({ error: "Tenant not found" });

      const data = await request.file();
      if (!data) return reply.status(400).send({ error: "No file uploaded" });

      const ext = MIME_TO_EXT[data.mimetype];
      if (!ext) return reply.status(400).send({ error: "Only PNG/JPG/WEBP allowed" });

      const imagesDir = resolve(dataDir, "images/tenants");
      const safeFilename = `${tenantId}${ext}`;
      const relPath = `images/tenants/${safeFilename}`;
      const absPath = join(imagesDir, safeFilename);

      for (const oldExt of IMAGE_EXTS) {
        const old = join(imagesDir, `${tenantId}${oldExt}`);
        if (old !== absPath && existsSync(old)) {
          try { unlinkSync(old); } catch { /* ok */ }
        }
      }

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) chunks.push(chunk as Buffer);
      await writeFile(absPath, Buffer.concat(chunks));

      await db.update(tenants).set({ logoPath: relPath }).where(eq(tenants.id, tenantId));
      await writeAuditLog(db, {
        userId: request.currentUser!.id,
        tenantId,
        action: "tenant.logo_upload",
        metadata: { logoPath: relPath },
      });

      return reply.send({ logoPath: relPath });
    },
  );

  fastify.delete(
    "/admin/tenants/:id/logo",
    { onRequest: [requireTenantRole(db, "owner")] },
    async (request, reply) => {
      const { id: tenantId } = request.params as { id: string };
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      if (!tenant) return reply.status(404).send({ error: "Tenant not found" });

      if (tenant.logoPath) {
        const absPath = resolve(join(dataDir, tenant.logoPath));
        if (existsSync(absPath)) {
          try { unlinkSync(absPath); } catch { /* ok */ }
        }
      }

      await db.update(tenants).set({ logoPath: null }).where(eq(tenants.id, tenantId));
      await writeAuditLog(db, {
        userId: request.currentUser!.id,
        tenantId,
        action: "tenant.logo_delete",
      });

      return reply.status(204).send();
    },
  );

  fastify.patch(
    "/admin/tenants/:id/branding",
    { onRequest: [requireTenantRole(db, "owner")] },
    async (request, reply) => {
      const { id: tenantId } = request.params as { id: string };
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      if (!tenant) return reply.status(404).send({ error: "Tenant not found" });

      const parsed = brandingBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      }

      const update: { colorBrand?: string; colorAccent?: string } = {};
      if (parsed.data.colorBrand !== undefined) update.colorBrand = parsed.data.colorBrand;
      if (parsed.data.colorAccent !== undefined) update.colorAccent = parsed.data.colorAccent;

      if (Object.keys(update).length > 0) {
        await db.update(tenants).set(update).where(eq(tenants.id, tenantId));
        await writeAuditLog(db, {
          userId: request.currentUser!.id,
          tenantId,
          action: "tenant.branding_update",
          metadata: update,
        });
      }

      const [updated] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      return reply.send({ colorBrand: updated!.colorBrand, colorAccent: updated!.colorAccent });
    },
  );
};

export default adminBrandingRoutes;
