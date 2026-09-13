import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import { tenants } from "../db/client.js";
import { requireAuth, requireTenantRole, writeAuditLog } from "../auth/authorize.js";

const settingsBodySchema = z.object({
  requireTableId: z.boolean().optional(),
  requireCustomerName: z.boolean().optional(),
});

const adminSettingsRoutes: FastifyPluginAsync<{ db: DbClient }> = async (fastify, opts) => {
  const { db } = opts;

  fastify.addHook("onRequest", requireAuth(db));

  fastify.patch(
    "/admin/tenants/:id/settings",
    { onRequest: [requireTenantRole(db, "owner")] },
    async (request, reply) => {
      const { id: tenantId } = request.params as { id: string };
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      if (!tenant) return reply.status(404).send({ error: "Tenant not found" });

      const parsed = settingsBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      }

      const update: { requireTableId?: boolean; requireCustomerName?: boolean } = {};
      if (parsed.data.requireTableId !== undefined) update.requireTableId = parsed.data.requireTableId;
      if (parsed.data.requireCustomerName !== undefined) update.requireCustomerName = parsed.data.requireCustomerName;

      if (Object.keys(update).length > 0) {
        await db.update(tenants).set(update).where(eq(tenants.id, tenantId));
        await writeAuditLog(db, {
          userId: request.currentUser!.id,
          tenantId,
          action: "tenant.settings_update",
          metadata: update,
        });
      }

      const [updated] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      return reply.send({
        requireTableId: updated!.requireTableId,
        requireCustomerName: updated!.requireCustomerName,
      });
    },
  );
};

export default adminSettingsRoutes;
